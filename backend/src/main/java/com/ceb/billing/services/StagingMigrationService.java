package com.ceb.billing.services;

import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.entities.BillingUploadStaging;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.repositories.BillingUploadStagingRepository;
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

            // Valid or Warning - migrate to main tables
            Map<String, Object> data = objectMapper.readValue(record.getRawJson(), new TypeReference<Map<String, Object>>() {});

            String accountNo = (String) data.get("accountNo");
            impactedAccounts.add(accountNo);
            String customerName = (String) data.get("customerName");
            String refNo = (String) data.get("refNo");
            LocalDate fromDate = data.get("fromDate") != null ? LocalDate.parse((String) data.get("fromDate")) : null;
            LocalDate toDate = data.get("toDate") != null ? LocalDate.parse((String) data.get("toDate")) : null;
            
            Double importUnits = data.get("importUnits") != null ? Double.valueOf(data.get("importUnits").toString()) : 0.0;
            Double exportUnits = data.get("exportUnits") != null ? Double.valueOf(data.get("exportUnits").toString()) : 0.0;
            Double unitCost = data.get("unitCost") != null ? Double.valueOf(data.get("unitCost").toString()) : 0.0;

            String bankCode = (String) data.get("bankCode");
            String branchCode = (String) data.get("branchCode");
            String bankAccountNo = (String) data.get("bankAccountNo");
            String billingMode = (String) data.get("billingMode");
            String customerAddress = (String) data.get("customerAddress");
            String mobileNo = (String) data.get("mobileNo");
            LocalDate agreementDate = data.get("agreementDate") != null ? LocalDate.parse((String) data.get("agreementDate")) : null;
            Double panelCapacity = data.get("panelCapacity") != null ? Double.valueOf(data.get("panelCapacity").toString()) : null;
            String solarType = (String) data.get("solarType");

            // Save / Update Customer
            Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
            Customer customer;
            if (optCustomer.isEmpty()) {
                customer = new Customer(accountNo, customerName, customerAddress, mobileNo, agreementDate,
                        panelCapacity, bankCode, branchCode, bankAccountNo, solarType);
                customerRepository.save(Objects.requireNonNull(customer));
                newCustomers++;
            } else {
                customer = optCustomer.get();
                // Only update fields that are currently null/empty — never overwrite existing data
                if (customerName != null && !customerName.isEmpty()
                        && (customer.getCustomerName() == null || customer.getCustomerName().isEmpty())) {
                    customer.setCustomerName(customerName);
                }
                if (bankCode != null && !bankCode.isEmpty() && (customer.getBankCode() == null || customer.getBankCode().isEmpty()))
                    customer.setBankCode(bankCode);
                if (branchCode != null && !branchCode.isEmpty() && (customer.getBranchCode() == null || customer.getBranchCode().isEmpty()))
                    customer.setBranchCode(branchCode);
                if (bankAccountNo != null && !bankAccountNo.isEmpty() && (customer.getBankAccountNo() == null || customer.getBankAccountNo().isEmpty()))
                    customer.setBankAccountNo(bankAccountNo);
                if (customerAddress != null && !customerAddress.isEmpty() && (customer.getCustomerAddress() == null || customer.getCustomerAddress().isEmpty()))
                    customer.setCustomerAddress(customerAddress);
                if (mobileNo != null && !mobileNo.isEmpty() && (customer.getMobileNo() == null || customer.getMobileNo().isEmpty()))
                    customer.setMobileNo(mobileNo);
                if (agreementDate != null && customer.getAgreementDate() == null)
                    customer.setAgreementDate(agreementDate);
                if (panelCapacity != null && customer.getPanelCapacity() == null)
                    customer.setPanelCapacity(panelCapacity);
                if (solarType != null && !solarType.isEmpty() && (customer.getSolarType() == null || customer.getSolarType().isEmpty()))
                    customer.setSolarType(solarType);
                customerRepository.save(Objects.requireNonNull(customer));
            }

            // Guard: skip billing record if one already exists for this account + billing period
            if (fromDate != null) {
                boolean alreadyExists = billingRecordRepository
                        .findByCustomerAccountNoAndFromDateYearAndMonth(accountNo, fromDate.getYear(), fromDate.getMonthValue())
                        .isPresent();
                if (alreadyExists) {
                    duplicateCount++;
                    continue;
                }
            }

            // Create Billing Record
            BillingRecord billingRecord = new BillingRecord(customer, refNo, fromDate, toDate, importUnits,
                    exportUnits, unitCost, billingMode, batchId);
            billingRecordRepository.save(Objects.requireNonNull(billingRecord));
            billingInserted++;
        }

        // Determine final status
        String finalStatus = "SUCCESS";
        if (invalidCount > 0 || duplicateCount > 0) {
            finalStatus = (billingInserted > 0) ? "COMPLETED_WITH_ERRORS" : "FAILED";
        }

        history.setStatus(finalStatus);
        history.setNewCustomers(newCustomers);
        history.setBillingInserted(billingInserted);
        uploadHistoryRepository.save(Objects.requireNonNull(history));

        // Delete staging rows for this batch
        stagingRepository.deleteByUploadBatchId(batchId);

        auditLogService.log("STAGING_APPROVED", String.format(
                "Batch ID %d approved by %s. Inserted bills: %d, New customers: %d, Skipped (invalid/duplicate): %d",
                batchId, approvedBy, billingInserted, newCustomers, (invalidCount + duplicateCount)));

        // Generate alerts for impacted accounts
        if (!impactedAccounts.isEmpty()) {
            try {
                alertService.generateAlertsForAccounts(impactedAccounts);
            } catch (Exception e) {
                System.err.println("Error generating alerts: " + e.getMessage());
            }
        }
    }

    @Transactional
    public void rejectBatch(Long batchId, String rejectedBy) {
        Optional<UploadHistory> optHistory = uploadHistoryRepository.findById(Objects.requireNonNull(batchId));
        if (optHistory.isEmpty()) {
            throw new IllegalArgumentException("Upload batch history not found for ID: " + batchId);
        }
        UploadHistory history = optHistory.get();

        // Delete staging rows for this batch
        stagingRepository.deleteByUploadBatchId(batchId);

        // Update status to REJECTED
        history.setStatus("REJECTED");
        uploadHistoryRepository.save(history);

        auditLogService.log("STAGING_REJECTED", String.format("Batch ID %d rejected by %s.", batchId, rejectedBy));
    }
}
