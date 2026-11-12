package com.ceb.billing.repositories;

import com.ceb.billing.entities.UploadHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface UploadHistoryRepository extends JpaRepository<UploadHistory, Long> {
    List<UploadHistory> findTop5ByOrderByUploadTimeDesc();
    List<UploadHistory> findByStatusOrderByUploadTimeDesc(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from UploadHistory h where h.id = :id")
    Optional<UploadHistory> findByIdForUpdate(@Param("id") Long id);
}

