package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "otp_verifications", indexes = {
    @Index(name = "idx_otp_session_id", columnList = "otp_session_id", unique = true),
    @Index(name = "idx_otp_username", columnList = "username")
})
public class OtpVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "otp_session_id", nullable = false, unique = true, length = 100)
    private String otpSessionId;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "hashed_otp", nullable = false)
    private String hashedOtp;

    @Column(name = "phone_number", length = 50)
    private String phoneNumber;

    @Column(name = "attempts_count", nullable = false)
    private int attemptsCount = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 5;

    @Column(name = "resend_cooldown_until", nullable = false)
    private LocalDateTime resendCooldownUntil;

    @Column(name = "expiry_time", nullable = false)
    private LocalDateTime expiryTime;

    @Column(nullable = false)
    private boolean consumed = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public OtpVerification() {
    }

    public OtpVerification(String otpSessionId, String username, String hashedOtp, String phoneNumber,
                           int maxAttempts, LocalDateTime resendCooldownUntil, LocalDateTime expiryTime) {
        this.otpSessionId = otpSessionId;
        this.username = username;
        this.hashedOtp = hashedOtp;
        this.phoneNumber = phoneNumber;
        this.attemptsCount = 0;
        this.maxAttempts = maxAttempts;
        this.resendCooldownUntil = resendCooldownUntil;
        this.expiryTime = expiryTime;
        this.consumed = false;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOtpSessionId() {
        return otpSessionId;
    }

    public void setOtpSessionId(String otpSessionId) {
        this.otpSessionId = otpSessionId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getHashedOtp() {
        return hashedOtp;
    }

    public void setHashedOtp(String hashedOtp) {
        this.hashedOtp = hashedOtp;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public int getAttemptsCount() {
        return attemptsCount;
    }

    public void setAttemptsCount(int attemptsCount) {
        this.attemptsCount = attemptsCount;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public LocalDateTime getResendCooldownUntil() {
        return resendCooldownUntil;
    }

    public void setResendCooldownUntil(LocalDateTime resendCooldownUntil) {
        this.resendCooldownUntil = resendCooldownUntil;
    }

    public LocalDateTime getExpiryTime() {
        return expiryTime;
    }

    public void setExpiryTime(LocalDateTime expiryTime) {
        this.expiryTime = expiryTime;
    }

    public boolean isConsumed() {
        return consumed;
    }

    public void setConsumed(boolean consumed) {
        this.consumed = consumed;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
