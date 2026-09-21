package com.ceb.billing.services;

import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.OtpVerification;
import com.ceb.billing.entities.User;
import com.ceb.billing.models.OtpLoginResponse;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.OtpVerificationRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.services.sms.SmsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@SuppressWarnings("null")
public class OtpService {

    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);

    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    private OtpVerificationRepository otpVerificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SmsService smsService;

    @Autowired
    private AuditLogService auditLogService;

    @Value("${ceb.otp.expiration-seconds:300}")
    private int otpExpirationSeconds; // 5 minutes default

    @Value("${ceb.otp.resend-cooldown-seconds:60}")
    private int resendCooldownSeconds; // 60 seconds default

    @Value("${ceb.otp.max-attempts:5}")
    private int maxAttempts;

    @Value("${ceb.otp.default-fallback-phone:+94771234567}")
    private String defaultFallbackPhone;

    /**
     * Resolves the user's phone number from User entity, Customer entity, or fallback.
     */
    public String resolveUserPhoneNumber(User user) {
        if (user.getPhoneNumber() != null && !user.getPhoneNumber().trim().isEmpty()) {
            return user.getPhoneNumber().trim();
        }

        // Try looking up Customer entity if username is an account number
        String username = user.getUsername();
        if (username != null && !username.trim().isEmpty()) {
            Optional<Customer> customerOpt = customerRepository.findById(username.trim());
            if (customerOpt.isPresent() && customerOpt.get().getMobileNo() != null && !customerOpt.get().getMobileNo().trim().isEmpty()) {
                String mobile = customerOpt.get().getMobileNo().trim();
                user.setPhoneNumber(mobile);
                userRepository.save(user);
                return mobile;
            }
        }

        // Apply default fallback phone
        user.setPhoneNumber(defaultFallbackPhone);
        userRepository.save(user);
        return defaultFallbackPhone;
    }

    /**
     * Mask phone number (e.g. ******4567)
     */
    public String maskPhoneNumber(String phone) {
        if (phone == null || phone.trim().isEmpty()) {
            return "******0000";
        }
        String clean = phone.replaceAll("\\s+", "");
        if (clean.length() <= 4) {
            return "******" + clean;
        }
        return "******" + clean.substring(clean.length() - 4);
    }

    /**
     * Generates a 6-digit secure OTP and sends it via SMS.
     */
    @Transactional
    public OtpLoginResponse createAndSendOtp(User user) {
        String phoneNumber = resolveUserPhoneNumber(user);
        String maskedPhone = maskPhoneNumber(phoneNumber);

        // Invalidate prior active OTP sessions for this user
        List<OtpVerification> activeSessions = otpVerificationRepository.findByUsernameAndConsumedFalse(user.getUsername());
        for (OtpVerification session : activeSessions) {
            session.setConsumed(true);
        }
        if (!activeSessions.isEmpty()) {
            otpVerificationRepository.saveAll(activeSessions);
        }

        // Generate cryptographically secure 6-digit OTP (100000 - 999999)
        int randomCode = 100000 + secureRandom.nextInt(900000);
        String rawOtp = String.valueOf(randomCode);

        // Hash OTP with BCrypt
        String hashedOtp = passwordEncoder.encode(rawOtp);

        String otpSessionId = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiry = now.plusSeconds(otpExpirationSeconds);
        LocalDateTime cooldown = now.plusSeconds(resendCooldownSeconds);

        OtpVerification otpVerification = new OtpVerification(
                otpSessionId,
                user.getUsername(),
                hashedOtp,
                phoneNumber,
                maxAttempts,
                cooldown,
                expiry
        );

        otpVerificationRepository.save(otpVerification);

        // Dispatch SMS
        int expiryMinutes = Math.max(1, otpExpirationSeconds / 60);
        boolean sent = smsService.sendOtpSms(phoneNumber, rawOtp, expiryMinutes);
        if (!sent) {
            logger.warn("SMS service dispatch returned false for recipient: {}", maskedPhone);
        }

        auditLogService.log("OTP_GENERATED", "OTP generated and dispatched to " + maskedPhone + " for user: " + user.getUsername());

        return new OtpLoginResponse(
                true,
                otpSessionId,
                maskedPhone,
                otpExpirationSeconds,
                resendCooldownSeconds,
                "A 6-digit verification code has been sent to your registered phone number."
        );
    }

    /**
     * Verifies the submitted OTP against the session and bcrypt hash.
     */
    @Transactional
    public String verifyOtp(String otpSessionId, String rawOtp) {
        if (otpSessionId == null || otpSessionId.trim().isEmpty() || rawOtp == null || rawOtp.trim().isEmpty()) {
            throw new IllegalArgumentException("Session ID and OTP code are required.");
        }

        OtpVerification otpVerification = otpVerificationRepository.findByOtpSessionId(otpSessionId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP session. Please sign in again."));

        if (otpVerification.isConsumed()) {
            throw new IllegalStateException("This verification code has already been used. Please sign in again.");
        }

        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(otpVerification.getExpiryTime())) {
            otpVerification.setConsumed(true);
            otpVerificationRepository.save(otpVerification);
            throw new IllegalStateException("Verification code has expired. Please request a new code.");
        }

        if (otpVerification.getAttemptsCount() >= otpVerification.getMaxAttempts()) {
            otpVerification.setConsumed(true);
            otpVerificationRepository.save(otpVerification);
            auditLogService.log("OTP_MAX_ATTEMPTS_EXCEEDED", "Max OTP verification attempts exceeded for user: " + otpVerification.getUsername());
            throw new IllegalStateException("Maximum verification attempts exceeded. Please sign in again.");
        }

        // Increment attempts count
        otpVerification.setAttemptsCount(otpVerification.getAttemptsCount() + 1);

        boolean matches = passwordEncoder.matches(rawOtp.trim(), otpVerification.getHashedOtp());
        if (!matches) {
            otpVerificationRepository.save(otpVerification);
            int remaining = otpVerification.getMaxAttempts() - otpVerification.getAttemptsCount();
            if (remaining <= 0) {
                otpVerification.setConsumed(true);
                otpVerificationRepository.save(otpVerification);
                auditLogService.log("OTP_ATTEMPT_FAILED", "User " + otpVerification.getUsername() + " entered wrong OTP. Attempts exhausted.");
                throw new IllegalStateException("Invalid verification code. Maximum attempts exceeded. Please sign in again.");
            } else {
                auditLogService.log("OTP_ATTEMPT_FAILED", "User " + otpVerification.getUsername() + " entered wrong OTP. Remaining attempts: " + remaining);
                throw new IllegalArgumentException("Invalid verification code. " + remaining + " attempts remaining.");
            }
        }

        // Successful match - invalidate session to prevent replay
        otpVerification.setConsumed(true);
        otpVerificationRepository.save(otpVerification);

        auditLogService.log("OTP_VERIFIED", "OTP successfully verified for user: " + otpVerification.getUsername());
        return otpVerification.getUsername();
    }

    /**
     * Resends an OTP enforcing the 60-second cooldown period and invalidating the previous OTP.
     */
    @Transactional
    public OtpLoginResponse resendOtp(String otpSessionId) {
        if (otpSessionId == null || otpSessionId.trim().isEmpty()) {
            throw new IllegalArgumentException("OTP session ID is required.");
        }

        OtpVerification otpVerification = otpVerificationRepository.findByOtpSessionId(otpSessionId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid OTP session. Please sign in again."));

        if (otpVerification.isConsumed()) {
            throw new IllegalStateException("Session is already completed or expired. Please sign in again.");
        }

        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(otpVerification.getResendCooldownUntil())) {
            long remainingSeconds = Duration.between(now, otpVerification.getResendCooldownUntil()).getSeconds() + 1;
            throw new IllegalStateException("Please wait " + remainingSeconds + " seconds before requesting a new code.");
        }

        // Invalidate old OTP session
        otpVerification.setConsumed(true);
        otpVerificationRepository.save(otpVerification);

        User user = userRepository.findByUsername(otpVerification.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("User account not found."));

        return createAndSendOtp(user);
    }
}
