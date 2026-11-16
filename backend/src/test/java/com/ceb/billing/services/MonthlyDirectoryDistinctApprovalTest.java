package com.ceb.billing.services;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MonthlyDirectoryDistinctApprovalTest {

    @Mock private MonthlyDirectorySnapshotRepository snapshotRepository;
    @Mock private CustomerDirectorySyncService customerDirectorySyncService;

    @Test
    void countsDistinctAccountsByMonthDivisionAndApprovedUnion() {
        MonthlyDirectorySnapshot julyAmpara = snapshot(1L, "July 2026", "Ampara", "APPROVED",
                "[{\"accountNo\":\" 100 \"},{\"accountNo\":\"100\"},{\"accountNo\":\"200\"}]");
        MonthlyDirectorySnapshot augustKalmunai = snapshot(2L, "August 2026", "Kalmunai", "APPROVED",
                "[{\"accountNo\":\"100\"},{\"accountNo\":\"300\"},{\"accountNo\":\"300\"}]");
        MonthlyDirectorySnapshot pending = snapshot(3L, "September 2026", "Kalmunai", "PENDING_APPROVAL",
                "[{\"accountNo\":\"400\"}]");
        when(snapshotRepository.findAllByOrderByCreatedDateDesc()).thenReturn(List.of(julyAmpara, augustKalmunai, pending));

        MonthlyDirectoryService service = service();
        Map<String, Object> response = service.listMonths();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> months = (List<Map<String, Object>>) response.get("months");

        assertEquals(3, response.get("allCustomersCount"));
        Map<String, Object> july = months.stream().filter(m -> "July 2026".equals(m.get("billingMonth"))).findFirst().orElseThrow();
        assertEquals(2, july.get("uniqueCustomers"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> julyDivisions = (List<Map<String, Object>>) july.get("divisions");
        assertEquals(2, julyDivisions.stream().filter(d -> "Ampara".equals(d.get("division"))).findFirst().orElseThrow().get("uniqueCustomers"));
        Map<String, Object> september = months.stream().filter(m -> "September 2026".equals(m.get("billingMonth"))).findFirst().orElseThrow();
        assertEquals(1, september.get("uniqueCustomers"));
        assertEquals(3, response.get("allCustomersCount"), "pending snapshots are excluded from the approved union");
    }

    @Test
    void syncFailureLeavesSnapshotPendingAndDoesNotSaveApproval() throws Exception {
        MonthlyDirectorySnapshot snapshot = snapshot(7L, "July 2026", "Ampara", "PENDING_APPROVAL",
                "[{\"accountNo\":\"100\"}]");
        when(snapshotRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(snapshot));
        doThrow(new IllegalStateException("sync failed"))
                .when(customerDirectorySyncService).syncSnapshotStrict(Objects.requireNonNull(snapshot));
        MonthlyDirectoryService service = service();

        assertThrows(IllegalStateException.class, () -> service.approveSnapshot(7L, "admin"));

        assertEquals("PENDING_APPROVAL", snapshot.getStatus());
        verify(snapshotRepository, never()).save(any(MonthlyDirectorySnapshot.class));
        assertNotNull(MonthlyDirectoryService.class.getMethod("approveSnapshot", Long.class, String.class)
                .getAnnotation(Transactional.class));
    }

    @Test
    void alreadyApprovedSnapshotIsNotMigratedAgainAndApprovalUsesRowLock() throws Exception {
        MonthlyDirectorySnapshot snapshot = snapshot(8L, "July 2026", "Ampara", "APPROVED",
                "[{\"accountNo\":\"100\"}]");
        when(snapshotRepository.findByIdForUpdate(8L)).thenReturn(Optional.of(snapshot));

        assertThrows(IllegalStateException.class, () -> service().approveSnapshot(8L, "admin"));

        verify(customerDirectorySyncService, never()).syncSnapshotStrict(any());
        Method lockQuery = MonthlyDirectorySnapshotRepository.class.getMethod("findByIdForUpdate", Long.class);
        assertEquals(LockModeType.PESSIMISTIC_WRITE, lockQuery.getAnnotation(Lock.class).value());
    }

    private MonthlyDirectoryService service() {
        MonthlyDirectoryService service = new MonthlyDirectoryService();
        ReflectionTestUtils.setField(service, "snapshotRepository", snapshotRepository);
        ReflectionTestUtils.setField(service, "customerDirectorySyncService", customerDirectorySyncService);
        return service;
    }

    private MonthlyDirectorySnapshot snapshot(Long id, String month, String division, String status, String rows) {
        MonthlyDirectorySnapshot snapshot = new MonthlyDirectorySnapshot();
        snapshot.setId(id);
        snapshot.setBillingMonth(month);
        snapshot.setDivision(division);
        snapshot.setStatus(status);
        snapshot.setDatasetName(month + " " + division);
        snapshot.setFinalDataJson(rows);
        snapshot.setTotalRecords(0);
        return snapshot;
    }
}
