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

    @Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM Alert a WHERE a.accountNo IN :accountNos AND a.status = :status AND a.alertType IN :alertTypes")
    void deleteByAccountNoInAndAlertTypeInAndStatus(
        @org.springframework.data.repository.query.Param("accountNos") java.util.Collection<String> accountNos,
        @org.springframework.data.repository.query.Param("alertTypes") java.util.Collection<String> alertTypes,
        @org.springframework.data.repository.query.Param("status") String status
    );
}
