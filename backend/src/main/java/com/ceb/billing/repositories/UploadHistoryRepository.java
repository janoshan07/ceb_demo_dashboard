package com.ceb.billing.repositories;

import com.ceb.billing.entities.UploadHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UploadHistoryRepository extends JpaRepository<UploadHistory, Long> {
    List<UploadHistory> findTop5ByOrderByUploadTimeDesc();
}
