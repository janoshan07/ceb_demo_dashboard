package com.ceb.billing.controllers;

import com.ceb.billing.entities.PaymentBatch;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.services.PaymentControlService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentControlController {

    @Autowired
    private PaymentControlService paymentControlService;

    /**
     * Canonical Summary Cards:
     * - Payment Ready
     * - On Hold
     * - Requires Review
     * - Total Payable
     * - Total On Hold
     * - Customer Count
     */
    @GetMapping("/summary")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getPaymentSummary(
            @RequestParam(value = "billingPeriod", required = false) String billingPeriod,
            @RequestParam(value = "division", required = false) String division) {
        try {
            return ResponseEntity.ok(paymentControlService.getCanonicalSummary(billingPeriod, division));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load payment summary: " + e.getMessage()));
        }
    }

    /**
     * Available Billing Months for Month-Wise Payment Control.
     */
    @GetMapping("/months")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getAvailableMonths() {
        try {
            return ResponseEntity.ok(paymentControlService.getAvailableBillingMonths());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load billing months: " + e.getMessage()));
        }
    }

    /**
     * Evaluated Customer Directory for Payment Control:
     * Returns READY / ON_HOLD / REVIEW customers with server-side pagination, search, and category filter.
     */
    @GetMapping("/customers")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getPaymentCustomers(
            @RequestParam(value = "billingPeriod", required = false) String billingPeriod,
            @RequestParam(value = "division", required = false) String division,
            @RequestParam(value = "category", defaultValue = "ALL") String category,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "holdReason", required = false) String holdReason,
            @RequestParam(value = "validationStatus", required = false) String validationStatus,
            @RequestParam(value = "netType", required = false) String netType,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size) {
        try {
            // Evaluated customer directory with server-side filtering
            return ResponseEntity.ok(paymentControlService.getPaymentCustomers(
                    billingPeriod, division, category, search, holdReason, validationStatus, netType, page, size));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load payment customers: " + e.getMessage()));
        }
    }

    /**
     * Customer 360 / Issue View:
     * Side-by-side MASTER VALUE vs UPLOADED/SOURCE VALUE.
     */
    @GetMapping("/customers/{accountNo}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getCustomerDetails(
            @PathVariable String accountNo,
            @RequestParam(value = "billingPeriod", required = false) String billingPeriod) {
        try {
            return ResponseEntity.ok(paymentControlService.getCustomerIssueDetails(accountNo, billingPeriod));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load customer details: " + e.getMessage()));
        }
    }

    /**
     * Customer 360 Month-Wise Payment Dossier:
     * Full month-wise financial timeline, strictly isolated per billing month, with categorized hold diagnostics,
     * side-by-side mismatch comparisons, and missing-field diagnostics.
     */
    @GetMapping("/customers/{accountNo}/dossier")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getCustomerPaymentDossier(@PathVariable String accountNo) {
        try {
            return ResponseEntity.ok(paymentControlService.getCustomerMonthWisePaymentDossier(accountNo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load customer payment dossier: " + e.getMessage()));
        }
    }

    /**
     * In-place Staging Correction:
     * Saves edits, re-validates, recalculates eligibility, and automatically moves to READY if resolved.
     */
    @PostMapping("/customers/{accountNo}/correct")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> correctCustomer(
            @PathVariable String accountNo,
            @RequestParam(value = "billingPeriod", required = false) String billingPeriod,
            @RequestBody Map<String, Object> corrections) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            return ResponseEntity.ok(paymentControlService.correctCustomerAndRevalidate(
                    accountNo, billingPeriod, corrections, username));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to correct customer: " + e.getMessage()));
        }
    }

    /**
     * Explicit Payment Hold / Release Toggle.
     */
    @PostMapping("/customers/{accountNo}/toggle-hold")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> toggleHold(
            @PathVariable String accountNo,
            @RequestParam(value = "billingPeriod", required = false) String billingPeriod,
            @RequestParam(value = "hold", defaultValue = "true") boolean hold,
            @RequestParam(value = "reason", required = false) String reason) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            return ResponseEntity.ok(paymentControlService.togglePaymentHold(
                    accountNo, billingPeriod, hold, reason, username));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to toggle payment hold: " + e.getMessage()));
        }
    }

    /**
     * Create Payment Batch:
     * BACKEND SECURITY ENFORCEMENT: Rejects immediately if any selected customer is ON_HOLD / ineligible!
     */
    @PostMapping("/batches")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> createBatch(@RequestBody Map<String, Object> payload) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            String billingPeriod = (String) payload.get("billingPeriod");
            String division = (String) payload.get("division");
            @SuppressWarnings("unchecked")
            List<String> accountNos = (List<String>) payload.get("accountNos");

            PaymentBatch batch = paymentControlService.createPaymentBatch(
                    billingPeriod, division, accountNos, username);
            return ResponseEntity.ok(batch);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to create payment batch: " + e.getMessage()));
        }
    }

    /**
     * Lists all payment batches.
     */
    @GetMapping("/batches")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> listBatches() {
        try {
            return ResponseEntity.ok(paymentControlService.getAllBatches());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load batches: " + e.getMessage()));
        }
    }

    /**
     * Get specific payment batch details and items.
     */
    @GetMapping("/batches/{batchId}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getBatch(@PathVariable Long batchId) {
        try {
            PaymentBatch batch = paymentControlService.getBatchById(batchId);
            return ResponseEntity.ok(Map.of(
                    "batch", batch,
                    "items", paymentControlService.getBatchItems(batchId)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load batch: " + e.getMessage()));
        }
    }

    /**
     * Batch State Transition:
     * actions: SUBMIT, REVIEW, APPROVE, REJECT, CORRECT, PROCESS, COMPLETE
     */
    @PostMapping("/batches/{batchId}/transition")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> transitionBatch(
            @PathVariable Long batchId,
            @RequestBody Map<String, Object> payload) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        String action = (String) payload.get("action");
        String reason = (String) payload.get("reason");

        if (action == null || action.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Action is required."));
        }

        // Only Admin can APPROVE, REJECT, or REVIEW batches
        if (("APPROVE".equalsIgnoreCase(action) || "REJECT".equalsIgnoreCase(action) || "REVIEW".equalsIgnoreCase(action)) && !isAdmin) {
            return ResponseEntity.status(403)
                    .body(new MessageResponse("Supervisor review / approval / rejection requires ADMIN role."));
        }

        try {
            PaymentBatch updated = paymentControlService.transitionBatchStatus(
                    batchId, action, reason, username);
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Batch transition failed: " + e.getMessage()));
        }
    }

    /**
     * Payment History for Processed & Settled batches.
     */
    @GetMapping("/history")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getPaymentHistory() {
        try {
            return ResponseEntity.ok(paymentControlService.getPaymentHistory());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new MessageResponse("Failed to load payment history: " + e.getMessage()));
        }
    }
}
