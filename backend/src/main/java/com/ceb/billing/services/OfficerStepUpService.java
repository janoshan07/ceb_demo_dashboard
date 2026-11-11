package com.ceb.billing.services;

import com.ceb.billing.entities.User;
import com.ceb.billing.repositories.AuditLogRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.security.OfficerStepUpResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OfficerStepUpService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);

    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private AuditLogRepository auditLogRepository;

    public OfficerStepUpResult verify(String officerUsername, String candidatePassword, String action, String recordId) {
        Object lock = locks.computeIfAbsent(officerUsername, ignored -> new Object());
        synchronized (lock) {
            LocalDateTime windowStart = LocalDateTime.now().minus(ATTEMPT_WINDOW);
            long failedAttempts = auditLogRepository.countByPerformedByAndActionAndTimestampAfter(
                    officerUsername, "OFFICER_STEP_UP_FAILED", windowStart);
            if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                return OfficerStepUpResult.RATE_LIMITED;
            }

            User officer = userRepository.findByUsername(officerUsername).orElse(null);
            if (officer == null || candidatePassword == null || candidatePassword.isBlank()
                    || candidatePassword.length() > 256 || !matchesAnyAdmin(candidatePassword)) {
                auditLogService.log("OFFICER_STEP_UP_FAILED", String.format(
                        "Officer ID %s; action %s; record ID %s; result INVALID",
                        officer == null ? "unknown" : officer.getId(), action, recordId));
                return failedAttempts + 1 >= MAX_FAILED_ATTEMPTS
                        ? OfficerStepUpResult.RATE_LIMITED
                        : OfficerStepUpResult.INVALID;
            }

            return OfficerStepUpResult.VERIFIED;
        }
    }

    public void auditMutation(String officerUsername, String action, String recordId) {
        User officer = userRepository.findByUsername(officerUsername).orElse(null);
        auditLogService.log("OFFICER_" + action, String.format(
                "Officer ID %s; action %s; record ID %s",
                officer == null ? "unknown" : officer.getId(), action, recordId));
    }

    private boolean matchesAnyAdmin(String candidatePassword) {
        List<User> administrators = userRepository.findByRole("ADMIN");
        boolean matches = false;
        for (User administrator : administrators) {
            matches |= passwordEncoder.matches(candidatePassword, administrator.getPassword());
        }
        return matches;
    }

}
