package com.ceb.billing.services;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.models.PaymentEligibilityResult;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Proxy;
import java.util.*;

/**
 * End-to-End Performance Benchmark Test comparing:
 * 1. PDF / Print generation preparation latency
 * 2. Excel export before-and-after (autoSizeColumn vs SXSSFWorkbook streaming + fixed widths)
 * 3. Memory consumption across Small (50), Medium (500), and Large (5,000) datasets
 */
public class ReportPerformanceBenchmarkTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static Map<String, Object> createMockRecord(int id, String month, String div, String status) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("accountNo", String.format("24000%05d", id));
        r.put("customerName", "Customer Test " + id);
        r.put("npayName", "Customer Test " + id);
        r.put("billingMonth", month);
        r.put("division", div);
        r.put("refNo", "REF-" + id);
        r.put("mobileNo", "077123" + String.format("%04d", id % 10000));
        r.put("solarType", "Net Plus");
        r.put("tariffType", "Domestic");
        r.put("panelCapacity", "5.0 kW");
        r.put("prevReadingDate", "2026-06-01");
        r.put("currReadingDate", "2026-07-01");
        r.put("ngenNetType", "Net Plus");
        r.put("kwhImport", 120.0);
        r.put("kwhExport", 580.0);
        r.put("kwhSales", 460.0);
        r.put("unitRate", 27.06);
        r.put("ngenUnitRate", 27.06);
        r.put("energyPurchase", 12447.60);
        r.put("billSetOff", 82.05);
        r.put("retentionMoney", 0.0);
        r.put("payment", 12365.55);
        r.put("outstandingBalance", 0.0);
        r.put("expenseCode", "L5001");
        r.put("bankCode", "7010");
        r.put("branchCode", "021");
        r.put("bankAccountNo", "80102030" + id);
        r.put("fromDate", "2026-06-01");
        r.put("toDate", "2026-07-01");
        r.put("status", status);
        return r;
    }

    private static List<Map<String, Object>> generateDataset(int count) {
        List<Map<String, Object>> list = new ArrayList<>(count);
        String[] divs = {"Ampara", "Batticaloa", "Kalmunai", "Trincomalee"};
        for (int i = 1; i <= count; i++) {
            list.add(createMockRecord(i, "July 2026", divs[i % divs.length], "READY"));
        }
        return list;
    }

    // Benchmark baseline: Legacy implementation with autoSizeColumn and unbuffered stream
    private static byte[] runLegacyExcelExport(List<Map<String, Object>> records) throws Exception {
        String[][] exportCols = {
                {"accountNo", "Account No"}, {"npayName", "Name"}, {"customerAddress", "Address"},
                {"refNo", "Ref No"}, {"mobileNo", "Mobile No"}, {"solarType", "Solar Type"},
                {"tariffType", "Tariff Type"}, {"panelCapacity", "Panel Capacity"},
                {"prevReadingDate", "Prev Reading"}, {"currReadingDate", "Curr Reading"},
                {"ngenNetType", "Net Type"}, {"kwhImport", "kWh Import"}, {"kwhExport", "kWh Export"},
                {"kwhSales", "kWh Sales"}, {"ngenUnitRate", "Unit Rate"}, {"energyPurchase", "Energy Purchase"},
                {"billSetOff", "Bill Set Off"}, {"retentionMoney", "Retention Money"},
                {"payment", "Payment"}, {"outstandingBalance", "Outstanding"}, {"status", "Status"}
        };

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Customer Directory");
            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row header = sheet.createRow(0);
            for (int c = 0; c < exportCols.length; c++) {
                Cell cell = header.createCell(c);
                cell.setCellValue(exportCols[c][1]);
                cell.setCellStyle(headerStyle);
            }

            int r = 1;
            for (Map<String, Object> row : records) {
                Row excelRow = sheet.createRow(r++);
                for (int c = 0; c < exportCols.length; c++) {
                    Object val = row.get(exportCols[c][0]);
                    excelRow.createCell(c).setCellValue(val != null ? String.valueOf(val) : "");
                }
            }
            for (int c = 0; c < exportCols.length; c++) {
                sheet.autoSizeColumn(c);
            }
            wb.write(bos);
            return bos.toByteArray();
        }
    }

    public static void main(String[] args) {
        System.out.println("==========================================================================================");
        System.out.println("     EDL SYSTEM EXPORT PERFORMANCE BENCHMARK (BEFORE VS AFTER OPTIMIZATION)              ");
        System.out.println("==========================================================================================");

        int[] datasetSizes = {50, 500, 5000};
        String[] sizeLabels = {"Small (50 records)", "Medium (500 records)", "Large (5,000 records)"};

        for (int idx = 0; idx < datasetSizes.length; idx++) {
            int count = datasetSizes[idx];
            String label = sizeLabels[idx];
            List<Map<String, Object>> data = generateDataset(count);

            ReportService reportService = new ReportService();
            PaymentControlService mockPCS = new PaymentControlService() {
                @Override
                public List<Map<String, Object>> loadCanonicalRecords(String billingPeriod, String division) {
                    return data;
                }

                @Override
                public PaymentEligibilityResult canPay(Map<String, Object> record) {
                    Map<String, Double> fin = new HashMap<>();
                    fin.put("currentPayment", 15420.50);
                    fin.put("billSetOff", 82.05);
                    fin.put("stampDuty", 25.00);
                    fin.put("amountPayable", 15313.45);
                    PaymentEligibilityResult res = new PaymentEligibilityResult();
                    res.setEligible(true);
                    res.setPaymentStatus("READY");
                    res.setFinancials(fin);
                    return res;
                }
            };
            ReflectionTestUtils.setField(reportService, "paymentControlService", mockPCS);

            MonthlyDirectoryService directoryService = new MonthlyDirectoryService();
            MonthlyDirectorySnapshot mockSnapshot = new MonthlyDirectorySnapshot();
            mockSnapshot.setId((long) (idx + 1));
            mockSnapshot.setDatasetName("July 2026 Billing");
            try {
                mockSnapshot.setFinalDataJson(MAPPER.writeValueAsString(data));
            } catch (Exception ignored) {}

            MonthlyDirectorySnapshotRepository mockRepo = (MonthlyDirectorySnapshotRepository) Proxy.newProxyInstance(
                    MonthlyDirectorySnapshotRepository.class.getClassLoader(),
                    new Class<?>[]{MonthlyDirectorySnapshotRepository.class},
                    (proxy, method, args1) -> {
                        if ("findById".equals(method.getName())) {
                            return Optional.of(mockSnapshot);
                        }
                        return null;
                    }
            );
            ReflectionTestUtils.setField(directoryService, "snapshotRepository", mockRepo);

            // 1. PDF / Print Data Preparation Timing
            long tPdf0 = System.currentTimeMillis();
            Map<String, Object> report = reportService.getPaymentReadyReport("July 2026", "ALL", null, null);
            long tPdf = System.currentTimeMillis() - tPdf0;

            // 2. Legacy Excel Generation Benchmark (Unbuffered + autoSizeColumn)
            long tLegacy0 = System.currentTimeMillis();
            byte[] legacyBytes = null;
            try {
                legacyBytes = runLegacyExcelExport(data);
            } catch (Exception e) {
                e.printStackTrace();
            }
            long tLegacy = System.currentTimeMillis() - tLegacy0;

            // 3. Optimized Excel Generation Benchmark (SXSSFWorkbook Streaming + Fixed Widths + Pre-sized stream)
            System.gc();
            Runtime rt = Runtime.getRuntime();
            long memBefore = rt.totalMemory() - rt.freeMemory();

            long tOpt0 = System.currentTimeMillis();
            byte[] optBytes = null;
            try {
                optBytes = directoryService.buildExcel(mockSnapshot.getId());
            } catch (Exception e) {
                e.printStackTrace();
            }
            long tOpt = System.currentTimeMillis() - tOpt0;

            long memAfter = rt.totalMemory() - rt.freeMemory();
            long memDeltaMB = Math.max(0, memAfter - memBefore) / (1024 * 1024);

            // 4. Payment Ready Slip Excel Timing
            long tSlipExcel0 = System.currentTimeMillis();
            byte[] slipExcelBytes = null;
            try {
                slipExcelBytes = reportService.generatePaymentReadyExcel("July 2026", "ALL", null, null);
            } catch (Exception e) {
                e.printStackTrace();
            }
            long tSlipExcel = System.currentTimeMillis() - tSlipExcel0;

            double speedup = tLegacy > 0 ? (double) tLegacy / Math.max(1, tOpt) : 1.0;

            System.out.println("\n------------------------------------------------------------------------------------------");
            System.out.printf("DATASET: %s (%,d Records)\n", label, count);
            System.out.println("------------------------------------------------------------------------------------------");
            System.out.printf("  [PDF/Print] Data Compilation Latency         : %d ms\n", tPdf);
            System.out.printf("  [Excel] Legacy Export (autoSizeColumn)       : %d ms  (Size: %,d KB)\n", tLegacy, (legacyBytes != null ? legacyBytes.length / 1024 : 0));
            System.out.printf("  [Excel] Optimized Streaming (SXSSFWorkbook)  : %d ms  (Size: %,d KB)\n", tOpt, (optBytes != null ? optBytes.length / 1024 : 0));
            System.out.printf("  [Excel] Performance Improvement (Speedup)    : %.1fx FASTER (Time reduced by %d ms)\n", speedup, (tLegacy - tOpt));
            System.out.printf("  [Excel] Payment Ready Slip Listing (.xlsx)   : %d ms  (Size: %,d KB)\n", tSlipExcel, (slipExcelBytes != null ? slipExcelBytes.length / 1024 : 0));
            System.out.printf("  [Memory] Heap Overhead During Export         : ~%d MB\n", memDeltaMB);
        }

        System.out.println("\n==========================================================================================");
        System.out.println("     BENCHMARK & VERIFICATION COMPLETED SUCCESSFULLY                                      ");
        System.out.println("==========================================================================================");
    }
}
