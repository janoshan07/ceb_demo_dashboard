package com.ceb.billing.repositories;

import com.ceb.billing.entities.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.time.LocalDateTime;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findAllByOrderByTimestampDesc();
    long countByPerformedByAndActionAndTimestampAfter(String performedBy, String action, LocalDateTime timestamp);
}
