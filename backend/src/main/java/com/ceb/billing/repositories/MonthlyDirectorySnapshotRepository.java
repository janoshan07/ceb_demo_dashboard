package com.ceb.billing.repositories;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MonthlyDirectorySnapshotRepository extends JpaRepository<MonthlyDirectorySnapshot, Long> {

    /** Newest archived month first. */
    List<MonthlyDirectorySnapshot> findAllByOrderByCreatedDateDesc();
}
