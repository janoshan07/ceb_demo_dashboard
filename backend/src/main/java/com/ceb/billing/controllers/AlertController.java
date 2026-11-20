
package com.ceb.billing.controllers;

import com.ceb.billing.entities.Alert;
import com.ceb.billing.repositories.AlertRepository;
import com.ceb.billing.services.AlertService;
import com.ceb.billing.security.OfficerStepUp;
import com.ceb.billing.services.AuditLogService;
import com.ceb.billing.config.UserDetailsImpl;
import org.springframework.lang.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/alerts")
public class AlertController {

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private AlertService alertService;

    @Autowired
    private AuditLogService auditLogService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> getActiveAlerts(@RequestParam(value = "severity", required = false) String severity) {
        List<Alert> alerts;
        if (severity != null && !severity.trim().isEmpty() && !"ALL".equalsIgnoreCase(severity.trim())) {
            alerts = alertRepository.findBySeverityAndStatusOrderByCreatedAtDesc(severity.trim().toUpperCase(), "UNREAD");
        } else {
            alerts = alertRepository.findByStatusOrderByCreatedAtDesc("UNREAD");
        }
        return ResponseEntity.ok(alerts);
    }

    @GetMapping("/counters")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> getAlertCounters() {
        Map<String, Long> counters = alertService.getAlertCounters();
        return ResponseEntity.ok(counters);
    }

    @PostMapping("/{alertId}/resolve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    @OfficerStepUp(action = "ALERT_RESOLVE", recordId = "alertId")
    public ResponseEntity<?> resolveAlert(@PathVariable @NonNull Long alertId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        alertService.resolveAlert(alertId);

        auditLogService.log("ALERT_RESOLVED", String.format(
                "Alert ID %d resolved by %s", alertId, userDetails.getUsername()));

        return ResponseEntity.ok().body(Map.of("message", "Alert successfully resolved."));
    }

    private static final java.util.concurrent.atomic.AtomicBoolean IS_RECHECKING = new java.util.concurrent.atomic.AtomicBoolean(false);

    @PostMapping("/recheck-false-negatives")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> recheckFalseNegatives() {
        if (!IS_RECHECKING.compareAndSet(false, true)) {
            return ResponseEntity.status(409).body(Map.of("message", "Recheck operation is already in progress. Please wait."));
        }
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String username = auth != null ? auth.getName() : "admin";
            Map<String, Integer> result = alertService.recheckAndResolveFalseNegativeAlerts(username);
            int resolved = result.get("resolvedCount");
            int skipped = result.get("skippedCount");
            int total = result.get("totalEvaluated");
            auditLogService.log("ALERTS_BATCH_RESOLVED", String.format(
                    "Rechecked %d false negative alerts (%d resolved, %d skipped) by %s", total, resolved, skipped, username));
            return ResponseEntity.ok(Map.of(
                    "message", String.format("Recheck complete: %d resolved, %d skipped out of %d evaluated.", resolved, skipped, total),
                    "resolvedCount", resolved,
                    "skippedCount", skipped,
                    "totalEvaluated", total
            ));
        } finally {
            IS_RECHECKING.set(false);
        }
    }

    @PostMapping("/resolve-group")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> resolveAlertGroup(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String alertType) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth != null ? auth.getName() : "admin";
        int resolved = alertService.resolveAlertGroup(severity, alertType, username);
        auditLogService.log("ALERT_GROUP_RESOLVED", String.format(
                "Bulk resolved %d alerts (severity: %s, type: %s) by %s",
                resolved, severity != null ? severity : "ALL", alertType != null ? alertType : "ALL", username));
        return ResponseEntity.ok(Map.of(
                "message", "Successfully resolved " + resolved + " alerts.",
                "resolvedCount", resolved
        ));
    }

    @GetMapping("/orphan-count")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getOrphanAlertCount() {
        int count = alertService.countOrphanAlerts();
        long durationMs = com.ceb.billing.services.AlertService.getLastQueryDurationMs();
        return ResponseEntity.ok(Map.of(
                "orphanCount", count,
                "durationMs", durationMs
        ));
    }

    @PostMapping("/resolve-orphans")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> resolveOrphanAlerts() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth != null ? auth.getName() : "admin";
        Map<String, Object> result = alertService.resolveAllOrphanAlerts(username);
        return ResponseEntity.ok(result);
    }
}
