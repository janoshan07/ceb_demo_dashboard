package com.ceb.billing.repositories;

import com.ceb.billing.entities.BillingUploadStaging;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.transaction.Transactional;
import java.util.List;

@Repository
public interface BillingUploadStagingRepository extends JpaRepository<BillingUploadStaging, Long> {
    
    List<BillingUploadStaging> findByUploadBatchId(Long uploadBatchId);

    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM BillingUploadStaging s WHERE s.uploadBatchId = :uploadBatchId")
    void deleteByUploadBatchId(@Param("uploadBatchId") Long uploadBatchId);
}
