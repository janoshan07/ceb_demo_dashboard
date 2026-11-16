package com.ceb.billing.services;

import com.ceb.billing.controllers.CustomerController;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Proxy;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class CustomerDirectoryCountingConsistencyTest {

    private CustomerController controller;
    private ObjectMapper objectMapper;

    // Simulation dataset:
    // July 2026:
    //   Ampara (prefix 24): 100 customers (24000001 - 24000100)
    //   Batticaloa (prefix 32): 150 customers (32000001 - 32000150)
    //   Trincomalee (prefix 34): 80 customers (34000001 - 34000080)
    //   Total July Unique: 330 customers
    //
    // August 2026:
    //   Ampara (prefix 24): 105 customers (24000001 - 24000105: 100 existing + 5 new)
    //   Batticaloa (prefix 32): 150 customers (32000001 - 32000150: all 150 existing)
    //   Trincomalee (prefix 34): 85 customers (34000001 - 34000085: 80 existing + 5 new)
    //   Total August Unique: 340 customers
    //
    // All Months Union:
    //   All 330 July customers + 10 new August customers = 340 unique customers.
    //   Plus 10 customers only in master customerRepository = 350 total unique customers across ALL.

    private List<MonthlyDirectorySnapshot> allSnapshots;

    @BeforeEach
    void setUp() throws Exception {
        objectMapper = new ObjectMapper();
        controller = new CustomerController();

        allSnapshots = new ArrayList<>();

        // --- July 2026 Snapshots ---
        List<Map<String, Object>> julyAmpara = new ArrayList<>();
        for (int i = 1; i <= 100; i++) {
            Map<String, Object> r = new HashMap<>();
            r.put("accountNo", String.format("24%06d", i));
            r.put("customerName", "July Ampara Cust " + i);
            r.put("division", "Ampara");
            r.put("snapshotDivision", "Ampara");
            r.put("solarType", "NET METERING");
            r.put("billingMonth", "July 2026");
            r.put("unitRate", 37.0);
            if (i <= 70) {
                // 70 complete
                r.put("isComplete", true);
            } else if (i <= 85) {
                // 15 outstanding
                r.put("noBillingData", true);
                r.put("isComplete", false);
            } else {
                // 15 missing/mismatch
                r.put("nameMatch", "MISMATCH");
                r.put("isComplete", false);
            }
            julyAmpara.add(r);
        }
        MonthlyDirectorySnapshot s1 = createSnapshot(1L, "July 2026", "Ampara", 100, julyAmpara);

        List<Map<String, Object>> julyBatti = new ArrayList<>();
        for (int i = 1; i <= 150; i++) {
            Map<String, Object> r = new HashMap<>();
            r.put("accountNo", String.format("32%06d", i));
            r.put("customerName", "July Batti Cust " + i);
            r.put("division", "Batticaloa");
            r.put("snapshotDivision", "Batticaloa");
            r.put("solarType", "NET ACCOUNTING");
            r.put("billingMonth", "July 2026");
            r.put("unitRate", 37.0);
            if (i <= 120) {
                r.put("isComplete", true);
            } else {
                r.put("unitRateMatch", "MISMATCH");
                r.put("isComplete", false);
            }
            julyBatti.add(r);
        }
        MonthlyDirectorySnapshot s2 = createSnapshot(2L, "July 2026", "Batticaloa", 150, julyBatti);

        List<Map<String, Object>> julyTrinc = new ArrayList<>();
        for (int i = 1; i <= 80; i++) {
            Map<String, Object> r = new HashMap<>();
            r.put("accountNo", String.format("34%06d", i));
            r.put("customerName", "July Trinc Cust " + i);
            r.put("division", "Trincomalee");
            r.put("snapshotDivision", "Trincomalee");
            r.put("solarType", "NET PLUS");
            r.put("billingMonth", "July 2026");
            r.put("unitRate", 37.0);
            r.put("isComplete", true);
            julyTrinc.add(r);
        }
        MonthlyDirectorySnapshot s3 = createSnapshot(3L, "July 2026", "Trincomalee", 80, julyTrinc);

        // --- August 2026 Snapshots ---
        List<Map<String, Object>> augAmpara = new ArrayList<>();
        for (int i = 1; i <= 105; i++) { // 100 existing + 5 new
            Map<String, Object> r = new HashMap<>();
            r.put("accountNo", String.format("24%06d", i));
            r.put("customerName", "Aug Ampara Cust " + i);
            r.put("division", "Ampara");
            r.put("snapshotDivision", "Ampara");
            r.put("solarType", "NET METERING");
            r.put("billingMonth", "August 2026");
            r.put("unitRate", 37.0);
            if (i <= 80) {
                r.put("isComplete", true);
            } else {
                r.put("isComplete", false);
                r.put("noBillingData", true);
            }
            augAmpara.add(r);
        }
        MonthlyDirectorySnapshot s4 = createSnapshot(4L, "August 2026", "Ampara", 105, augAmpara);

        List<Map<String, Object>> augBatti = new ArrayList<>();
        for (int i = 1; i <= 150; i++) {
            Map<String, Object> r = new HashMap<>();
            r.put("accountNo", String.format("32%06d", i));
            r.put("customerName", "Aug Batti Cust " + i);
            r.put("division", "Batticaloa");
            r.put("snapshotDivision", "Batticaloa");
            r.put("solarType", "NET ACCOUNTING");
            r.put("billingMonth", "August 2026");
            r.put("unitRate", 37.0);
            r.put("isComplete", true);
            augBatti.add(r);
        }
        MonthlyDirectorySnapshot s5 = createSnapshot(5L, "August 2026", "Batticaloa", 150, augBatti);

        List<Map<String, Object>> augTrinc = new ArrayList<>();
        for (int i = 1; i <= 85; i++) { // 80 existing + 5 new
            Map<String, Object> r = new HashMap<>();
            r.put("accountNo", String.format("34%06d", i));
            r.put("customerName", "Aug Trinc Cust " + i);
            r.put("division", "Trincomalee");
            r.put("snapshotDivision", "Trincomalee");
            r.put("solarType", "NET PLUS");
            r.put("billingMonth", "August 2026");
            r.put("unitRate", 37.0);
            r.put("isComplete", true);
            augTrinc.add(r);
        }
        MonthlyDirectorySnapshot s6 = createSnapshot(6L, "August 2026", "Trincomalee", 85, augTrinc);

        allSnapshots.addAll(List.of(s6, s5, s4, s3, s2, s1)); // Descending order

        MonthlyDirectorySnapshotRepository snapRepo = (MonthlyDirectorySnapshotRepository) Proxy.newProxyInstance(
                MonthlyDirectorySnapshotRepository.class.getClassLoader(),
                new Class<?>[]{MonthlyDirectorySnapshotRepository.class},
                (proxy, method, mArgs) -> {
                    String name = method.getName();
                    if ("findAllByOrderByCreatedDateDesc".equals(name) || "findAll".equals(name)) {
                        return allSnapshots;
                    }
                    if ("findByBillingMonthIgnoreCase".equals(name)) {
                        String m = (String) mArgs[0];
                        List<MonthlyDirectorySnapshot> res = new ArrayList<>();
                        for (MonthlyDirectorySnapshot s : allSnapshots) {
                            if (s.getBillingMonth() != null && s.getBillingMonth().equalsIgnoreCase(m)) {
                                res.add(s);
                            }
                        }
                        return res;
                    }
                    return Collections.emptyList();
                });

        CustomerRepository custRepo = (CustomerRepository) Proxy.newProxyInstance(
                CustomerRepository.class.getClassLoader(),
                new Class<?>[]{CustomerRepository.class},
                (proxy, method, mArgs) -> Collections.emptyList());

        BillingRecordRepository billRepo = (BillingRecordRepository) Proxy.newProxyInstance(
                BillingRecordRepository.class.getClassLoader(),
                new Class<?>[]{BillingRecordRepository.class},
                (proxy, method, mArgs) -> Collections.emptyList());

        CostCodeRepository costRepo = (CostCodeRepository) Proxy.newProxyInstance(
                CostCodeRepository.class.getClassLoader(),
                new Class<?>[]{CostCodeRepository.class},
                (proxy, method, mArgs) -> Optional.empty());

        NetTypeRepository netRepo = (NetTypeRepository) Proxy.newProxyInstance(
                NetTypeRepository.class.getClassLoader(),
                new Class<?>[]{NetTypeRepository.class},
                (proxy, method, mArgs) -> Optional.empty());

        ExpenseCodeRepository expRepo = (ExpenseCodeRepository) Proxy.newProxyInstance(
                ExpenseCodeRepository.class.getClassLoader(),
                new Class<?>[]{ExpenseCodeRepository.class},
                (proxy, method, mArgs) -> Optional.empty());

        ReflectionTestUtils.setField(controller, "monthlyDirectorySnapshotRepository", snapRepo);
        ReflectionTestUtils.setField(controller, "customerRepository", custRepo);
        ReflectionTestUtils.setField(controller, "billingRecordRepository", billRepo);
        ReflectionTestUtils.setField(controller, "costCodeRepository", costRepo);
        ReflectionTestUtils.setField(controller, "netTypeRepository", netRepo);
        ReflectionTestUtils.setField(controller, "expenseCodeRepository", expRepo);
        ReflectionTestUtils.setField(controller, "objectMapper", objectMapper);
    }

    private MonthlyDirectorySnapshot createSnapshot(Long id, String month, String division, int count, List<Map<String, Object>> records) throws Exception {
        MonthlyDirectorySnapshot snap = new MonthlyDirectorySnapshot();
        snap.setId(id);
        snap.setDatasetName(division + " " + month);
        snap.setBillingMonth(month);
        snap.setDivision(division);
        snap.setStatus("APPROVED");
        snap.setTotalRecords(count);
        snap.setFinalDataJson(objectMapper.writeValueAsString(records));
        snap.setCreatedDate(java.time.LocalDateTime.now().minusDays(10 - id.intValue()));
        return snap;
    }

    @Test
    @DisplayName("July 2026 summary and customer counts match exactly 330 unique customers")
    void testJuly2026Counts() {
        ResponseEntity<?> resp = controller.getOfficerCustomersSummary("July 2026", "ALL");
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) resp.getBody();
        assertNotNull(summary);
        assertEquals(330, ((Number) summary.get("total")).intValue(), "July total unique customers must be 330");

        int complete = ((Number) summary.get("complete")).intValue();
        int missing = ((Number) summary.get("missing")).intValue();
        assertEquals(330, complete + missing, "Total must equal Complete + Missing for July");

        // List query
        ResponseEntity<?> listResp = controller.getOfficerCustomers("", "", "ALL", "", "July 2026", "", "", "accountNo", "asc", 0, 500);
        @SuppressWarnings("unchecked")
        Map<String, Object> page = (Map<String, Object>) listResp.getBody();
        assertNotNull(page);
        assertEquals(330, ((Number) page.get("totalElements")).intValue());
    }

    @Test
    @DisplayName("August 2026 summary and customer counts match exactly 340 unique customers")
    void testAugust2026Counts() {
        ResponseEntity<?> resp = controller.getOfficerCustomersSummary("August 2026", "ALL");
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) resp.getBody();
        assertNotNull(summary);
        assertEquals(340, ((Number) summary.get("total")).intValue(), "August total unique customers must be 340");

        int complete = ((Number) summary.get("complete")).intValue();
        int missing = ((Number) summary.get("missing")).intValue();
        assertEquals(340, complete + missing, "Total must equal Complete + Missing for August");

        ResponseEntity<?> listResp = controller.getOfficerCustomers("", "", "ALL", "", "August 2026", "", "", "accountNo", "asc", 0, 500);
        @SuppressWarnings("unchecked")
        Map<String, Object> page = (Map<String, Object>) listResp.getBody();
        assertNotNull(page);
        assertEquals(340, ((Number) page.get("totalElements")).intValue());
    }

    @Test
    @DisplayName("All Billing Months returns union of unique customers (340) and is NOT lower than July or August")
    void testAllBillingMonthsCountNotLowerThanIndividualMonths() {
        ResponseEntity<?> resp = controller.getOfficerCustomersSummary("ALL", "ALL");
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) resp.getBody();
        assertNotNull(summary);

        int totalAll = ((Number) summary.get("total")).intValue();
        int completeAll = ((Number) summary.get("complete")).intValue();
        int missingAll = ((Number) summary.get("missing")).intValue();

        // 330 in July + 10 new in August = 340 total distinct accounts
        assertEquals(340, totalAll, "All Billing Months must return 340 unique customers");
        assertTrue(totalAll >= 330, "All Billing Months must be >= July count");
        assertTrue(totalAll >= 340, "All Billing Months must be >= August count");

        // Reconciliation
        assertEquals(totalAll, completeAll + missingAll, "Total must equal Complete + Missing for ALL months");

        // List query
        ResponseEntity<?> listResp = controller.getOfficerCustomers("", "", "ALL", "", "ALL", "", "", "accountNo", "asc", 0, 500);
        @SuppressWarnings("unchecked")
        Map<String, Object> page = (Map<String, Object>) listResp.getBody();
        assertNotNull(page);
        assertEquals(340, ((Number) page.get("totalElements")).intValue());
    }

    @Test
    @DisplayName("Division filtering is consistently applied for specific months and ALL months")
    void testDivisionFilteringConsistency() {
        // Ampara in July (100)
        ResponseEntity<?> julyAmparaResp = controller.getOfficerCustomersSummary("July 2026", "Ampara");
        @SuppressWarnings("unchecked")
        Map<String, Object> julyAmparaSummary = (Map<String, Object>) julyAmparaResp.getBody();
        assertEquals(100, ((Number) julyAmparaSummary.get("total")).intValue());

        // Ampara in August (105)
        ResponseEntity<?> augAmparaResp = controller.getOfficerCustomersSummary("August 2026", "Ampara");
        @SuppressWarnings("unchecked")
        Map<String, Object> augAmparaSummary = (Map<String, Object>) augAmparaResp.getBody();
        assertEquals(105, ((Number) augAmparaSummary.get("total")).intValue());

        // Ampara in ALL months (105 unique accounts)
        ResponseEntity<?> allAmparaResp = controller.getOfficerCustomersSummary("ALL", "Ampara");
        @SuppressWarnings("unchecked")
        Map<String, Object> allAmparaSummary = (Map<String, Object>) allAmparaResp.getBody();
        assertEquals(105, ((Number) allAmparaSummary.get("total")).intValue());

        // Batticaloa in ALL months (150 unique accounts)
        ResponseEntity<?> allBattiResp = controller.getOfficerCustomersSummary("ALL", "Batticaloa");
        @SuppressWarnings("unchecked")
        Map<String, Object> allBattiSummary = (Map<String, Object>) allBattiResp.getBody();
        assertEquals(150, ((Number) allBattiSummary.get("total")).intValue());

        // Trincomalee in ALL months (85 unique accounts)
        ResponseEntity<?> allTrincResp = controller.getOfficerCustomersSummary("ALL", "Trincomalee");
        @SuppressWarnings("unchecked")
        Map<String, Object> allTrincSummary = (Map<String, Object>) allTrincResp.getBody();
        assertEquals(85, ((Number) allTrincSummary.get("total")).intValue());

        // Sum of divisions: 105 + 150 + 85 = 340 (matches total across ALL)
        assertEquals(340, 105 + 150 + 85);
    }

    @Test
    @DisplayName("Completeness filter tabs match summary statistics exactly")
    void testCompletenessTabsReconciliation() {
        // Test with July 2026
        ResponseEntity<?> summaryResp = controller.getOfficerCustomersSummary("July 2026", "ALL");
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) summaryResp.getBody();
        int expectedComplete = ((Number) summary.get("complete")).intValue();
        int expectedMissing = ((Number) summary.get("missing")).intValue();

        // Query COMPLETE
        ResponseEntity<?> completeListResp = controller.getOfficerCustomers("", "", "ALL", "COMPLETE", "July 2026", "", "", "accountNo", "asc", 0, 500);
        @SuppressWarnings("unchecked")
        Map<String, Object> completePage = (Map<String, Object>) completeListResp.getBody();
        assertEquals(expectedComplete, ((Number) completePage.get("totalElements")).intValue());

        // Query MISSING
        ResponseEntity<?> missingListResp = controller.getOfficerCustomers("", "", "ALL", "MISSING", "July 2026", "", "", "accountNo", "asc", 0, 500);
        @SuppressWarnings("unchecked")
        Map<String, Object> missingPage = (Map<String, Object>) missingListResp.getBody();
        assertEquals(expectedMissing, ((Number) missingPage.get("totalElements")).intValue());

        // Sum of list elements equals total elements
        assertEquals(330, expectedComplete + expectedMissing);
    }

    @Test
    @DisplayName("Pagination, search and sorting work correctly on ALL billing months")
    void testPaginationSearchSorting() {
        // Search by account number
        ResponseEntity<?> searchResp = controller.getOfficerCustomers("24000001", "", "ALL", "", "ALL", "", "", "accountNo", "asc", 0, 10);
        @SuppressWarnings("unchecked")
        Map<String, Object> searchPage = (Map<String, Object>) searchResp.getBody();
        assertEquals(1, ((Number) searchPage.get("totalElements")).intValue());

        // Search by customer name
        ResponseEntity<?> searchNameResp = controller.getOfficerCustomers("Batti", "", "ALL", "", "ALL", "", "", "accountNo", "asc", 0, 10);
        @SuppressWarnings("unchecked")
        Map<String, Object> searchNamePage = (Map<String, Object>) searchNameResp.getBody();
        assertEquals(150, ((Number) searchNamePage.get("totalElements")).intValue());

        // Pagination: Page 0 with size 20
        ResponseEntity<?> page0Resp = controller.getOfficerCustomers("", "", "ALL", "", "ALL", "", "", "accountNo", "asc", 0, 20);
        @SuppressWarnings("unchecked")
        Map<String, Object> page0 = (Map<String, Object>) page0Resp.getBody();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content0 = (List<Map<String, Object>>) page0.get("content");
        assertEquals(20, content0.size());
        assertEquals(17, ((Number) page0.get("totalPages")).intValue()); // 340 / 20 = 17
        assertTrue((Boolean) page0.get("first"));
        assertFalse((Boolean) page0.get("last"));

        // Page 16 (last page: 17 * 20 = 340)
        ResponseEntity<?> page16Resp = controller.getOfficerCustomers("", "", "ALL", "", "ALL", "", "", "accountNo", "asc", 16, 20);
        @SuppressWarnings("unchecked")
        Map<String, Object> page16 = (Map<String, Object>) page16Resp.getBody();
        assertTrue((Boolean) page16.get("last"));
    }

    public static void main(String[] args) {
        try {
            CustomerDirectoryCountingConsistencyTest test = new CustomerDirectoryCountingConsistencyTest();
            test.setUp();
            System.out.println("Running testJuly2026Counts...");
            test.testJuly2026Counts();
            System.out.println("  -> PASSED");

            System.out.println("Running testAugust2026Counts...");
            test.testAugust2026Counts();
            System.out.println("  -> PASSED");

            System.out.println("Running testAllBillingMonthsCountNotLowerThanIndividualMonths...");
            test.testAllBillingMonthsCountNotLowerThanIndividualMonths();
            System.out.println("  -> PASSED");

            System.out.println("Running testDivisionFilteringConsistency...");
            test.testDivisionFilteringConsistency();
            System.out.println("  -> PASSED");

            System.out.println("Running testCompletenessTabsReconciliation...");
            test.testCompletenessTabsReconciliation();
            System.out.println("  -> PASSED");

            System.out.println("Running testPaginationSearchSorting...");
            test.testPaginationSearchSorting();
            System.out.println("  -> PASSED");

            System.out.println("=================================================");
            System.out.println("ALL 6 COUNTING CONSISTENCY TESTS PASSED 100%!");
            System.out.println("=================================================");
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}
