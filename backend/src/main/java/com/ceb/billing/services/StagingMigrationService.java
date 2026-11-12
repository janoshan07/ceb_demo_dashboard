package com.ceb.billing.services;

import com.ceb.billing.entities.*;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.repositories.BillingUploadStagingRepository;
import com.ceb.billing.repositories.CostCodeRepository;
import com.ceb.billing.repositories.NetTypeRepository;
import com.ceb.billing.repositories.ExpenseCodeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
public class StagingMigrationService {

    @Autowired
    private BillingUploadStagingRepository stagingRepository;

    @Autowired
    private com.ceb.billing.repositories.StagingChangeLogRepository changeLogRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AlertService alertService;

    @Autowired
    private CostCodeRepository costCodeRepository;

    @Autowired
    private NetTypeRepository netTypeRepository;

    @Autowired
    private ExpenseCodeRepository expenseCodeRepository;

    @Autowired
    private com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository monthlyDirectorySnapshotRepository;

    @Autowired
    private CustomerDirectorySyncService customerDirectorySyncService;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private CustomerHashIndexService customerHashIndexService;

    @Autowired(required = false)
    private org.springframework.context.ApplicationEventPublisher eventPublisher;

    @Transactional
    public String migrateApprovedBatch(Long batchId, String approvedBy) throws Exception {
        Optional<UploadHistory> optHistory = uploadHistoryRepository.findByIdForUpdate(Objects.requireNonNull(batchId));
        if (optHistory.isEmpty()) {
            throw new IllegalArgumentException("Upload batch history not found for ID: " + batchId);
        }
        UploadHistory history = optHistory.get();

        String currentStatus = history.getStatus();
        boolean pendingApproval = "PENDING_APPROVAL".equalsIgnoreCase(currentStatus);
        boolean adminImport = "STAGED_IMPORT".equalsIgnoreCase(currentStatus);
        if (!pendingApproval && !adminImport) {
            throw new IllegalStateException("Batch ID " + batchId + " is no longer pending approval (status: " + history.getStatus() + ").");
        }

        List<BillingUploadStaging> stagingRecords = stagingRepository.findByUploadBatchId(batchId);
        int newCustomers = 0;
        int billingInserted = 0;
        int invalidCount = 0;
        int duplicateCount = 0;
        int skippedCount = 0;
        int successfulRows = 0;
        Set<String> impactedAccounts = new HashSet<>();

        // Optimization with Hashing:
        // 1. Pre-load reference tables into in-memory HashMaps for O(1) resolution
        Map<String, CostCode> costCodeHash = new HashMap<>();
        costCodeRepository.findAll().forEach(cc -> {
            if (cc.getCostCode() != null) {
                costCodeHash.put(cc.getCostCode().trim(), cc);
                costCodeHash.put(cc.getCostCode().trim().toLowerCase(), cc);
            }
        });

        Map<String, NetType> netTypeHash = new HashMap<>();
        netTypeRepository.findAll().forEach(nt -> {
            if (nt.getName() != null) {
                netTypeHash.put(nt.getName().trim().toUpperCase(), nt);
                netTypeHash.put(nt.getName().trim().toLowerCase(), nt);
            }
        });

        Map<String, ExpenseCode> expenseCodeHash = new HashMap<>();
        expenseCodeRepository.findAll().forEach(ec -> {
            if (ec.getExpCode() != null) {
                expenseCodeHash.put(ec.getExpCode().trim().toUpperCase(), ec);
                expenseCodeHash.put(ec.getExpCode().trim().toLowerCase(), ec);
                expenseCodeHash.put(String.valueOf(ec.getId()), ec);
            }
            if (ec.getExp() != null) {
                expenseCodeHash.put(ec.getExp().trim().toLowerCase(), ec);
            }
        });

        // 2. Single-pass JSON parsing: parse each staging record once and collect all candidate accounts
        class ParsedStagingRow {
            final BillingUploadStaging record;
            final Map<String, Object> data;
            final String accountNo;
            ParsedStagingRow(BillingUploadStaging record, Map<String, Object> data, String accountNo) {
                this.record = record;
                this.data = data;
                this.accountNo = accountNo;
            }
        }

        List<ParsedStagingRow> parsedRows = new ArrayList<>(stagingRecords.size());
        Set<String> allBatchAccounts = new HashSet<>();

        for (BillingUploadStaging r : stagingRecords) {
            Map<String, Object> d = Collections.emptyMap();
            String acc = null;
            try {
                if (r.getRawJson() != null && !r.getRawJson().trim().isEmpty()) {
                    d = objectMapper.readValue(r.getRawJson(), new TypeReference<Map<String, Object>>() {});
                    Object rawAcc = d.get("accountNo");
                    if (rawAcc != null && !rawAcc.toString().trim().isEmpty()) {
                        acc = rawAcc.toString().trim();
                        allBatchAccounts.add(acc);
                    }
                }
            } catch (Exception ignored) {}
            parsedRows.add(new ParsedStagingRow(r, d, acc));
        }

        // 3. Pre-load candidate customers into an in-memory Hash Map [O(1) Access]
        Map<String, Customer> customerHash = new HashMap<>();
        List<String> accList = new ArrayList<>(allBatchAccounts);
        int chunkSize = 1000;
        for (int i = 0; i < accList.size(); i += chunkSize) {
            List<String> sub = accList.subList(i, Math.min(i + chunkSize, accList.size()));
            customerRepository.findAllById(Objects.requireNonNull(sub)).forEach(c -> {
                if (c.getAccountNo() != null) customerHash.put(c.getAccountNo().trim(), c);
            });
        }

        // 4. Pre-load existing billing records into a HashSet for O(1) duplicate checks (eliminates N+1 queries)
        Set<String> existingBillingKeyHash = new HashSet<>();
        for (int i = 0; i < accList.size(); i += chunkSize) {
            List<String> sub = accList.subList(i, Math.min(i + chunkSize, accList.size()));
            List<Object[]> rows = billingRecordRepository.findBillingKeysByAccountNos(sub);
            for (Object[] row : rows) {
                String acc = row[0] != null ? row[0].toString().trim() : "";
                String ref = row[1] != null ? row[1].toString().trim() : "";
                String from = row[2] != null ? row[2].toString().trim() : "";
                String to = row[3] != null ? row[3].toString().trim() : "";
                existingBillingKeyHash.add(buildBillingHashKey(acc, ref, from, to));
            }
        }

        Map<String, Customer> customersToSave = new HashMap<>();
        List<BillingRecord> billingRecordsToSave = new ArrayList<>();

        for (ParsedStagingRow item : parsedRows) {
            BillingUploadStaging record = item.record;
            Map<String, Object> data = item.data;
            String status = record.getValidationStatus();

            if ("INVALID".equals(status) || "REJECTED".equals(status)) {
                if ("REJECTED".equals(status)) {
                    skippedCount++;
                } else {
                    invalidCount++;
                }
                continue;
            }
            if ("DUPLICATE".equals(status)) {
                if (!"BILLING".equals(record.getRowType())) {
                    duplicateCount++;
                    continue;
                }
            }

            String accountNo   = item.accountNo;
            String customerName = (String) data.get("customerName");
            String bankCode    = (String) data.get("bankCode");
            String branchCode  = (String) data.get("branchCode");
            String bankAccountNo = (String) data.get("bankAccountNo");
            String customerAddress = (String) data.get("customerAddress");
            String mobileNo    = (String) data.get("mobileNo");
            LocalDate agreementDate = data.get("agreementDate") != null
                    ? safeParseDate((String) data.get("agreementDate")) : null;
            Double panelCapacity = data.get("panelCapacity") != null
                    ? Double.valueOf(data.get("panelCapacity").toString()) : null;
            String solarType   = (String) data.get("solarType");
            String costCode    = (String) data.get("costCode");
            String refNo       = (String) data.get("refNo");
            Double unitRate    = data.get("unitRate") != null ? Double.valueOf(data.get("unitRate").toString()) : null;
            String tariffType  = (String) data.get("tariffType");
            String billingMode = (String) data.get("billingMode");

            if (accountNo == null || accountNo.trim().isEmpty()) {
                skippedCount++;
                continue; // Defensive: skip rows with no account number
            }
            impactedAccounts.add(accountNo);

            // ── Upsert Customer via O(1) Hash Map lookups ───────────────────
            Customer customer = customerHash.get(accountNo);
            if (customer == null) {
                customer = new Customer(accountNo, customerName, customerAddress, mobileNo,
                        agreementDate, panelCapacity, bankCode, branchCode, bankAccountNo, solarType);
                customer.setCreatedByUploadId(batchId); // Tag creation upload reference

                if (isNotBlank(costCode)) {
                    customer.setCostCode(costCodeHash.get(costCode.trim()));
                }
                if (isNotBlank(solarType)) {
                    customer.setNetType(netTypeHash.get(solarType.trim().toUpperCase()));
                }
                if (isNotBlank(billingMode)) {
                    String cleanEc = billingMode.trim().toUpperCase();
                    customer.setExpenseCode(expenseCodeHash.get(cleanEc));
                }
                if (isNotBlank(refNo)) {
                    customer.setRefNo(refNo);
                }
                if (unitRate != null) {
                    customer.setUnitRate(unitRate);
                }
                if (isNotBlank(tariffType)) {
                    customer.setTariffType(tariffType);
                }

                String targetDiv = "";
                Object snapDiv = data.get("snapshotDivision");
                if (snapDiv != null) targetDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(snapDiv.toString());
                if (targetDiv.isEmpty() && data.get("division") != null) targetDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(data.get("division").toString());
                if (targetDiv.isEmpty() && isNotBlank(costCode)) targetDiv = com.ceb.billing.utils.BranchDetector.divisionFromCostCode(costCode);
                if (targetDiv.isEmpty()) targetDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(branchCode);
                if (targetDiv.isEmpty()) {
                    String detectedDiv = com.ceb.billing.utils.BranchDetector.detectBranch(accountNo);
                    if (detectedDiv != null && !detectedDiv.isEmpty()) targetDiv = detectedDiv;
                }
                if (!targetDiv.isEmpty()) {
                    customer.setDivision(targetDiv);
                    if (isBlank(customer.getBranchCode())) {
                        customer.setBranchCode(targetDiv);
                    }
                }

                customersToSave.put(accountNo, customer);
                customerHash.put(accountNo, customer);
                newCustomers++;
            } else {
                // Only fill in fields that are currently null/empty — never overwrite existing data
                if (isNotBlank(customerName) && isBlank(customer.getCustomerName()))
                    customer.setCustomerName(customerName);
                if (isNotBlank(bankCode) && isBlank(customer.getBankCode()))
                    customer.setBankCode(bankCode);
                if (isNotBlank(branchCode) && isBlank(customer.getBranchCode()))
                    customer.setBranchCode(branchCode);
                if (isNotBlank(bankAccountNo) && isBlank(customer.getBankAccountNo()))
                    customer.setBankAccountNo(bankAccountNo);
                if (isNotBlank(customerAddress) && isBlank(customer.getCustomerAddress()))
                    customer.setCustomerAddress(customerAddress);
                if (isNotBlank(mobileNo) && isBlank(customer.getMobileNo()))
                    customer.setMobileNo(mobileNo);
                if (agreementDate != null && customer.getAgreementDate() == null)
                    customer.setAgreementDate(agreementDate);
                if (panelCapacity != null && customer.getPanelCapacity() == null)
                    customer.setPanelCapacity(panelCapacity);
                if (isNotBlank(solarType) && isBlank(customer.getSolarType()))
                    customer.setSolarType(solarType);

                if (isNotBlank(costCode) && customer.getCostCode() == null) {
                    customer.setCostCode(costCodeHash.get(costCode.trim()));
                }
                if (isNotBlank(solarType) && customer.getNetType() == null) {
                    customer.setNetType(netTypeHash.get(solarType.trim().toUpperCase()));
                }
                if (isNotBlank(billingMode) && customer.getExpenseCode() == null) {
                    String cleanEc = billingMode.trim().toUpperCase();
                    customer.setExpenseCode(expenseCodeHash.get(cleanEc));
                }
                if (isNotBlank(refNo) && isBlank(customer.getRefNo())) {
                    customer.setRefNo(refNo);
                }
                if (unitRate != null && customer.getUnitRate() == null) {
                    customer.setUnitRate(unitRate);
                }
                if (isNotBlank(tariffType) && isBlank(customer.getTariffType())) {
                    customer.setTariffType(tariffType);
                }

                if (isBlank(customer.getDivision())) {
                    String targetDiv = "";
                    Object snapDiv = data.get("snapshotDivision");
                    if (snapDiv != null) targetDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(snapDiv.toString());
                    if (targetDiv.isEmpty() && data.get("division") != null) targetDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(data.get("division").toString());
                    if (targetDiv.isEmpty() && isNotBlank(costCode)) targetDiv = com.ceb.billing.utils.BranchDetector.divisionFromCostCode(costCode);
                    if (targetDiv.isEmpty()) targetDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(branchCode);
                    if (targetDiv.isEmpty()) {
                        String detectedDiv = com.ceb.billing.utils.BranchDetector.detectBranch(accountNo);
                        if (detectedDiv != null && !detectedDiv.isEmpty()) targetDiv = detectedDiv;
                    }
                    if (!targetDiv.isEmpty()) {
                        customer.setDivision(targetDiv);
                    }
                }

                customersToSave.put(accountNo, customer);
            }

            // ── CUSTOMER_PROFILE rows: no billing record to create ────────
            if ("CUSTOMER_PROFILE".equals(record.getRowType())) {
                successfulRows++;
                continue;
            }

            // ── BILLING rows: parse billing-specific fields ───────────────
            LocalDate fromDate = data.get("fromDate") != null
                    ? safeParseDate((String) data.get("fromDate"))
                    : (data.get("prevReadingDate") != null ? safeParseDate((String) data.get("prevReadingDate")) : null);
            LocalDate toDate = data.get("toDate") != null
                    ? safeParseDate((String) data.get("toDate"))
                    : (data.get("currReadingDate") != null ? safeParseDate((String) data.get("currReadingDate")) : null);
            refNo = (String) data.get("refNo");
            if (refNo == null || refNo.trim().isEmpty() || "—".equals(refNo)) {
                LocalDate refDate = toDate != null ? toDate : LocalDate.now();
                refNo = isNotBlank(customer.getRefNo()) ? customer.getRefNo()
                        : "REF-" + accountNo + "-" + refDate.toString().replace("-", "");
            }
            Double importUnits = data.get("importUnits") != null
                    ? Double.valueOf(data.get("importUnits").toString())
                    : (data.get("kwhImport") != null ? Double.valueOf(data.get("kwhImport").toString()) : 0.0);
            Double exportUnits = data.get("exportUnits") != null
                    ? Double.valueOf(data.get("exportUnits").toString())
                    : (data.get("kwhExport") != null ? Double.valueOf(data.get("kwhExport").toString()) : 0.0);
            Double unitCost = data.get("unitCost") != null
                    ? Double.valueOf(data.get("unitCost").toString())
                    : (data.get("unitRate") != null ? Double.valueOf(data.get("unitRate").toString()) : 0.0);
            billingMode = (String) data.get("billingMode");

            // Guard: skip if dates are missing (DB constraint: fromDate NOT NULL)
            if (fromDate == null || toDate == null) {
                System.err.println("[StagingMigration] Skipping billing row for account " + accountNo
                        + " — fromDate or toDate is null. Row will not produce a billing record.");
                skippedCount++;
                continue;
            }

            // Guard: skip if a billing record already exists for this account + period + refNo (via O(1) Hash Set check)
            Boolean forceImport = data.get("forceImport") instanceof Boolean ? (Boolean) data.get("forceImport") : false;
            String billHashKey = buildBillingHashKey(accountNo, refNo, fromDate, toDate);
            if (!forceImport) {
                if (existingBillingKeyHash.contains(billHashKey)) {
                    duplicateCount++;
                    continue;
                }
            }
            existingBillingKeyHash.add(billHashKey);

            // Create billing record
            BillingRecord billingRecord = new BillingRecord(customer, refNo, fromDate, toDate,
                    importUnits, exportUnits, unitCost, billingMode, batchId);

            // NPAY/NGEN fields mapping
            Double energyPurchase = data.get("energyPurchase") != null ? Double.valueOf(data.get("energyPurchase").toString()) : 0.0;
            Double billSetOff = data.get("billSetOff") != null ? Double.valueOf(data.get("billSetOff").toString()) : 0.0;
            Double retentionMoney = data.get("retentionMoney") != null ? Double.valueOf(data.get("retentionMoney").toString()) : 0.0;
            Double payment = data.get("payment") != null ? Double.valueOf(data.get("payment").toString()) : 0.0;
            Double paymentSettled = data.get("paymentSettled") != null ? Double.valueOf(data.get("paymentSettled").toString()) : 0.0;
            Double outstandingBalance = data.get("outstandingBalance") != null ? Double.valueOf(data.get("outstandingBalance").toString()) : 0.0;

            billingRecord.setEnergyPurchase(energyPurchase);
            billingRecord.setBillSetOff(billSetOff);
            billingRecord.setRetentionMoney(retentionMoney);
            billingRecord.setPayment(payment);
            billingRecord.setPaymentSettled(paymentSettled);
            billingRecord.setOutstandingBalance(outstandingBalance);

            Double kwhImport = data.get("kwhImport") != null ? Double.valueOf(data.get("kwhImport").toString()) : null;
            Double kwhExport = data.get("kwhExport") != null ? Double.valueOf(data.get("kwhExport").toString()) : null;
            billingRecord.setKwhImport(kwhImport);
            billingRecord.setKwhExport(kwhExport);
            if (kwhImport != null && kwhExport != null) {
                billingRecord.setKwhSales(kwhExport - kwhImport);
            }
            billingRecord.setPrevReadingDate(fromDate);
            billingRecord.setCurrReadingDate(toDate);

            billingRecordsToSave.add(billingRecord);
            billingInserted++;
            successfulRows++;
        }

        // Batch save accumulated customers and billing records in chunks
        if (!customersToSave.isEmpty()) {
            List<Customer> custList = new ArrayList<>(customersToSave.values());
            for (int i = 0; i < custList.size(); i += chunkSize) {
                customerRepository.saveAll(Objects.requireNonNull(
                        custList.subList(i, Math.min(i + chunkSize, custList.size()))));
            }
            if (customerHashIndexService != null) {
                custList.forEach(customerHashIndexService::putOrUpdate);
            }
        }
        if (!billingRecordsToSave.isEmpty()) {
            for (int i = 0; i < billingRecordsToSave.size(); i += chunkSize) {
                billingRecordRepository.saveAll(Objects.requireNonNull(
                        billingRecordsToSave.subList(i, Math.min(i + chunkSize, billingRecordsToSave.size()))));
            }
        }

        // ── Determine final status ────────────────────────────────────────
        String finalStatus;
        if (successfulRows == 0 && (invalidCount > 0 || duplicateCount > 0 || skippedCount > 0)) {
            finalStatus = "FAILED";
        } else {
            finalStatus = "APPROVED";
        }

        history.setStatus(finalStatus);
        history.setNewCustomers(newCustomers);
        history.setBillingInserted(billingInserted);
        history.setRowsProcessed(successfulRows + invalidCount + duplicateCount + skippedCount);
        history.setErrorsCount(invalidCount);
        uploadHistoryRepository.save(Objects.requireNonNull(history));

        if ("FAILED".equals(finalStatus)) {
            // No valid rows were migrated. Keep staged rows available for review and do not
            // promote the linked directory snapshot to APPROVED.
            updateDirectorySnapshotStatus(history, "FAILED", approvedBy);
            return finalStatus;
        }

        // Auto-reject remaining pending row proposals only after migration is known to succeed.
        List<com.ceb.billing.entities.StagingChangeLog> pending = changeLogRepository.findByUploadBatchIdAndStatus(batchId, "PENDING");
        for (com.ceb.billing.entities.StagingChangeLog p : pending) {
            p.setStatus("REJECTED");
            p.setReviewedBy(approvedBy);
            p.setReviewedAt(java.time.LocalDateTime.now());
            p.setRejectionReason("Batch approved & finalized.");
        }
        if (!pending.isEmpty()) {
            changeLogRepository.saveAll(pending);
        }

        // Delete staging rows for this batch
        stagingRepository.deleteByUploadBatchId(batchId);

        auditLogService.log("STAGING_APPROVED", String.format(
                "Batch ID %d approved by %s. Inserted bills: %d, New/updated customers: %d, "
                + "Skipped (invalid=%d, duplicate=%d, null-date=%d). Final status: %s",
                batchId, approvedBy, billingInserted, newCustomers,
                invalidCount, duplicateCount, skippedCount, finalStatus));

        // Generate alerts for impacted accounts
        if (!impactedAccounts.isEmpty()) {
            try {
                alertService.generateAlertsForAccounts(impactedAccounts);
            } catch (Exception e) {
                System.err.println("Error generating alerts: " + e.getMessage());
            }
        }

        // ── Monthly Customer Directory activation ──────────────────────
        //    The Officer's Step 6 approval already captured the complete final
        //    dataset as a PENDING_APPROVAL snapshot. The Admin's final approval
        //    of the staged batch automatically promotes it to APPROVED — no
        //    data is rebuilt or recompared.
        updateDirectorySnapshotStatus(history, "APPROVED", approvedBy);

        if (eventPublisher != null) {
            eventPublisher.publishEvent(new com.ceb.billing.events.CustomerDirectoryChangedEvent());
        }
        return finalStatus;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String buildBillingHashKey(String accountNo, String refNo, Object fromDate, Object toDate) {
        return (accountNo != null ? accountNo.trim() : "") + "#"
                + (refNo != null ? refNo.trim() : "") + "#"
                + (fromDate != null ? fromDate.toString().trim() : "") + "#"
                + (toDate != null ? toDate.toString().trim() : "");
    }

    private LocalDate safeParseDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) return null;
        try {
            return LocalDate.parse(dateStr.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private boolean isNotBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    /**
     * Promotes (or rejects) the pending Monthly Customer Directory snapshot that belongs to the
     * import session behind this staged batch. The session id is carried in the batch's file name
     * ("Multi-File Import (Session {id})"). Snapshot data itself is never modified here.
     */
    private void updateDirectorySnapshotStatus(UploadHistory history, String newStatus, String actor) {
        try {
            String fileName = history.getFilename();
            if (fileName == null) return;
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("Session\\s+(\\d+)").matcher(fileName);
            if (!m.find()) return;
            Long sessionId = Long.valueOf(m.group(1));
            List<com.ceb.billing.entities.MonthlyDirectorySnapshot> pending =
                    monthlyDirectorySnapshotRepository.findBySessionIdAndStatus(sessionId, "PENDING_APPROVAL");
            for (com.ceb.billing.entities.MonthlyDirectorySnapshot snap : pending) {
                snap.setStatus(newStatus);
                if ("APPROVED".equals(newStatus)) {
                    snap.setApprovedBy(actor);
                    snap.setApprovalDate(java.time.LocalDateTime.now());
                }
                monthlyDirectorySnapshotRepository.save(snap);
                // On final approval, sync the approved records into the Customer Directory so
                // both directories carry the same customer information.
                if ("APPROVED".equals(newStatus)) {
                    try {
                        customerDirectorySyncService.syncSnapshot(snap);
                    } catch (Exception e) {
                        System.err.println("Customer Directory sync failed for snapshot "
                                + snap.getId() + ": " + e.getMessage());
                    }
                }
            }
            if (!pending.isEmpty()) {
                auditLogService.log("DIRECTORY_SNAPSHOT_" + newStatus, String.format(
                        "Monthly Customer Directory snapshot for session %d marked %s by %s (final Admin decision on batch %d).",
                        sessionId, newStatus, actor, history.getId()));
            }
        } catch (Exception e) {
            // Never fail the batch decision because of the directory bookkeeping.
            System.err.println("Error updating Monthly Directory snapshot status: " + e.getMessage());
        }
    }



    @Transactional
    public void rejectBatch(Long batchId, String reason, String rejectedBy) {
        Optional<UploadHistory> optHistory = uploadHistoryRepository.findById(Objects.requireNonNull(batchId));
        if (optHistory.isEmpty()) {
            throw new IllegalArgumentException("Upload batch history not found for ID: " + batchId);
        }
        UploadHistory history = optHistory.get();

        if ("APPROVED".equalsIgnoreCase(history.getStatus())) {
            throw new IllegalStateException("Batch ID " + batchId + " has already been approved and cannot be rejected.");
        }

        // Auto-reject any remaining pending proposals on this batch
        List<com.ceb.billing.entities.StagingChangeLog> pending = changeLogRepository.findByUploadBatchIdAndStatus(batchId, "PENDING");
        for (com.ceb.billing.entities.StagingChangeLog p : pending) {
            p.setStatus("REJECTED");
            p.setReviewedBy(rejectedBy);
            p.setReviewedAt(java.time.LocalDateTime.now());
            p.setRejectionReason("Batch rejected: " + reason);
            changeLogRepository.save(p);
        }

        // Delete staging rows for this batch
        stagingRepository.deleteByUploadBatchId(batchId);

        // Update status to REJECTED
        history.setStatus("REJECTED");
        history.setRejectionReason(reason);
        uploadHistoryRepository.save(history);

        auditLogService.log("STAGING_REJECTED", String.format("Batch ID %d rejected by %s. Reason: %s", batchId, rejectedBy, reason));

        // A rejected batch never received the final Admin approval — mark the pending
        // Monthly Customer Directory snapshot for that session as REJECTED too.
        updateDirectorySnapshotStatus(history, "REJECTED", rejectedBy);

        if (eventPublisher != null) {
            eventPublisher.publishEvent(new com.ceb.billing.events.CustomerDirectoryChangedEvent());
        }
    }
}
