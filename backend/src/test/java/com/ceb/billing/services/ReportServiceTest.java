package com.ceb.billing.services;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.ceb.billing.utils.BranchDetector;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class ReportServiceTest {

    private PaymentControlService paymentControlService;
    private ReportService reportService;
    private List<MonthlyDirectorySnapshot> snapshots;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws Exception {
        objectMapper = new ObjectMapper();
        snapshots = new ArrayList<>();

        String url = "jdbc:mysql://localhost:3306/ceb_billing_db?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
        String user = "root";
        String pass = System.getenv("DB_PASSWORD");
        if (pass == null) pass = "Ceb@2516";

        try (Connection conn = DriverManager.getConnection(url, user, pass);
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, billing_month, division, dataset_name, final_data_json, status FROM monthly_directory_snapshot")) {
            while (rs.next()) {
                MonthlyDirectorySnapshot s = new MonthlyDirectorySnapshot();
                s.setId(rs.getLong("id"));
                s.setBillingMonth(rs.getString("billing_month"));
                s.setDivision(rs.getString("division"));
                s.setDatasetName(rs.getString("dataset_name"));
                s.setFinalDataJson(rs.getString("final_data_json"));
                s.setStatus(rs.getString("status"));
                snapshots.add(s);
            }
        }

        System.out.println("Loaded " + snapshots.size() + " snapshots from DB for testing.");

        // Wire Mock Repository
        MonthlyDirectorySnapshotRepository snapRepo = (MonthlyDirectorySnapshotRepository) Proxy.newProxyInstance(
                MonthlyDirectorySnapshotRepository.class.getClassLoader(),
                new Class[]{MonthlyDirectorySnapshotRepository.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("findAll".equals(name) || "findAllByOrderByCreatedDateDesc".equals(name)) return snapshots;
                    if ("findByBillingMonthIgnoreCase".equals(name)) {
                        String bm = (String) args[0];
                        List<MonthlyDirectorySnapshot> list = new ArrayList<>();
                        for (MonthlyDirectorySnapshot s : snapshots) {
                            if (s.getBillingMonth() != null && s.getBillingMonth().equalsIgnoreCase(bm)) {
                                list.add(s);
                            }
                        }
                        return list;
                    }
                    if ("findByDivisionIgnoreCase".equals(name)) {
                        String div = (String) args[0];
                        List<MonthlyDirectorySnapshot> list = new ArrayList<>();
                        for (MonthlyDirectorySnapshot s : snapshots) {
                            if (s.getDivision() != null && s.getDivision().equalsIgnoreCase(div)) {
                                list.add(s);
                            }
                        }
                        return list;
                    }
                    if ("findByBillingMonthIgnoreCaseAndDivisionIgnoreCase".equals(name)) {
                        String bm = (String) args[0];
                        String div = (String) args[1];
                        List<MonthlyDirectorySnapshot> list = new ArrayList<>();
                        for (MonthlyDirectorySnapshot s : snapshots) {
                            if (s.getBillingMonth() != null && s.getBillingMonth().equalsIgnoreCase(bm)
                                    && s.getDivision() != null && s.getDivision().equalsIgnoreCase(div)) {
                                list.add(s);
                            }
                        }
                        return list;
                    }
                    if ("findByStatusOrderByCreatedDateDesc".equals(name)) {
                        return snapshots;
                    }
                    return Collections.emptyList();
                }
        );

        paymentControlService = new PaymentControlService();
        org.springframework.test.util.ReflectionTestUtils.setField(paymentControlService, "monthlyDirectorySnapshotRepository", snapRepo);
        org.springframework.test.util.ReflectionTestUtils.setField(paymentControlService, "objectMapper", objectMapper);

        reportService = new ReportService();
        org.springframework.test.util.ReflectionTestUtils.setField(reportService, "paymentControlService", paymentControlService);
    }

    @Test
    @DisplayName("Verify loadCanonicalRecords loads data from MySQL snapshots")
    void testLoadCanonicalRecords() {
        List<Map<String, Object>> julyRecords = paymentControlService.loadCanonicalRecords("July 2026", "Ampara");
        assertNotNull(julyRecords);
        assertFalse(julyRecords.isEmpty());
        System.out.println("July Ampara records count: " + julyRecords.size());

        List<Map<String, Object>> allJuly = paymentControlService.loadCanonicalRecords("July 2026", "ALL");
        assertNotNull(allJuly);
        System.out.println("All July records count: " + allJuly.size());
        assertTrue(allJuly.size() > 5000);

        List<Map<String, Object>> allAugust = paymentControlService.loadCanonicalRecords("August 2026", "ALL");
        assertNotNull(allAugust);
        System.out.println("All August records count: " + allAugust.size());
        assertTrue(allAugust.size() > 5000);
    }

    @Test
    @DisplayName("Verify Division isolation across Ampara and Batticaloa")
    void testDivisionIsolation() {
        List<Map<String, Object>> ampara = paymentControlService.loadCanonicalRecords("July 2026", "Ampara");
        List<Map<String, Object>> batticaloa = paymentControlService.loadCanonicalRecords("July 2026", "Batticaloa");

        assertFalse(ampara.isEmpty());
        assertFalse(batticaloa.isEmpty());

        for (Map<String, Object> r : ampara) {
            String acc = String.valueOf(r.get("accountNo"));
            assertTrue(acc.startsWith("24"), "Ampara account must start with 24: " + acc);
        }

        for (Map<String, Object> r : batticaloa) {
            String acc = String.valueOf(r.get("accountNo"));
            assertTrue(acc.startsWith("32"), "Batticaloa account must start with 32: " + acc);
        }
    }

    @Test
    @DisplayName("Verify Monthly Revenue Report produces accurate aggregation")
    void testMonthlyRevenueReport() {
        List<Map<String, Object>> revList = reportService.getMonthlyRevenueReport(null, null, null);
        assertNotNull(revList);
        assertFalse(revList.isEmpty());
        System.out.println("Monthly Revenue Cycles: " + revList.size());
        for (Map<String, Object> m : revList) {
            System.out.printf("Cycle %d-%02d: Revenue=%.2f, Imports=%.2f, Exports=%.2f%n",
                    m.get("year"), m.get("month"), m.get("revenue"), m.get("imports"), m.get("exports"));
            assertTrue((Double) m.get("revenue") > 0);
            assertTrue((Double) m.get("imports") > 0);
            assertTrue((Double) m.get("exports") > 0);
        }

        // Test with Division filter
        List<Map<String, Object>> amparaRev = reportService.getMonthlyRevenueReport(null, null, "Ampara");
        assertNotNull(amparaRev);
        assertFalse(amparaRev.isEmpty());
        System.out.println("Ampara Monthly Revenue Cycles: " + amparaRev.size());
        assertTrue((Double) amparaRev.get(0).get("revenue") < (Double) revList.get(0).get("revenue"));
    }

    @Test
    @DisplayName("Verify Customer Billing Ledger contains all required columns")
    void testCustomerBillingReport() {
        List<Map<String, Object>> billingList = reportService.getCustomerBillingReport("July 2026", null, null, "Ampara");
        assertNotNull(billingList);
        assertFalse(billingList.isEmpty());
        assertEquals(1466, billingList.size());

        Map<String, Object> first = billingList.get(0);
        assertNotNull(first.get("accountNo"));
        assertNotNull(first.get("customerName"));
        assertNotNull(first.get("branchCode"));
        assertNotNull(first.get("fromDate"));
        assertNotNull(first.get("toDate"));
        assertNotNull(first.get("refNo"));
        assertNotNull(first.get("imports"));
        assertNotNull(first.get("exports"));
        assertNotNull(first.get("netUnit"));
        assertNotNull(first.get("unitCost"));
        assertNotNull(first.get("totalAmount"));

        System.out.println("Customer Billing Row Sample: " + first);
    }

    @Test
    @DisplayName("Verify Highest Exporters and Importers Ranking")
    void testHighestExportersAndImporters() {
        List<Map<String, Object>> exporters = reportService.getHighestExportersReport("July 2026", null, null, null);
        assertNotNull(exporters);
        assertFalse(exporters.isEmpty());
        assertTrue(exporters.size() <= 100);

        // Verify descending order
        for (int i = 0; i < exporters.size() - 1; i++) {
            double current = (Double) exporters.get(i).get("exports");
            double next = (Double) exporters.get(i + 1).get("exports");
            assertTrue(current >= next, "Exporters must be ordered descending");
        }

        List<Map<String, Object>> importers = reportService.getHighestImportersReport("July 2026", null, null, null);
        assertNotNull(importers);
        assertFalse(importers.isEmpty());
        assertTrue(importers.size() <= 100);

        for (int i = 0; i < importers.size() - 1; i++) {
            double current = (Double) importers.get(i).get("imports");
            double next = (Double) importers.get(i + 1).get("imports");
            assertTrue(current >= next, "Importers must be ordered descending");
        }
    }

    @Test
    @DisplayName("Verify Branch Performance Summary aggregates all 5 divisions")
    void testBranchPerformance() {
        List<Map<String, Object>> branches = reportService.getBranchPerformanceReport("July 2026", null, null);
        assertNotNull(branches);
        assertEquals(5, branches.size());

        Set<String> branchCodes = new HashSet<>();
        for (Map<String, Object> b : branches) {
            String code = (String) b.get("branchCode");
            branchCodes.add(code);
            long count = (Long) b.get("customerCount");
            double rev = (Double) b.get("revenue");
            System.out.printf("Branch %s: Active Customers=%d, Revenue=%.2f%n", code, count, rev);
            assertTrue(count > 0, "Branch " + code + " must have active customers");
            assertTrue(rev > 0, "Branch " + code + " must have revenue");
        }

        assertTrue(branchCodes.contains("Ampara"));
        assertTrue(branchCodes.contains("Batticaloa"));
        assertTrue(branchCodes.contains("Kalmunai"));
        assertTrue(branchCodes.contains("Trincomalee"));
        assertTrue(branchCodes.contains("Valaichenai"));
    }

    @Test
    @DisplayName("Measure Customer Billing Report Execution Time for ALL months and ALL branches")
    void testCustomerBillingReportPerformance() {
        long start = System.currentTimeMillis();
        List<Map<String, Object>> billingList = reportService.getCustomerBillingReport("ALL", null, null, null);
        long elapsed = System.currentTimeMillis() - start;
        assertNotNull(billingList);
        System.out.println("ALL months Customer Billing records: " + billingList.size() + " in " + elapsed + " ms");
    }
}
