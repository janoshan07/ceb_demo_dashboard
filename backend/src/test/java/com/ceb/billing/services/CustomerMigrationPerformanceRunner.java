package com.ceb.billing.services;

import com.ceb.billing.entities.*;
import com.ceb.billing.repositories.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.*;

/**
 * Direct execution runner to verify hashing performance with 1,500 staging records across multiple CEB areas.
 */
public class CustomerMigrationPerformanceRunner {

    public static void main(String[] args) {
        System.out.println("=================================================================");
        System.out.println("CEB Staging Migration Hashing & Performance Test Runner");
        System.out.println("=================================================================");

        try {
            Long batchId = 276L;
            UploadHistory history = new UploadHistory("Multi-File Import (Session 276)", "officer", "PENDING_APPROVAL", 1500, 0, 0, 0);
            history.setId(batchId);

            ObjectMapper objectMapper = new ObjectMapper();

            // Prepare 1,500 staging records across 3 areas (Ampara, Batticaloa, Trincomalee)
            List<BillingUploadStaging> stagingList = new ArrayList<>();
            Set<String> expectedDuplicates = new HashSet<>();

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

                // Row 10 and 20 are duplicate bills
                if (i == 10 || i == 20) {
                    expectedDuplicates.add(acc);
                }

                BillingUploadStaging row = new BillingUploadStaging(batchId, objectMapper.writeValueAsString(map), "VALID", "[]", "BILLING");
                stagingList.add(row);
            }

            // In-memory repositories mock implementations
            Map<String, Customer> dbCustomers = new HashMap<>();
            List<BillingRecord> dbBillingRecords = new ArrayList<>();

            StagingMigrationService service = new StagingMigrationService();

            // Setup dummy repositories using standard Java proxies or dummy objects
            UploadHistoryRepository uploadHistoryRepo = (UploadHistoryRepository) java.lang.reflect.Proxy.newProxyInstance(
                    UploadHistoryRepository.class.getClassLoader(),
                    new Class<?>[]{UploadHistoryRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findById".equals(method.getName())) return Optional.of(history);
                        if ("save".equals(method.getName())) return mArgs[0];
                        return null;
                    });

            StagingChangeLogRepository changeLogRepo = (StagingChangeLogRepository) java.lang.reflect.Proxy.newProxyInstance(
                    StagingChangeLogRepository.class.getClassLoader(),
                    new Class<?>[]{StagingChangeLogRepository.class},
                    (proxy, method, mArgs) -> Collections.emptyList());

            final boolean[] deleteBatchCalled = {false};
            BillingUploadStagingRepository stagingRepo = (BillingUploadStagingRepository) java.lang.reflect.Proxy.newProxyInstance(
                    BillingUploadStagingRepository.class.getClassLoader(),
                    new Class<?>[]{BillingUploadStagingRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findByUploadBatchId".equals(method.getName())) return stagingList;
                        if ("deleteByUploadBatchId".equals(method.getName())) {
                            deleteBatchCalled[0] = true;
                            return null;
                        }
                        return null;
                    });

            CustomerRepository custRepo = (CustomerRepository) java.lang.reflect.Proxy.newProxyInstance(
                    CustomerRepository.class.getClassLoader(),
                    new Class<?>[]{CustomerRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findAllById".equals(method.getName())) {
                            @SuppressWarnings("unchecked")
                            Collection<String> ids = (Collection<String>) mArgs[0];
                            List<Customer> found = new ArrayList<>();
                            for (String id : ids) {
                                if (dbCustomers.containsKey(id)) found.add(dbCustomers.get(id));
                            }
                            return found;
                        }
                        if ("saveAll".equals(method.getName())) {
                            @SuppressWarnings("unchecked")
                            Iterable<Customer> entities = (Iterable<Customer>) mArgs[0];
                            for (Customer c : entities) {
                                dbCustomers.put(c.getAccountNo(), c);
                            }
                            return entities;
                        }
                        return null;
                    });

            final int[] individualQueryCount = {0};
            BillingRecordRepository billingRepo = (BillingRecordRepository) java.lang.reflect.Proxy.newProxyInstance(
                    BillingRecordRepository.class.getClassLoader(),
                    new Class<?>[]{BillingRecordRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findBillingKeysByAccountNos".equals(method.getName())) {
                            List<Object[]> keys = new ArrayList<>();
                            for (String dupAcc : expectedDuplicates) {
                                keys.add(new Object[]{dupAcc, "REF-" + dupAcc, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30)});
                            }
                            return keys;
                        }
                        if ("findByCustomerAccountNoAndRefNoAndFromDateAndToDate".equals(method.getName())) {
                            individualQueryCount[0]++;
                            return Optional.empty();
                        }
                        if ("saveAll".equals(method.getName())) {
                            @SuppressWarnings("unchecked")
                            Iterable<BillingRecord> records = (Iterable<BillingRecord>) mArgs[0];
                            for (BillingRecord br : records) {
                                dbBillingRecords.add(br);
                            }
                            return records;
                        }
                        return null;
                    });

            CostCodeRepository costRepo = (CostCodeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    CostCodeRepository.class.getClassLoader(),
                    new Class<?>[]{CostCodeRepository.class},
                    (proxy, method, mArgs) -> Collections.emptyList());

            NetTypeRepository netRepo = (NetTypeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    NetTypeRepository.class.getClassLoader(),
                    new Class<?>[]{NetTypeRepository.class},
                    (proxy, method, mArgs) -> Collections.emptyList());

            ExpenseCodeRepository expRepo = (ExpenseCodeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    ExpenseCodeRepository.class.getClassLoader(),
                    new Class<?>[]{ExpenseCodeRepository.class},
                    (proxy, method, mArgs) -> Collections.emptyList());

            AuditLogService auditLogService = new AuditLogService() {
                @Override
                public void log(String action, String details) {}
            };

            final boolean[] alertServiceCalled = {false};
            AlertService alertService = new AlertService() {
                @Override
                public void generateAlertsForAccounts(Set<String> accountNos) {
                    alertServiceCalled[0] = true;
                }
            };

            MonthlyDirectorySnapshotRepository snapRepo = (MonthlyDirectorySnapshotRepository) java.lang.reflect.Proxy.newProxyInstance(
                    MonthlyDirectorySnapshotRepository.class.getClassLoader(),
                    new Class<?>[]{MonthlyDirectorySnapshotRepository.class},
                    (proxy, method, mArgs) -> Collections.emptyList());

            ReflectionTestUtils.setField(service, "uploadHistoryRepository", uploadHistoryRepo);
            ReflectionTestUtils.setField(service, "stagingRepository", stagingRepo);
            ReflectionTestUtils.setField(service, "customerRepository", custRepo);
            ReflectionTestUtils.setField(service, "billingRecordRepository", billingRepo);
            ReflectionTestUtils.setField(service, "costCodeRepository", costRepo);
            ReflectionTestUtils.setField(service, "netTypeRepository", netRepo);
            ReflectionTestUtils.setField(service, "expenseCodeRepository", expRepo);
            ReflectionTestUtils.setField(service, "changeLogRepository", changeLogRepo);
            ReflectionTestUtils.setField(service, "auditLogService", auditLogService);
            ReflectionTestUtils.setField(service, "alertService", alertService);
            ReflectionTestUtils.setField(service, "monthlyDirectorySnapshotRepository", snapRepo);
            ReflectionTestUtils.setField(service, "objectMapper", objectMapper);

            // Run migration and measure execution time
            long start = System.currentTimeMillis();
            service.migrateApprovedBatch(batchId, "admin");
            long elapsed = System.currentTimeMillis() - start;

            System.out.println("-> Migration completed in: " + elapsed + " ms");
            System.out.println("-> Status: " + history.getStatus());
            System.out.println("-> Processed rows: " + history.getRowsProcessed());
            System.out.println("-> Bills inserted: " + history.getBillingInserted());
            System.out.println("-> New customers saved: " + history.getNewCustomers());
            System.out.println("-> Bulk delete called: " + deleteBatchCalled[0]);
            System.out.println("-> Individual duplicate DB queries: " + individualQueryCount[0] + " (Must be 0)");
            System.out.println("-> Alert service called: " + alertServiceCalled[0]);

            // Assertions
            if (individualQueryCount[0] != 0) {
                throw new IllegalStateException("FAIL: Individual DB queries were made instead of in-memory Hashing!");
            }
            if (!deleteBatchCalled[0]) {
                throw new IllegalStateException("FAIL: Bulk deleteByUploadBatchId was not called!");
            }
            if (history.getBillingInserted() != 1498) { // 1500 - 2 duplicates
                throw new IllegalStateException("FAIL: Expected 1498 bills inserted, got " + history.getBillingInserted());
            }
            if (history.getNewCustomers() != 1500) {
                throw new IllegalStateException("FAIL: Expected 1500 new customers, got " + history.getNewCustomers());
            }

            // Verify area assignment across divisions
            int amparaCount = 0, battiCount = 0, trincCount = 0;
            for (Customer c : dbCustomers.values()) {
                if ("Ampara".equals(c.getDivision())) amparaCount++;
                else if ("Batticaloa".equals(c.getDivision())) battiCount++;
                else if ("Trincomalee".equals(c.getDivision())) trincCount++;
            }
            System.out.println("-> Area Distribution verified:");
            System.out.println("   * Ampara: " + amparaCount + " (Expected: 500)");
            System.out.println("   * Batticaloa: " + battiCount + " (Expected: 500)");
            System.out.println("   * Trincomalee: " + trincCount + " (Expected: 500)");

            if (amparaCount != 500 || battiCount != 500 || trincCount != 500) {
                throw new IllegalStateException("FAIL: Area division counts mismatch!");
            }

            System.out.println("=================================================================");
            System.out.println("ALL TESTS PASSED SUCCESSFULLY! Migration is now O(1) blazingly fast.");
            System.out.println("=================================================================");
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}
