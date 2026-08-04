package com.ceb.billing.controllers;

import com.ceb.billing.services.MonthlyDirectoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST endpoints for the Monthly Customer Directory archive — the final save/archive workflow that
 * runs after a Step 6 (Master Data Comparison) import is approved.
 *
 * Purely additive: it archives the approved final dataset and manages those archives. It does not
 * modify Steps 1–6 or any validation, merge, comparison, duplicate handling or approval logic.
 */
@RestController
@RequestMapping("/api")
public class MonthlyDirectoryController {

    @Autowired
    private MonthlyDirectoryService monthlyDirectoryService;

    /**
     * Saves the approved Step 6 dataset as a new permanent monthly snapshot. Called after the Step 6
     * approval succeeds and before finalize cleans up the session cache.
     */
    @PostMapping({"/admin/import/{sessionId}/save-directory", "/officer/import/{sessionId}/save-directory"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> saveDirectory(
            @PathVariable Long sessionId,
            @RequestParam(value = "datasetName", required = false, defaultValue = "") String datasetName,
            @RequestParam(value = "billingMonth", required = false, defaultValue = "") String billingMonth,
            @RequestParam(value = "division", required = false, defaultValue = "") String division,
            @RequestParam(value = "validationSummaryJson", required = false, defaultValue = "") String validationSummaryJson,
            @RequestParam(value = "correctionsJson", required = false, defaultValue = "{}") String correctionsJson) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            Map<String, Map<String, Object>> corrections = correctionsJson != null && !correctionsJson.equals("{}")
                    ? new com.fasterxml.jackson.databind.ObjectMapper().readValue(correctionsJson,
                        new com.fasterxml.jackson.core.type.TypeReference<Map<String, Map<String, Object>>>() {})
                    : null;

            boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

            Map<String, Object> result = monthlyDirectoryService.createSnapshot(
                    sessionId, username, datasetName, billingMonth, division, validationSummaryJson, corrections, isAdmin);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to save Monthly Directory: " + e.getMessage()));
        }
    }

    /** Lists all archived monthly directories (metadata only). */
    @GetMapping({"/admin/monthly-directory", "/officer/monthly-directory"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> list() {
        try {
            return ResponseEntity.ok(monthlyDirectoryService.listSnapshots());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to load directories: " + e.getMessage()));
        }
    }

    /**
     * Billing-month overview: every archived month with its 5 fixed Eastern Province division
     * slots, per-division status/records/last-updated and overall monthly progress.
     */
    @GetMapping({"/admin/monthly-directory/months", "/officer/monthly-directory/months"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> months() {
        try {
            return ResponseEntity.ok(monthlyDirectoryService.listMonths());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to load billing months: " + e.getMessage()));
        }
    }

    /** Opens/views one archived month including its full final Customer Directory data. */
    @GetMapping({"/admin/monthly-directory/{id}", "/officer/monthly-directory/{id}"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> get(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(monthlyDirectoryService.getSnapshot(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to open directory: " + e.getMessage()));
        }
    /** Approves a monthly directory snapshot (Admin only). Syncs customer details to Customer Directory. */
    @PostMapping("/admin/monthly-directory/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approve(@PathVariable Long id) {
        String adminUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            return ResponseEntity.ok(monthlyDirectoryService.approveSnapshot(id, adminUsername));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Approval failed: " + e.getMessage()));
        }
    }

    /** Renames a dataset. Updates ONLY the dataset name — customer records are untouched. */
    @PutMapping({"/admin/monthly-directory/{id}/rename", "/officer/monthly-directory/{id}/rename"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> rename(@PathVariable Long id,
                                    @RequestParam("datasetName") String datasetName) {
        try {
            return ResponseEntity.ok(monthlyDirectoryService.rename(id, datasetName));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Rename failed: " + e.getMessage()));
        }
    }

    /**
     * Edits ONE record inside a snapshot (the post-Step-6 working area). The request body may carry
     * {@code recordIndex}, a {@code fields} map of edited values, and boolean {@code revalidate} /
     * {@code approve} flags. Every change is recorded in the snapshot's audit history.
     */
    @PutMapping({"/admin/monthly-directory/{id}/record", "/officer/monthly-directory/{id}/record"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> updateRecord(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            if (body == null || body.get("recordIndex") == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "recordIndex is required."));
            }
            int recordIndex = ((Number) body.get("recordIndex")).intValue();
            @SuppressWarnings("unchecked")
            Map<String, Object> fields = body.get("fields") instanceof Map
                    ? (Map<String, Object>) body.get("fields") : new java.util.HashMap<>();
            boolean revalidate = Boolean.TRUE.equals(body.get("revalidate"));
            boolean approve = Boolean.TRUE.equals(body.get("approve"));
            return ResponseEntity.ok(
                    monthlyDirectoryService.updateRecord(id, recordIndex, fields, revalidate, approve, username));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Record update failed: " + e.getMessage()));
        }
    }

    /** Returns the complete audit history (edits and approvals) for one snapshot. */
    @GetMapping({"/admin/monthly-directory/{id}/audit", "/officer/monthly-directory/{id}/audit"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> audit(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(monthlyDirectoryService.getAuditLog(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to load audit history: " + e.getMessage()));
        }
    }

    /** Permanently deletes one archived month. */
    @DeleteMapping({"/admin/monthly-directory/{id}", "/officer/monthly-directory/{id}"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            monthlyDirectoryService.delete(id);
            return ResponseEntity.ok(Map.of("message", "Directory deleted."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Delete failed: " + e.getMessage()));
        }
    }

    /** Downloads the archived final Customer Directory data as an .xlsx workbook. */
    @GetMapping({"/admin/monthly-directory/{id}/download/excel", "/officer/monthly-directory/{id}/download/excel"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> downloadExcel(@PathVariable Long id) {
        try {
            byte[] bytes = monthlyDirectoryService.buildExcel(id);
            String filename = "customer_directory_" + id + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(bytes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Excel export failed: " + e.getMessage()));
        }
    }
}
