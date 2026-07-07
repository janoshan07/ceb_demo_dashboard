package com.ceb.billing.controllers;

import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.models.ExcelUploadResponse;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.ImportAuditLogRepository;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.services.ExcelParsingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;
import java.time.LocalDate;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping
public class BillingController {

    @Autowired
    private ExcelParsingService excelParsingService;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private ApprovalRequestRepository approvalRequestRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private ImportAuditLogRepository importAuditLogRepository;

    @Autowired
    private com.ceb.billing.services.AuditLogService auditLogService;

    // --- Officer Billing Endpoints ---

    @PostMapping("/api/officer/upload/excel")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> uploadExcelFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Please upload a valid Excel file."));
        }

        String username = SecurityContextHolder.getContext().getAuthentication().getName();

        try {
            ExcelUploadResponse response = excelParsingService.parseAndSaveExcel(file, username);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Excel parsing failed: " + e.getMessage()));
        }
    }

    @GetMapping("/api/officer/billing/uploads")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<List<UploadHistory>> getUploadHistory() {
        List<UploadHistory> history = uploadHistoryRepository.findAll(Sort.by(Sort.Direction.DESC, "uploadTime"));
        return ResponseEntity.ok(history);
    }

    @DeleteMapping("/api/officer/billing/uploads/{uploadId}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> deleteUploadHistory(@PathVariable long uploadId) {
        Optional<UploadHistory> optHistory = uploadHistoryRepository.findById(uploadId);
        if (optHistory.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        UploadHistory history = optHistory.get();
        String filename = history.getFilename();

        // Find all customers created by this upload
        List<Customer> createdCustomers = customerRepository.findByCreatedByUploadId(uploadId);
        int customersDeleted = 0;
        int customersDetached = 0;

        // Delete all billing records linked to this upload first
        billingRecordRepository.deleteByUploadHistoryId(uploadId);

        // Delete associated audit log if exists
        try {
            importAuditLogRepository.deleteByUploadHistoryId(uploadId);
        } catch (Exception ex) {
            ex.printStackTrace();
        }

        // Delete newly created customers if they have no other billing records
        for (Customer customer : createdCustomers) {
            long activeRecordsCount = billingRecordRepository.countByCustomerAccountNo(customer.getAccountNo());
            if (activeRecordsCount == 0) {
                customerRepository.delete(customer);
                customersDeleted++;
            } else {
                customer.setCreatedByUploadId(null);
                customerRepository.save(customer);
                customersDetached++;
            }
        }

        // Delete the upload history record
        uploadHistoryRepository.deleteById(uploadId);

        String actor = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("UPLOAD_ROLLBACK",
                "User " + actor + " deleted upload history entry ID " + uploadId
                        + " (\"" + filename + "\"), associated billing records, and rolled back "
                        + customersDeleted + " newly added customer records (retained/detached " + customersDetached + ").");

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Upload \"" + filename + "\" and associated records deleted. Rolled back " 
                     + customersDeleted + " newly added customers (retained " + customersDetached + " referenced customers).");
        response.put("filename", filename);
        response.put("customersDeleted", customersDeleted);
        response.put("customersDetached", customersDetached);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/officer/billing")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<List<BillingRecord>> getAllBillingRecords() {
        return ResponseEntity.ok(billingRecordRepository.findAll());
    }

    @GetMapping("/api/officer/billing/{accountNo}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getBillingByAccountNo(@PathVariable String accountNo) {
        List<BillingRecord> records = billingRecordRepository.findByCustomerAccountNoOrderByFromDateDesc(accountNo);
        return ResponseEntity.ok(records);
    }

    @PutMapping("/api/officer/billing/{billingId}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> officerUpdateBillingRecord(@PathVariable long billingId,
            @RequestBody BillingRecord billingDetails) {
        Optional<BillingRecord> optRecord = billingRecordRepository.findById(billingId);
        if (optRecord.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        BillingRecord record = optRecord.get();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

            Map<String, Object> oldMap = getBillingFieldMap(record);
            Map<String, Object> newMap = getBillingFieldMap(billingDetails);

            String oldJson = objectMapper.writeValueAsString(oldMap);
            String newJson = objectMapper.writeValueAsString(newMap);

            ApprovalRequest request = new ApprovalRequest(
                    billingId,
                    record.getCustomer().getAccountNo(),
                    userDetails.getUsername(),
                    oldJson,
                    newJson,
                    "PENDING");
            approvalRequestRepository.save(request);
            auditLogService.log("BILLING_EDIT_REQUEST", "Billing Officer " + userDetails.getUsername()
                    + " submitted billing edit request for bill ID " + billingId);

            // Explicitly set status PENDING to notify frontend
            Map<String, Object> response = new HashMap<>();
            response.put("requestId", request.getRequestId());
            response.put("status", "PENDING");
            response.put("message", "Billing edit request queued for approval.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to create approval request: " + e.getMessage()));
        }
    }

    // --- Admin Billing Endpoints ---

    @PutMapping("/api/admin/billing/{billingId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminUpdateBillingRecord(@PathVariable long billingId,
            @RequestBody BillingRecord billingDetails) {
        Optional<BillingRecord> optRecord = billingRecordRepository.findById(billingId);
        if (optRecord.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        BillingRecord record = optRecord.get();
        record.setRefNo(billingDetails.getRefNo());
        record.setFromDate(billingDetails.getFromDate());
        record.setToDate(billingDetails.getToDate());
        record.setImportUnits(billingDetails.getImportUnits());
        record.setExportUnits(billingDetails.getExportUnits());
        record.setUnitCost(billingDetails.getUnitCost());
        record.setBillingMode(billingDetails.getBillingMode());
        record.calculateFields();
        billingRecordRepository.save(record);

        auditLogService.log("BILLING_UPDATE", "Admin updated billing record ID: " + billingId);
        return ResponseEntity.ok(record);
    }

    private Map<String, Object> getBillingFieldMap(BillingRecord record) {
        Map<String, Object> map = new HashMap<>();
        map.put("refNo", record.getRefNo());
        map.put("fromDate", record.getFromDate() != null ? record.getFromDate().toString() : null);
        map.put("toDate", record.getToDate() != null ? record.getToDate().toString() : null);
        map.put("importUnits", record.getImportUnits());
        map.put("exportUnits", record.getExportUnits());
        map.put("unitCost", record.getUnitCost());
        map.put("billingMode", record.getBillingMode());
        return map;
    }

    @PostMapping("/api/admin/billing")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminCreateBillingRecord(@RequestBody Map<String, Object> payload) {
        try {
            String accountNo = (String) payload.get("accountNo");
            Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
            if (optCustomer.isEmpty()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Customer account not found: " + accountNo));
            }
            BillingRecord record = new BillingRecord();
            record.setCustomer(optCustomer.get());
            mapBillingRecordFields(record, payload);
            billingRecordRepository.save(record);
            
            String actor = SecurityContextHolder.getContext().getAuthentication().getName();
            auditLogService.log("BILLING_CREATE", "Admin " + actor + " manually created billing record ID: " + record.getBillingId() + " for customer " + accountNo);
            return ResponseEntity.ok(record);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to create billing record: " + e.getMessage()));
        }
    }

    @PostMapping("/api/officer/billing")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> officerCreateBillingRecord(@RequestBody Map<String, Object> payload) {
        try {
            String accountNo = (String) payload.get("accountNo");
            Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
            if (optCustomer.isEmpty()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Customer account not found: " + accountNo));
            }
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
            
            String newJson = objectMapper.writeValueAsString(payload);
            ApprovalRequest request = new ApprovalRequest(
                    null,
                    accountNo,
                    username,
                    "{}",
                    newJson,
                    "PENDING",
                    "CREATE",
                    "BILLING"
            );
            approvalRequestRepository.save(request);
            auditLogService.log("BILLING_CREATE_REQUEST", "Officer " + username + " submitted manual billing creation request for customer " + accountNo);
            
            Map<String, Object> response = new HashMap<>();
            response.put("requestId", request.getRequestId());
            response.put("status", "PENDING");
            response.put("message", "Manual billing creation request queued for approval.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to queue creation request: " + e.getMessage()));
        }
    }

    @DeleteMapping("/api/admin/billing/{billingId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminDeleteBillingRecord(@PathVariable long billingId) {
        Optional<BillingRecord> optRecord = billingRecordRepository.findById(billingId);
        if (optRecord.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        billingRecordRepository.delete(Objects.requireNonNull(optRecord.get()));
        String actor = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("BILLING_DELETE", "Admin " + actor + " manually deleted billing record ID: " + billingId);
        return ResponseEntity.ok(new MessageResponse("Billing record deleted successfully."));
    }

    @DeleteMapping("/api/officer/billing/{billingId}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> officerDeleteBillingRecord(@PathVariable long billingId) {
        Optional<BillingRecord> optRecord = billingRecordRepository.findById(billingId);
        if (optRecord.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        BillingRecord record = optRecord.get();
        try {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
            
            Map<String, Object> oldMap = getBillingFieldMap(record);
            String oldJson = objectMapper.writeValueAsString(oldMap);
            
            ApprovalRequest request = new ApprovalRequest(
                    billingId,
                    record.getCustomer().getAccountNo(),
                    username,
                    oldJson,
                    "{}",
                    "PENDING",
                    "DELETE",
                    "BILLING"
            );
            approvalRequestRepository.save(request);
            auditLogService.log("BILLING_DELETE_REQUEST", "Officer " + username + " submitted billing deletion request for bill ID " + billingId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("requestId", request.getRequestId());
            response.put("status", "PENDING");
            response.put("message", "Billing deletion request queued for approval.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to queue deletion request: " + e.getMessage()));
        }
    }

    private void mapBillingRecordFields(BillingRecord record, Map<String, Object> values) {
        if (values.containsKey("refNo"))
            record.setRefNo((String) values.get("refNo"));
        if (values.containsKey("fromDate") && values.get("fromDate") != null) {
            record.setFromDate(LocalDate.parse((String) values.get("fromDate")));
        }
        if (values.containsKey("toDate") && values.get("toDate") != null) {
            record.setToDate(LocalDate.parse((String) values.get("toDate")));
        }
        if (values.containsKey("importUnits") && values.get("importUnits") != null) {
            record.setImportUnits(Double.valueOf(values.get("importUnits").toString()));
        }
        if (values.containsKey("exportUnits") && values.get("exportUnits") != null) {
            record.setExportUnits(Double.valueOf(values.get("exportUnits").toString()));
        }
        if (values.containsKey("unitCost") && values.get("unitCost") != null) {
            record.setUnitCost(Double.valueOf(values.get("unitCost").toString()));
        }
        if (values.containsKey("billingMode"))
            record.setBillingMode((String) values.get("billingMode"));
        if (values.containsKey("billCycle") && values.get("billCycle") != null && !values.get("billCycle").toString().isEmpty()) {
            record.setBillCycle(Integer.valueOf(values.get("billCycle").toString()));
        }
        if (values.containsKey("billSetOff") && values.get("billSetOff") != null && !values.get("billSetOff").toString().isEmpty()) {
            record.setBillSetOff(Double.valueOf(values.get("billSetOff").toString()));
        }
        if (values.containsKey("retentionMoney") && values.get("retentionMoney") != null && !values.get("retentionMoney").toString().isEmpty()) {
            record.setRetentionMoney(Double.valueOf(values.get("retentionMoney").toString()));
        }
        if (values.containsKey("payment") && values.get("payment") != null && !values.get("payment").toString().isEmpty()) {
            record.setPayment(Double.valueOf(values.get("payment").toString()));
        }
        record.calculateFields();
    }
}
