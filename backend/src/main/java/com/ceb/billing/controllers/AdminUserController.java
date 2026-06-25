package com.ceb.billing.controllers;

import com.ceb.billing.entities.AuditLog;
import com.ceb.billing.entities.User;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.entities.BillingUploadStaging;
import com.ceb.billing.repositories.AuditLogRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.repositories.BillingUploadStagingRepository;
import com.ceb.billing.services.AuditLogService;
import com.ceb.billing.services.StagingMigrationService;
import com.ceb.billing.models.MessageResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.Objects;

// Admin user management controller
@RestController

@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private BillingUploadStagingRepository stagingRepository;

    @Autowired
    private StagingMigrationService stagingMigrationService;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private AuditLogService auditLogService;

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody User user) {
        if (user.getUsername() == null || user.getUsername().trim().isEmpty() ||
                user.getPassword() == null || user.getPassword().trim().isEmpty() ||
                user.getRole() == null || user.getRole().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Missing username, password, or role"));
        }

        String assignedRole = user.getRole().trim().toUpperCase();
        if (!assignedRole.equals("ADMIN") && !assignedRole.equals("OFFICER") && !assignedRole.equals("USER")) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Invalid role. Allowed roles: ADMIN, OFFICER, USER"));
        }

        if (userRepository.findByUsername(user.getUsername().trim()).isPresent()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Username already exists!"));
        }

        user.setUsername(user.getUsername().trim());
        user.setPassword(encoder.encode(user.getPassword().trim()));
        user.setRole(assignedRole);
        userRepository.save(Objects.requireNonNull(user));

        auditLogService.log("USER_CREATED", "Created user: " + user.getUsername() + " with role: " + user.getRole());
        return ResponseEntity.ok(user);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable long id, @RequestBody User userDetails) {
        Optional<User> optUser = userRepository.findById(id);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = optUser.get();

        // Update password if present and not empty
        if (userDetails.getPassword() != null && !userDetails.getPassword().trim().isEmpty()) {
            user.setPassword(encoder.encode(userDetails.getPassword().trim()));
        }

        // Update role
        if (userDetails.getRole() != null && !userDetails.getRole().trim().isEmpty()) {
            String assignedRole = userDetails.getRole().trim().toUpperCase();
            if (!assignedRole.equals("ADMIN") && !assignedRole.equals("OFFICER") && !assignedRole.equals("USER")) {
                return ResponseEntity.badRequest()
                        .body(new MessageResponse("Invalid role. Allowed roles: ADMIN, OFFICER, USER"));
            }
            user.setRole(assignedRole);
        }

        userRepository.save(Objects.requireNonNull(user));

        auditLogService.log("USER_UPDATED", "Updated user details for username: " + user.getUsername());
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable long id) {
        Optional<User> optUser = userRepository.findById(id);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = optUser.get();
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();

        if (user.getUsername().equals(currentUsername)) {
            return ResponseEntity.badRequest().body(new MessageResponse("You cannot delete your own account!"));
        }

        userRepository.delete(user);
        auditLogService.log("USER_DELETED", "Deleted user: " + user.getUsername());

        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        List<AuditLog> logs = auditLogRepository.findAllByOrderByTimestampDesc();
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/staging/pending")
    public ResponseEntity<List<UploadHistory>> getPendingStagingBatches() {
        return ResponseEntity.ok(uploadHistoryRepository.findByStatusOrderByUploadTimeDesc("PENDING_APPROVAL"));
    }

    @GetMapping("/staging/batch/{batchId}")
    public ResponseEntity<List<BillingUploadStaging>> getStagingBatchDetails(@PathVariable long batchId) {
        return ResponseEntity.ok(stagingRepository.findByUploadBatchId(batchId));
    }

    @PostMapping("/staging/batch/{batchId}/approve")
    public ResponseEntity<?> approveStagingBatch(@PathVariable long batchId) {
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            stagingMigrationService.migrateApprovedBatch(batchId, currentUsername);
            return ResponseEntity.ok(new MessageResponse("Staging batch approved and successfully migrated to main tables."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to migrate staging batch: " + e.getMessage()));
        }
    }

    @PostMapping("/staging/batch/{batchId}/reject")
    public ResponseEntity<?> rejectStagingBatch(@PathVariable long batchId) {
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            stagingMigrationService.rejectBatch(batchId, currentUsername);
            return ResponseEntity.ok(new MessageResponse("Staging batch successfully rejected and staging rows discarded."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Failed to reject staging batch: " + e.getMessage()));
        }
    }
}

