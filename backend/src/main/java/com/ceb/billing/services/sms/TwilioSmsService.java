package com.ceb.billing.services.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "ceb.sms.provider", havingValue = "twilio")
public class TwilioSmsService implements SmsService {

    private static final Logger logger = LoggerFactory.getLogger(TwilioSmsService.class);

    @Value("${ceb.sms.twilio.account-sid:}")
    private String accountSid;

    @Value("${ceb.sms.twilio.auth-token:}")
    private String authToken;

    @Value("${ceb.sms.twilio.from-number:}")
    private String fromNumber;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Override
    public boolean sendOtpSms(String toPhoneNumber, String otp, int expiryMinutes) {
        String masked = mask(toPhoneNumber);
        if (accountSid == null || accountSid.isBlank() || authToken == null || authToken.isBlank()) {
            logger.error("Twilio SMS dispatch failed: Account SID or Auth Token is missing in configuration.");
            return false;
        }

        try {
            String url = String.format("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", accountSid);
            String messageBody = String.format("Your EDL Smart Solar verification code is: %s. Valid for %d minutes. Never share this code.", otp, expiryMinutes);

            Map<String, String> formData = Map.of(
                    "To", toPhoneNumber,
                    "From", fromNumber,
                    "Body", messageBody
            );

            String formEncoded = formData.entrySet().stream()
                    .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                    .collect(Collectors.joining("&"));

            String authHeader = "Basic " + Base64.getEncoder().encodeToString((accountSid + ":" + authToken).getBytes(StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", authHeader)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(formEncoded))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                logger.info("Twilio SMS successfully dispatched to recipient: {}", masked);
                return true;
            } else {
                logger.error("Twilio SMS dispatch returned error status {}: {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            logger.error("Exception occurred while sending SMS via Twilio to {}: {}", masked, e.getMessage());
            return false;
        }
    }

    private String mask(String phone) {
        if (phone == null || phone.length() <= 4) {
            return "******";
        }
        return "******" + phone.substring(phone.length() - 4);
    }
}
