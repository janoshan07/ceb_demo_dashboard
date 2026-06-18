package com.ceb.billing.controllers;

import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.services.AuditLogService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/approvals")
@PreAuthorize("hasRole('ADMIN')")
public class ApprovalController {

    @Autowired
    private ApprovalRequestRepository approvalRequestRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<List<ApprovalRequest>> getPendingApprovals() {
        List<ApprovalRequest> pending = approvalRequestRepository.findByStatusOrderByCreatedAtDesc("PENDING");
        return ResponseEntity.ok(pending);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable Long id) {
        Optional<ApprovalRequest> optRequest = approvalRequestRepository.findById(id);
        if (optRequest.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        ApprovalRequest request = optRequest.get();
        if (!request.getStatus().equals("PENDING")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Request is already processed."));
        }

        String adminUsername = SecurityContextHolder.getContext().getAuthentication().getName();

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

            Map<String, Object> newValues = objectMapper.readValue(request.getNewValues(),
                    new TypeReference<Map<String, Object>>() {
                    });

            if (request.getBillingId() == null) {
                // Customer Profile Edit
                Optional<Customer> optCustomer = customerRepository.findById(request.getAccountNo());
                if (optCustomer.isEmpty()) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Customer account no longer exists."));
                }
                Customer customer = optCustomer.get();
                applyCustomerEdits(customer, newValues);
                customerRepository.save(customer);

                auditLogService.log("CUSTOMER_EDIT_APPROVED",
                        String.format("Admin %s approved customer %s changes from %s", adminUsername,
                                request.getAccountNo(), request.getChangedBy()));
            } else {
                // Billing Record Edit
                Optional<BillingRecord> optBilling = billingRecordRepository.findById(request.getBillingId());
                if (optBilling.isEmpty()) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Billing record no longer exists."));
                }
                BillingRecord billing = optBilling.get();
                applyBillingEdits(billing, newValues);
                billingRecordRepository.save(billing);

                auditLogService.log("BILLING_EDIT_APPROVED",
                        String.format("Admin %s approved billing ID %d changes from %s", adminUsername,
                                request.getBillingId(), request.getChangedBy()));
            }

            request.setStatus("APPROVED");
            approvalRequestRepository.save(request);

            return ResponseEntity.ok(new MessageResponse("Approval request approved and applied successfully."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Error processing approval: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable Long id) {
        Optional<ApprovalRequest> optRequest = approvalRequestRepository.findById(id);
        if (optRequest.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        ApprovalRequest request = optRequest.get();
        if (!request.getStatus().equals("PENDING")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Request is already processed."));
        }

        String adminUsername = SecurityContextHolder.getContext().getAuthentication().getName();

        request.setStatus("REJECTED");
        approvalRequestRepository.save(request);

        auditLogService.log("EDIT_REJECTED",
                String.format("Admin %s rejected changes from %s for target %s",
                        adminUsername, request.getChangedBy(),
                        request.getBillingId() != null ? "Bill ID " + request.getBillingId()
                                : "Customer " + request.getAccountNo()));

        return ResponseEntity.ok(new MessageResponse("Approval request rejected successfully."));
    }

    private void applyCustomerEdits(Customer customer, Map<String, Object> values) {
        if (values.containsKey("customerName"))
            customer.setCustomerName((String) values.get("customerName"));
        if (values.containsKey("customerAddress"))
            customer.setCustomerAddress((String) values.get("customerAddress"));
        if (values.containsKey("mobileNo"))
            customer.setMobileNo((String) values.get("mobileNo"));
        if (values.containsKey("agreementDate") && values.get("agreementDate") != null) {
            customer.setAgreementDate(LocalDate.parse((String) values.get("agreementDate")));
        }
        if (values.containsKey("panelCapacity") && values.get("panelCapacity") != null) {
            customer.setPanelCapacity(Double.valueOf(values.get("panelCapacity").toString()));
        }
        if (values.containsKey("bankCode"))
            customer.setBankCode((String) values.get("bankCode"));
        if (values.containsKey("branchCode"))
            customer.setBranchCode((String) values.get("branchCode"));
        if (values.containsKey("bankAccountNo"))
            customer.setBankAccountNo((String) values.get("bankAccountNo"));
        if (values.containsKey("solarType"))
            customer.setSolarType((String) values.get("solarType"));
    }

    private void applyBillingEdits(BillingRecord billing, Map<String, Object> values) {
        if (values.containsKey("refNo"))
            billing.setRefNo((String) values.get("refNo"));
        if (values.containsKey("fromDate") && values.get("fromDate") != null) {
            billing.setFromDate(LocalDate.parse((String) values.get("fromDate")));
        }
        if (values.containsKey("toDate") && values.get("toDate") != null) {
            billing.setToDate(LocalDate.parse((String) values.get("toDate")));
        }
        if (values.containsKey("importUnits") && values.get("importUnits") != null) {
            billing.setImportUnits(Double.valueOf(values.get("importUnits").toString()));
        }
        if (values.containsKey("exportUnits") && values.get("exportUnits") != null) {
            billing.setExportUnits(Double.valueOf(values.get("exportUnits").toString()));
        }
        if (values.containsKey("unitCost") && values.get("unitCost") != null) {
            billing.setUnitCost(Double.valueOf(values.get("unitCost").toString()));
        }
        if (values.containsKey("billingMode"))
            billing.setBillingMode((String) values.get("billingMode"));
        billing.calculateFields();
    }
}
