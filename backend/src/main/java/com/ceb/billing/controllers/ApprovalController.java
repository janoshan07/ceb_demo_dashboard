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
import com.ceb.billing.services.MonthlyDirectoryService;
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

    @Autowired
    private MonthlyDirectoryService monthlyDirectoryService;

    @Autowired
    private com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository monthlyDirectorySnapshotRepository;

    private static final java.util.logging.Logger log = java.util.logging.Logger.getLogger(ApprovalController.class.getName());

    private String str(Map<String, Object> r, String... keys) {
        if (r == null) return null;
        for (String k : keys) {
            Object v = r.get(k);
            if (v instanceof Map) v = ((Map<?, ?>) v).get("value");
            if (v != null) {
                String s = v.toString().trim();
                if (!s.isEmpty() && !"—".equals(s)) return s;
            }
        }
        return null;
    }

    private Double dbl(Map<String, Object> r, String... keys) {
        if (r == null) return null;
        for (String k : keys) {
            Object v = r.get(k);
            if (v instanceof Map) v = ((Map<?, ?>) v).get("value");
            if (v != null) {
                try {
                    String s = v.toString().trim().replace(",", "");
                    if (!s.isEmpty() && !"—".equals(s)) {
                        return Double.parseDouble(s);
                    }
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

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

            if ("MONTHLY_DIRECTORY".equals(eType)) {
                if ("DELETE".equals(aType)) {
                    monthlyDirectoryService.deleteSnapshotAndSync(request.getBillingId());
                    auditLogService.log("MONTHLY_DIRECTORY_DELETE_APPROVED",
                            String.format("Admin %s approved monthly directory deletion for Snapshot ID %d requested by %s", adminUsername,
                                    request.getBillingId(), request.getChangedBy()));
                } else {
                    return ResponseEntity.badRequest().body(new MessageResponse("Unsupported action on monthly directory."));
                }
            } else if ("CUSTOMER".equals(eType)) {
                if ("CREATE".equals(aType)) {
                    Customer customer = new Customer();
                    customer.setAccountNo(request.getAccountNo());
                    applyCustomerEdits(customer, newValues);
                    excelValidationService.revalidateCustomer(customer);
                    customerRepository.save(Objects.requireNonNull(customer));
                    updateCustomerInSnapshotsAfterApproval(request.getAccountNo(), newValues);
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
                    Customer customer;
                    if (optCustomer.isEmpty()) {
                        customer = new Customer();
                        customer.setAccountNo(request.getAccountNo());
                    } else {
                        customer = optCustomer.get();
                    }
                    applyCustomerEdits(customer, newValues);
                    excelValidationService.revalidateCustomer(customer);
                    customerRepository.save(Objects.requireNonNull(customer));
                    updateCustomerInSnapshotsAfterApproval(request.getAccountNo(), newValues);
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

        if ("CUSTOMER".equals(request.getEntityType())) {
            clearPendingApprovalInSnapshots(request.getAccountNo());
        }

        String targetDetail;
        if ("MONTHLY_DIRECTORY".equals(request.getEntityType())) {
            targetDetail = "Monthly Directory Snapshot ID " + request.getBillingId();
        } else {
            targetDetail = request.getBillingId() != null ? "Bill ID " + request.getBillingId() : "Customer " + request.getAccountNo();
        }
        auditLogService.log("EDIT_REJECTED",
                String.format("Admin %s rejected changes from %s for target %s",
                        adminUsername, request.getChangedBy(), targetDetail));

        return ResponseEntity.ok(new MessageResponse("Approval request rejected successfully."));
    }

    private void updateCustomerInSnapshotsAfterApproval(String accountNo, Map<String, Object> payload) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
            List<com.ceb.billing.entities.MonthlyDirectorySnapshot> snapshots = monthlyDirectorySnapshotRepository.findAll();
            for (com.ceb.billing.entities.MonthlyDirectorySnapshot snap : snapshots) {
                if (snap.getFinalDataJson() == null || snap.getFinalDataJson().trim().isEmpty()) {
                    continue;
                }
                boolean modified = false;
                List<Map<String, Object>> list = objectMapper.readValue(snap.getFinalDataJson(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                if (list != null) {
                    for (Map<String, Object> rec : list) {
                        String acc = str(rec, "accountNo");
                        if (accountNo.equals(acc)) {
                            // Update customer fields
                            if (payload.containsKey("customerName") && payload.get("customerName") != null) {
                                rec.put("customerName", payload.get("customerName"));
                                rec.put("name", payload.get("customerName"));
                            }
                            if (payload.containsKey("customerAddress") && payload.get("customerAddress") != null) {
                                rec.put("customerAddress", payload.get("customerAddress"));
                                rec.put("address", payload.get("customerAddress"));
                            }
                            if (payload.containsKey("mobileNo") && payload.get("mobileNo") != null) {
                                rec.put("mobileNo", payload.get("mobileNo"));
                            }
                            if (payload.containsKey("agreementDate") && payload.get("agreementDate") != null) {
                                rec.put("agreementDate", payload.get("agreementDate"));
                            }
                            if (payload.containsKey("panelCapacity") && payload.get("panelCapacity") != null) {
                                rec.put("panelCapacity", payload.get("panelCapacity"));
                            }
                            if (payload.containsKey("solarType") && payload.get("solarType") != null) {
                                rec.put("solarType", payload.get("solarType"));
                                rec.put("netTypeName", payload.get("solarType"));
                            }
                            if (payload.containsKey("tariffType") && payload.get("tariffType") != null) {
                                rec.put("tariffType", payload.get("tariffType"));
                            }
                            if (payload.containsKey("bankCode") && payload.get("bankCode") != null) {
                                rec.put("bankCode", payload.get("bankCode"));
                            }
                            if (payload.containsKey("branchCode") && payload.get("branchCode") != null) {
                                rec.put("branchCode", payload.get("branchCode"));
                            }
                            if (payload.containsKey("bankAccountNo") && payload.get("bankAccountNo") != null) {
                                rec.put("bankAccountNo", payload.get("bankAccountNo"));
                            }
                            if (payload.containsKey("refNo") && payload.get("refNo") != null) {
                                rec.put("refNo", payload.get("refNo"));
                            }
                            if (payload.containsKey("unitRate") && payload.get("unitRate") != null) {
                                rec.put("unitRate", payload.get("unitRate"));
                            }
                            if (payload.containsKey("costCodeId") && payload.get("costCodeId") != null) {
                                rec.put("costCodeId", payload.get("costCodeId"));
                            }
                            if (payload.containsKey("netTypeId") && payload.get("netTypeId") != null) {
                                rec.put("netTypeId", payload.get("netTypeId"));
                            }
                            if (payload.containsKey("expenseCodeId") && payload.get("expenseCodeId") != null) {
                                rec.put("expenseCodeId", payload.get("expenseCodeId"));
                            }

                            // Re-evaluate mismatches
                            String newName = str(rec, "customerName");
                            String masterName = str(rec, "masterName");
                            if (masterName != null && newName != null && newName.trim().equalsIgnoreCase(masterName.trim())) {
                                rec.put("nameMatch", "MATCH");
                            }

                            Double newUnitRate = dbl(rec, "unitRate");
                            Double masterUnitRate = dbl(rec, "masterUnitRate");
                            if (masterUnitRate != null && newUnitRate != null && Math.abs(newUnitRate - masterUnitRate) < 0.001) {
                                rec.put("unitRateMatch", "MATCH");
                            }

                            String newNetType = str(rec, "solarType", "netTypeName");
                            String masterNetType = str(rec, "masterNetType", "masterSolarType");
                            if (masterNetType != null && newNetType != null && newNetType.trim().equalsIgnoreCase(masterNetType.trim())) {
                                rec.put("netTypeMatch", "MATCH");
                            }

                            // Clear pending approval
                            rec.remove("pendingAdminApproval");
                            rec.remove("approvalStatus");

                            // Re-calculate completeness
                            java.util.List<String> missingFields = new java.util.ArrayList<>();
                            if (str(rec, "customerName") == null) missingFields.add("Customer Name");
                            if (str(rec, "customerAddress") == null) missingFields.add("Customer Address");
                            if (str(rec, "mobileNo") == null) missingFields.add("Mobile No");
                            if (str(rec, "agreementDate") == null) missingFields.add("Agreement Date");
                            Double cap = dbl(rec, "panelCapacity");
                            if (cap == null || cap <= 0) missingFields.add("Panel Capacity");
                            if (str(rec, "bankCode") == null) missingFields.add("Bank Code");
                            if (str(rec, "bankAccountNo") == null) missingFields.add("Bank Account No");
                            if (str(rec, "solarType", "netTypeName") == null) missingFields.add("Solar System Type");
                            if (str(rec, "refNo") == null) missingFields.add("Ref No");
                            if (dbl(rec, "unitRate") == null) missingFields.add("Unit Rate");

                            boolean hasNameMismatch = "MISMATCH".equals(rec.get("nameMatch"));
                            boolean hasUnitRateMismatch = "MISMATCH".equals(rec.get("unitRateMatch"));
                            boolean hasNetTypeMismatch = "MISMATCH".equals(rec.get("netTypeMatch"));
                            
                            boolean isMasterFound = !rec.containsKey("masterDataFound") || Boolean.TRUE.equals(rec.get("masterDataFound"));
                            boolean isNewCust = !isMasterFound || Boolean.TRUE.equals(rec.get("isNewCustomer"));
                            boolean isPaymentHold = Boolean.TRUE.equals(rec.get("paymentHold"));
                            boolean isNoBill = Boolean.TRUE.equals(rec.get("masterOnly")) || Boolean.TRUE.equals(rec.get("noBillingData"));
                            
                            boolean isPaymentMismatch = false;
                            Object pMap = rec.get("mergedPayment");
                            if (pMap instanceof Map) {
                                isPaymentMismatch = Boolean.TRUE.equals(((Map<?, ?>) pMap).get("mismatch"));
                            }
                            boolean isRejected = "REJECTED".equals(rec.get("status")) || Boolean.TRUE.equals(rec.get("rejected"));
                            boolean isOutstanding = (isNewCust || isPaymentHold || isNoBill || isPaymentMismatch) && !isRejected;

                            boolean isComplete = missingFields.isEmpty() && !hasNameMismatch && !hasUnitRateMismatch && !hasNetTypeMismatch && !isOutstanding && !isRejected;

                            rec.put("isComplete", isComplete);
                            rec.put("missingFields", missingFields);
                            if (isComplete) {
                                rec.put("validationStatus", "VALID");
                                rec.put("status", "VALID");
                            }

                            modified = true;
                        }
                    }
                    if (modified) {
                        snap.setFinalDataJson(objectMapper.writeValueAsString(list));
                        monthlyDirectorySnapshotRepository.save(snap);
                    }
                }
            }
        } catch (Exception ex) {
            log.warning("Failed to update snapshots on approval for account " + accountNo + ": " + ex.getMessage());
        }
    }

    private void clearPendingApprovalInSnapshots(String accountNo) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
            List<com.ceb.billing.entities.MonthlyDirectorySnapshot> snapshots = monthlyDirectorySnapshotRepository.findAll();
            for (com.ceb.billing.entities.MonthlyDirectorySnapshot snap : snapshots) {
                if (snap.getFinalDataJson() == null || snap.getFinalDataJson().trim().isEmpty()) {
                    continue;
                }
                boolean modified = false;
                List<Map<String, Object>> list = objectMapper.readValue(snap.getFinalDataJson(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                if (list != null) {
                    for (Map<String, Object> rec : list) {
                        String acc = str(rec, "accountNo");
                        if (accountNo.equals(acc)) {
                            rec.remove("pendingAdminApproval");
                            rec.remove("approvalStatus");
                            modified = true;
                        }
                    }
                    if (modified) {
                        snap.setFinalDataJson(objectMapper.writeValueAsString(list));
                        monthlyDirectorySnapshotRepository.save(snap);
                    }
                }
            }
        } catch (Exception ex) {
            log.warning("Failed to clear pending approval flag in snapshots for account " + accountNo + ": " + ex.getMessage());
        }
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
