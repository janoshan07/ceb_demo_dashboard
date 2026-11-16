package com.ceb.billing.repositories;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

import java.util.List;

@Repository
public interface MonthlyDirectorySnapshotRepository extends JpaRepository<MonthlyDirectorySnapshot, Long> {

    /** Serializes approvals for one snapshot so concurrent Admin requests cannot migrate it twice. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from MonthlyDirectorySnapshot s where s.id = :id")
    java.util.Optional<MonthlyDirectorySnapshot> findByIdForUpdate(@Param("id") Long id);

    /** Newest archived month first. */
    List<MonthlyDirectorySnapshot> findAllByOrderByCreatedDateDesc();

    /** Snapshots created from one import session in a given status (e.g. PENDING_APPROVAL). */
    List<MonthlyDirectorySnapshot> findBySessionIdAndStatus(Long sessionId, String status);

    /** Existing snapshot(s) already saved to one Billing Month + Division slot. */
    List<MonthlyDirectorySnapshot> findByBillingMonthIgnoreCaseAndDivisionIgnoreCase(String billingMonth, String division);

    List<MonthlyDirectorySnapshot> findByStatusOrderByCreatedDateDesc(String status);

    List<MonthlyDirectorySnapshot> findByBillingMonthIgnoreCaseAndStatus(String billingMonth, String status);

    List<MonthlyDirectorySnapshot> findByDivisionIgnoreCaseAndStatus(String division, String status);

    List<MonthlyDirectorySnapshot> findByBillingMonthIgnoreCase(String billingMonth);

    List<MonthlyDirectorySnapshot> findByDivisionIgnoreCase(String division);

    List<MonthlyDirectorySnapshot> findByBillingMonthIgnoreCaseAndDivisionIgnoreCaseAndStatus(String billingMonth, String division, String status);
}
