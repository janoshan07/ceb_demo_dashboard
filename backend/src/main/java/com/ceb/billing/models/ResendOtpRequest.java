package com.ceb.billing.models;

import jakarta.validation.constraints.NotBlank;

public class ResendOtpRequest {

    @NotBlank(message = "OTP session ID is required")
    private String otpSessionId;

    public ResendOtpRequest() {
    }

    public ResendOtpRequest(String otpSessionId) {
        this.otpSessionId = otpSessionId;
    }

    public String getOtpSessionId() {
        return otpSessionId;
    }

    public void setOtpSessionId(String otpSessionId) {
        this.otpSessionId = otpSessionId;
    }
}
