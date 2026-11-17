package com.ceb.billing.services;

import com.ceb.billing.entities.PaymentBatchItem;
import com.ceb.billing.models.PaymentEligibilityResult;
import com.ceb.billing.repositories.PaymentBatchItemRepository;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Proxy;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class PaymentReadyReportTest {

    private ReportService reportService;
    private PaymentControlService paymentControlService;
    private PaymentBatchItemRepository paymentBatchItemRepository;

    private List<Map<String, Object>> mockCanonicalRecords;
    private Map<String, Boolean> mockReadyStatus;

    @BeforeEach
    void setUp() {
        reportService = new ReportService();
        mockCanonicalRecords = new ArrayList<>();
        mockReadyStatus = new HashMap<>();

        // Clean subclass without requiring ByteBuddy / Mockito agent
        paymentControlService = new PaymentControlService() {
            @Override
            public List<Map<String, Object>> loadCanonicalRecords(String billingPeriod, String division) {
                List<Map<String, Object>> filtered = new ArrayList<>();
                boolean hasBp = billingPeriod != null && !billingPeriod.trim().isEmpty() && !"ALL".equalsIgnoreCase(billingPeriod.trim());
                boolean hasDiv = division != null && !division.trim().isEmpty() && !"ALL".equalsIgnoreCase(division.trim());

                for (Map<String, Object> r : mockCanonicalRecords) {
                    if (hasBp && !billingPeriod.trim().equalsIgnoreCase(String.valueOf(r.get("billingMonth")))) {
                        continue;
                    }
                    if (hasDiv && !division.trim().equalsIgnoreCase(String.valueOf(r.get("division")))) {
                        continue;
                    }
                    filtered.add(r);
                }
                return filtered;
            }

            @Override
            public PaymentEligibilityResult canPay(Map<String, Object> record) {
                String acc = (String) record.get("accountNo");
                boolean isReady = mockReadyStatus.getOrDefault(acc, true);
                return createEligibilityResult(record, isReady);
            }
        };

        paymentBatchItemRepository = (PaymentBatchItemRepository) Proxy.newProxyInstance(
                PaymentBatchItemRepository.class.getClassLoader(),
                new Class<?>[]{PaymentBatchItemRepository.class},
                (proxy, method, args) -> Collections.emptyList()
        );

        ReflectionTestUtils.setField(reportService, "paymentControlService", paymentControlService);
        ReflectionTestUtils.setField(reportService, "paymentBatchItemRepository", paymentBatchItemRepository);
    }

    private Map<String, Object> createTestRecord(String acc, String name, String div, String month,
                                                double sales, double setOff, double units) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("accountNo", acc);
        r.put("customerName", name);
        r.put("division", div);
        r.put("snapshotDivision", div);
        r.put("billingMonth", month);
        r.put("refNo", "463-" + acc.substring(acc.length() - 4));
        r.put("fromDate", "2026-06-15");
        r.put("toDate", "2026-07-16");
        r.put("kwhImport", 100.0);
        r.put("kwhExport", units);
        r.put("kwhNet", units - 100.0);
        r.put("unitRate", 27.06);
        r.put("expenseCode", "L5001");
        r.put("bankCode", "7083");
        r.put("branchCode", "58");
        r.put("bankAccountNo", "58020138937");
        r.put("salesAmount", sales);
        r.put("billSetOff", setOff);
        return r;
    }

    private PaymentEligibilityResult createEligibilityResult(Map<String, Object> rec, boolean isReady) {
        PaymentEligibilityResult res = new PaymentEligibilityResult();
        res.setEligible(isReady);
        res.setPaymentStatus(isReady ? "READY" : "ON_HOLD");

        double current = (double) rec.getOrDefault("salesAmount", 0.0);
        double setOff = (double) rec.getOrDefault("billSetOff", 0.0);
        double settled = Math.max(0.0, current - setOff);
        double stamp = settled > 25000.0 ? 25.0 : 0.0;
        double payable = Math.max(0.0, settled - stamp);

        Map<String, Double> fin = new LinkedHashMap<>();
        fin.put("currentPayment", current);
        fin.put("billSetOff", setOff);
        fin.put("stampDuty", stamp);
        fin.put("amountPayable", payable);
        fin.put("totalPayable", payable);
        res.setFinancials(fin);
        return res;
    }

    @Test
    @DisplayName("Scenario 1: July 2026 Payment Ready Report retrieves strictly July ready records")
    public void testJuly2026PaymentReadyReport() {
        mockCanonicalRecords.clear();
        mockReadyStatus.clear();

        mockCanonicalRecords.add(createTestRecord("2400022100", "K.M.Premarathna", "Ampara", "July 2026", 16885.44, 512.82, 755.0));
        mockCanonicalRecords.add(createTestRecord("2400050716", "K.W.U.Priyantha", "Ampara", "July 2026", 8668.00, 82.05, 626.0));
        mockCanonicalRecords.add(createTestRecord("2400118205", "M.A.Inul Haroosa", "Ampara", "July 2026", 19916.16, 82.05, 811.0));

        mockReadyStatus.put("2400022100", true);
        mockReadyStatus.put("2400050716", true);
        mockReadyStatus.put("2400118205", false); // ON HOLD customer

        Map<String, Object> result = reportService.getPaymentReadyReport("July 2026", "Ampara", null, null);
        assertNotNull(result);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) result.get("records");
        assertEquals(2, records.size(), "Only 2 ready customers should be returned; on-hold customer must be excluded");

        for (Map<String, Object> rec : records) {
            assertEquals("READY", rec.get("paymentStatus"));
            assertEquals("July 2026", rec.get("billingMonth"));
            assertEquals("Ampara", rec.get("division"));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) result.get("summary");
        assertEquals(2, summary.get("totalPaymentReadyCustomers"));
        assertEquals("JULY 2026", summary.get("selectedBillingMonth"));
        assertEquals("AMPARA", summary.get("selectedDivision"));
    }

    @Test
    @DisplayName("Scenario 2: August 2026 Payment Ready Report isolation")
    public void testAugust2026PaymentReadyReport() {
        mockCanonicalRecords.clear();
        mockReadyStatus.clear();

        mockCanonicalRecords.add(createTestRecord("2400022100", "K.M.Premarathna", "Ampara", "August 2026", 18200.00, 0.0, 800.0));
        mockCanonicalRecords.add(createTestRecord("2400265607", "W.U.Nishantha perera", "Ampara", "August 2026", 19462.00, 82.05, 592.0));

        mockReadyStatus.put("2400022100", true);
        mockReadyStatus.put("2400265607", true);

        Map<String, Object> result = reportService.getPaymentReadyReport("August 2026", "Ampara", null, null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) result.get("records");
        assertEquals(2, records.size());

        for (Map<String, Object> rec : records) {
            assertEquals("August 2026", rec.get("billingMonth"));
            assertEquals("READY", rec.get("paymentStatus"));
        }
    }

    @Test
    @DisplayName("Scenario 3: All Billing Months keeps monthly records distinct and unmerged")
    public void testAllBillingMonthsSeparation() {
        mockCanonicalRecords.clear();
        mockReadyStatus.clear();

        // Customer 2400022100 appears in both July and August
        mockCanonicalRecords.add(createTestRecord("2400022100", "K.M.Premarathna", "Ampara", "July 2026", 16885.44, 512.82, 755.0));
        mockCanonicalRecords.add(createTestRecord("2400022100", "K.M.Premarathna", "Ampara", "August 2026", 18200.00, 0.0, 800.0));
        mockCanonicalRecords.add(createTestRecord("3200010000", "S.Selvakumar", "Batticaloa", "July 2026", 25500.00, 100.0, 950.0));

        mockReadyStatus.put("2400022100", true);
        mockReadyStatus.put("3200010000", true);

        Map<String, Object> result = reportService.getPaymentReadyReport("ALL", "ALL", null, null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) result.get("records");

        assertEquals(3, records.size(), "Each monthly bill must be a separate record; do not merge July & August for same customer");
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) result.get("summary");
        assertEquals(3, summary.get("totalPaymentReadyCustomers"));

        long custInBothMonths = records.stream()
                .filter(r -> "2400022100".equals(r.get("accountNo")))
                .count();
        assertEquals(2, custInBothMonths, "Customer 2400022100 must appear twice with their respective monthly bills");
    }

    @Test
    @DisplayName("Scenario 4: Division Isolation - Kalmunai records never leak into Batticaloa")
    public void testDivisionIsolation() {
        mockCanonicalRecords.clear();
        mockReadyStatus.clear();

        mockCanonicalRecords.add(createTestRecord("3200001001", "Batti Customer 1", "Batticaloa", "July 2026", 12000.0, 0.0, 500.0));
        mockCanonicalRecords.add(createTestRecord("3300001001", "Kalmunai Customer 1", "Kalmunai", "July 2026", 14000.0, 0.0, 600.0));

        mockReadyStatus.put("3200001001", true);
        mockReadyStatus.put("3300001001", true);

        Map<String, Object> result = reportService.getPaymentReadyReport("July 2026", "Batticaloa", null, null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) result.get("records");
        assertEquals(1, records.size());
        assertEquals("Batticaloa", records.get(0).get("division"));
        assertFalse(records.stream().anyMatch(r -> "Kalmunai".equalsIgnoreCase((String) r.get("division"))));
    }

    @Test
    @DisplayName("Scenario 5 & 6: Search Filtering by Account Number and Customer Name")
    public void testSearchFilters() {
        mockCanonicalRecords.clear();
        mockReadyStatus.clear();

        mockCanonicalRecords.add(createTestRecord("2400022100", "K.M.Premarathna", "Ampara", "July 2026", 16885.44, 512.82, 755.0));
        mockCanonicalRecords.add(createTestRecord("2400050716", "K.W.U.Priyantha", "Ampara", "July 2026", 8668.00, 82.05, 626.0));
        mockCanonicalRecords.add(createTestRecord("2400392706", "V.Vijendrakumar", "Ampara", "July 2026", 42029.90, 4826.30, 2444.0));

        mockReadyStatus.put("2400022100", true);
        mockReadyStatus.put("2400050716", true);
        mockReadyStatus.put("2400392706", true);

        // Test Account Number search
        Map<String, Object> accSearchResult = reportService.getPaymentReadyReport("July 2026", "Ampara", "50716", null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> accFiltered = (List<Map<String, Object>>) accSearchResult.get("records");
        assertEquals(1, accFiltered.size());
        assertEquals("2400050716", accFiltered.get(0).get("accountNo"));

        // Test Customer Name search
        Map<String, Object> nameSearchResult = reportService.getPaymentReadyReport("July 2026", "Ampara", null, "Vijendra");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nameFiltered = (List<Map<String, Object>>) nameSearchResult.get("records");
        assertEquals(1, nameFiltered.size());
        assertEquals("V.Vijendrakumar", nameFiltered.get(0).get("customerName"));
    }

    @Test
    @DisplayName("Scenario 7: Financial Totals Reconcile with Individual Row Calculations")
    public void testFinancialReconciliation() {
        mockCanonicalRecords.clear();
        mockReadyStatus.clear();

        // Row 1: 16885.44 - 512.82 = 16372.62 (settled < 25000, stamp duty = 0)
        mockCanonicalRecords.add(createTestRecord("2400022100", "K.M.Premarathna", "Ampara", "July 2026", 16885.44, 512.82, 755.0));
        // Row 2: 42029.90 - 4826.30 = 37203.60 (settled >= 25000, stamp duty = 25.00, payable = 37178.60)
        mockCanonicalRecords.add(createTestRecord("2400392706", "V.Vijendrakumar", "Ampara", "July 2026", 42029.90, 4826.30, 2444.0));

        mockReadyStatus.put("2400022100", true);
        mockReadyStatus.put("2400392706", true);

        Map<String, Object> result = reportService.getPaymentReadyReport("July 2026", "Ampara", null, null);
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) result.get("summary");

        assertEquals(2, summary.get("totalPaymentReadyCustomers"));
        assertEquals(58915.34, (double) summary.get("totalAmountSum"), 0.01);
        assertEquals(5339.12, (double) summary.get("totalBillSetOffSum"), 0.01);
        assertEquals(25.00, (double) summary.get("totalStampDutySum"), 0.01);
        assertEquals(53551.22, (double) summary.get("totalAmountPayableSum"), 0.01);
    }

    @Test
    @DisplayName("Scenario 8: Excel Export Generation Produces Valid POI Workbook")
    public void testExcelExportGeneration() throws Exception {
        mockCanonicalRecords.clear();
        mockReadyStatus.clear();

        mockCanonicalRecords.add(createTestRecord("2400022100", "K.M.Premarathna", "Ampara", "July 2026", 16885.44, 512.82, 755.0));
        mockCanonicalRecords.add(createTestRecord("2400392706", "V.Vijendrakumar", "Ampara", "July 2026", 42029.90, 4826.30, 2444.0));

        mockReadyStatus.put("2400022100", true);
        mockReadyStatus.put("2400392706", true);

        byte[] excelBytes = reportService.generatePaymentReadyExcel("July 2026", "Ampara", null, null);
        assertNotNull(excelBytes);
        assertTrue(excelBytes.length > 0, "Excel output should not be empty");

        // Verify valid XSSFWorkbook can parse it
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(excelBytes))) {
            Sheet sheet = wb.getSheet("Payment Ready Slip Listing");
            assertNotNull(sheet, "Sheet 'Payment Ready Slip Listing' must exist");
            assertEquals("SLIP TRANSACTION LISTING - PAYMENT OF NET ACCOUNTING / NET PLUS / NET PLUS PLUS FOR THE MONTH OF JULY 2026",
                    sheet.getRow(0).getCell(0).getStringCellValue());
        }
    }

    public static void main(String[] args) {
        try {
            System.out.println("Starting PaymentReadyReportTest execution...");
            PaymentReadyReportTest test = new PaymentReadyReportTest();

            test.setUp();
            test.testJuly2026PaymentReadyReport();
            System.out.println("  [PASS] Scenario 1: July 2026 Payment Ready Report");

            test.setUp();
            test.testAugust2026PaymentReadyReport();
            System.out.println("  [PASS] Scenario 2: August 2026 Payment Ready Report");

            test.setUp();
            test.testAllBillingMonthsSeparation();
            System.out.println("  [PASS] Scenario 3: All Billing Months unmerged separation");

            test.setUp();
            test.testDivisionIsolation();
            System.out.println("  [PASS] Scenario 4: Division Isolation");

            test.setUp();
            test.testSearchFilters();
            System.out.println("  [PASS] Scenario 5 & 6: Account No and Customer Name search");

            test.setUp();
            test.testFinancialReconciliation();
            System.out.println("  [PASS] Scenario 7: Financial Totals Reconciliation");

            test.setUp();
            test.testExcelExportGeneration();
            System.out.println("  [PASS] Scenario 8: Excel Export POI Generation");

            System.out.println("=================================================");
            System.out.println("ALL PAYMENT READY REPORT TEST SCENARIOS PASSED 100%!");
            System.out.println("=================================================");
        } catch (Throwable t) {
            t.printStackTrace();
            System.exit(1);
        }
    }
}
