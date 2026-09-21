package com.ceb.billing.models;

public class OtpLoginResponse {
    private boolean otpRequired = true;
    private String otpSessionId;
    private String maskedPhone;
    private int expiresInSeconds;
    private int resendCooldownSeconds;
    private String message;

    public OtpLoginResponse() {
    }

    public OtpLoginResponse(boolean otpRequired, String otpSessionId, String maskedPhone,
                            int expiresInSeconds, int resendCooldownSeconds, String message) {
        this.otpRequired = otpRequired;
        this.otpSessionId = otpSessionId;
        this.maskedPhone = maskedPhone;
        this.expiresInSeconds = expiresInSeconds;
        this.resendCooldownSeconds = resendCooldownSeconds;
        this.message = message;
    }

    public boolean isOtpRequired() {
        return otpRequired;
    }

    public void setOtpRequired(boolean otpRequired) {
        this.otpRequired = otpRequired;
    }

    public String getOtpSessionId() {
        return otpSessionId;
    }

    public void setOtpSessionId(String otpSessionId) {
        this.otpSessionId = otpSessionId;
    }

    public String getMaskedPhone() {
        return maskedPhone;
    }

    public void setMaskedPhone(String maskedPhone) {
        this.maskedPhone = maskedPhone;
    }

    public int getExpiresInSeconds() {
        return expiresInSeconds;
    }

    public void setExpiresInSeconds(int expiresInSeconds) {
        this.expiresInSeconds = expiresInSeconds;
    }

    public int getResendCooldownSeconds() {
        return resendCooldownSeconds;
    }

    public void setResendCooldownSeconds(int resendCooldownSeconds) {
        this.resendCooldownSeconds = resendCooldownSeconds;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
