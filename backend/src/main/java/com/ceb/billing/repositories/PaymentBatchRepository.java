package com.ceb.billing.repositories;

import com.ceb.billing.entities.PaymentBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentBatchRepository extends JpaRepository<PaymentBatch, Long> {

    Optional<PaymentBatch> findByBatchNumber(String batchNumber);

    List<PaymentBatch> findAllByOrderByCreatedDateDesc();

    List<PaymentBatch> findByBillingPeriodIgnoreCaseOrderByCreatedDateDesc(String billingPeriod);

    List<PaymentBatch> findByStatusIgnoreCaseOrderByCreatedDateDesc(String status);
}
