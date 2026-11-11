package com.ceb.billing.services;

import com.ceb.billing.entities.User;
import com.ceb.billing.repositories.AuditLogRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.security.OfficerStepUpResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OfficerStepUpServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private OfficerStepUpService officerStepUpService;

    @Test
    void verifyAcceptsAnAdminPasswordWithoutLoggingIt() {
        User officer = new User("officer", "officer-hash", "OFFICER");
        User admin = new User("admin", "admin-hash", "ADMIN");
        when(userRepository.findByUsername("officer")).thenReturn(Optional.of(officer));
        when(userRepository.findByRole("ADMIN")).thenReturn(List.of(admin));
        when(auditLogRepository.countByPerformedByAndActionAndTimestampAfter(
                eq("officer"), eq("OFFICER_STEP_UP_FAILED"), any(LocalDateTime.class))).thenReturn(0L);
        when(passwordEncoder.matches("admin-password", "admin-hash")).thenReturn(true);

        assertEquals(OfficerStepUpResult.VERIFIED,
                officerStepUpService.verify("officer", "admin-password", "CUSTOMER_UPDATE", "123"));

        verify(auditLogService, never()).log(anyString(), contains("admin-password"));
    }

    @Test
    void verifyRateLimitsAfterFiveFailedAttempts() {
        User officer = new User("officer", "officer-hash", "OFFICER");
        User admin = new User("admin", "admin-hash", "ADMIN");
        AtomicLong failedAttempts = new AtomicLong();
        when(userRepository.findByUsername("officer")).thenReturn(Optional.of(officer));
        when(userRepository.findByRole("ADMIN")).thenReturn(List.of(admin));
        when(auditLogRepository.countByPerformedByAndActionAndTimestampAfter(
                eq("officer"), eq("OFFICER_STEP_UP_FAILED"), any(LocalDateTime.class)))
                .thenAnswer(invocation -> failedAttempts.get());
        when(passwordEncoder.matches("wrong-password", "admin-hash")).thenReturn(false);
        doAnswer(invocation -> {
            failedAttempts.incrementAndGet();
            return null;
        }).when(auditLogService).log(eq("OFFICER_STEP_UP_FAILED"), anyString());

        for (int attempt = 0; attempt < 4; attempt++) {
            assertEquals(OfficerStepUpResult.INVALID,
                    officerStepUpService.verify("officer", "wrong-password", "CUSTOMER_UPDATE", "123"));
        }
        assertEquals(OfficerStepUpResult.RATE_LIMITED,
                officerStepUpService.verify("officer", "wrong-password", "CUSTOMER_UPDATE", "123"));
        assertEquals(OfficerStepUpResult.RATE_LIMITED,
                officerStepUpService.verify("officer", "admin-password", "CUSTOMER_UPDATE", "123"));

        verify(auditLogService, times(5)).log(eq("OFFICER_STEP_UP_FAILED"), anyString());
    }
}
