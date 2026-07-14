package com.ceb.billing.repositories;

import com.ceb.billing.entities.StagingChangeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StagingChangeLogRepository extends JpaRepository<StagingChangeLog, Long> {
    List<StagingChangeLog> findByUploadBatchId(Long uploadBatchId);
    List<StagingChangeLog> findByUploadBatchIdAndStatus(Long uploadBatchId, String status);
}
