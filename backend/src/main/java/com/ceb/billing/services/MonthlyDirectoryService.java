package com.ceb.billing.services;

import com.ceb.billing.entities.BillingUploadStaging;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.ImportSession;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.BillingUploadStagingRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.ImportSessionRepository;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.entities.UploadHistory;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Archive/save workflow that runs AFTER a Step 6 (Master Data Comparison) import is approved.
 *
 * It captures the fully approved final dataset (already enriched and held in the import service's
 * main-dataset cache) into a permanent, per-month {@link MonthlyDirectorySnapshot}. Each approved
 * month is stored as a separate row and is never overwritten.
 *
 * This service is purely additive: it only reads the approved dataset and never modifies any
 * validation, merge, comparison, duplicate handling or approval logic.
 */
@Service
@SuppressWarnings({"null", "unchecked"})
public class MonthlyDirectoryService {

    @Autowired
    private MonthlyDirectorySnapshotRepository snapshotRepository;

    @Autowired
    private ImportSessionRepository sessionRepository;

    @Autowired
    private MultiFileImportService multiFileImportService;

    @Autowired
    private CustomerDirectorySyncService customerDirectorySyncService;

    @Autowired
    private BillingUploadStagingRepository stagingRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** The 5 fixed Eastern Province divisions every Billing Month is organized into. */
    public static final List<String> DIVISIONS =
            List.of("Ampara", "Batticaloa", "Trincomalee", "Valaichenai", "Kalmunai");

    // Curated, human-readable column set for the archived dataset / Excel export.
    private static final String[][] EXPORT_COLUMNS = {
            {"accountNo", "Account No"},
            {"npayName", "Name"},
            {"customerAddress", "Address"},
            {"refNo", "Ref No"},
            {"mobileNo", "Mobile No"},
            {"solarType", "Solar Type"},
            {"tariffType", "Tariff Type"},
            {"panelCapacity", "Panel Capacity"},
            {"prevReadingDate", "Prev Reading"},
            {"currReadingDate", "Curr Reading"},
            {"ngenNetType", "Net Type"},
            {"kwhImport", "kWh Import"},
            {"kwhExport", "kWh Export"},
            {"kwhSales", "kWh Sales"},
            {"ngenUnitRate", "Unit Rate"},
            {"energyPurchase", "Energy Purchase"},
            {"billSetOff", "Bill Set Off"},
            {"retentionMoney", "Retention Money"},
            {"payment", "Payment"},
            {"outstandingBalance", "Outstanding"},
            {"status", "Status"}
    };

    /**
     * Builds and persists a new monthly snapshot from the approved main-dataset cache. Captures the
     * COMPLETE Step 6 dataset exactly as displayed — including master-only rows, error/warning/
     * duplicate/mismatch records and every merged field — with any Step 6 corrections overlaid
     * (only rows the user explicitly deleted in Step 6 are skipped, as they are no longer shown).
     * Validation results are carried over as-is and never recalculated. Rows changed in Step 6 are
     * flagged {@code step6Corrected} and logged in the snapshot's audit history so corrections stay
     * visible in the directory. Records are stored sorted by Account No ascending.
     */
    @Transactional
    public Map<String, Object> createSnapshot(Long sessionId, String username, String datasetName,
                                              String billingMonth, String division, String validationSummaryJson,
                                              Map<String, Map<String, Object>> corrections,
                                              boolean isAdmin) throws Exception {
        List<Map<String, Object>> mainDataset = multiFileImportService.getMainDataset(sessionId);
        if (mainDataset == null || mainDataset.isEmpty()) {
            throw new IllegalStateException("No approved dataset found for this session. Approve Step 6 before saving the directory.");
        }

        // Resolve the Month + Division slot: request params first, then the values the import
        // session was bound to when the upload started from the Customer Directory.
        String month = billingMonth != null ? billingMonth.trim() : "";
        String div = division != null ? division.trim() : "";
        ImportSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session != null) {
            if (month.isEmpty() && session.getBillingMonth() != null) month = session.getBillingMonth().trim();
            if (div.isEmpty() && session.getDivision() != null) div = session.getDivision().trim();
        }
        div = canonicalDivision(div);

        List<Map<String, Object>> finalData = new ArrayList<>();
        Map<Map<String, Object>, Object[]> correctionInfo = new IdentityHashMap<>(); // finalRow -> {corr, statusBefore}
        for (Map<String, Object> row : mainDataset) {
            String accountNo = row.get("accountNo") != null ? String.valueOf(row.get("accountNo")) : null;
            String rowNumStr = String.valueOf(row.get("rowNum"));

            Map<String, Object> corr = null;
            if (corrections != null) {
                if (corrections.containsKey(rowNumStr)) corr = corrections.get(rowNumStr);
                else if (accountNo != null && corrections.containsKey(accountNo)) corr = corrections.get(accountNo);
            }
            if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                continue;
            }

            Map<String, Object> finalRow = new LinkedHashMap<>(row);
            if (corr != null) {
                finalRow.putAll(corr);
                finalRow.put("step6Corrected", true);
                correctionInfo.put(finalRow, new Object[]{corr, strVal(row.get("status"))});
            }
            finalData.add(finalRow);
        }

        // Directory display order: Account No ascending (numeric-aware).
        finalData.sort(Comparator.comparing(r -> accountSortKey(r.get("accountNo"))));

        String name = datasetName != null ? datasetName.trim() : "";
        if (name.isEmpty()) {
            name = defaultName(month, div);
        }

        // Each Month + Division slot holds exactly one dataset: re-uploading a division replaces
        // its previous snapshot, while every other month/division stays untouched.
        if (!month.isEmpty() && !div.isEmpty()) {
            snapshotRepository.deleteAll(
                    snapshotRepository.findByBillingMonthIgnoreCaseAndDivisionIgnoreCase(month, div));
        }

        MonthlyDirectorySnapshot snap = new MonthlyDirectorySnapshot();
        snap.setDatasetName(name);
        snap.setBillingMonth(!month.isEmpty() ? month : null);
        snap.setDivision(!div.isEmpty() ? div : null);
        snap.setApprovedBy(username);
        snap.setTotalRecords(finalData.size());
        snap.setStatus(isAdmin ? "APPROVED" : "PENDING_APPROVAL");
        snap.setSessionId(sessionId);
        snap.setFinalDataJson(mapper.writeValueAsString(finalData));
        // Prefer the Step 6-provided summary (exact saved results); fall back to counting the stored rows.
        snap.setValidationSummary(validationSummaryJson != null && !validationSummaryJson.trim().isEmpty()
                ? validationSummaryJson
                : mapper.writeValueAsString(computeSummary(finalData)));

        // Step 6 corrections become the snapshot's initial audit history entries, so the
        // "Edit / Approval History" view shows what was corrected before approval.
        for (int i = 0; i < finalData.size(); i++) {
            Map<String, Object> rec = finalData.get(i);
            Object[] info = correctionInfo.get(rec);
            if (info == null) continue;
            Map<String, Object> changes = new LinkedHashMap<>((Map<String, Object>) info[0]);
            changes.remove("deleted");
            appendAudit(snap, username, "STEP6_CORRECTION", rec, i, changes,
                    (String) info[1], strVal(rec.get("status")));
        }

        snap = snapshotRepository.save(snap);
        // If this snapshot is immediately approved (Admin save), push its records into the
        // permanent Customer Directory right away so both directories stay in sync.
        if ("APPROVED".equals(snap.getStatus())) {
            try {
                customerDirectorySyncService.syncSnapshot(snap);
            } catch (Exception e) {
                System.err.println("Customer Directory sync failed for snapshot " + snap.getId() + ": " + e.getMessage());
            }
        }
        return toMetadata(snap);
    }

    /**
     * Approves a monthly directory snapshot (Admin action).
     * Marks the snapshot as APPROVED, sets approvedBy to the Admin's username, and automatically
     * syncs all customer details contained in the dataset into the permanent Customer Directory.
     */
    @Transactional
    public Map<String, Object> approveSnapshot(Long id, String adminUsername) {
        MonthlyDirectorySnapshot s = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));
        s.setStatus("APPROVED");
        s.setApprovedBy(adminUsername);
        s.setApprovalDate(java.time.LocalDateTime.now());
        s = snapshotRepository.save(s);

        try {
            customerDirectorySyncService.syncSnapshot(s);
        } catch (Exception e) {
            System.err.println("Customer Directory sync failed for approved snapshot " + s.getId() + ": " + e.getMessage());
        }

        return toMetadata(s);
    }

    /** Lists all archived months (metadata only — the heavy dataset JSON is not included). */
    public List<Map<String, Object>> listSnapshots() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (MonthlyDirectorySnapshot s : snapshotRepository.findAllByOrderByCreatedDateDesc()) {
            out.add(toMetadata(s));
        }
        return out;
    }

    /**
     * Billing-month overview for the Division-based Customer Directory. Groups every snapshot by
     * Billing Month and reports the 5 fixed Eastern Province divisions per month with their status
     * (NOT_UPLOADED / PENDING / APPROVED), record counts, last-updated time and overall monthly
     * progress. A month is automatically marked completed once all 5 divisions are APPROVED.
     * Snapshots saved before the division redesign (no month/division) are returned separately so
     * nothing archived is ever hidden.
     */
    public Map<String, Object> listMonths() {
        Map<String, List<MonthlyDirectorySnapshot>> byMonth = new LinkedHashMap<>();
        List<Map<String, Object>> unassigned = new ArrayList<>();

        for (MonthlyDirectorySnapshot s : snapshotRepository.findAllByOrderByCreatedDateDesc()) {
            String month = s.getBillingMonth() != null ? s.getBillingMonth().trim() : "";
            if (month.isEmpty()) {
                unassigned.add(toMetadata(s));
                continue;
            }
            byMonth.computeIfAbsent(monthKey(month), k -> new ArrayList<>()).add(s);
        }

        List<Map<String, Object>> months = new ArrayList<>();
        for (List<MonthlyDirectorySnapshot> snaps : byMonth.values()) {
            String label = snaps.get(0).getBillingMonth().trim();

            // One slot per fixed division; snapshots with an unknown division stay visible too.
            Map<String, MonthlyDirectorySnapshot> byDivision = new LinkedHashMap<>();
            List<Map<String, Object>> otherDatasets = new ArrayList<>();
            for (MonthlyDirectorySnapshot s : snaps) {
                String div = canonicalDivision(s.getDivision());
                if (DIVISIONS.contains(div)) {
                    // Newest snapshot wins the slot (list is already newest-first).
                    byDivision.putIfAbsent(div, s);
                } else {
                    otherDatasets.add(toMetadata(s));
                }
            }

            List<Map<String, Object>> divisions = new ArrayList<>();
            int approvedCount = 0, uploadedCount = 0, totalRecords = 0;
            java.time.LocalDateTime lastUpdated = null;
            for (String div : DIVISIONS) {
                MonthlyDirectorySnapshot s = byDivision.get(div);
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("division", div);
                if (s == null) {
                    d.put("status", "NOT_UPLOADED");
                    d.put("totalRecords", 0);
                    d.put("lastUpdated", null);
                    d.put("snapshotId", null);
                    d.put("datasetName", null);
                } else {
                    boolean approved = "APPROVED".equals(s.getStatus());
                    if (approved) approvedCount++;
                    uploadedCount++;
                    totalRecords += s.getTotalRecords() != null ? s.getTotalRecords() : 0;
                    java.time.LocalDateTime updated = s.getApprovalDate() != null ? s.getApprovalDate() : s.getCreatedDate();
                    if (updated != null && (lastUpdated == null || updated.isAfter(lastUpdated))) lastUpdated = updated;
                    d.put("status", approved ? "APPROVED" : "PENDING");
                    d.put("totalRecords", s.getTotalRecords() != null ? s.getTotalRecords() : 0);
                    d.put("lastUpdated", updated != null ? updated.format(TS) : null);
                    d.put("snapshotId", s.getId());
                    d.put("datasetName", s.getDatasetName());
                    d.put("approvedBy", s.getApprovedBy());
                }
                divisions.add(d);
            }

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("billingMonth", label);
            m.put("divisions", divisions);
            m.put("divisionCount", DIVISIONS.size());
            m.put("uploadedCount", uploadedCount);
            m.put("approvedCount", approvedCount);
            m.put("totalRecords", totalRecords);
            m.put("lastUpdated", lastUpdated != null ? lastUpdated.format(TS) : null);
            m.put("completed", approvedCount == DIVISIONS.size());
            m.put("otherDatasets", otherDatasets);
            months.add(m);
        }

        // Newest billing month first (unparseable labels sink to the bottom, keeping insert order).
        months.sort(Comparator.comparing(
                (Map<String, Object> m) -> parseMonthLabel((String) m.get("billingMonth")),
                Comparator.nullsLast(Comparator.reverseOrder())));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("divisions", DIVISIONS);
        out.put("months", months);
        out.put("unassigned", unassigned);
        return out;
    }

    /** Case-insensitive grouping key so "july 2026" and "July 2026" land in the same month. */
    private String monthKey(String label) {
        return label.trim().toLowerCase(Locale.ENGLISH);
    }

    /** Parses labels like "July 2026" for sorting; returns null when the label is free-form. */
    private java.time.YearMonth parseMonthLabel(String label) {
        if (label == null) return null;
        try {
            return java.time.YearMonth.parse(label.trim(),
                    DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH));
        } catch (Exception e) {
            return null;
        }
    }

    /** Returns one snapshot including the parsed final dataset and validation summary. */
    public Map<String, Object> getSnapshot(Long id) throws Exception {
        MonthlyDirectorySnapshot s = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));
        Map<String, Object> out = toMetadata(s);

        List<Map<String, Object>> records = parseJsonArray(s.getFinalDataJson());
        if (records.isEmpty()) {
            records = fetchFallbackRecords(s);
            if (!records.isEmpty()) {
                try {
                    s.setFinalDataJson(mapper.writeValueAsString(records));
                    s.setTotalRecords(records.size());
                    s.setValidationSummary(mapper.writeValueAsString(computeSummary(records)));
                    snapshotRepository.save(s);
                } catch (Exception e) {
                    System.err.println("MonthlyDirectoryService: failed to persist fallback records: " + e.getMessage());
                }
            }
        }

        Map<String, Object> summary = parseJsonObject(s.getValidationSummary());
        if ((summary == null || summary.isEmpty()) && !records.isEmpty()) {
            summary = computeSummary(records);
        }

        out.put("validationSummary", summary);
        out.put("records", records);
        out.put("auditLog", parseJsonArray(s.getAuditLogJson()));
        return out;
    }

    private List<Map<String, Object>> fetchFallbackRecords(MonthlyDirectorySnapshot s) {
        List<Map<String, Object>> records = new ArrayList<>();
        // 1. Try fetching main dataset from session if sessionId is present
        if (s.getSessionId() != null) {
            try {
                List<Map<String, Object>> mainDataset = multiFileImportService.getMainDataset(s.getSessionId());
                if (mainDataset != null && !mainDataset.isEmpty()) {
                    return mainDataset;
                }
            } catch (Exception e) {
                System.err.println("MonthlyDirectoryService: multiFileImportService lookup failed: " + e.getMessage());
            }

            // 2. Try fetching staging rows by uploadBatchId
            try {
                List<BillingUploadStaging> stagingRows = stagingRepository.findByUploadBatchId(s.getSessionId());
                if (stagingRows != null && !stagingRows.isEmpty()) {
                    Map<String, Map<String, Object>> grouped = new LinkedHashMap<>();
                    for (BillingUploadStaging row : stagingRows) {
                        Map<String, Object> data = parseJsonObject(row.getRawJson());
                        if (data == null || data.isEmpty()) continue;
                        String acc = data.get("accountNo") != null ? String.valueOf(data.get("accountNo")).trim()
                                : ("__row_" + row.getStagingId());
                        Map<String, Object> map = grouped.computeIfAbsent(acc, k -> new LinkedHashMap<>());
                        map.putAll(data);
                        if (row.getValidationStatus() != null) map.put("status", row.getValidationStatus());
                    }
                    records.addAll(grouped.values());
                    if (!records.isEmpty()) return records;
                }
            } catch (Exception e) {
                System.err.println("MonthlyDirectoryService: staging lookup failed: " + e.getMessage());
            }
        }

        // 3. Try fetching from Customer table by division
        try {
            List<Customer> customers = customerRepository.findAll();
            if (customers != null && !customers.isEmpty()) {
                String targetDiv = canonicalDivision(s.getDivision());
                for (Customer c : customers) {
                    if (targetDiv == null || targetDiv.isEmpty() || targetDiv.equalsIgnoreCase(c.getDivision()) || targetDiv.equalsIgnoreCase(c.getBranchCode())) {
                        Map<String, Object> map = new LinkedHashMap<>();
                        map.put("accountNo", c.getAccountNo());
                        map.put("customerName", c.getCustomerName());
                        map.put("npayName", c.getCustomerName());
                        map.put("customerAddress", c.getCustomerAddress());
                        map.put("refNo", c.getRefNo());
                        map.put("mobileNo", c.getMobileNo());
                        map.put("solarType", c.getSolarType());
                        map.put("panelCapacity", c.getPanelCapacity());
                        map.put("agreementDate", c.getAgreementDate());
                        map.put("bankCode", c.getBankCode());
                        map.put("branchCode", c.getBranchCode());
                        map.put("bankAccountNo", c.getBankAccountNo());
                        map.put("unitRate", c.getUnitRate());
                        map.put("status", c.getValidationStatus() != null ? c.getValidationStatus() : "APPROVED");
                        records.add(map);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("MonthlyDirectoryService: customer repository fallback failed: " + e.getMessage());
        }

        return records;
    }

    /** Returns just the audit history (newest first) for one snapshot. */
    public List<Map<String, Object>> getAuditLog(Long id) throws Exception {
        MonthlyDirectorySnapshot s = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));
        return parseJsonArray(s.getAuditLogJson());
    }

    /**
     * Applies a user edit to ONE record inside an archived snapshot and, optionally, revalidates and/or
     * approves that single record. This is the post-Step-6 "working area": every change is recorded in
     * the snapshot's audit history and the snapshot's validation summary is refreshed. No other record
     * is touched and no validation issue is auto-removed or auto-corrected.
     *
     * @param revalidate    when true, re-runs the same validation rules on this record only
     * @param approveRecord when true, marks this single record as approved (by {@code username})
     */
    @Transactional
    public Map<String, Object> updateRecord(Long id, int recordIndex, Map<String, Object> updatedFields,
                                            boolean revalidate, boolean approveRecord, String username) throws Exception {
        MonthlyDirectorySnapshot s = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));
        List<Map<String, Object>> records = parseJsonArray(s.getFinalDataJson());
        if (recordIndex < 0 || recordIndex >= records.size()) {
            throw new IllegalArgumentException("Record index out of range: " + recordIndex);
        }
        Map<String, Object> record = records.get(recordIndex);

        // Capture the field-level before/after values for the audit trail.
        Map<String, Object> changes = new LinkedHashMap<>();
        String statusBefore = strVal(record.get("status"));
        if (updatedFields != null) {
            for (Map.Entry<String, Object> e : updatedFields.entrySet()) {
                Object oldV = record.get(e.getKey());
                Object newV = e.getValue();
                if (!Objects.equals(strVal(oldV), strVal(newV))) {
                    Map<String, Object> ch = new LinkedHashMap<>();
                    ch.put("from", oldV);
                    ch.put("to", newV);
                    changes.put(e.getKey(), ch);
                }
                record.put(e.getKey(), newV);
            }
        }

        String action = changes.isEmpty() ? "VIEW" : "EDIT";
        // Flag edited records so the directory's "Corrections" card can filter them.
        if (!changes.isEmpty()) record.put("correctedInDirectory", true);
        if (revalidate) {
            multiFileImportService.revalidateDirectoryRecord(record);
            action = "REVALIDATE";
        }
        if (approveRecord) {
            record.put("recordApproved", true);
            record.put("recordApprovedBy", username);
            record.put("recordApprovedAt", java.time.LocalDateTime.now().format(TS));
            action = "APPROVE";
        }
        String statusAfter = strVal(record.get("status"));

        records.set(recordIndex, record);
        s.setFinalDataJson(mapper.writeValueAsString(records));
        s.setValidationSummary(mapper.writeValueAsString(computeSummary(records)));
        appendAudit(s, username, action, record, recordIndex, changes, statusBefore, statusAfter);
        snapshotRepository.save(s);

        // Keep the Customer Directory in step with edits made to an already-approved month.
        if ("APPROVED".equals(s.getStatus()) && !changes.isEmpty()) {
            try {
                customerDirectorySyncService.upsertCustomer(record, s.getDivision());
            } catch (Exception e) {
                System.err.println("Customer Directory sync failed for edited record in snapshot "
                        + s.getId() + ": " + e.getMessage());
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("recordIndex", recordIndex);
        out.put("record", record);
        out.put("validationSummary", computeSummary(records));
        out.put("auditLog", parseJsonArray(s.getAuditLogJson()));
        return out;
    }

    /** Renames a snapshot. Updates ONLY the dataset name — customer records are never touched. */
    @Transactional
    public Map<String, Object> rename(Long id, String newName) {
        if (newName == null || newName.trim().isEmpty()) {
            throw new IllegalArgumentException("Dataset name cannot be empty.");
        }
        MonthlyDirectorySnapshot s = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));
        s.setDatasetName(newName.trim());
        s = snapshotRepository.save(s);
        return toMetadata(s);
    }

    /** Permanently deletes one archived month (manual deletion only). */
    @Transactional
    public void delete(Long id) {
        if (!snapshotRepository.existsById(id)) {
            throw new IllegalArgumentException("Directory snapshot not found: " + id);
        }
        snapshotRepository.deleteById(id);
    }

    @Transactional
    public void deleteSnapshotAndSync(Long id) throws Exception {
        MonthlyDirectorySnapshot snap = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));

        // 1. Parse JSON to get all customer account numbers
        List<Map<String, Object>> records = parseJsonArray(snap.getFinalDataJson());
        Set<String> accountNumbers = new HashSet<>();
        for (Map<String, Object> r : records) {
            String acc = r.get("accountNo") != null ? String.valueOf(r.get("accountNo")).trim() : null;
            if (acc != null && !acc.isEmpty()) {
                accountNumbers.add(acc);
            }
        }

        // 2. Find and delete associated BillingRecords and UploadHistory
        UploadHistory history = findUploadHistoryForSnapshot(snap);
        if (history != null) {
            billingRecordRepository.deleteByUploadHistoryId(history.getId());
            uploadHistoryRepository.delete(history);
        }

        // 3. Delete the snapshot
        snapshotRepository.delete(snap);

        // 4. Update or delete Customer profiles in Customer Directory
        for (String accNo : accountNumbers) {
            // Find all OTHER approved snapshots that contain this customer
            List<MonthlyDirectorySnapshot> otherApprovedSnaps = snapshotRepository.findByStatusOrderByCreatedDateDesc("APPROVED");
            MonthlyDirectorySnapshot latestOtherSnap = null;
            Map<String, Object> latestOtherRecord = null;

            outerLoop:
            for (MonthlyDirectorySnapshot otherSnap : otherApprovedSnaps) {
                if (otherSnap.getId().equals(id)) continue;
                List<Map<String, Object>> otherRecords = parseJsonArray(otherSnap.getFinalDataJson());
                for (Map<String, Object> or : otherRecords) {
                    String oAcc = or.get("accountNo") != null ? String.valueOf(or.get("accountNo")).trim() : null;
                    if (accNo.equals(oAcc)) {
                        latestOtherSnap = otherSnap;
                        latestOtherRecord = or;
                        break outerLoop;
                    }
                }
            }

            if (latestOtherRecord != null) {
                customerDirectorySyncService.upsertCustomer(latestOtherRecord, latestOtherSnap.getDivision());
            } else {
                long remainingBills = billingRecordRepository.countByCustomerAccountNo(accNo);
                if (remainingBills == 0) {
                    customerRepository.findById(accNo).ifPresent(customerRepository::delete);
                } else {
                    customerRepository.findById(accNo).ifPresent(c -> {
                        c.setDirectoryJson(null);
                        customerRepository.save(c);
                    });
                }
            }
        }
    }

    private UploadHistory findUploadHistoryForSnapshot(MonthlyDirectorySnapshot snap) {
        if (snap.getSessionId() == null) return null;
        String sessionStr = "Session " + snap.getSessionId();
        List<UploadHistory> histories = uploadHistoryRepository.findAll();
        for (UploadHistory h : histories) {
            if (h.getFilename() != null && h.getFilename().contains(sessionStr)) {
                return h;
            }
        }
        return null;
    }

    public MonthlyDirectorySnapshot getSnapshotEntity(Long id) {
        return snapshotRepository.findById(id).orElse(null);
    }

    /** Builds an .xlsx export of the archived final Customer Directory data. */
    public byte[] buildExcel(Long id) throws Exception {
        MonthlyDirectorySnapshot s = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));
        List<Map<String, Object>> records = parseJsonArray(s.getFinalDataJson());

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Customer Directory");

            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row header = sheet.createRow(0);
            for (int c = 0; c < EXPORT_COLUMNS.length; c++) {
                Cell cell = header.createCell(c);
                cell.setCellValue(EXPORT_COLUMNS[c][1]);
                cell.setCellStyle(headerStyle);
            }

            int r = 1;
            for (Map<String, Object> row : records) {
                Row excelRow = sheet.createRow(r++);
                for (int c = 0; c < EXPORT_COLUMNS.length; c++) {
                    Object val = row.get(EXPORT_COLUMNS[c][0]);
                    excelRow.createCell(c).setCellValue(cellString(val));
                }
            }
            for (int c = 0; c < EXPORT_COLUMNS.length; c++) {
                sheet.autoSizeColumn(c);
            }

            wb.write(bos);
            return bos.toByteArray();
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Numeric-aware sort key so e.g. account "9" orders before "10" and before "100". */
    private String accountSortKey(Object acc) {
        String s = acc == null ? "" : String.valueOf(acc).trim();
        if (s.matches("\\d+")) {
            return String.format("%030d", new java.math.BigInteger(s));
        }
        return s;
    }

    private String defaultName(String billingMonth, String division) {
        String month = billingMonth != null ? billingMonth.trim() : "";
        String div = division != null ? division.trim() : "";
        if (!month.isEmpty() && !div.isEmpty()) {
            return month + " \u2013 " + div + " Billing";
        }
        if (!month.isEmpty()) {
            return month + " Billing";
        }
        return "Customer Directory " + java.time.LocalDate.now();
    }

    /** Folds free-typed division names onto the fixed 5-division list (case-insensitive). */
    private String canonicalDivision(String division) {
        if (division == null) return "";
        String d = division.trim();
        for (String known : DIVISIONS) {
            if (known.equalsIgnoreCase(d)) return known;
        }
        return d;
    }

    private Map<String, Object> toMetadata(MonthlyDirectorySnapshot s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("datasetName", s.getDatasetName());
        m.put("billingMonth", s.getBillingMonth());
        m.put("division", s.getDivision());
        m.put("approvalDate", s.getApprovalDate() != null ? s.getApprovalDate().format(TS) : null);
        m.put("createdDate", s.getCreatedDate() != null ? s.getCreatedDate().format(TS) : null);
        m.put("approvedBy", s.getApprovedBy());
        m.put("totalRecords", s.getTotalRecords());
        m.put("status", s.getStatus());
        m.put("sessionId", s.getSessionId());
        return m;
    }

    private Map<String, Object> computeSummary(List<Map<String, Object>> rows) {
        int valid = 0, warnings = 0, errors = 0, nameMismatch = 0, unitRateMismatch = 0, netTypeMismatch = 0;
        int newCustomers = 0, noBillingData = 0, duplicates = 0;
        for (Map<String, Object> row : rows) {
            String status = row.get("status") != null ? String.valueOf(row.get("status")) : "";
            boolean isNew = Boolean.FALSE.equals(row.get("masterDataFound")) || Boolean.TRUE.equals(row.get("isNewCustomer"));
            boolean isNoBilling = Boolean.TRUE.equals(row.get("masterOnly")) || Boolean.TRUE.equals(row.get("noBillingData"));
            boolean isDup = "DUPLICATE".equalsIgnoreCase(status) || Boolean.TRUE.equals(row.get("hasDuplicateSources")) || Boolean.TRUE.equals(row.get("isDuplicateEntry"));
            boolean isNameMismatch = "MISMATCH".equals(row.get("nameMatch"));
            boolean isUnitRateMismatch = "MISMATCH".equals(row.get("unitRateMatch"));
            boolean isNetTypeMismatch = "MISMATCH".equals(row.get("netTypeMatch"));

            if (isNew) newCustomers++;
            if (isNoBilling) noBillingData++;
            if (isDup) duplicates++;
            if (isNameMismatch) nameMismatch++;
            if (isUnitRateMismatch) unitRateMismatch++;
            if (isNetTypeMismatch) netTypeMismatch++;

            if ("VALID".equalsIgnoreCase(status) && !isNew && !isNoBilling && !isDup && !isNameMismatch && !isUnitRateMismatch && !isNetTypeMismatch) {
                valid++;
            }
            if ("WARNING".equalsIgnoreCase(status)) warnings++;
            if ("ERROR".equalsIgnoreCase(status)) errors++;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalRecords", rows.size());
        m.put("validCount", valid);
        m.put("newCustomersCount", newCustomers);
        m.put("noBillingDataCount", noBillingData);
        m.put("duplicateCount", duplicates);
        m.put("warningCount", warnings);
        m.put("errorCount", errors);
        m.put("nameMismatchCount", nameMismatch);
        m.put("unitRateMismatchCount", unitRateMismatch);
        m.put("netTypeMismatchCount", netTypeMismatch);
        return m;
    }

    private List<Map<String, Object>> parseJsonArray(String json) {
        if (json == null || json.trim().isEmpty()) return new ArrayList<>();
        try {
            String trimmed = json.trim();
            if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() > 2) {
                try {
                    Object unwrapped = mapper.readValue(trimmed, Object.class);
                    if (unwrapped instanceof String) {
                        trimmed = (String) unwrapped;
                    }
                } catch (Exception ignored) {}
            }
            return mapper.readValue(trimmed, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            System.err.println("MonthlyDirectoryService: failed to parse JSON array: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private Map<String, Object> parseJsonObject(String json) {
        if (json == null || json.trim().isEmpty()) return new LinkedHashMap<>();
        try {
            String trimmed = json.trim();
            if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() > 2) {
                try {
                    Object unwrapped = mapper.readValue(trimmed, Object.class);
                    if (unwrapped instanceof String) {
                        trimmed = (String) unwrapped;
                    }
                } catch (Exception ignored) {}
            }
            return mapper.readValue(trimmed, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            System.err.println("MonthlyDirectoryService: failed to parse JSON object: " + e.getMessage());
            return new LinkedHashMap<>();
        }
    }

    private String cellString(Object val) {
        if (val == null) return "";
        if (val instanceof Map) {
            Object inner = ((Map<?, ?>) val).get("value");
            return inner != null ? String.valueOf(inner) : "";
        }
        return String.valueOf(val);
    }

    private String strVal(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    /** Prepends one entry (newest first) to the snapshot's persisted audit history. */
    private void appendAudit(MonthlyDirectorySnapshot s, String user, String action, Map<String, Object> record,
                             int recordIndex, Map<String, Object> changes, String statusBefore, String statusAfter) throws Exception {
        List<Map<String, Object>> log = parseJsonArray(s.getAuditLogJson());
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("timestamp", java.time.LocalDateTime.now().format(TS));
        entry.put("user", user);
        entry.put("action", action);
        entry.put("recordIndex", recordIndex);
        entry.put("accountNo", record.get("accountNo"));
        entry.put("statusBefore", statusBefore);
        entry.put("statusAfter", statusAfter);
        entry.put("changes", changes);
        log.add(0, entry);
        s.setAuditLogJson(mapper.writeValueAsString(log));
    }
}
