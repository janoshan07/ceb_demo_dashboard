package com.ceb.billing.services;

import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.entities.BillingUploadStaging;
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

    @Transactional
    public void migrateApprovedBatch(Long batchId, String approvedBy) throws Exception {
        Optional<UploadHistory> optHistory = uploadHistoryRepository.findById(Objects.requireNonNull(batchId));
        if (optHistory.isEmpty()) {
            throw new IllegalArgumentException("Upload batch history not found for ID: " + batchId);
        }
        UploadHistory history = optHistory.get();

        List<BillingUploadStaging> stagingRecords = stagingRepository.findByUploadBatchId(batchId);
        int newCustomers = 0;
        int billingInserted = 0;
        int invalidCount = 0;
        int duplicateCount = 0;
        int skippedCount = 0;
        int successfulRows = 0;
        Set<String> impactedAccounts = new HashSet<>();

        for (BillingUploadStaging record : stagingRecords) {
            String status = record.getValidationStatus();

            if ("INVALID".equals(status)) {
                invalidCount++;
                continue;
            }
            if ("DUPLICATE".equals(status)) {
                duplicateCount++;
                continue;
            }

            // Parse shared fields
            Map<String, Object> data = objectMapper.readValue(record.getRawJson(),
                    new TypeReference<Map<String, Object>>() {});

            String accountNo   = (String) data.get("accountNo");
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

            // ── Upsert Customer ───────────────────────────────────────────
            Optional<Customer> optCustomer = customerRepository.findById(accountNo);
            Customer customer;
            if (optCustomer.isEmpty()) {
                customer = new Customer(accountNo, customerName, customerAddress, mobileNo,
                        agreementDate, panelCapacity, bankCode, branchCode, bankAccountNo, solarType);
                customer.setCreatedByUploadId(batchId); // Tag creation upload reference

                if (isNotBlank(costCode)) {
                    customer.setCostCode(costCodeRepository.findByCostCode(costCode.trim()).orElse(null));
                }
                if (isNotBlank(solarType)) {
                    customer.setNetType(netTypeRepository.findByName(solarType.trim()).orElse(null));
                }
                if (isNotBlank(billingMode)) {
                    String cleanEc = billingMode.trim();
                    customer.setExpenseCode(expenseCodeRepository.findByExpCode(cleanEc)
                        .orElseGet(() -> {
                            try {
                                return expenseCodeRepository.findById(Long.valueOf(cleanEc)).orElse(null);
                            } catch (Exception ignored) {
                                return null;
                            }
                        }));
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

                customerRepository.save(Objects.requireNonNull(customer));
                newCustomers++;
            } else {
                customer = optCustomer.get();
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
                    customer.setCostCode(costCodeRepository.findByCostCode(costCode.trim()).orElse(null));
                }
                if (isNotBlank(solarType) && customer.getNetType() == null) {
                    customer.setNetType(netTypeRepository.findByName(solarType.trim()).orElse(null));
                }
                if (isNotBlank(billingMode) && customer.getExpenseCode() == null) {
                    String cleanEc = billingMode.trim();
                    customer.setExpenseCode(expenseCodeRepository.findByExpCode(cleanEc)
                        .orElseGet(() -> {
                            try {
                                return expenseCodeRepository.findById(Long.valueOf(cleanEc)).orElse(null);
                            } catch (Exception ignored) {
                                return null;
                            }
                        }));
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

                customerRepository.save(Objects.requireNonNull(customer));
            }

            // ── CUSTOMER_PROFILE rows: no billing record to create ────────
            if ("CUSTOMER_PROFILE".equals(record.getRowType())) {
                successfulRows++;
                continue;
            }

            // ── BILLING rows: parse billing-specific fields ───────────────
            refNo = (String) data.get("refNo");
            LocalDate fromDate = data.get("fromDate") != null
                    ? safeParseDate((String) data.get("fromDate")) : null;
            LocalDate toDate = data.get("toDate") != null
                    ? safeParseDate((String) data.get("toDate")) : null;
            Double importUnits = data.get("importUnits") != null
                    ? Double.valueOf(data.get("importUnits").toString()) : 0.0;
            Double exportUnits = data.get("exportUnits") != null
                    ? Double.valueOf(data.get("exportUnits").toString()) : 0.0;
            Double unitCost = data.get("unitCost") != null
                    ? Double.valueOf(data.get("unitCost").toString()) : 0.0;
            billingMode = (String) data.get("billingMode");

            // Guard: skip if dates are missing (DB constraint: fromDate NOT NULL)
            if (fromDate == null || toDate == null) {
                System.err.println("[StagingMigration] Skipping billing row for account " + accountNo
                        + " — fromDate or toDate is null. Row will not produce a billing record.");
                skippedCount++;
                continue;
            }

            // Guard: skip if a billing record already exists for this account + period (unless forceImport is true)
            Boolean forceImport = data.get("forceImport") instanceof Boolean ? (Boolean) data.get("forceImport") : false;
            if (!forceImport) {
                boolean alreadyExists = !billingRecordRepository
                        .findByCustomerAccountNoAndFromDateYearAndMonth(accountNo,
                                fromDate.getYear(), fromDate.getMonthValue())
                        .isEmpty();
                if (alreadyExists) {
                    duplicateCount++;
                    continue;
                }
            }

            // Create billing record
            BillingRecord billingRecord = new BillingRecord(customer, refNo, fromDate, toDate,
                    importUnits, exportUnits, unitCost, billingMode, batchId);
            billingRecordRepository.save(Objects.requireNonNull(billingRecord));
            billingInserted++;
            successfulRows++;
        }

        // ── Determine final status ────────────────────────────────────────
        String finalStatus;
        if (successfulRows == 0) {
            finalStatus = (invalidCount > 0 || duplicateCount > 0 || skippedCount > 0) ? "FAILED" : "SUCCESS";
        } else if (invalidCount > 0 || duplicateCount > 0 || skippedCount > 0) {
            finalStatus = "COMPLETED_WITH_ERRORS";
        } else {
            finalStatus = "SUCCESS";
        }

        history.setStatus(finalStatus);
        history.setNewCustomers(newCustomers);
        history.setBillingInserted(billingInserted);
        history.setRowsProcessed(successfulRows + invalidCount + duplicateCount + skippedCount);
        history.setErrorsCount(invalidCount);
        uploadHistoryRepository.save(Objects.requireNonNull(history));

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
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

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



    @Transactional
    public void rejectBatch(Long batchId, String reason, String rejectedBy) {
        Optional<UploadHistory> optHistory = uploadHistoryRepository.findById(Objects.requireNonNull(batchId));
        if (optHistory.isEmpty()) {
            throw new IllegalArgumentException("Upload batch history not found for ID: " + batchId);
        }
        UploadHistory history = optHistory.get();

        // Delete staging rows for this batch
        stagingRepository.deleteByUploadBatchId(batchId);

        // Update status to REJECTED
        history.setStatus("REJECTED");
        history.setRejectionReason(reason);
        uploadHistoryRepository.save(history);

        auditLogService.log("STAGING_REJECTED", String.format("Batch ID %d rejected by %s. Reason: %s", batchId, rejectedBy, reason));
    }
}
