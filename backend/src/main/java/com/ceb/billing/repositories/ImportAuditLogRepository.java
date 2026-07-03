package com.ceb.billing.repositories;

import com.ceb.billing.entities.ImportAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

@Repository
public interface ImportAuditLogRepository extends JpaRepository<ImportAuditLog, Long> {
    Optional<ImportAuditLog> findByUploadHistoryId(Long uploadHistoryId);

    @Transactional
    @Modifying
    @Query("DELETE FROM ImportAuditLog i WHERE i.uploadHistoryId = :uploadHistoryId")
    void deleteByUploadHistoryId(@Param("uploadHistoryId") Long uploadHistoryId);
}
