package com.ceb.billing.repositories;

import com.ceb.billing.entities.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByStatusOrderByCreatedAtDesc(String status);

    List<Alert> findBySeverityAndStatusOrderByCreatedAtDesc(String severity, String status);

    long countBySeverityAndStatus(String severity, String status);

    long countByStatus(String status);

    List<Alert> findByAccountNoAndAlertTypeAndStatus(String accountNo, String alertType, String status);

    @Transactional
    void deleteByAccountNoAndAlertTypeAndStatus(String accountNo, String alertType, String status);
}
