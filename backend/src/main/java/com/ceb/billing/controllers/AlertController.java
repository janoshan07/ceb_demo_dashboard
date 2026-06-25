package com.ceb.billing.controllers;

import com.ceb.billing.entities.Alert;
import com.ceb.billing.repositories.AlertRepository;
import com.ceb.billing.services.AlertService;
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
    public ResponseEntity<?> resolveAlert(@PathVariable @NonNull Long alertId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        alertService.resolveAlert(alertId);

        auditLogService.log("ALERT_RESOLVED", String.format(
                "Alert ID %d resolved by %s", alertId, userDetails.getUsername()));

        return ResponseEntity.ok().body(Map.of("message", "Alert successfully resolved."));
    }
}
