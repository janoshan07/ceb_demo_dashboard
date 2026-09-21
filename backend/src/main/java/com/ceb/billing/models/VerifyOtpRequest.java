package com.ceb.billing.models;

import jakarta.validation.constraints.NotBlank;

public class VerifyOtpRequest {

    @NotBlank(message = "OTP session ID is required")
    private String otpSessionId;

    @NotBlank(message = "OTP code is required")
    private String otp;

    public VerifyOtpRequest() {
    }

    public VerifyOtpRequest(String otpSessionId, String otp) {
        this.otpSessionId = otpSessionId;
        this.otp = otp;
    }

    public String getOtpSessionId() {
        return otpSessionId;
    }

    public void setOtpSessionId(String otpSessionId) {
        this.otpSessionId = otpSessionId;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }
}
