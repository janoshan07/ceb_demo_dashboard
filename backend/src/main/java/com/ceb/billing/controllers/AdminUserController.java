package com.ceb.billing.controllers;

import com.ceb.billing.entities.AuditLog;
import com.ceb.billing.entities.User;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.entities.BillingUploadStaging;
import com.ceb.billing.repositories.AuditLogRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.ImportBatchRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.repositories.BillingUploadStagingRepository;
import com.ceb.billing.services.AuditLogService;
import com.ceb.billing.services.StagingMigrationService;
import com.ceb.billing.models.MessageResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import com.ceb.billing.services.ExcelValidationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;


// Admin user management controller
@RestController

@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private BillingUploadStagingRepository stagingRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private ImportBatchRepository importBatchRepository;

    @Autowired
    private StagingMigrationService stagingMigrationService;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private ExcelValidationService excelValidationService;

    @Autowired
    private ObjectMapper objectMapper;


    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody User user) {
        if (user.getUsername() == null || user.getUsername().trim().isEmpty() ||
                user.getPassword() == null || user.getPassword().trim().isEmpty() ||
                user.getRole() == null || user.getRole().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Missing username, password, or role"));
        }

        String assignedRole = user.getRole().trim().toUpperCase();
        if (!assignedRole.equals("ADMIN") && !assignedRole.equals("OFFICER") && !assignedRole.equals("USER")) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Invalid role. Allowed roles: ADMIN, OFFICER, USER"));
        }

        if (userRepository.findByUsername(user.getUsername().trim()).isPresent()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Username already exists!"));
        }

        user.setUsername(user.getUsername().trim());
        user.setPassword(encoder.encode(user.getPassword().trim()));
        user.setRole(assignedRole);
        userRepository.save(Objects.requireNonNull(user));

        auditLogService.log("USER_CREATED", "Created user: " + user.getUsername() + " with role: " + user.getRole());
        return ResponseEntity.ok(user);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable long id, @RequestBody User userDetails) {
        Optional<User> optUser = userRepository.findById(id);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = optUser.get();

        // Update password if present and not empty
        if (userDetails.getPassword() != null && !userDetails.getPassword().trim().isEmpty()) {
            user.setPassword(encoder.encode(userDetails.getPassword().trim()));
        }

        // Update role
        if (userDetails.getRole() != null && !userDetails.getRole().trim().isEmpty()) {
            String assignedRole = userDetails.getRole().trim().toUpperCase();
            if (!assignedRole.equals("ADMIN") && !assignedRole.equals("OFFICER") && !assignedRole.equals("USER")) {
                return ResponseEntity.badRequest()
                        .body(new MessageResponse("Invalid role. Allowed roles: ADMIN, OFFICER, USER"));
            }
            user.setRole(assignedRole);
        }

        userRepository.save(Objects.requireNonNull(user));

        auditLogService.log("USER_UPDATED", "Updated user details for username: " + user.getUsername());
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable long id) {
        Optional<User> optUser = userRepository.findById(id);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = optUser.get();
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();

        if (user.getUsername().equals(currentUsername)) {
            return ResponseEntity.badRequest().body(new MessageResponse("You cannot delete your own account!"));
        }

        userRepository.delete(user);
        auditLogService.log("USER_DELETED", "Deleted user: " + user.getUsername());

        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        List<AuditLog> logs = auditLogRepository.findAllByOrderByTimestampDesc();
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/staging/pending")
    public ResponseEntity<List<UploadHistory>> getPendingStagingBatches() {
        return ResponseEntity.ok(uploadHistoryRepository.findByStatusOrderByUploadTimeDesc("PENDING_APPROVAL"));
    }

    @GetMapping("/staging/batch/{batchId}")
    public ResponseEntity<List<BillingUploadStaging>> getStagingBatchDetails(@PathVariable long batchId) {
        return ResponseEntity.ok(stagingRepository.findByUploadBatchId(batchId));
    }

    @PostMapping("/staging/batch/{batchId}/approve")
    public ResponseEntity<?> approveStagingBatch(@PathVariable long batchId) {
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            stagingMigrationService.migrateApprovedBatch(batchId, currentUsername);
            return ResponseEntity.ok(new MessageResponse("Staging batch approved and successfully migrated to main tables."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to migrate staging batch: " + e.getMessage()));
        }
    }

    @PostMapping("/staging/batch/{batchId}/reject")
    public ResponseEntity<?> rejectStagingBatch(@PathVariable long batchId) {
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            stagingMigrationService.rejectBatch(batchId, currentUsername);
            return ResponseEntity.ok(new MessageResponse("Staging batch successfully rejected and staging rows discarded."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to reject staging batch: " + e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DATA MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────

    /**
     * DELETE /api/admin/data/customers
     *
     * Purges customer and billing data from the database.
     *
     * Supported scopes (query param ?scope=):
     *   customers-only (default) — deletes billing_records then customers
     *   full                     — also deletes upload_history, billing_upload_staging, import_batches
     *
     * Billing records must be deleted before customers due to the FK constraint.
     */
    @DeleteMapping("/data/customers")
    public ResponseEntity<?> purgeCustomerData(
            @RequestParam(value = "scope", defaultValue = "customers-only") String scope) {

        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean fullScope = "full".equalsIgnoreCase(scope.trim());

        long billingDeleted  = billingRecordRepository.count();
        long customerDeleted = customerRepository.count();
        long historyDeleted  = 0;
        long stagingDeleted  = 0;
        long batchesDeleted  = 0;

        // 1. Delete billing records first (FK: billing_records.account_no → customers.account_no)
        billingRecordRepository.deleteAll();

        // 2. Delete all customers
        customerRepository.deleteAll();

        if (fullScope) {
            // 3. Delete staging rows
            stagingDeleted = stagingRepository.count();
            stagingRepository.deleteAll();

            // 4. Delete upload history
            historyDeleted = uploadHistoryRepository.count();
            uploadHistoryRepository.deleteAll();

            // 5. Delete import batches
            batchesDeleted = importBatchRepository.count();
            importBatchRepository.deleteAll();
        }

        String auditDetails = String.format(
                "[DATA PURGE] scope=%s — deleted: %d billing records, %d customers%s. Performed by: %s",
                scope, billingDeleted, customerDeleted,
                fullScope ? String.format(", %d upload histories, %d staging rows, %d import batches",
                        historyDeleted, stagingDeleted, batchesDeleted) : "",
                currentUsername);
        auditLogService.log("DATA_PURGE", auditDetails);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "Customer data purge completed successfully.");
        result.put("scope", scope);
        result.put("billingRecordsDeleted", billingDeleted);
        result.put("customersDeleted", customerDeleted);
        if (fullScope) {
            result.put("uploadHistoriesDeleted", historyDeleted);
            result.put("stagingRowsDeleted", stagingDeleted);
            result.put("importBatchesDeleted", batchesDeleted);
        }
        return ResponseEntity.ok(result);
    }

    @PutMapping("/staging/row/{stagingId}")
    public ResponseEntity<?> updateStagingRow(@PathVariable long stagingId, @RequestBody Map<String, Object> updatedFields) {
        Optional<BillingUploadStaging> optStaging = stagingRepository.findById(stagingId);
        if (optStaging.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        BillingUploadStaging row = optStaging.get();
        try {
            // 1. Parse current raw JSON
            Map<String, Object> rawData = objectMapper.readValue(row.getRawJson(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            
            // 2. Overlay updated fields
            rawData.putAll(updatedFields);
            
            // 3. Re-run validation based on row type
            String validationStatus = "VALID";
            List<String> errorMsgs = new ArrayList<>();
            
            String rowType = row.getRowType(); // "BILLING" or "CUSTOMER_PROFILE"
            String sheetName = rawData.get("sheetName") != null ? rawData.get("sheetName").toString() : "Sheet";
            int rowNum = rawData.get("rowNum") != null ? Integer.parseInt(rawData.get("rowNum").toString()) : 1;
            String accountNo = rawData.get("accountNo") != null ? rawData.get("accountNo").toString() : "";
            
            if ("CUSTOMER_PROFILE".equalsIgnoreCase(rowType)) {
                String customerName = rawData.get("customerName") != null ? rawData.get("customerName").toString() : "";
                String customerAddress = rawData.get("customerAddress") != null ? rawData.get("customerAddress").toString() : "";
                String mobileNo = rawData.get("mobileNo") != null ? rawData.get("mobileNo").toString() : "";
                String bankCode = rawData.get("bankCode") != null ? rawData.get("bankCode").toString() : "";
                String branchCode = rawData.get("branchCode") != null ? rawData.get("branchCode").toString() : "";
                String bankAccountNo = rawData.get("bankAccountNo") != null ? rawData.get("bankAccountNo").toString() : "";
                String agreementDate = rawData.get("agreementDate") != null ? rawData.get("agreementDate").toString() : "";
                Double panelCapacity = rawData.get("panelCapacity") != null && !rawData.get("panelCapacity").toString().isEmpty() 
                        ? Double.valueOf(rawData.get("panelCapacity").toString()) : null;
                String solarType = rawData.get("solarType") != null ? rawData.get("solarType").toString() : "";
                String costCode = rawData.get("costCode") != null ? rawData.get("costCode").toString() : "";
                String billingMode = rawData.get("billingMode") != null ? rawData.get("billingMode").toString() : "";
                
                ExcelValidationService.RowValidationResult valResult =
                        excelValidationService.validateCustomerRow(
                                sheetName, rowNum, accountNo, customerName, customerAddress, mobileNo, 
                                bankCode, branchCode, bankAccountNo, agreementDate, panelCapacity, solarType, 
                                costCode, billingMode);
                
                validationStatus = valResult.hasErrors() ? "INVALID" : valResult.hasWarnings() ? "WARNING" : "VALID";
                for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                    errorMsgs.add(err.getErrorMessage());
                }
            } else {
                // BILLING row
                String customerName = rawData.get("customerName") != null ? rawData.get("customerName").toString() : "";
                String rawFromDate = rawData.get("fromDate") != null ? rawData.get("fromDate").toString() : "";
                String rawToDate = rawData.get("toDate") != null ? rawData.get("toDate").toString() : "";
                String importUnitsStr = rawData.get("importUnits") != null ? rawData.get("importUnits").toString() : "";
                String exportUnitsStr = rawData.get("exportUnits") != null ? rawData.get("exportUnits").toString() : "";
                String unitCostStr = rawData.get("unitCost") != null ? rawData.get("unitCost").toString() : "";
                String bankCode = rawData.get("bankCode") != null ? rawData.get("bankCode").toString() : "";
                
                java.time.LocalDate fromDate = null, toDate = null;
                try { if (!rawFromDate.isEmpty()) fromDate = java.time.LocalDate.parse(rawFromDate); } catch(Exception e) {}
                try { if (!rawToDate.isEmpty()) toDate = java.time.LocalDate.parse(rawToDate); } catch(Exception e) {}
                
                Double importUnits = null, exportUnits = null, unitCost = null;
                try { if (!importUnitsStr.isEmpty()) importUnits = Double.parseDouble(importUnitsStr); } catch(Exception e) {}
                try { if (!exportUnitsStr.isEmpty()) exportUnits = Double.parseDouble(exportUnitsStr); } catch(Exception e) {}
                try { if (!unitCostStr.isEmpty()) unitCost = Double.parseDouble(unitCostStr); } catch(Exception e) {}
                
                ExcelValidationService.RowValidationResult valResult =
                        excelValidationService.validateRow(
                                sheetName, rowNum, "BILLING", accountNo, customerName,
                                rawFromDate, fromDate, rawToDate, toDate,
                                importUnitsStr, importUnits, exportUnitsStr, exportUnits,
                                unitCostStr, unitCost, bankCode,
                                rawData.get("customerAddress") != null ? rawData.get("customerAddress").toString() : "",
                                rawData.get("mobileNo") != null ? rawData.get("mobileNo").toString() : "",
                                rawData.get("bankAccountNo") != null ? rawData.get("bankAccountNo").toString() : "",
                                rawData.get("branchCode") != null ? rawData.get("branchCode").toString() : "",
                                rawData.get("billingMode") != null ? rawData.get("billingMode").toString() : "",
                                rawData.get("agreementDate") != null ? rawData.get("agreementDate").toString() : "",
                                rawData.get("panelCapacity") != null && !rawData.get("panelCapacity").toString().isEmpty() 
                                        ? Double.valueOf(rawData.get("panelCapacity").toString()) : null,
                                rawData.get("solarType") != null ? rawData.get("solarType").toString() : "",
                                new java.util.HashSet<>()
                        );
                
                validationStatus = valResult.hasDuplicate() ? "DUPLICATE" : valResult.hasErrors() ? "INVALID" : valResult.hasWarnings() ? "WARNING" : "VALID";
                for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                    errorMsgs.add(err.getErrorMessage());
                }
            }
            
            // 4. Save updated staging row to database
            row.setRawJson(objectMapper.writeValueAsString(rawData));
            row.setValidationStatus(validationStatus);
            row.setValidationErrors(objectMapper.writeValueAsString(errorMsgs));
            stagingRepository.save(row);
            
            // Log update action
            auditLogService.log("STAGING_ROW_EDITED", String.format("Staged row ID %d (Type: %s, Acc: %s) updated and re-validated to status: %s", stagingId, rowType, accountNo, validationStatus));
            
            // Return updated row formatted for frontend
            Map<String, Object> response = new HashMap<>();
            response.put("stagingId", row.getStagingId());
            response.put("validationStatus", row.getValidationStatus());
            response.put("errors", errorMsgs.stream().map(msg -> Map.of("errorMessage", msg, "field", "Edit", "warning", false)).toList());
            response.put("rowType", row.getRowType());
            response.put("rowNum", rowNum);
            response.putAll(rawData);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to update staging row: " + e.getMessage()));
        }
    }

    @PostMapping("/staging/mock/seed")
    public ResponseEntity<?> seedMockStaging() {
        try {
            // Create a mock UploadHistory row
            UploadHistory history = new UploadHistory(
                    "mock_test_batch.xlsx",
                    "admin",
                    "PENDING_APPROVAL",
                    0, 0, 0, 0
            );
            history = uploadHistoryRepository.save(history);
            long batchId = history.getId();

            // Create a mock BillingUploadStaging row
            Map<String, Object> mockRawData = new HashMap<>();
            mockRawData.put("accountNo", "1122334455");
            mockRawData.put("customerName", "Mock Invalid Customer");
            mockRawData.put("fromDate", "2026-01-01");
            mockRawData.put("toDate", "2026-01-31");
            mockRawData.put("importUnits", 100.0);
            mockRawData.put("exportUnits", 200.0);
            mockRawData.put("unitCost", 15.0);
            mockRawData.put("rowNum", 2);
            mockRawData.put("sheetName", "BillingData");

            String rawJson = objectMapper.writeValueAsString(mockRawData);
            List<String> mockErrors = List.of("Account No length must be 10 characters.");
            String errJson = objectMapper.writeValueAsString(mockErrors);

            BillingUploadStaging stagingRow = new BillingUploadStaging(
                    batchId,
                    rawJson,
                    "INVALID",
                    errJson,
                    "BILLING"
            );
            stagingRepository.save(stagingRow);

            Map<String, Object> response = new HashMap<>();
            response.put("stagingBatchId", batchId);
            response.put("stagingId", stagingRow.getStagingId());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Seeding failed: " + e.getMessage()));
        }
    }
}

