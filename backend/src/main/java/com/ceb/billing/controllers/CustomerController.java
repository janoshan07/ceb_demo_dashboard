package com.ceb.billing.controllers;

import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;

@RestController
@RequestMapping
public class CustomerController {

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private ApprovalRequestRepository approvalRequestRepository;

    @Autowired
    private AuditLogService auditLogService;

    // --- Officer Customer Endpoints ---

    @GetMapping("/api/officer/customers")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerCustomers(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("accountNo").ascending());
        Page<Customer> customers;

        if (query != null && !query.trim().isEmpty()) {
            customers = customerRepository.searchCustomers(query.trim(), pageable);
        } else {
            customers = customerRepository.findAll(pageable);
        }

        return ResponseEntity.ok(customers);
    }

    @GetMapping("/api/officer/customers/{accountNo}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerCustomerByAccountNo(@PathVariable String accountNo) {
        Optional<Customer> customer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (customer.isPresent()) {
            return ResponseEntity.ok(customer.get());
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/api/officer/customers/{accountNo}/billing")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerCustomerBillingHistory(@PathVariable String accountNo) {
        Optional<Customer> customer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (customer.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        List<BillingRecord> history = billingRecordRepository.findByCustomerAccountNoOrderByFromDateDesc(Objects.requireNonNull(accountNo));
        return ResponseEntity.ok(history);
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

    @PutMapping("/api/admin/customers/{accountNo}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminUpdateCustomer(@PathVariable String accountNo,
            @RequestBody Customer customerDetails) {
        Optional<Customer> optCustomer = customerRepository.findById(Objects.requireNonNull(accountNo));
        if (optCustomer.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Customer customer = optCustomer.get();
        String oldName = customer.getCustomerName();
        customer.setCustomerName(customerDetails.getCustomerName());
        customer.setCustomerAddress(customerDetails.getCustomerAddress());
        customer.setMobileNo(customerDetails.getMobileNo());
        customer.setAgreementDate(customerDetails.getAgreementDate());
        customer.setPanelCapacity(customerDetails.getPanelCapacity());
        customer.setBankCode(customerDetails.getBankCode());
        customer.setBranchCode(customerDetails.getBranchCode());
        customer.setBankAccountNo(customerDetails.getBankAccountNo());
        customer.setSolarType(customerDetails.getSolarType());

        customerRepository.save(Objects.requireNonNull(customer));

        // Audit Log Entry
        String auditDetail = String.format("Admin updated customer account: %s. Name changed from '%s' to '%s'",
                accountNo, oldName, customerDetails.getCustomerName());
        auditLogService.log("CUSTOMER_UPDATE", auditDetail);

        return ResponseEntity.ok(customer);
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
        return ResponseEntity.ok(history);
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
    }
}
