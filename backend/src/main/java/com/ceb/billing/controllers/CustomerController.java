package com.ceb.billing.controllers;

import com.ceb.billing.config.UserDetailsImpl;
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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;
import java.util.logging.Logger;

@RestController
@RequestMapping
public class CustomerController {

    private static final Logger log = Logger.getLogger(CustomerController.class.getName());

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private ApprovalRequestRepository approvalRequestRepository;

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
    private ObjectMapper objectMapper;

    /** Customer list fields that may be used to sort the Customer Directory (whitelist). */
    private static final java.util.Set<String> SORTABLE_FIELDS = java.util.Set.of(
            "accountNo", "customerName", "agreementDate", "panelCapacity",
            "branchCode", "division", "solarType", "unitRate", "createdAt", "validationStatus");

    /**
     * Converts a Customer JPA entity to a plain Map of scalar values.
     * This avoids Hibernate lazy-load proxy serialization issues that cause
     * HTTP 500 errors when Jackson tries to serialize uninitialised proxies.
     */
    private Map<String, Object> toSafeDto(Customer c) {
        Map<String, Object> dto = new LinkedHashMap<>();
        try {
            dto.put("accountNo",       c.getAccountNo());
            dto.put("customerName",    c.getCustomerName());
            dto.put("customerAddress", c.getCustomerAddress());
            dto.put("mobileNo",        c.getMobileNo());
            dto.put("agreementDate",   c.getAgreementDate() != null ? c.getAgreementDate().toString() : null);
            dto.put("panelCapacity",   c.getPanelCapacity());
            dto.put("bankCode",        c.getBankCode());
            dto.put("branchCode",      c.getBranchCode());
            dto.put("bankAccountNo",   c.getBankAccountNo());
            dto.put("solarType",       c.getSolarType());
            dto.put("refNo",           c.getRefNo());
            dto.put("unitRate",        c.getUnitRate());
            dto.put("tariffType",      c.getTariffType());
            dto.put("createdAt",       c.getCreatedAt() != null ? c.getCreatedAt().toString() : null);
            // Safely read lazy associations — returns null if not loaded rather than throwing
            try { dto.put("costCode",     c.getCostCode()     != null ? c.getCostCode().getCostCode()   : null); } catch (Exception e) { dto.put("costCode",     null); }
            try { dto.put("netTypeName",  c.getNetType()      != null ? c.getNetType().getName()         : null); } catch (Exception e) { dto.put("netTypeName",  null); }
            try { dto.put("expenseCode",  c.getExpenseCode()  != null ? c.getExpenseCode().getExpCode() : null); } catch (Exception e) { dto.put("expenseCode",  null); }
            dto.put("validationStatus", c.getValidationStatus());
            dto.put("validationErrors", c.getValidationErrors());
            dto.put("division",        c.getDivision());
            // Full merged Monthly Directory record so the Customer 360 view can show the same
            // Master / CEB Assist / NGEN / NPAY detail. Returned as a parsed object (or null).
            Object directory = null;
            if (c.getDirectoryJson() != null && !c.getDirectoryJson().trim().isEmpty()) {
                try {
                    directory = objectMapper.readValue(c.getDirectoryJson(),
                            new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                } catch (Exception e) {
                    directory = null;
                }
            }
            dto.put("directory", directory);

            // Compute Completeness (Complete Details vs Missing Details)
            List<String> missingFields = new ArrayList<>();
            if (c.getCustomerName() == null || c.getCustomerName().trim().isEmpty()) missingFields.add("Customer Name");
            if (c.getCustomerAddress() == null || c.getCustomerAddress().trim().isEmpty()) missingFields.add("Customer Address");
            if (c.getMobileNo() == null || c.getMobileNo().trim().isEmpty()) missingFields.add("Mobile Number");
            if (c.getAgreementDate() == null) missingFields.add("Agreement Date");
            if (c.getPanelCapacity() == null || c.getPanelCapacity() <= 0) missingFields.add("Panel Capacity");
            if (c.getBankCode() == null || c.getBankCode().trim().isEmpty()) missingFields.add("Bank Code");
            if (c.getBankAccountNo() == null || c.getBankAccountNo().trim().isEmpty()) missingFields.add("Bank Account No");
            String solar = c.getSolarType() != null ? c.getSolarType().trim() : "";
            if (solar.isEmpty() && c.getNetType() != null && c.getNetType().getName() != null) {
                solar = c.getNetType().getName().trim();
            }
            if (solar.isEmpty()) missingFields.add("Solar / Net Type");
            if (c.getUnitRate() == null) missingFields.add("Unit Rate");
            if (c.getTariffType() == null || c.getTariffType().trim().isEmpty()) missingFields.add("Tariff Type");

            dto.put("isComplete", missingFields.isEmpty());
            dto.put("missingFields", missingFields);
        } catch (Exception ex) {
            log.warning("toSafeDto error for account " + c.getAccountNo() + ": " + ex.getMessage());
        }
        return dto;
    }

    // --- Officer Customer Endpoints ---

    @GetMapping("/api/officer/customers")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerCustomers(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "validationStatus", required = false) String validationStatus,
            @RequestParam(value = "location", required = false) String location,
            @RequestParam(value = "completeness", required = false) String completeness,
            @RequestParam(value = "sortBy", required = false) String sortBy,
            @RequestParam(value = "direction", required = false) String direction,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size) {

        try {
            // Resolve a safe sort: whitelist the property, default to Account No ascending.
            String sortProp = (sortBy != null && SORTABLE_FIELDS.contains(sortBy.trim())) ? sortBy.trim() : "accountNo";
            Sort.Direction dir = "desc".equalsIgnoreCase(direction != null ? direction.trim() : "")
                    ? Sort.Direction.DESC : Sort.Direction.ASC;
            Pageable pageable = PageRequest.of(page, size, Sort.by(dir, sortProp));

            String q = (query != null) ? query.trim() : "";
            String status = (validationStatus != null) ? validationStatus.trim() : "";
            String loc = (location != null) ? location.trim() : "";

            Page<Customer> customerPage = customerRepository.searchCustomersFiltered(
                    q.isEmpty() ? null : q,
                    status.isEmpty() ? null : status,
                    loc.isEmpty() ? null : loc,
                    pageable);

            // Map each Customer entity to a safe DTO to avoid Hibernate lazy-proxy serialization errors
            List<Map<String, Object>> dtoList = new ArrayList<>();
            for (Customer c : customerPage.getContent()) {
                try {
                    Map<String, Object> dto = toSafeDto(c);
                    if ("COMPLETE".equalsIgnoreCase(completeness) && !Boolean.TRUE.equals(dto.get("isComplete"))) {
                        continue;
                    }
                    if (("MISSING".equalsIgnoreCase(completeness) || "INCOMPLETE".equalsIgnoreCase(completeness)) && Boolean.TRUE.equals(dto.get("isComplete"))) {
                        continue;
                    }
                    dtoList.add(dto);
                } catch (Exception ex) {
                    log.warning("Skipping customer " + c.getAccountNo() + " due to mapping error: " + ex.getMessage());
                }
            }

            // Build a safe pageable response matching Spring Page structure
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("content",          dtoList);
            response.put("totalElements",    customerPage.getTotalElements());
            response.put("totalPages",       customerPage.getTotalPages());
            response.put("number",           customerPage.getNumber());
            response.put("size",             customerPage.getSize());
            response.put("numberOfElements", customerPage.getNumberOfElements());
            response.put("first",            customerPage.isFirst());
            response.put("last",             customerPage.isLast());
            response.put("empty",            customerPage.isEmpty());

            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            log.severe("GET /api/officer/customers failed: " + ex.getMessage());
            ex.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "Failed to load customers: " + ex.getMessage()));
        }
    }

    @GetMapping("/api/officer/customers/{accountNo}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerCustomerByAccountNo(@PathVariable String accountNo) {
        try {
            Optional<Customer> customer = customerRepository.findById(Objects.requireNonNull(accountNo));
            if (customer.isPresent()) {
                return ResponseEntity.ok(toSafeDto(customer.get()));
            }
            return ResponseEntity.notFound().build();
        } catch (Exception ex) {
            log.severe("GET /api/officer/customers/" + accountNo + " failed: " + ex.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to load customer: " + ex.getMessage()));
        }
    }

    @GetMapping("/api/officer/customers/{accountNo}/billing")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerCustomerBillingHistory(@PathVariable String accountNo) {
        try {
            Optional<Customer> customer = customerRepository.findById(Objects.requireNonNull(accountNo));
            if (customer.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            List<BillingRecord> history = billingRecordRepository.findByCustomerAccountNoOrderByFromDateDesc(accountNo);
            List<BillingRecord> ngenHistory = new ArrayList<>();
            for (BillingRecord br : history) {
                if (br.getUploadHistoryId() == null || 
                    br.getKwhImport() != null || 
                    br.getKwhExport() != null || 
                    br.getKwhSales() != null) {
                    ngenHistory.add(br);
                }
            }
            history = ngenHistory;
            history = deduplicateTechnicalDuplicates(history);
            List<Map<String, Object>> dtoList = new ArrayList<>();
            for (BillingRecord br : history) {
                dtoList.add(toBillingDto(br));
            }
            return ResponseEntity.ok(dtoList);
        } catch (Exception ex) {
            log.severe("GET /api/officer/customers/" + accountNo + "/billing failed: " + ex.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to load billing history: " + ex.getMessage()));
        }
    }

    @PutMapping("/api/officer/customers/{accountNo}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> officerUpdateCustomer(@PathVariable String accountNo,
            @RequestBody Customer customerDetails) {
        Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (optCustomer.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Customer customer = optCustomer.get();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

            Map<String, Object> oldMap = getCustomerFieldMap(customer);
            Map<String, Object> newMap = getCustomerFieldMap(customerDetails);

            String oldJson = objectMapper.writeValueAsString(oldMap);
            String newJson = objectMapper.writeValueAsString(newMap);

            ApprovalRequest request = new ApprovalRequest(
                    null,
                    accountNo,
                    userDetails.getUsername(),
                    oldJson,
                    newJson,
                    "PENDING");
            approvalRequestRepository.save(request);
            auditLogService.log("CUSTOMER_EDIT_REQUEST", "Billing Officer " + userDetails.getUsername()
                    + " submitted customer edit request for " + accountNo);

            // Explicitly set status PENDING to notify frontend
            Map<String, Object> response = new HashMap<>();
            response.put("requestId", request.getRequestId());
            response.put("status", "PENDING");
            response.put("message", "Customer edit request queued for approval.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to create approval request: " + e.getMessage()));
        }
    }

    // --- Admin Customer Endpoints ---

    @DeleteMapping("/api/admin/customers/clear-all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> clearAllCustomers() {
        try {
            long count = customerRepository.count();
            billingRecordRepository.deleteAll();
            customerRepository.deleteAll();
            String adminUsername = SecurityContextHolder.getContext().getAuthentication().getName();
            auditLogService.log("CUSTOMER_DIRECTORY_CLEAR",
                    String.format("Admin %s cleared all %d customer records from Customer Directory", adminUsername, count));
            return ResponseEntity.ok(Map.of("message", "Successfully cleared " + count + " customer records."));
        } catch (Exception ex) {
            log.severe("DELETE /api/admin/customers/clear-all failed: " + ex.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to clear customers: " + ex.getMessage()));
        }
    }

    @PutMapping("/api/admin/customers/{accountNo}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminUpdateCustomer(@PathVariable String accountNo,
            @RequestBody Map<String, Object> payload) {
        try {
            Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
            if (optCustomer.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Customer customer = optCustomer.get();
            String oldName = customer.getCustomerName();
            
            applyCustomerEdits(customer, payload);

            excelValidationService.revalidateCustomer(customer);
            customerRepository.save(Objects.requireNonNull(customer));

            // Audit Log Entry
            String auditDetail = String.format("Admin updated customer account: %s. Name changed from '%s' to '%s'",
                    accountNo, oldName, customer.getCustomerName());
            auditLogService.log("CUSTOMER_UPDATE", auditDetail);

            return ResponseEntity.ok(toSafeDto(customer));
        } catch (Exception ex) {
            log.severe("PUT /api/admin/customers/" + accountNo + " failed: " + ex.getMessage());
            ex.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to update customer details: " + ex.getMessage()));
        }
    }

    // --- User (Customer Self-Service) Endpoints ---

    @GetMapping("/api/user/customers/{accountNo}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> userGetOwnCustomerDetails(@PathVariable String accountNo) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        if (!userDetails.getUsername().equals(accountNo)) {
            return ResponseEntity.status(403)
                    .body(new MessageResponse("Access Denied: You can only view your own details."));
        }

        Optional<Customer> customer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (customer.isPresent()) {
            return ResponseEntity.ok(customer.get());
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/api/user/customers/{accountNo}/billing")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> userGetOwnBillingHistory(@PathVariable String accountNo) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        if (!userDetails.getUsername().equals(accountNo)) {
            return ResponseEntity.status(403)
                    .body(new MessageResponse("Access Denied: You can only view your own billing history."));
        }

        Optional<Customer> customer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (customer.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        List<BillingRecord> history = billingRecordRepository.findByCustomerAccountNoOrderByFromDateDesc(accountNo);
        List<BillingRecord> ngenHistory = new ArrayList<>();
        for (BillingRecord br : history) {
            if (br.getUploadHistoryId() == null || 
                br.getKwhImport() != null || 
                br.getKwhExport() != null || 
                br.getKwhSales() != null) {
                ngenHistory.add(br);
            }
        }
        history = ngenHistory;
        history = deduplicateTechnicalDuplicates(history);
        return ResponseEntity.ok(history);
    }

    private Map<String, Object> toBillingDto(BillingRecord br) {
        Map<String, Object> dto = new LinkedHashMap<>();
        try {
            dto.put("billingId",        br.getBillingId());
            dto.put("accountNo",        br.getCustomer() != null ? br.getCustomer().getAccountNo() : null);
            dto.put("customerName",     br.getCustomer() != null ? br.getCustomer().getCustomerName() : null);
            dto.put("refNo",            br.getRefNo());
            dto.put("fromDate",         br.getFromDate()         != null ? br.getFromDate().toString()         : null);
            dto.put("toDate",           br.getToDate()           != null ? br.getToDate().toString()           : null);
            dto.put("prevReadingDate",  br.getPrevReadingDate()  != null ? br.getPrevReadingDate().toString()  : null);
            dto.put("currReadingDate",  br.getCurrReadingDate()  != null ? br.getCurrReadingDate().toString()  : null);
            dto.put("importUnits",      br.getImportUnits());
            dto.put("exportUnits",      br.getExportUnits());
            dto.put("netUnit",          br.getNetUnit());
            dto.put("unitCost",         br.getUnitCost());
            dto.put("totalAmount",      br.getTotalAmount());
            dto.put("billingMode",      br.getBillingMode());
            dto.put("billCycle",        br.getBillCycle());
            dto.put("billSetOff",       br.getBillSetOff());
            dto.put("retentionMoney",   br.getRetentionMoney());
            dto.put("payment",          br.getPayment());
            dto.put("energyPurchase",    br.getEnergyPurchase());
            dto.put("kwhImport",        br.getKwhImport());
            dto.put("kwhExport",        br.getKwhExport());
            dto.put("kwhSales",         br.getKwhSales());
            dto.put("paymentSettled",   br.getPaymentSettled());
            dto.put("outstandingBalance", br.getOutstandingBalance());
            dto.put("uploadHistoryId",  br.getUploadHistoryId());
            dto.put("createdAt",        br.getCreatedAt() != null ? br.getCreatedAt().toString() : null);
        } catch (Exception ex) {
            log.warning("toBillingDto error for billing id " + br.getBillingId() + ": " + ex.getMessage());
        }
        return dto;
    }

    private Map<String, Object> getCustomerFieldMap(Customer customer) {
        Map<String, Object> map = new HashMap<>();
        map.put("customerName", customer.getCustomerName());
        map.put("customerAddress", customer.getCustomerAddress());
        map.put("mobileNo", customer.getMobileNo());
        map.put("agreementDate", customer.getAgreementDate() != null ? customer.getAgreementDate().toString() : null);
        map.put("panelCapacity", customer.getPanelCapacity());
        map.put("bankCode", customer.getBankCode());
        map.put("branchCode", customer.getBranchCode());
        map.put("bankAccountNo", customer.getBankAccountNo());
        map.put("solarType", customer.getSolarType());
        map.put("refNo", customer.getRefNo());
        map.put("unitRate", customer.getUnitRate());
        map.put("tariffType", customer.getTariffType());
        map.put("costCodeId", customer.getCostCode() != null ? customer.getCostCode().getId() : null);
        map.put("costCode", customer.getCostCode() != null ? customer.getCostCode().getCostCode() : null);
        map.put("netTypeId", customer.getNetType() != null ? customer.getNetType().getId() : null);
        map.put("netTypeName", customer.getNetType() != null ? customer.getNetType().getName() : null);
        map.put("expenseCodeId", customer.getExpenseCode() != null ? customer.getExpenseCode().getId() : null);
        map.put("expenseCode", customer.getExpenseCode() != null ? customer.getExpenseCode().getExpCode() : null);
        return map;
    }

    @PostMapping("/api/admin/customers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminCreateCustomer(@RequestBody Map<String, Object> payload) {
        try {
            String accountNo = (String) payload.get("accountNo");
            if (accountNo == null || accountNo.trim().length() != 10 || !accountNo.trim().matches("\\d+")) {
                return ResponseEntity.badRequest().body(new MessageResponse("Account number must be a valid 10-digit numeric string."));
            }
            Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo.trim()));
            if (optCustomer.isPresent()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Customer account already exists: " + accountNo));
            }
            Customer customer = new Customer();
            customer.setAccountNo(accountNo.trim());
            applyCustomerEdits(customer, payload);
            excelValidationService.revalidateCustomer(customer);
            customerRepository.save(customer);

            String actor = SecurityContextHolder.getContext().getAuthentication().getName();
            auditLogService.log("CUSTOMER_CREATE", "Admin " + actor + " manually created customer account: " + accountNo);
            return ResponseEntity.ok(customer);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to create customer: " + e.getMessage()));
        }
    }

    @PostMapping("/api/officer/customers")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> officerCreateCustomer(@RequestBody Map<String, Object> payload) {
        try {
            String accountNo = (String) payload.get("accountNo");
            if (accountNo == null || accountNo.trim().length() != 10 || !accountNo.trim().matches("\\d+")) {
                return ResponseEntity.badRequest().body(new MessageResponse("Account number must be a valid 10-digit numeric string."));
            }
            Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo.trim()));
            if (optCustomer.isPresent()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Customer account already exists: " + accountNo));
            }
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

            String newJson = objectMapper.writeValueAsString(payload);
            ApprovalRequest request = new ApprovalRequest(
                    null,
                    accountNo.trim(),
                    username,
                    "{}",
                    newJson,
                    "PENDING",
                    "CREATE",
                    "CUSTOMER"
            );
            approvalRequestRepository.save(request);
            auditLogService.log("CUSTOMER_CREATE_REQUEST", "Officer " + username + " submitted manual customer creation request for " + accountNo);

            Map<String, Object> response = new HashMap<>();
            response.put("requestId", request.getRequestId());
            response.put("status", "PENDING");
            response.put("message", "Manual customer creation request queued for approval.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to queue creation request: " + e.getMessage()));
        }
    }

    @DeleteMapping("/api/admin/customers/{accountNo}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminDeleteCustomer(@PathVariable String accountNo) {
        Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (optCustomer.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        long activeRecordsCount = billingRecordRepository.countByCustomerAccountNo(accountNo);
        if (activeRecordsCount > 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Cannot delete customer account " + accountNo + " because they have " + activeRecordsCount + " active billing records. Delete the billing records first."));
        }

        customerRepository.delete(Objects.requireNonNull(optCustomer.get()));
        String actor = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("CUSTOMER_DELETE", "Admin " + actor + " manually deleted customer account: " + accountNo);
        return ResponseEntity.ok(new MessageResponse("Customer account deleted successfully."));
    }

    @DeleteMapping("/api/officer/customers/{accountNo}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> officerDeleteCustomer(@PathVariable String accountNo) {
        Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (optCustomer.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        long activeRecordsCount = billingRecordRepository.countByCustomerAccountNo(accountNo);
        if (activeRecordsCount > 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Cannot delete customer account " + accountNo + " because they have " + activeRecordsCount + " active billing records."));
        }

        Customer customer = optCustomer.get();
        try {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

            Map<String, Object> oldMap = getCustomerFieldMap(customer);
            String oldJson = objectMapper.writeValueAsString(oldMap);

            ApprovalRequest request = new ApprovalRequest(
                    null,
                    accountNo,
                    username,
                    oldJson,
                    "{}",
                    "PENDING",
                    "DELETE",
                    "CUSTOMER"
            );
            approvalRequestRepository.save(request);
            auditLogService.log("CUSTOMER_DELETE_REQUEST", "Officer " + username + " submitted deletion request for customer account " + accountNo);

            Map<String, Object> response = new HashMap<>();
            response.put("requestId", request.getRequestId());
            response.put("status", "PENDING");
            response.put("message", "Customer deletion request queued for approval.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to queue deletion request: " + e.getMessage()));
        }
    }

    private void applyCustomerEdits(Customer customer, Map<String, Object> values) {
        if (values.containsKey("customerName"))
            customer.setCustomerName((String) values.get("customerName"));
        if (values.containsKey("customerAddress"))
            customer.setCustomerAddress((String) values.get("customerAddress"));
        if (values.containsKey("mobileNo"))
            customer.setMobileNo((String) values.get("mobileNo"));
        if (values.containsKey("agreementDate") && values.get("agreementDate") != null && !values.get("agreementDate").toString().isEmpty()) {
            customer.setAgreementDate(java.time.LocalDate.parse((String) values.get("agreementDate")));
        }
        if (values.containsKey("panelCapacity") && values.get("panelCapacity") != null && !values.get("panelCapacity").toString().isEmpty()) {
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
        if (values.containsKey("unitRate") && values.get("unitRate") != null && !values.get("unitRate").toString().isEmpty())
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

    private List<BillingRecord> deduplicateTechnicalDuplicates(List<BillingRecord> history) {
        if (history == null || history.isEmpty()) {
            return history;
        }
        List<BillingRecord> uniqueRecords = new ArrayList<>();
        for (BillingRecord record : history) {
            boolean isTechnicalDuplicate = false;
            for (BillingRecord existing : uniqueRecords) {
                if (isSameTechnicalRecord(record, existing)) {
                    isTechnicalDuplicate = true;
                    break;
                }
            }
            if (!isTechnicalDuplicate) {
                uniqueRecords.add(record);
            }
        }
        return uniqueRecords;
    }

    private boolean isSameTechnicalRecord(BillingRecord r1, BillingRecord r2) {
        if (r1 == null || r2 == null) return false;

        String acc1 = r1.getCustomer() != null ? r1.getCustomer().getAccountNo() : null;
        String acc2 = r2.getCustomer() != null ? r2.getCustomer().getAccountNo() : null;
        if (!Objects.equals(acc1, acc2)) return false;

        if (!Objects.equals(r1.getRefNo(), r2.getRefNo())) return false;
        if (!Objects.equals(r1.getFromDate(), r2.getFromDate())) return false;
        if (!Objects.equals(r1.getToDate(), r2.getToDate())) return false;

        if (!Objects.equals(r1.getPrevReadingDate(), r2.getPrevReadingDate())) return false;
        if (!Objects.equals(r1.getCurrReadingDate(), r2.getCurrReadingDate())) return false;

        if (!Objects.equals(r1.getImportUnits(), r2.getImportUnits())) return false;
        if (!Objects.equals(r1.getExportUnits(), r2.getExportUnits())) return false;
        if (!Objects.equals(r1.getNetUnit(), r2.getNetUnit())) return false;
        if (!Objects.equals(r1.getUnitCost(), r2.getUnitCost())) return false;
        if (!Objects.equals(r1.getTotalAmount(), r2.getTotalAmount())) return false;
        if (!Objects.equals(r1.getBillingMode(), r2.getBillingMode())) return false;

        if (!Objects.equals(r1.getBillCycle(), r2.getBillCycle())) return false;
        if (!Objects.equals(r1.getBillSetOff(), r2.getBillSetOff())) return false;
        if (!Objects.equals(r1.getRetentionMoney(), r2.getRetentionMoney())) return false;
        if (!Objects.equals(r1.getPayment(), r2.getPayment())) return false;
        if (!Objects.equals(r1.getEnergyPurchase(), r2.getEnergyPurchase())) return false;

        if (!Objects.equals(r1.getKwhImport(), r2.getKwhImport())) return false;
        if (!Objects.equals(r1.getKwhExport(), r2.getKwhExport())) return false;
        if (!Objects.equals(r1.getKwhSales(), r2.getKwhSales())) return false;
        if (!Objects.equals(r1.getPaymentSettled(), r2.getPaymentSettled())) return false;
        if (!Objects.equals(r1.getUploadHistoryId(), r2.getUploadHistoryId())) return false;

        return true;
    }
}
