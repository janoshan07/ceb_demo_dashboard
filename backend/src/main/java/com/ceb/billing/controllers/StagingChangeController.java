package com.ceb.billing.controllers;

import com.ceb.billing.entities.BillingUploadStaging;
import com.ceb.billing.entities.StagingChangeLog;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.repositories.BillingUploadStagingRepository;
import com.ceb.billing.repositories.StagingChangeLogRepository;
import com.ceb.billing.services.AuditLogService;
import com.ceb.billing.services.ExcelValidationService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api")
public class StagingChangeController {

    @Autowired
    private StagingChangeLogRepository changeLogRepository;

    @Autowired
    private BillingUploadStagingRepository stagingRepository;

    @Autowired
    private ExcelValidationService excelValidationService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private ObjectMapper objectMapper;

    // ────────────────────────────────────────────────────────────────────────
    //  OFFICER ENDPOINTS
    // ────────────────────────────────────────────────────────────────────────

    @PostMapping("/officer/staging/batch/{batchId}/row/{stagingId}/propose-edit")
    @PreAuthorize("hasRole('OFFICER')")
    public ResponseEntity<?> proposeEdit(
            @PathVariable Long batchId,
            @PathVariable Long stagingId,
            @RequestBody Map<String, Object> updatedFields) {
        
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<BillingUploadStaging> optStaging = stagingRepository.findById(stagingId);
        if (optStaging.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        BillingUploadStaging stagingRow = optStaging.get();

        try {
            // Parse current JSON
            Map<String, Object> rawData = objectMapper.readValue(stagingRow.getRawJson(),
                    new TypeReference<Map<String, Object>>() {});
            
            // Merged data for proposed change
            Map<String, Object> proposedData = new LinkedHashMap<>(rawData);
            proposedData.putAll(updatedFields);

            // Re-validate to get correct validation errors/status
            String validationStatus = "VALID";
            List<String> errorMsgs = new ArrayList<>();
            String rowType = stagingRow.getRowType();
            String sheetName = rawData.get("sheetName") != null ? rawData.get("sheetName").toString() : "Sheet";
            int rowNum = rawData.get("rowNum") != null ? Integer.parseInt(rawData.get("rowNum").toString()) : 1;
            String accountNo = proposedData.get("accountNo") != null ? proposedData.get("accountNo").toString() : "";

            if ("CUSTOMER_PROFILE".equalsIgnoreCase(rowType)) {
                String customerName = proposedData.get("customerName") != null ? proposedData.get("customerName").toString() : "";
                String customerAddress = proposedData.get("customerAddress") != null ? proposedData.get("customerAddress").toString() : "";
                String mobileNo = proposedData.get("mobileNo") != null ? proposedData.get("mobileNo").toString() : "";
                String bankCode = proposedData.get("bankCode") != null ? proposedData.get("bankCode").toString() : "";
                String branchCode = proposedData.get("branchCode") != null ? proposedData.get("branchCode").toString() : "";
                String bankAccountNo = proposedData.get("bankAccountNo") != null ? proposedData.get("bankAccountNo").toString() : "";
                String agreementDate = proposedData.get("agreementDate") != null ? proposedData.get("agreementDate").toString() : "";
                Double panelCapacity = proposedData.get("panelCapacity") != null && !proposedData.get("panelCapacity").toString().isEmpty()
                        ? Double.valueOf(proposedData.get("panelCapacity").toString()) : null;
                String solarType = ExcelValidationService.normalizeSolarType(proposedData.get("solarType") != null ? proposedData.get("solarType").toString() : "");
                proposedData.put("solarType", solarType);
                String costCode = proposedData.get("costCode") != null ? proposedData.get("costCode").toString() : "";
                String tariffType = proposedData.get("tariffType") != null ? proposedData.get("tariffType").toString() : "";
                // Auto-recalculate L-Code (billingMode)
                String billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);
                proposedData.put("billingMode", billingMode);
                String refNo = proposedData.get("refNo") != null ? proposedData.get("refNo").toString() : "";
                Double unitRate = proposedData.get("unitRate") != null && !proposedData.get("unitRate").toString().isEmpty()
                        ? Double.valueOf(proposedData.get("unitRate").toString()) : null;

                ExcelValidationService.RowValidationResult valResult =
                        excelValidationService.validateCustomerRow(
                                sheetName, rowNum, accountNo, customerName, customerAddress, mobileNo,
                                bankCode, branchCode, bankAccountNo, agreementDate, panelCapacity, solarType,
                                costCode, billingMode, refNo, unitRate, tariffType);

                validationStatus = valResult.hasErrors() ? "ERROR" : valResult.hasWarnings() ? "WARNING" : "VALID";
                for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                    errorMsgs.add(err.getErrorMessage());
                }
            } else {
                String customerName = proposedData.get("customerName") != null ? proposedData.get("customerName").toString() : "";
                String rawFromDate = proposedData.get("fromDate") != null ? proposedData.get("fromDate").toString() : "";
                String rawToDate = proposedData.get("toDate") != null ? proposedData.get("toDate").toString() : "";
                String importUnitsStr = proposedData.get("importUnits") != null ? proposedData.get("importUnits").toString() : "";
                String exportUnitsStr = proposedData.get("exportUnits") != null ? proposedData.get("exportUnits").toString() : "";
                String unitCostStr = proposedData.get("unitCost") != null ? proposedData.get("unitCost").toString() : "";
                String bankCode = proposedData.get("bankCode") != null ? proposedData.get("bankCode").toString() : "";

                java.time.LocalDate fromDate = null, toDate = null;
                try { if (!rawFromDate.isEmpty()) fromDate = java.time.LocalDate.parse(rawFromDate); } catch(Exception e) {}
                try { if (!rawToDate.isEmpty()) toDate = java.time.LocalDate.parse(rawToDate); } catch(Exception e) {}

                Double importUnits = null, exportUnits = null, unitCost = null;
                try { if (!importUnitsStr.isEmpty()) importUnits = Double.parseDouble(importUnitsStr); } catch(Exception e) {}
                try { if (!exportUnitsStr.isEmpty()) exportUnits = Double.parseDouble(exportUnitsStr); } catch(Exception e) {}
                try { if (!unitCostStr.isEmpty()) unitCost = Double.parseDouble(unitCostStr); } catch(Exception e) {}

                String solarType = ExcelValidationService.normalizeSolarType(proposedData.get("solarType") != null ? proposedData.get("solarType").toString() : "");
                proposedData.put("solarType", solarType);
                String tariffType = proposedData.get("tariffType") != null ? proposedData.get("tariffType").toString() : "";
                String billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);
                proposedData.put("billingMode", billingMode);

                ExcelValidationService.RowValidationResult valResult =
                        excelValidationService.validateRow(
                                sheetName, rowNum, "BILLING", accountNo, customerName,
                                rawFromDate, fromDate, rawToDate, toDate,
                                importUnitsStr, importUnits, exportUnitsStr, exportUnits,
                                unitCostStr, unitCost, bankCode,
                                proposedData.get("customerAddress") != null ? proposedData.get("customerAddress").toString() : "",
                                proposedData.get("mobileNo") != null ? proposedData.get("mobileNo").toString() : "",
                                proposedData.get("bankAccountNo") != null ? proposedData.get("bankAccountNo").toString() : "",
                                proposedData.get("branchCode") != null ? proposedData.get("branchCode").toString() : "",
                                billingMode,
                                proposedData.get("agreementDate") != null ? proposedData.get("agreementDate").toString() : "",
                                proposedData.get("panelCapacity") != null && !proposedData.get("panelCapacity").toString().isEmpty()
                                        ? Double.valueOf(proposedData.get("panelCapacity").toString()) : null,
                                solarType,
                                tariffType,
                                new java.util.HashSet<>()
                        );

                validationStatus = valResult.hasDuplicate() ? "DUPLICATE" : valResult.hasErrors() ? "ERROR" : valResult.hasWarnings() ? "WARNING" : "VALID";
                for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                    errorMsgs.add(err.getErrorMessage());
                }
            }

            // Save Proposal
            StagingChangeLog proposal = new StagingChangeLog(
                    batchId,
                    stagingId,
                    rowType,
                    "EDIT",
                    stagingRow.getRawJson(),
                    objectMapper.writeValueAsString(proposedData),
                    username
            );
            proposal.setStatus("PENDING");
            changeLogRepository.save(proposal);

            auditLogService.log("PROPOSAL_EDIT_SUBMITTED",
                    String.format("Officer %s proposed edit on staged row ID %d in batch %d", username, stagingId, batchId));

            return ResponseEntity.ok(proposal);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to propose edit: " + e.getMessage()));
        }
    }

    @PostMapping("/officer/staging/batch/{batchId}/row/{stagingId}/propose-delete")
    @PreAuthorize("hasRole('OFFICER')")
    public ResponseEntity<?> proposeDelete(
            @PathVariable Long batchId,
            @PathVariable Long stagingId) {

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<BillingUploadStaging> optStaging = stagingRepository.findById(stagingId);
        if (optStaging.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        BillingUploadStaging stagingRow = optStaging.get();

        try {
            StagingChangeLog proposal = new StagingChangeLog(
                    batchId,
                    stagingId,
                    stagingRow.getRowType(),
                    "DELETE",
                    stagingRow.getRawJson(),
                    null,
                    username
            );
            proposal.setStatus("PENDING");
            changeLogRepository.save(proposal);

            auditLogService.log("PROPOSAL_DELETE_SUBMITTED",
                    String.format("Officer %s proposed delete on staged row ID %d in batch %d", username, stagingId, batchId));

            return ResponseEntity.ok(proposal);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to propose delete: " + e.getMessage()));
        }
    }

    @GetMapping("/officer/staging/batch/{batchId}/proposals")
    public ResponseEntity<List<StagingChangeLog>> getProposals(@PathVariable Long batchId) {
        return ResponseEntity.ok(changeLogRepository.findByUploadBatchId(batchId));
    }
    @GetMapping("/officer/staging/batch/{batchId}/rows")
    @PreAuthorize("hasRole('OFFICER')")
    public ResponseEntity<List<BillingUploadStaging>> getStagingBatchRows(@PathVariable Long batchId) {
        return ResponseEntity.ok(stagingRepository.findByUploadBatchId(batchId));
    }
    // ────────────────────────────────────────────────────────────────────────
    //  ADMIN ENDPOINTS
    // ────────────────────────────────────────────────────────────────────────

    @PostMapping("/admin/staging/proposal/{proposalId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approveProposal(
            @PathVariable Long proposalId,
            @RequestParam(value = "rejectionReason", required = false, defaultValue = "") String reason) {

        String adminUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<StagingChangeLog> optProposal = changeLogRepository.findById(proposalId);
        if (optProposal.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        StagingChangeLog proposal = optProposal.get();
        if (!"PENDING".equals(proposal.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Proposal is already " + proposal.getStatus()));
        }

        try {
            Optional<BillingUploadStaging> optStaging = stagingRepository.findById(proposal.getStagingId());
            if ("EDIT".equals(proposal.getActionType())) {
                if (optStaging.isPresent()) {
                    BillingUploadStaging stagingRow = optStaging.get();
                    stagingRow.setRawJson(proposal.getModifiedData());

                    // Re-run validation on staging table row to update the row's validation status and errors list
                    Map<String, Object> rawData = objectMapper.readValue(proposal.getModifiedData(),
                            new TypeReference<Map<String, Object>>() {});
                    
                    String rowType = stagingRow.getRowType();
                    String sheetName = rawData.get("sheetName") != null ? rawData.get("sheetName").toString() : "Sheet";
                    int rowNum = rawData.get("rowNum") != null ? Integer.parseInt(rawData.get("rowNum").toString()) : 1;
                    String accountNo = rawData.get("accountNo") != null ? rawData.get("accountNo").toString() : "";
                    String validationStatus = "VALID";
                    List<String> errorMsgs = new ArrayList<>();

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
                        String solarType = ExcelValidationService.normalizeSolarType(rawData.get("solarType") != null ? rawData.get("solarType").toString() : "");
                        rawData.put("solarType", solarType);
                        String costCode = rawData.get("costCode") != null ? rawData.get("costCode").toString() : "";
                        String tariffType = rawData.get("tariffType") != null ? rawData.get("tariffType").toString() : "";
                        // Auto-recalculate L-Code (billingMode)
                        String billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);
                        rawData.put("billingMode", billingMode);
                        String refNo = rawData.get("refNo") != null ? rawData.get("refNo").toString() : "";
                        Double unitRate = rawData.get("unitRate") != null && !rawData.get("unitRate").toString().isEmpty()
                                ? Double.valueOf(rawData.get("unitRate").toString()) : null;

                        stagingRow.setRawJson(objectMapper.writeValueAsString(rawData));

                        ExcelValidationService.RowValidationResult valResult =
                                excelValidationService.validateCustomerRow(
                                        sheetName, rowNum, accountNo, customerName, customerAddress, mobileNo,
                                        bankCode, branchCode, bankAccountNo, agreementDate, panelCapacity, solarType,
                                        costCode, billingMode, refNo, unitRate, tariffType);

                        validationStatus = valResult.hasErrors() ? "ERROR" : valResult.hasWarnings() ? "WARNING" : "VALID";
                        for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                            errorMsgs.add(err.getErrorMessage());
                        }
                    } else {
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

                        String solarType = ExcelValidationService.normalizeSolarType(rawData.get("solarType") != null ? rawData.get("solarType").toString() : "");
                        rawData.put("solarType", solarType);
                        String tariffType = rawData.get("tariffType") != null ? rawData.get("tariffType").toString() : "";
                        String billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);
                        rawData.put("billingMode", billingMode);

                        stagingRow.setRawJson(objectMapper.writeValueAsString(rawData));

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
                                        billingMode,
                                        rawData.get("agreementDate") != null ? rawData.get("agreementDate").toString() : "",
                                        rawData.get("panelCapacity") != null && !rawData.get("panelCapacity").toString().isEmpty()
                                                ? Double.valueOf(rawData.get("panelCapacity").toString()) : null,
                                        solarType,
                                        tariffType,
                                        new java.util.HashSet<>()
                                );

                        validationStatus = valResult.hasDuplicate() ? "DUPLICATE" : valResult.hasErrors() ? "ERROR" : valResult.hasWarnings() ? "WARNING" : "VALID";
                        for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                            errorMsgs.add(err.getErrorMessage());
                        }
                    }

                    stagingRow.setValidationStatus(validationStatus);
                    stagingRow.setValidationErrors(objectMapper.writeValueAsString(errorMsgs));
                    stagingRepository.save(stagingRow);
                }
            } else if ("DELETE".equals(proposal.getActionType())) {
                optStaging.ifPresent(stagingRepository::delete);
            }

            proposal.setStatus("APPROVED");
            proposal.setReviewedBy(adminUsername);
            proposal.setReviewedAt(LocalDateTime.now());
            changeLogRepository.save(proposal);

            auditLogService.log("PROPOSAL_APPROVED",
                    String.format("Admin %s approved proposed %s on staged row ID %d (proposal %d)",
                            adminUsername, proposal.getActionType(), proposal.getStagingId(), proposalId));

            return ResponseEntity.ok(new MessageResponse("Proposal approved successfully"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to approve proposal: " + e.getMessage()));
        }
    }

    @PostMapping("/admin/staging/proposal/{proposalId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> rejectProposal(
            @PathVariable Long proposalId,
            @RequestParam(value = "reason", required = false, defaultValue = "") String reason) {

        String adminUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<StagingChangeLog> optProposal = changeLogRepository.findById(proposalId);
        if (optProposal.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        StagingChangeLog proposal = optProposal.get();
        if (!"PENDING".equals(proposal.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Proposal is already " + proposal.getStatus()));
        }

        proposal.setStatus("REJECTED");
        proposal.setReviewedBy(adminUsername);
        proposal.setReviewedAt(LocalDateTime.now());
        proposal.setRejectionReason(reason);
        changeLogRepository.save(proposal);

        auditLogService.log("PROPOSAL_REJECTED",
                String.format("Admin %s rejected proposed %s on staged row ID %d (proposal %d). Reason: %s",
                        adminUsername, proposal.getActionType(), proposal.getStagingId(), proposal.getId(), reason));

        return ResponseEntity.ok(new MessageResponse("Proposal rejected successfully"));
    }

    @DeleteMapping("/admin/staging/row/{stagingId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminDeleteRow(@PathVariable Long stagingId) {
        String adminUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<BillingUploadStaging> optStaging = stagingRepository.findById(stagingId);
        if (optStaging.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        stagingRepository.delete(optStaging.get());
        auditLogService.log("STAGING_ROW_DELETED_BY_ADMIN",
                String.format("Admin %s directly deleted staging row ID %d", adminUsername, stagingId));
        return ResponseEntity.ok(new MessageResponse("Staging row deleted directly by admin."));
    }
}
