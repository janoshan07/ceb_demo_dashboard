package com.ceb.billing.repositories;

import com.ceb.billing.entities.OtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {
    Optional<OtpVerification> findByOtpSessionId(String otpSessionId);
    List<OtpVerification> findByUsernameAndConsumedFalse(String username);
}
