package com.ceb.billing.services;

import com.ceb.billing.entities.*;
import com.ceb.billing.repositories.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.lang.NonNull;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CustomerMigrationHashingTest {

    @Mock
    private UploadHistoryRepository uploadHistoryRepository;
    @Mock
    private BillingUploadStagingRepository stagingRepository;
    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private BillingRecordRepository billingRecordRepository;
    @Mock
    private CostCodeRepository costCodeRepository;
    @Mock
    private NetTypeRepository netTypeRepository;
    @Mock
    private ExpenseCodeRepository expenseCodeRepository;
    @Mock
    private StagingChangeLogRepository changeLogRepository;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private AlertService alertService;
    @Mock
    private MonthlyDirectorySnapshotRepository monthlyDirectorySnapshotRepository;
    @Mock
    private CustomerDirectorySyncService customerDirectorySyncService;

    @NonNull
    private StagingMigrationService stagingMigrationService = new StagingMigrationService();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        stagingMigrationService = new StagingMigrationService();
        ReflectionTestUtils.setField(stagingMigrationService, "uploadHistoryRepository", uploadHistoryRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "stagingRepository", stagingRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "billingRecordRepository", billingRecordRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "costCodeRepository", costCodeRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "netTypeRepository", netTypeRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "expenseCodeRepository", expenseCodeRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "changeLogRepository", changeLogRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "auditLogService", auditLogService);
        ReflectionTestUtils.setField(stagingMigrationService, "alertService", alertService);
        ReflectionTestUtils.setField(stagingMigrationService, "monthlyDirectorySnapshotRepository", monthlyDirectorySnapshotRepository);
        ReflectionTestUtils.setField(stagingMigrationService, "customerDirectorySyncService", customerDirectorySyncService);
        ReflectionTestUtils.setField(stagingMigrationService, "objectMapper", objectMapper);
    }

    @SuppressWarnings("null")
    @Test
    void testFastMigrationWithMultipleAreasAndDuplicateHashing() throws Exception {
        Long batchId = 276L;
        UploadHistory history = new UploadHistory("Multi-File Import (Session 276)", "officer", "PENDING_APPROVAL", 1500, 0, 0, 0);
        history.setId(batchId);
        when(uploadHistoryRepository.findById(batchId)).thenReturn(Optional.of(history));
        when(changeLogRepository.findByUploadBatchIdAndStatus(batchId, "PENDING")).thenReturn(Collections.emptyList());

        // Prepare 1,500 staging records across 3 areas:
        // 500 Ampara (24...), 500 Batticaloa (32...), 500 Trincomalee (34...)
        List<BillingUploadStaging> stagingList = new ArrayList<>();
        List<Object[]> existingDbKeys = new ArrayList<>();

        for (int i = 1; i <= 1500; i++) {
            String prefix;
            if (i <= 500) prefix = "24";       // Ampara
            else if (i <= 1000) prefix = "32";  // Batticaloa
            else prefix = "34";                 // Trincomalee

            String acc = String.format("%s%08d", prefix, i);
            Map<String, Object> map = new HashMap<>();
            map.put("accountNo", acc);
            map.put("customerName", "Customer " + i);
            map.put("fromDate", "2026-06-01");
            map.put("toDate", "2026-06-30");
            map.put("refNo", "REF-" + acc);
            map.put("importUnits", 150.0);
            map.put("exportUnits", 250.0);
            map.put("unitRate", 37.0);

            // Row 10 is an existing duplicate in the database
            if (i == 10) {
                existingDbKeys.add(new Object[]{acc, "REF-" + acc, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30)});
            }

            BillingUploadStaging row = new BillingUploadStaging(batchId, objectMapper.writeValueAsString(map), "VALID", "[]", "BILLING");
            stagingList.add(row);
        }

        when(stagingRepository.findByUploadBatchId(batchId)).thenReturn(stagingList);
        when(costCodeRepository.findAll()).thenReturn(Collections.emptyList());
        when(netTypeRepository.findAll()).thenReturn(Collections.emptyList());
        when(expenseCodeRepository.findAll()).thenReturn(Collections.emptyList());

        when(customerRepository.findAllById(Objects.requireNonNull(anyList()))).thenReturn(Collections.emptyList());
        when(billingRecordRepository.findBillingKeysByAccountNos(any())).thenReturn(existingDbKeys);

        long start = System.currentTimeMillis();
        stagingMigrationService.migrateApprovedBatch(batchId, "admin");
        long duration = System.currentTimeMillis() - start;

        System.out.println("Fast migration of 1500 records took: " + duration + "ms");

        // Verify that findByCustomerAccountNoAndRefNoAndFromDateAndToDate was NEVER called (eliminated N+1)
        verify(billingRecordRepository, never())
                .findByCustomerAccountNoAndRefNoAndFromDateAndToDate(any(), any(), any(), any());

        // Verify deleteByUploadBatchId was called via bulk query
        verify(stagingRepository).deleteByUploadBatchId(batchId);

        // Verify customers to save
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Customer>> custCaptor = ArgumentCaptor.forClass(Iterable.class);
        verify(customerRepository, atLeastOnce()).saveAll(custCaptor.capture());

        Iterable<Customer> savedCustomers = Objects.requireNonNull(custCaptor.getValue());
        List<Customer> savedCustomerList = new ArrayList<>();
        savedCustomers.forEach(savedCustomerList::add);
        assertFalse(savedCustomerList.isEmpty());

        // Verify division derivation across areas
        for (Customer c : savedCustomerList) {
            String acc = c.getAccountNo();
            if (acc.startsWith("24")) {
                assertEquals("Ampara", c.getDivision());
            } else if (acc.startsWith("32")) {
                assertEquals("Batticaloa", c.getDivision());
            } else if (acc.startsWith("34")) {
                assertEquals("Trincomalee", c.getDivision());
            }
        }

        // Verify alertService was called with impacted accounts
        verify(alertService).generateAlertsForAccounts(any());

        // A duplicate is skipped and reported as a completed batch with errors.
        assertEquals("COMPLETED_WITH_ERRORS", history.getStatus());
        assertEquals(1499, history.getBillingInserted()); // 1500 - 1 duplicate = 1499
        assertTrue(duration < 2000, "Migration should complete under 2 seconds, took: " + duration + "ms");
    }
}
