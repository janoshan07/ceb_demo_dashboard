package com.ceb.billing.repositories;

import com.ceb.billing.entities.ApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

@Repository
public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, Long> {
    List<ApprovalRequest> findByStatusOrderByCreatedAtDesc(String status);
    long countByStatus(String status);
    boolean existsByBillingIdAndEntityTypeAndActionTypeAndStatus(Long billingId, String entityType, String actionType, String status);

    List<ApprovalRequest> findByChangedByOrderByCreatedAtDesc(String changedBy);

    boolean existsByChangedByAndBillingIdAndAccountNoAndEntityTypeAndActionTypeAndStatus(
            String changedBy, Long billingId, String accountNo, String entityType, String actionType, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ApprovalRequest a where a.requestId = :id")
    Optional<ApprovalRequest> findByIdForUpdate(@Param("id") Long id);
}
