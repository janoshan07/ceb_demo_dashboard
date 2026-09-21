package com.ceb.billing.services.sms;

public interface SmsService {
    /**
     * Dispatches an OTP verification code to the recipient's phone number.
     *
     * @param toPhoneNumber recipient phone number (e.g. +94771234567)
     * @param otp 6-digit one-time password
     * @param expiryMinutes duration in minutes before expiration
     * @return true if successfully dispatched, false otherwise
     */
    boolean sendOtpSms(String toPhoneNumber, String otp, int expiryMinutes);
}
