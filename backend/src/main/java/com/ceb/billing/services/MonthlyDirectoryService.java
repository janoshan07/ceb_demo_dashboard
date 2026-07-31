package com.ceb.billing.services;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
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
public class MonthlyDirectoryService {

    @Autowired
    private MonthlyDirectorySnapshotRepository snapshotRepository;

    @Autowired
    private MultiFileImportService multiFileImportService;

    private final ObjectMapper mapper = new ObjectMapper();

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

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
                                              String billingMonth, String validationSummaryJson,
                                              Map<String, Map<String, Object>> corrections,
                                              boolean isAdmin) throws Exception {
        List<Map<String, Object>> mainDataset = multiFileImportService.getMainDataset(sessionId);
        if (mainDataset == null || mainDataset.isEmpty()) {
            throw new IllegalStateException("No approved dataset found for this session. Approve Step 6 before saving the directory.");
        }

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
            name = defaultName(billingMonth);
        }

        MonthlyDirectorySnapshot snap = new MonthlyDirectorySnapshot();
        snap.setDatasetName(name);
        snap.setBillingMonth(billingMonth != null && !billingMonth.trim().isEmpty() ? billingMonth.trim() : null);
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
            @SuppressWarnings("unchecked")
            Map<String, Object> changes = new LinkedHashMap<>((Map<String, Object>) info[0]);
            changes.remove("deleted");
            appendAudit(snap, username, "STEP6_CORRECTION", rec, i, changes,
                    (String) info[1], strVal(rec.get("status")));
        }

        snap = snapshotRepository.save(snap);
        return toMetadata(snap);
    }

    /** Lists all archived months (metadata only — the heavy dataset JSON is not included). */
    public List<Map<String, Object>> listSnapshots() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (MonthlyDirectorySnapshot s : snapshotRepository.findAllByOrderByCreatedDateDesc()) {
            out.add(toMetadata(s));
        }
        return out;
    }

    /** Returns one snapshot including the parsed final dataset and validation summary. */
    public Map<String, Object> getSnapshot(Long id) throws Exception {
        MonthlyDirectorySnapshot s = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Directory snapshot not found: " + id));
        Map<String, Object> out = toMetadata(s);
        out.put("validationSummary", parseJsonObject(s.getValidationSummary()));
        out.put("records", parseJsonArray(s.getFinalDataJson()));
        out.put("auditLog", parseJsonArray(s.getAuditLogJson()));
        return out;
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

    private String defaultName(String billingMonth) {
        if (billingMonth != null && !billingMonth.trim().isEmpty()) {
            return billingMonth.trim() + " Billing";
        }
        return "Customer Directory " + java.time.LocalDate.now();
    }

    private Map<String, Object> toMetadata(MonthlyDirectorySnapshot s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("datasetName", s.getDatasetName());
        m.put("billingMonth", s.getBillingMonth());
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
        for (Map<String, Object> row : rows) {
            String status = row.get("status") != null ? String.valueOf(row.get("status")) : "";
            if ("VALID".equals(status)) valid++;
            else if ("WARNING".equals(status)) warnings++;
            else if ("ERROR".equals(status)) errors++;
            if ("MISMATCH".equals(row.get("nameMatch"))) nameMismatch++;
            if ("MISMATCH".equals(row.get("unitRateMatch"))) unitRateMismatch++;
            if ("MISMATCH".equals(row.get("netTypeMatch"))) netTypeMismatch++;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalRecords", rows.size());
        m.put("validCount", valid);
        m.put("warningCount", warnings);
        m.put("errorCount", errors);
        m.put("nameMismatchCount", nameMismatch);
        m.put("unitRateMismatchCount", unitRateMismatch);
        m.put("netTypeMismatchCount", netTypeMismatch);
        return m;
    }

    private List<Map<String, Object>> parseJsonArray(String json) throws Exception {
        if (json == null || json.trim().isEmpty()) return new ArrayList<>();
        return mapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
    }

    private Map<String, Object> parseJsonObject(String json) throws Exception {
        if (json == null || json.trim().isEmpty()) return new LinkedHashMap<>();
        return mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
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
