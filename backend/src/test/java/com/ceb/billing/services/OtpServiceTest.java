package com.ceb.billing.services;

import com.ceb.billing.entities.OtpVerification;
import com.ceb.billing.entities.User;
import com.ceb.billing.models.OtpLoginResponse;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.OtpVerificationRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.services.sms.SmsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
public class OtpServiceTest {

    @Mock
    private OtpVerificationRepository otpVerificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private SmsService smsService;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private OtpService otpService;

    @BeforeEach
    public void setUp() {
        ReflectionTestUtils.setField(otpService, "otpExpirationSeconds", 300);
        ReflectionTestUtils.setField(otpService, "resendCooldownSeconds", 60);
        ReflectionTestUtils.setField(otpService, "maxAttempts", 5);
        ReflectionTestUtils.setField(otpService, "defaultFallbackPhone", "+94771234567");
    }

    @Test
    public void testCreateAndSendOtp_Success() {
        User user = new User("admin", "hashedpw", "ADMIN", "+94771234567");
        when(otpVerificationRepository.findByUsernameAndConsumedFalse("admin")).thenReturn(Collections.emptyList());
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$mockHashedOtp");
        when(smsService.sendOtpSms(eq("+94771234567"), anyString(), eq(5))).thenReturn(true);

        OtpLoginResponse response = otpService.createAndSendOtp(user);

        assertNotNull(response);
        assertTrue(response.isOtpRequired());
        assertNotNull(response.getOtpSessionId());
        assertEquals("******4567", response.getMaskedPhone());
        assertEquals(300, response.getExpiresInSeconds());
        assertEquals(60, response.getResendCooldownSeconds());

        verify(smsService, times(1)).sendOtpSms(eq("+94771234567"), anyString(), eq(5));
        verify(otpVerificationRepository, times(1)).save(any(OtpVerification.class));
    }

    @Test
    public void testVerifyOtp_Success() {
        String sessionId = "test-session-123";
        String rawOtp = "654321";
        String hashedOtp = "$2a$10$mockHashedOtp";

        OtpVerification entity = new OtpVerification(
                sessionId, "admin", hashedOtp, "+94771234567", 5,
                LocalDateTime.now().plusSeconds(60),
                LocalDateTime.now().plusMinutes(5)
        );

        when(otpVerificationRepository.findByOtpSessionId(sessionId)).thenReturn(Optional.of(entity));
        when(passwordEncoder.matches(rawOtp, hashedOtp)).thenReturn(true);

        String verifiedUser = otpService.verifyOtp(sessionId, rawOtp);

        assertEquals("admin", verifiedUser);
        assertTrue(entity.isConsumed(), "Verified OTP must be marked as consumed to prevent replay");
        verify(otpVerificationRepository, times(1)).save(entity);
    }

    @Test
    public void testVerifyOtp_InvalidCode_DecrementsRemainingAttempts() {
        String sessionId = "test-session-456";
        String rawOtp = "000000";
        String hashedOtp = "$2a$10$mockHashedOtp";

        OtpVerification entity = new OtpVerification(
                sessionId, "admin", hashedOtp, "+94771234567", 5,
                LocalDateTime.now().plusSeconds(60),
                LocalDateTime.now().plusMinutes(5)
        );

        when(otpVerificationRepository.findByOtpSessionId(sessionId)).thenReturn(Optional.of(entity));
        when(passwordEncoder.matches(rawOtp, hashedOtp)).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            otpService.verifyOtp(sessionId, rawOtp);
        });

        assertTrue(ex.getMessage().contains("4 attempts remaining"));
        assertEquals(1, entity.getAttemptsCount());
        assertFalse(entity.isConsumed());
        verify(otpVerificationRepository, times(1)).save(entity);
    }

    @Test
    public void testVerifyOtp_MaxAttemptsExceeded() {
        String sessionId = "test-session-max";
        String rawOtp = "000000";
        String hashedOtp = "$2a$10$mockHashedOtp";

        OtpVerification entity = new OtpVerification(
                sessionId, "admin", hashedOtp, "+94771234567", 5,
                LocalDateTime.now().plusSeconds(60),
                LocalDateTime.now().plusMinutes(5)
        );
        entity.setAttemptsCount(4); // 5th attempt will fail

        when(otpVerificationRepository.findByOtpSessionId(sessionId)).thenReturn(Optional.of(entity));
        when(passwordEncoder.matches(rawOtp, hashedOtp)).thenReturn(false);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            otpService.verifyOtp(sessionId, rawOtp);
        });

        assertTrue(ex.getMessage().contains("Maximum attempts exceeded"));
        assertTrue(entity.isConsumed());
    }

    @Test
    public void testVerifyOtp_ExpiredOtp() {
        String sessionId = "test-session-expired";
        String rawOtp = "123456";

        OtpVerification entity = new OtpVerification(
                sessionId, "admin", "hashed", "+94771234567", 5,
                LocalDateTime.now().minusMinutes(10),
                LocalDateTime.now().minusMinutes(1) // expired
        );

        when(otpVerificationRepository.findByOtpSessionId(sessionId)).thenReturn(Optional.of(entity));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            otpService.verifyOtp(sessionId, rawOtp);
        });

        assertTrue(ex.getMessage().contains("expired"));
        assertTrue(entity.isConsumed());
    }

    @Test
    public void testVerifyOtp_AlreadyConsumedPreventReplay() {
        String sessionId = "test-session-consumed";
        String rawOtp = "123456";

        OtpVerification entity = new OtpVerification(
                sessionId, "admin", "hashed", "+94771234567", 5,
                LocalDateTime.now().plusSeconds(60),
                LocalDateTime.now().plusMinutes(5)
        );
        entity.setConsumed(true);

        when(otpVerificationRepository.findByOtpSessionId(sessionId)).thenReturn(Optional.of(entity));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            otpService.verifyOtp(sessionId, rawOtp);
        });

        assertTrue(ex.getMessage().contains("already been used"));
    }

    @Test
    public void testResendOtp_CooldownEnforced() {
        String sessionId = "test-session-cooldown";

        OtpVerification entity = new OtpVerification(
                sessionId, "admin", "hashed", "+94771234567", 5,
                LocalDateTime.now().plusSeconds(45), // 45 seconds left
                LocalDateTime.now().plusMinutes(4)
        );

        when(otpVerificationRepository.findByOtpSessionId(sessionId)).thenReturn(Optional.of(entity));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            otpService.resendOtp(sessionId);
        });

        assertTrue(ex.getMessage().contains("Please wait"));
        assertFalse(entity.isConsumed());
    }

    @Test
    public void testResendOtp_AfterCooldown_GeneratesNewOtp() {
        String sessionId = "test-session-resend";

        OtpVerification oldEntity = new OtpVerification(
                sessionId, "admin", "hashed", "+94771234567", 5,
                LocalDateTime.now().minusSeconds(10), // Cooldown passed
                LocalDateTime.now().plusMinutes(2)
        );

        User user = new User("admin", "hashedpw", "ADMIN", "+94771234567");

        when(otpVerificationRepository.findByOtpSessionId(sessionId)).thenReturn(Optional.of(oldEntity));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$newHashedOtp");
        when(smsService.sendOtpSms(eq("+94771234567"), anyString(), eq(5))).thenReturn(true);

        OtpLoginResponse response = otpService.resendOtp(sessionId);

        assertNotNull(response);
        assertTrue(oldEntity.isConsumed(), "Old OTP session must be invalidated upon resend");
        verify(smsService, times(1)).sendOtpSms(eq("+94771234567"), anyString(), eq(5));
    }

    @Test
    public void testMaskPhoneNumber() {
        assertEquals("******4567", otpService.maskPhoneNumber("+94771234567"));
        assertEquals("******1234", otpService.maskPhoneNumber("0770001234"));
        assertEquals("******0000", otpService.maskPhoneNumber(null));
        assertEquals("******0000", otpService.maskPhoneNumber(""));
    }
}
