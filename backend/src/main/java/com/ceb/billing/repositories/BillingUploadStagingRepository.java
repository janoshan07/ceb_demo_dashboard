package com.ceb.billing.repositories;

import com.ceb.billing.entities.BillingUploadStaging;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.transaction.Transactional;
import java.util.List;

@Repository
public interface BillingUploadStagingRepository extends JpaRepository<BillingUploadStaging, Long> {
    
    List<BillingUploadStaging> findByUploadBatchId(Long uploadBatchId);

    @Transactional
    void deleteByUploadBatchId(Long uploadBatchId);
}
