package com.ceb.billing.controllers;

import com.ceb.billing.services.MultiFileImportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * REST controller for the 3-step multi-file Excel import workflow:
 *   Step 1 — Master Data (customer profiles)
 *   Step 2 — CEB Assist  (reading dates)
 *   Step 3 — NGEN        (kWh data + billing calculation)
 */
@RestController
@RequestMapping("/api")
public class MultiFileImportController {

    @Autowired
    private MultiFileImportService multiFileImportService;

    // ─────────────────────────────────────────────────────────────────────
    //  SESSION
    // ─────────────────────────────────────────────────────────────────────

    /** Returns the current active import session for the authenticated user (or {hasActiveSession: false}). */
    @GetMapping("/officer/import/session/active")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getActiveSession() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            return ResponseEntity.ok(multiFileImportService.getActiveSession(username));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    /** Discards/resets the current session so the user can start fresh. */
    @DeleteMapping("/officer/import/session/{sessionId}")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> discardSession(@PathVariable Long sessionId) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            multiFileImportService.discardSession(sessionId, username);
            return ResponseEntity.ok(Map.of("message", "Session discarded. You can start a new import."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  STEP 1 — MASTER DATA
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Upload and preview Master Data file.
     * Returns structured preview with row-level validation.
     */
    @PostMapping("/officer/import/master-data/upload")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> uploadMasterData(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File cannot be empty."));
        }
        try {
            byte[] fileBytes = file.getBytes();
            Map<String, Object> preview = multiFileImportService.previewMasterData(fileBytes, file.getOriginalFilename());
            return ResponseEntity.ok(preview);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Master Data preview failed: " + e.getMessage()));
        }
    }

    /**
     * Approve Master Data — persists customers and starts the import session.
     * Request body: { "corrections": { "accountNo": { field: value } }, "fileBytes": base64string }
     * We accept the file again to avoid storing bytes server-side between preview and approve.
     */
    @PostMapping({"/admin/import/master-data/approve", "/officer/import/master-data/approve"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> approveMasterData(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "correctionsJson", required = false, defaultValue = "{}") String correctionsJson) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File cannot be empty."));
        }
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            byte[] fileBytes = file.getBytes();

            // Parse corrections map from JSON string
            @SuppressWarnings("unchecked")
            Map<String, Map<String, Object>> corrections = correctionsJson != null && !correctionsJson.equals("{}")
                    ? new com.fasterxml.jackson.databind.ObjectMapper().readValue(correctionsJson,
                        new com.fasterxml.jackson.core.type.TypeReference<Map<String, Map<String, Object>>>() {})
                    : null;

            Map<String, Object> result = multiFileImportService.approveMasterData(fileBytes, file.getOriginalFilename(), username, corrections);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Master Data approval failed: " + e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  STEP 2 — CEB ASSIST
    // ─────────────────────────────────────────────────────────────────────

    @PostMapping("/officer/import/ceb-assist/upload")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> uploadCebAssist(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sessionId") Long sessionId) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File cannot be empty."));
        }
        try {
            byte[] fileBytes = file.getBytes();
            Map<String, Object> preview = multiFileImportService.previewCebAssist(fileBytes, file.getOriginalFilename(), sessionId);
            return ResponseEntity.ok(preview);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "CEB Assist preview failed: " + e.getMessage()));
        }
    }

    @PostMapping({"/admin/import/ceb-assist/{sessionId}/approve", "/officer/import/ceb-assist/{sessionId}/approve"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> approveCebAssist(
            @PathVariable Long sessionId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "correctionsJson", required = false, defaultValue = "{}") String correctionsJson) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File cannot be empty."));
        }
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            byte[] fileBytes = file.getBytes();
            @SuppressWarnings("unchecked")
            Map<String, Map<String, Object>> corrections = correctionsJson != null && !correctionsJson.equals("{}")
                    ? new com.fasterxml.jackson.databind.ObjectMapper().readValue(correctionsJson,
                        new com.fasterxml.jackson.core.type.TypeReference<Map<String, Map<String, Object>>>() {})
                    : null;

            Map<String, Object> result = multiFileImportService.approveCebAssist(fileBytes, username, sessionId, corrections);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "CEB Assist approval failed: " + e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  STEP 3 — NGEN
    // ─────────────────────────────────────────────────────────────────────

    @PostMapping("/officer/import/ngen/upload")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> uploadNgen(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sessionId") Long sessionId) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File cannot be empty."));
        }
        try {
            byte[] fileBytes = file.getBytes();
            Map<String, Object> preview = multiFileImportService.previewNgen(fileBytes, file.getOriginalFilename(), sessionId);
            return ResponseEntity.ok(preview);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "NGEN preview failed: " + e.getMessage()));
        }
    }

    @PostMapping({"/admin/import/ngen/{sessionId}/approve", "/officer/import/ngen/{sessionId}/approve"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> approveNgen(
            @PathVariable Long sessionId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "correctionsJson", required = false, defaultValue = "{}") String correctionsJson) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File cannot be empty."));
        }
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            byte[] fileBytes = file.getBytes();
            @SuppressWarnings("unchecked")
            Map<String, Map<String, Object>> corrections = correctionsJson != null && !correctionsJson.equals("{}")
                    ? new com.fasterxml.jackson.databind.ObjectMapper().readValue(correctionsJson,
                         new com.fasterxml.jackson.core.type.TypeReference<Map<String, Map<String, Object>>>() {})
                    : null;

            boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

            Map<String, Object> result = multiFileImportService.approveNgen(fileBytes, username, sessionId, corrections, isAdmin);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "NGEN approval failed: " + e.getMessage()));
        }
    }
}
