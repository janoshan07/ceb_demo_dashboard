package com.ceb.billing.repositories;

import com.ceb.billing.entities.ApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, Long> {
    List<ApprovalRequest> findByStatusOrderByCreatedAtDesc(String status);
    long countByStatus(String status);
    boolean existsByBillingIdAndEntityTypeAndActionTypeAndStatus(Long billingId, String entityType, String actionType, String status);
}
