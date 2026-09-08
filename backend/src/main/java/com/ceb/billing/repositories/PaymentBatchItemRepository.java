package com.ceb.billing.repositories;

import com.ceb.billing.entities.PaymentBatchItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentBatchItemRepository extends JpaRepository<PaymentBatchItem, Long> {

    List<PaymentBatchItem> findByBatchId(Long batchId);

    List<PaymentBatchItem> findByAccountNo(String accountNo);

    List<PaymentBatchItem> findByPaymentStatusIgnoreCase(String paymentStatus);
}
