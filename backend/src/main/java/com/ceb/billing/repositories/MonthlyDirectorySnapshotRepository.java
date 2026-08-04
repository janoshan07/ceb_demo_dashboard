package com.ceb.billing.repositories;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MonthlyDirectorySnapshotRepository extends JpaRepository<MonthlyDirectorySnapshot, Long> {

    /** Newest archived month first. */
    List<MonthlyDirectorySnapshot> findAllByOrderByCreatedDateDesc();

    /** Snapshots created from one import session in a given status (e.g. PENDING_APPROVAL). */
    List<MonthlyDirectorySnapshot> findBySessionIdAndStatus(Long sessionId, String status);

    /** Existing snapshot(s) already saved to one Billing Month + Division slot. */
    List<MonthlyDirectorySnapshot> findByBillingMonthIgnoreCaseAndDivisionIgnoreCase(String billingMonth, String division);

    List<MonthlyDirectorySnapshot> findByStatusOrderByCreatedDateDesc(String status);
}
