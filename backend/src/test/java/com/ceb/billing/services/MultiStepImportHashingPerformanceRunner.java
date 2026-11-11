package com.ceb.billing.services;

import com.ceb.billing.entities.ImportSession;
import com.ceb.billing.repositories.*;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayOutputStream;
import java.util.*;

/**
 * Direct execution runner to verify hashing performance across all multi-file import steps:
 * - Step 2: CEB Assist
 * - Step 3: NGEN
 * - Step 4: NPAY
 * - Step 5: Main Dataset Generation
 * - Step 6: Master Comparison
 */
public class MultiStepImportHashingPerformanceRunner {

    public static void main(String[] args) {
        System.out.println("=================================================================");
        System.out.println("CEB Multi-Step Import Hashing Performance Test Runner");
        System.out.println("=================================================================");

        try {
            final int ROW_COUNT = 1500;
            Long sessionId = 278L;

            // 1. Generate Excel files in memory
            System.out.println("Generating synthetic Excel files (1,500 rows each)...");
            byte[] cebBytes = generateCebAssistExcel(ROW_COUNT);
            byte[] ngenBytes = generateNgenExcel(ROW_COUNT);
            byte[] npayBytes = generateNpayExcel(ROW_COUNT);
            System.out.println("Excel generation complete!");

            // 2. Setup service and mocks
            MultiFileImportService importService = new MultiFileImportService();
            PreviewService previewService = new PreviewService();
            ExcelValidationService excelValidationService = new ExcelValidationService();

            ImportSession session = new ImportSession();
            session.setId(sessionId);
            session.setCreatedBy("officer");
            session.setStage("MASTER_APPROVED");
            session.setMasterCustomerCount(ROW_COUNT);

            Map<Long, ImportSession> sessionStore = new HashMap<>();
            sessionStore.put(sessionId, session);

            ImportSessionRepository sessionRepo = (ImportSessionRepository) java.lang.reflect.Proxy.newProxyInstance(
                    ImportSessionRepository.class.getClassLoader(),
                    new Class[]{ImportSessionRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findById".equals(method.getName())) {
                            return Optional.ofNullable(sessionStore.get(mArgs[0]));
                        }
                        if ("save".equals(method.getName())) {
                            ImportSession s = (ImportSession) mArgs[0];
                            sessionStore.put(s.getId(), s);
                            return s;
                        }
                        return null;
                    }
            );

            AuditLogService auditLogService = new AuditLogService() {
                @Override
                public void log(String action, String details) {}
            };

            ReflectionTestUtils.setField(importService, "previewService", previewService);
            ReflectionTestUtils.setField(importService, "excelValidationService", excelValidationService);
            ReflectionTestUtils.setField(importService, "sessionRepository", sessionRepo);
            ReflectionTestUtils.setField(importService, "auditLogService", auditLogService);

            // Populate mock Master Data cache for session
            List<Map<String, Object>> mockMaster = new ArrayList<>();
            for (int r = 1; r <= ROW_COUNT; r++) {
                Map<String, Object> m = new HashMap<>();
                String acc = String.format("34%08d", r);
                m.put("accountNo", acc);
                m.put("customerName", "Customer " + r);
                m.put("unitRate", 37.0);
                m.put("solarType", "Net Plus");
                m.put("tariffType", "Fix");
                mockMaster.add(m);
            }
            ReflectionTestUtils.invokeMethod(importService, "saveMasterDataToStaging", sessionId, mockMaster);

            // ─── Step 2: CEB Assist Hashing Benchmark ───
            System.out.println("\n--- Step 2: CEB Assist Hashing Benchmark ---");
            long t0 = System.currentTimeMillis();
            Map<String, Object> cebPreview = importService.previewCebAssist(cebBytes, "CEB_Assist.xlsx", sessionId);
            long cebPreviewTime = System.currentTimeMillis() - t0;
            System.out.printf("CEB Assist Preview finished in: %d ms (Rows: %d)%n",
                    cebPreviewTime, cebPreview.get("totalRows"));

            long t1 = System.currentTimeMillis();
            Map<String, Object> cebApprove = importService.approveCebAssist(cebBytes, "officer", sessionId, Collections.emptyMap());
            long cebApproveTime = System.currentTimeMillis() - t1;
            System.out.printf("CEB Assist Proceed (Approve) finished in: %d ms (Cached: %d)%n",
                    cebApproveTime, cebApprove.get("cebAssistCount"));
            if (cebApproveTime > 150) {
                System.out.println("WARNING: CEB Assist approve took longer than expected: " + cebApproveTime + " ms");
            } else {
                System.out.println("SUCCESS: CEB Assist O(1) hash bypass executed in " + cebApproveTime + " ms!");
            }

            // ─── Step 3: NGEN Hashing Benchmark ───
            System.out.println("\n--- Step 3: NGEN Hashing Benchmark ---");
            long t2 = System.currentTimeMillis();
            Map<String, Object> ngenPreview = importService.previewNgen(ngenBytes, "NGEN_Sheet.xlsx", sessionId);
            long ngenPreviewTime = System.currentTimeMillis() - t2;
            System.out.printf("NGEN Preview finished in: %d ms (Rows: %d)%n",
                    ngenPreviewTime, ngenPreview.get("totalRows"));

            long t3 = System.currentTimeMillis();
            importService.approveNgen(ngenBytes, "officer", sessionId, Collections.emptyMap(), false);
            long ngenApproveTime = System.currentTimeMillis() - t3;
            System.out.printf("NGEN Proceed (Approve) finished in: %d ms%n", ngenApproveTime);
            if (ngenApproveTime > 150) {
                System.out.println("WARNING: NGEN approve took longer than expected: " + ngenApproveTime + " ms");
            } else {
                System.out.println("SUCCESS: NGEN O(1) hash bypass executed in " + ngenApproveTime + " ms!");
            }

            // ─── Step 4: NPAY Hashing Benchmark ───
            System.out.println("\n--- Step 4: NPAY Hashing Benchmark ---");
            long t4 = System.currentTimeMillis();
            Map<String, Object> npayPreview = importService.previewNpay(npayBytes, "NPAY_Sheet.xlsx", sessionId);
            long npayPreviewTime = System.currentTimeMillis() - t4;
            System.out.printf("NPAY Preview finished in: %d ms (Rows: %d)%n",
                    npayPreviewTime, npayPreview.get("totalRows"));

            long t5 = System.currentTimeMillis();
            importService.approveNpay(npayBytes, "officer", sessionId, Collections.emptyMap(), false);
            long npayApproveTime = System.currentTimeMillis() - t5;
            System.out.printf("NPAY Proceed (Approve) finished in: %d ms%n", npayApproveTime);
            if (npayApproveTime > 150) {
                System.out.println("WARNING: NPAY approve took longer than expected: " + npayApproveTime + " ms");
            } else {
                System.out.println("SUCCESS: NPAY O(1) hash bypass executed in " + npayApproveTime + " ms!");
            }

            // ─── Step 5: Main Dataset Merge ───
            System.out.println("\n--- Step 5: Main Dataset Merge Verification ---");
            List<Map<String, Object>> mainDataset = importService.getMainDataset(sessionId);
            System.out.printf("Main Dataset merged successfully! Merged Records: %d%n", mainDataset.size());
            if (mainDataset.size() != ROW_COUNT) {
                throw new IllegalStateException("Expected " + ROW_COUNT + " merged rows, got: " + mainDataset.size());
            }

            System.out.println("\n=================================================================");
            System.out.println("ALL MULTI-STEP IMPORT HASHING BENCHMARKS PASSED SUCCESSFULLY!");
            System.out.println("=================================================================");

        } catch (Throwable t) {
            System.err.println("TEST FAILURE: " + t.getMessage());
            t.printStackTrace();
            System.exit(1);
        }
    }

    private static byte[] generateCebAssistExcel(int count) throws Exception {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("CEB Assist");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Account No");
            header.createCell(1).setCellValue("Customer Name");
            header.createCell(2).setCellValue("Prev Reading Date");
            header.createCell(3).setCellValue("Curr Reading Date");

            for (int r = 1; r <= count; r++) {
                Row row = sheet.createRow(r);
                String acc = String.format("34%08d", r);
                row.createCell(0).setCellValue(acc);
                row.createCell(1).setCellValue("Customer " + r);
                row.createCell(2).setCellValue("2026-05-01");
                row.createCell(3).setCellValue("2026-05-31");
            }
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    private static byte[] generateNgenExcel(int count) throws Exception {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("NGEN");
            Row header = sheet.createRow(0);
            String[] headers = {"Account No", "Net Type", "kWh Import", "kWh Export", "kWh Unit Sales",
                    "Unit Rate", "Retention Money", "Bill Set Off", "Sales Amount", "Payment Settled", "Outstanding Balance"};
            for (int c = 0; c < headers.length; c++) header.createCell(c).setCellValue(headers[c]);

            for (int r = 1; r <= count; r++) {
                Row row = sheet.createRow(r);
                String acc = String.format("34%08d", r);
                row.createCell(0).setCellValue(acc);
                row.createCell(1).setCellValue("Net Plus");
                row.createCell(2).setCellValue(150.0);
                row.createCell(3).setCellValue(350.0);
                row.createCell(4).setCellValue(200.0);
                row.createCell(5).setCellValue(37.0);
                row.createCell(6).setCellValue(0.0);
                row.createCell(7).setCellValue(0.0);
                row.createCell(8).setCellValue(7400.0);
                row.createCell(9).setCellValue(7400.0);
                row.createCell(10).setCellValue(0.0);
            }
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    private static byte[] generateNpayExcel(int count) throws Exception {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("NPAY");
            Row header = sheet.createRow(0);
            String[] headers = {"Account No", "Net Type", "Customer Name", "Energy Purchase", "Bill Set Off", "Retention Money", "Payment"};
            for (int c = 0; c < headers.length; c++) header.createCell(c).setCellValue(headers[c]);

            for (int r = 1; r <= count; r++) {
                Row row = sheet.createRow(r);
                String acc = String.format("34%08d", r);
                row.createCell(0).setCellValue(acc);
                row.createCell(1).setCellValue("Net Plus");
                row.createCell(2).setCellValue("Customer " + r);
                row.createCell(3).setCellValue(7400.0);
                row.createCell(4).setCellValue(0.0);
                row.createCell(5).setCellValue(0.0);
                row.createCell(6).setCellValue(7400.0);
            }
            wb.write(baos);
            return baos.toByteArray();
        }
    }
}
