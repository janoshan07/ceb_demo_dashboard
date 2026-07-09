package com.ceb.billing.repositories;

import com.ceb.billing.entities.ImportSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ImportSessionRepository extends JpaRepository<ImportSession, Long> {

    /** Find the most recent active (non-completed) session for a user */
    Optional<ImportSession> findTopByCreatedByAndStageNotOrderByCreatedAtDesc(String createdBy, String stage);

    /** Find any incomplete session for this user */
    List<ImportSession> findByCreatedByAndStageNot(String createdBy, String stage);

    Optional<ImportSession> findBySessionKey(String sessionKey);
}
