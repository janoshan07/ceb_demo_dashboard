package com.ceb.billing.services;

import com.ceb.billing.controllers.CustomerController;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

/**
 * Runner to verify Customer Directory counts and details with multiple areas in the same billing month.
 */
public class CustomerMultiAreaDirectoryRunner {

    public static void main(String[] args) {
        System.out.println("=================================================================");
        System.out.println("Customer Directory Multi-Area Same Month Test Runner");
        System.out.println("=================================================================");

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            String testMonth = "June 2026";

            // Area 1: Ampara (prefix 24) - 100 customers
            List<Map<String, Object>> amparaRecords = new ArrayList<>();
            for (int i = 1; i <= 100; i++) {
                String acc = String.format("24%08d", i);
                Map<String, Object> r = new HashMap<>();
                r.put("accountNo", acc);
                r.put("customerName", "Ampara Customer " + i);
                r.put("division", "Ampara");
                r.put("snapshotDivision", "Ampara");
                r.put("solarType", "NET METERING");
                r.put("unitRate", 37.0);
                r.put("billingMonth", testMonth);
                amparaRecords.add(r);
            }
            MonthlyDirectorySnapshot amparaSnap = new MonthlyDirectorySnapshot();
            amparaSnap.setId(1L);
            amparaSnap.setDatasetName("Ampara June");
            amparaSnap.setBillingMonth(testMonth);
            amparaSnap.setDivision("Ampara");
            amparaSnap.setStatus("APPROVED");
            amparaSnap.setTotalRecords(100);
            amparaSnap.setFinalDataJson(objectMapper.writeValueAsString(amparaRecords));
            amparaSnap.setSessionId(101L);

            // Area 2: Batticaloa (prefix 32) - 150 customers
            List<Map<String, Object>> battiRecords = new ArrayList<>();
            for (int i = 1; i <= 150; i++) {
                String acc = String.format("32%08d", i);
                Map<String, Object> r = new HashMap<>();
                r.put("accountNo", acc);
                r.put("customerName", "Batticaloa Customer " + i);
                r.put("division", "Batticaloa");
                r.put("snapshotDivision", "Batticaloa");
                r.put("solarType", "NET ACCOUNTING");
                r.put("unitRate", 37.0);
                r.put("billingMonth", testMonth);
                battiRecords.add(r);
            }
            MonthlyDirectorySnapshot battiSnap = new MonthlyDirectorySnapshot();
            battiSnap.setId(2L);
            battiSnap.setDatasetName("Batticaloa June");
            battiSnap.setBillingMonth(testMonth);
            battiSnap.setDivision("Batticaloa");
            battiSnap.setStatus("APPROVED");
            battiSnap.setTotalRecords(150);
            battiSnap.setFinalDataJson(objectMapper.writeValueAsString(battiRecords));
            battiSnap.setSessionId(102L);

            // Area 3: Trincomalee (prefix 34) - 80 customers
            List<Map<String, Object>> trincRecords = new ArrayList<>();
            for (int i = 1; i <= 80; i++) {
                String acc = String.format("34%08d", i);
                Map<String, Object> r = new HashMap<>();
                r.put("accountNo", acc);
                r.put("customerName", "Trincomalee Customer " + i);
                r.put("division", "Trincomalee");
                r.put("snapshotDivision", "Trincomalee");
                r.put("solarType", "NET PLUS");
                r.put("unitRate", 37.0);
                r.put("billingMonth", testMonth);
                trincRecords.add(r);
            }
            MonthlyDirectorySnapshot trincSnap = new MonthlyDirectorySnapshot();
            trincSnap.setId(3L);
            trincSnap.setDatasetName("Trincomalee June");
            trincSnap.setBillingMonth(testMonth);
            trincSnap.setDivision("Trincomalee");
            trincSnap.setStatus("APPROVED");
            trincSnap.setTotalRecords(80);
            trincSnap.setFinalDataJson(objectMapper.writeValueAsString(trincRecords));
            trincSnap.setSessionId(103L);

            List<MonthlyDirectorySnapshot> allSnapshots = List.of(amparaSnap, battiSnap, trincSnap);

            CustomerController controller = new CustomerController();

            MonthlyDirectorySnapshotRepository snapRepo = (MonthlyDirectorySnapshotRepository) java.lang.reflect.Proxy.newProxyInstance(
                    MonthlyDirectorySnapshotRepository.class.getClassLoader(),
                    new Class<?>[]{MonthlyDirectorySnapshotRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findByBillingMonthIgnoreCase".equals(method.getName())) return allSnapshots;
                        if ("findAllByOrderByCreatedDateDesc".equals(method.getName())) return allSnapshots;
                        if ("findAll".equals(method.getName())) return allSnapshots;
                        return Collections.emptyList();
                    });

            CustomerRepository custRepo = (CustomerRepository) java.lang.reflect.Proxy.newProxyInstance(
                    CustomerRepository.class.getClassLoader(),
                    new Class<?>[]{CustomerRepository.class},
                    (proxy, method, mArgs) -> Collections.emptyList());

            BillingRecordRepository billRepo = (BillingRecordRepository) java.lang.reflect.Proxy.newProxyInstance(
                    BillingRecordRepository.class.getClassLoader(),
                    new Class<?>[]{BillingRecordRepository.class},
                    (proxy, method, mArgs) -> Collections.emptyList());

            CostCodeRepository costRepo = (CostCodeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    CostCodeRepository.class.getClassLoader(),
                    new Class<?>[]{CostCodeRepository.class},
                    (proxy, method, mArgs) -> Optional.empty());

            NetTypeRepository netRepo = (NetTypeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    NetTypeRepository.class.getClassLoader(),
                    new Class<?>[]{NetTypeRepository.class},
                    (proxy, method, mArgs) -> Optional.empty());

            ExpenseCodeRepository expRepo = (ExpenseCodeRepository) java.lang.reflect.Proxy.newProxyInstance(
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

            // Test 1: Query location="ALL" for billingMonth="June 2026"
            ResponseEntity<?> allSummaryResp = controller.getOfficerCustomersSummary(testMonth, "ALL");
            @SuppressWarnings("unchecked")
            Map<String, Object> allSummary = (Map<String, Object>) Objects.requireNonNull(
                    allSummaryResp.getBody(), "ALL summary response body must not be null");
            System.out.println("-> Summary for location='ALL': " + allSummary);

            int totalExpected = 100 + 150 + 80; // 330
            Number totalActual = (Number) allSummary.get("total");
            if (totalActual == null || totalActual.intValue() != totalExpected) {
                throw new IllegalStateException("FAIL: Expected total " + totalExpected + ", got " + totalActual);
            }
            System.out.println("   * Passed: Total count matches 330 across all 3 areas!");

            // Test 2: Query location="Ampara" for billingMonth="June 2026"
            ResponseEntity<?> amparaSummaryResp = controller.getOfficerCustomersSummary(testMonth, "Ampara");
            @SuppressWarnings("unchecked")
            Map<String, Object> amparaSummary = (Map<String, Object>) Objects.requireNonNull(
                    amparaSummaryResp.getBody(), "Ampara summary response body must not be null");
            Number amparaActual = (Number) amparaSummary.get("total");
            if (amparaActual == null || amparaActual.intValue() != 100) {
                throw new IllegalStateException("FAIL: Expected Ampara total 100, got " + amparaActual);
            }
            System.out.println("   * Passed: Ampara count matches 100!");

            // Test 3: Query location="Batticaloa" for billingMonth="June 2026"
            ResponseEntity<?> battiSummaryResp = controller.getOfficerCustomersSummary(testMonth, "Batticaloa");
            @SuppressWarnings("unchecked")
            Map<String, Object> battiSummary = (Map<String, Object>) Objects.requireNonNull(
                    battiSummaryResp.getBody(), "Batticaloa summary response body must not be null");
            Number battiActual = (Number) battiSummary.get("total");
            if (battiActual == null || battiActual.intValue() != 150) {
                throw new IllegalStateException("FAIL: Expected Batticaloa total 150, got " + battiActual);
            }
            System.out.println("   * Passed: Batticaloa count matches 150!");

            // Test 4: Query location="Trincomalee" for billingMonth="June 2026"
            ResponseEntity<?> trincSummaryResp = controller.getOfficerCustomersSummary(testMonth, "Trincomalee");
            @SuppressWarnings("unchecked")
            Map<String, Object> trincSummary = (Map<String, Object>) Objects.requireNonNull(
                    trincSummaryResp.getBody(), "Trincomalee summary response body must not be null");
            Number trincActual = (Number) trincSummary.get("total");
            if (trincActual == null || trincActual.intValue() != 80) {
                throw new IllegalStateException("FAIL: Expected Trincomalee total 80, got " + trincActual);
            }
            System.out.println("   * Passed: Trincomalee count matches 80!");

            // Test 5: Verify getOfficerCustomers returns all 330 records
            ResponseEntity<?> customersResp = controller.getOfficerCustomers(
                    "", "", "ALL", "", testMonth, "", "", "accountNo", "asc", 0, 500);
            @SuppressWarnings("unchecked")
            Map<String, Object> pageData = (Map<String, Object>) Objects.requireNonNull(
                    customersResp.getBody(), "Customer page response body must not be null");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> customersList = (List<Map<String, Object>>) pageData.get("content");
            System.out.println("-> Customers returned for page size 500: " + customersList.size());
            if (customersList.size() != 330) {
                throw new IllegalStateException("FAIL: Expected 330 customers returned, got " + customersList.size());
            }

            // Verify no records overwritten and divisions correctly preserved
            int amparaFound = 0, battiFound = 0, trincFound = 0;
            for (Map<String, Object> c : customersList) {
                String loc = CustomerController.resolveLocation(c);
                if ("Ampara".equals(loc)) amparaFound++;
                else if ("Batticaloa".equals(loc)) battiFound++;
                else if ("Trincomalee".equals(loc)) trincFound++;
            }

            System.out.println("-> Customer Details Division Breakdown:");
            System.out.println("   * Ampara: " + amparaFound);
            System.out.println("   * Batticaloa: " + battiFound);
            System.out.println("   * Trincomalee: " + trincFound);

            if (amparaFound != 100 || battiFound != 150 || trincFound != 80) {
                throw new IllegalStateException("FAIL: Detailed customer records division counts mismatch!");
            }

            System.out.println("=================================================================");
            System.out.println("ALL MULTI-AREA SAME MONTH DIRECTORY TESTS PASSED SUCCESSFULLY!");
            System.out.println("=================================================================");
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}
