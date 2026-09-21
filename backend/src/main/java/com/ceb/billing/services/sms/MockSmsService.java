package com.ceb.billing.services.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

@Service
@ConditionalOnProperty(name = "ceb.sms.provider", havingValue = "mock", matchIfMissing = true)
public class MockSmsService implements SmsService {

    private static final Logger logger = LoggerFactory.getLogger(MockSmsService.class);

    @Value("${ceb.sms.mock.log-otp-for-dev:true}")
    private boolean logOtpForDev;

    // In-memory cache of latest OTP for local developer testing convenience
    private final ConcurrentHashMap<String, String> latestOtpsByPhone = new ConcurrentHashMap<>();

    @Override
    public boolean sendOtpSms(String toPhoneNumber, String otp, int expiryMinutes) {
        String safePhone = toPhoneNumber != null ? toPhoneNumber : "Unknown";
        String masked = mask(safePhone);

        latestOtpsByPhone.put(safePhone, otp);

        if (logOtpForDev) {
            logger.info("\n==============================================================\n" +
                        " [EDL SMS GATEWAY - LOCAL DEV SIMULATOR]\n" +
                        " Recipient Phone : {} (Masked: {})\n" +
                        " Verification OTP: {}\n" +
                        " Validity        : {} Minutes\n" +
                        " Message Body    : Your EDL Smart Solar login code is {}. Valid for {} mins. Do not share.\n" +
                        "==============================================================",
                    safePhone, masked, otp, expiryMinutes, otp, expiryMinutes);
        } else {
            logger.info("Mock SMS successfully simulated to recipient: {}", masked);
        }

        return true;
    }

    public String getLatestOtpForTesting(String phoneNumber) {
        return latestOtpsByPhone.get(phoneNumber);
    }

    private String mask(String phone) {
        if (phone == null || phone.length() <= 4) {
            return "******";
        }
        return "******" + phone.substring(phone.length() - 4);
    }
}
