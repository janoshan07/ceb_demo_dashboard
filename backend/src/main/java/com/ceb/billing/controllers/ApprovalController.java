package com.ceb.billing.controllers;

import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.CostCodeRepository;
import com.ceb.billing.repositories.NetTypeRepository;
import com.ceb.billing.repositories.ExpenseCodeRepository;
import com.ceb.billing.services.ExcelValidationService;
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
import java.util.Objects;

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

    @Autowired
    private CostCodeRepository costCodeRepository;

    @Autowired
    private NetTypeRepository netTypeRepository;

    @Autowired
    private ExpenseCodeRepository expenseCodeRepository;

    @Autowired
    private com.ceb.billing.services.ExcelValidationService excelValidationService;

    @GetMapping
    public ResponseEntity<List<ApprovalRequest>> getPendingApprovals() {
        List<ApprovalRequest> pending = approvalRequestRepository.findByStatusOrderByCreatedAtDesc("PENDING");
        return ResponseEntity.ok(pending);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable long id) {
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

            String eType = request.getEntityType() != null ? request.getEntityType() : (request.getBillingId() == null ? "CUSTOMER" : "BILLING");
            String aType = request.getActionType() != null ? request.getActionType() : "UPDATE";

            if ("CUSTOMER".equals(eType)) {
                if ("CREATE".equals(aType)) {
                    Customer customer = new Customer();
                    customer.setAccountNo(request.getAccountNo());
                    applyCustomerEdits(customer, newValues);
                    excelValidationService.revalidateCustomer(customer);
                    customerRepository.save(Objects.requireNonNull(customer));
                    auditLogService.log("CUSTOMER_CREATE_APPROVED",
                            String.format("Admin %s approved manual customer creation for %s requested by %s", adminUsername,
                                     request.getAccountNo(), request.getChangedBy()));
                } else if ("DELETE".equals(aType)) {
                    Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(request.getAccountNo()));
                    if (optCustomer.isPresent()) {
                        customerRepository.delete(Objects.requireNonNull(optCustomer.get()));
                    }
                    auditLogService.log("CUSTOMER_DELETE_APPROVED",
                            String.format("Admin %s approved customer deletion for %s requested by %s", adminUsername,
                                    request.getAccountNo(), request.getChangedBy()));
                } else {
                    // UPDATE
                    Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(request.getAccountNo()));
                    if (optCustomer.isEmpty()) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Customer account no longer exists."));
                    }
                    Customer customer = optCustomer.get();
                    applyCustomerEdits(customer, newValues);
                    excelValidationService.revalidateCustomer(customer);
                    customerRepository.save(Objects.requireNonNull(customer));
                    auditLogService.log("CUSTOMER_EDIT_APPROVED",
                            String.format("Admin %s approved customer %s changes from %s", adminUsername,
                                    request.getAccountNo(), request.getChangedBy()));
                }
            } else {
                // BILLING
                if ("CREATE".equals(aType)) {
                    Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(request.getAccountNo()));
                    if (optCustomer.isEmpty()) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Customer account no longer exists."));
                    }
                    BillingRecord billing = new BillingRecord();
                    billing.setCustomer(optCustomer.get());
                    applyBillingEdits(billing, newValues);
                    if (newValues.containsKey("refNo")) {
                        billing.setRefNo((String) newValues.get("refNo"));
                    }
                    billingRecordRepository.save(Objects.requireNonNull(billing));
                    auditLogService.log("BILLING_CREATE_APPROVED",
                            String.format("Admin %s approved manual billing creation for customer %s requested by %s", adminUsername,
                                    request.getAccountNo(), request.getChangedBy()));
                } else if ("DELETE".equals(aType)) {
                    Optional<BillingRecord> optBilling = billingRecordRepository.findById(Objects.requireNonNull(request.getBillingId()));
                    if (optBilling.isPresent()) {
                        billingRecordRepository.delete(Objects.requireNonNull(optBilling.get()));
                    }
                    auditLogService.log("BILLING_DELETE_APPROVED",
                            String.format("Admin %s approved billing ID %d deletion requested by %s", adminUsername,
                                    request.getBillingId(), request.getChangedBy()));
                } else {
                    // UPDATE
                    Optional<BillingRecord> optBilling = billingRecordRepository.findById(Objects.requireNonNull(request.getBillingId()));
                    if (optBilling.isEmpty()) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Billing record no longer exists."));
                    }
                    BillingRecord billing = optBilling.get();
                    applyBillingEdits(billing, newValues);
                    billingRecordRepository.save(Objects.requireNonNull(billing));
                    auditLogService.log("BILLING_EDIT_APPROVED",
                            String.format("Admin %s approved billing ID %d changes from %s", adminUsername,
                                    request.getBillingId(), request.getChangedBy()));
                }
            }

            request.setStatus("APPROVED");
            approvalRequestRepository.save(Objects.requireNonNull(request));

            return ResponseEntity.ok(new MessageResponse("Approval request approved and applied successfully."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Error processing approval: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable long id) {
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
        approvalRequestRepository.save(Objects.requireNonNull(request));

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
        if (values.containsKey("refNo"))
            customer.setRefNo((String) values.get("refNo"));
        if (values.containsKey("unitRate") && values.get("unitRate") != null)
            customer.setUnitRate(Double.valueOf(values.get("unitRate").toString()));
        if (values.containsKey("tariffType"))
            customer.setTariffType((String) values.get("tariffType"));

        if (values.containsKey("costCodeId") && values.get("costCodeId") != null && !values.get("costCodeId").toString().isEmpty()) {
            long ccId = Long.parseLong(values.get("costCodeId").toString());
            customer.setCostCode(costCodeRepository.findById(ccId).orElse(null));
        } else if (values.containsKey("costCode") && values.get("costCode") != null && !values.get("costCode").toString().isEmpty()) {
            String ccCode = values.get("costCode").toString();
            customer.setCostCode(costCodeRepository.findByCostCode(ccCode).orElse(null));
        }

        if (values.containsKey("netTypeId") && values.get("netTypeId") != null && !values.get("netTypeId").toString().isEmpty()) {
            long ntId = Long.parseLong(values.get("netTypeId").toString());
            customer.setNetType(netTypeRepository.findById(ntId).orElse(null));
        } else if (values.containsKey("netTypeName") && values.get("netTypeName") != null && !values.get("netTypeName").toString().isEmpty()) {
            String ntName = values.get("netTypeName").toString();
            customer.setNetType(netTypeRepository.findByName(ntName).orElse(null));
        } else if (values.containsKey("solarType") && values.get("solarType") != null && !values.get("solarType").toString().isEmpty()) {
            String ntName = values.get("solarType").toString();
            customer.setNetType(netTypeRepository.findByName(ntName).orElse(null));
        }

        // Recalculate Expense Code automatically based on Solar Type and Tariff Type
        String derivedL = ExcelValidationService.deriveLCode(customer.getSolarType(), customer.getTariffType());
        if (derivedL != null && !derivedL.isEmpty()) {
            customer.setExpenseCode(expenseCodeRepository.findByExpCode(derivedL).orElse(null));
        } else {
            customer.setExpenseCode(null);
        }
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
