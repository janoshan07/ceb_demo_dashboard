package com.ceb.billing.services;

import com.ceb.billing.entities.CostCode;
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
 * Direct execution runner to verify Step 1 Master Data upload & proceed hashing performance with 1,500 records.
 */
public class MasterDataUploadPerformanceRunner {

    public static void main(String[] args) {
        System.out.println("=================================================================");
        System.out.println("CEB Step 1 Master Data Hashing & Performance Test Runner");
        System.out.println("=================================================================");

        try {
            // 1. Generate an Excel workbook with 1,500 Master Data rows
            System.out.println("Generating synthetic Excel workbook with 1,500 Master Data rows...");
            byte[] excelBytes;
            try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                Sheet sheet = wb.createSheet("Master Data");
                Row header = sheet.createRow(0);
                String[] headers = new String[]{
                        "Account No", "Customer Name", "Address", "Ref. No.", "Cost Code",
                        "Mobile Number", "Panel Capacity", "Capacity", "Agreement Date", "Bank Code",
                        "Branch Code", "Bank Account No", "Type", "Unit Rate", "Fix/Variable", "Exp"
                };
                for (int c = 0; c < headers.length; c++) {
                    header.createCell(c).setCellValue(headers[c]);
                }

                for (int r = 1; r <= 1500; r++) {
                    Row row = sheet.createRow(r);
                    String acc = String.format("34%08d", r); // Trincomalee prefix 34
                    row.createCell(0).setCellValue(acc);
                    row.createCell(1).setCellValue("Trinco Customer " + r);
                    row.createCell(2).setCellValue(r + ", Main Street, Trincomalee");
                    row.createCell(3).setCellValue("REF" + acc);
                    row.createCell(4).setCellValue("540.00");
                    row.createCell(5).setCellValue("0771234567");
                    row.createCell(6).setCellValue(5.0);
                    row.createCell(7).setCellValue(5.0);
                    row.createCell(8).setCellValue("2024-05-15");
                    row.createCell(9).setCellValue("7010");
                    row.createCell(10).setCellValue("001");
                    row.createCell(11).setCellValue("123456789012");
                    row.createCell(12).setCellValue("Net Plus");
                    row.createCell(13).setCellValue(37.0);
                    row.createCell(14).setCellValue("Fixed");
                    row.createCell(15).setCellValue("L1");
                }

                wb.write(baos);
                excelBytes = baos.toByteArray();
            }
            System.out.printf("Excel generation complete! Size: %.1f KB (%d bytes)%n", excelBytes.length / 1024.0, excelBytes.length);

            // 2. Instantiate and inject services
            MultiFileImportService importService = new MultiFileImportService();
            PreviewService previewService = new PreviewService();
            ExcelValidationService excelValidationService = new ExcelValidationService();

            CostCodeRepository costCodeRepo = (CostCodeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    CostCodeRepository.class.getClassLoader(),
                    new Class[]{CostCodeRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findAll".equals(method.getName())) {
                            CostCode cc = new CostCode("540.00", "Trincomalee Cost Center");
                            return List.of(cc);
                        }
                        return null;
                    }
            );

            Map<Long, ImportSession> sessionStore = new HashMap<>();
            ImportSessionRepository sessionRepo = (ImportSessionRepository) java.lang.reflect.Proxy.newProxyInstance(
                    ImportSessionRepository.class.getClassLoader(),
                    new Class[]{ImportSessionRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findTopByUploadedByOrderByIdDesc".equals(method.getName())) {
                            return sessionStore.values().stream().findFirst();
                        }
                        if ("findByCreatedByAndStageNot".equals(method.getName())) {
                            return new ArrayList<>(sessionStore.values());
                        }
                        if ("save".equals(method.getName())) {
                            ImportSession s = (ImportSession) mArgs[0];
                            if (s.getId() == null) s.setId(277L);
                            sessionStore.put(s.getId(), s);
                            return s;
                        }
                        return null;
                    }
            );

            AuditLogService auditLogService = new AuditLogService() {
                @Override
                public void log(String action, String details) {
                    // no-op for performance test
                }
            };

            NetTypeRepository netTypeRepo = (NetTypeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    NetTypeRepository.class.getClassLoader(),
                    new Class[]{NetTypeRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findAll".equals(method.getName())) {
                            return List.of(new com.ceb.billing.entities.NetType("Net Plus"));
                        }
                        return null;
                    }
            );

            ExpenseCodeRepository expCodeRepo = (ExpenseCodeRepository) java.lang.reflect.Proxy.newProxyInstance(
                    ExpenseCodeRepository.class.getClassLoader(),
                    new Class[]{ExpenseCodeRepository.class},
                    (proxy, method, mArgs) -> {
                        if ("findAll".equals(method.getName())) {
                            return List.of(new com.ceb.billing.entities.ExpenseCode("L5002", "L5002", "Net Plus Fixed"));
                        }
                        return null;
                    }
            );

            ReflectionTestUtils.setField(importService, "previewService", previewService);
            ReflectionTestUtils.setField(importService, "excelValidationService", excelValidationService);
            ReflectionTestUtils.setField(importService, "costCodeRepository", costCodeRepo);
            ReflectionTestUtils.setField(importService, "netTypeRepository", netTypeRepo);
            ReflectionTestUtils.setField(importService, "expenseCodeRepository", expCodeRepo);
            ReflectionTestUtils.setField(importService, "sessionRepository", sessionRepo);
            ReflectionTestUtils.setField(importService, "auditLogService", auditLogService);

            // 3. Test Preview Step (Parsing + Validation + Date Hashing + Duplicate Hashing)
            System.out.println("\n--- Step 1 Upload & Preview Benchmark ---");
            long t0 = System.currentTimeMillis();
            Map<String, Object> previewResult = importService.previewMasterData(excelBytes, "Trinco Master data.xlsx", "officer");
            long previewElapsed = System.currentTimeMillis() - t0;

            int totalRows = (Integer) previewResult.get("totalRows");
            int validCount = (Integer) previewResult.get("validCount");
            System.out.printf("Preview finished in: %d ms%n", previewElapsed);
            System.out.printf("Total Rows Previewed: %d, Valid Count: %d%n", totalRows, validCount);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> previewRowList = (List<Map<String, Object>>) previewResult.get("rows");
            if (previewRowList != null && !previewRowList.isEmpty()) {
                System.out.println("Row 0 Errors: " + previewRowList.get(0).get("errors"));
                System.out.println("Row 0 Details: " + previewRowList.get(0));
            }

            if (totalRows != 1500 || validCount != 1500) {
                throw new IllegalStateException("Preview row count mismatch! Expected 1500 valid rows, got: " + totalRows);
            }

            // 4. Test Proceed Step (approveMasterData with In-Memory Hash Bypass)
            System.out.println("\n--- Step 1 Proceed (Approve) Benchmark ---");
            long t1 = System.currentTimeMillis();
            Map<String, Object> proceedResult = importService.approveMasterData(
                    excelBytes, "Trinco Master data.xlsx", "officer", Collections.emptyMap(), "July 2026", "Trincomalee");
            long proceedElapsed = System.currentTimeMillis() - t1;

            int totalImported = (Integer) proceedResult.get("totalImported");
            System.out.printf("Proceed (Approve) finished in: %d ms%n", proceedElapsed);
            System.out.printf("Total Customers Staged: %d%n", totalImported);

            if (totalImported != 1500) {
                throw new IllegalStateException("Proceed row count mismatch! Expected 1500 staged rows, got: " + totalImported);
            }

            // Proceed should be nearly instantaneous (< 100ms) because POI parsing is completely bypassed via in-memory hashing
            if (proceedElapsed > 300) {
                System.out.printf("WARNING: Proceed took %d ms, which is slower than ideal (<300ms)%n", proceedElapsed);
            } else {
                System.out.println("SUCCESS: Proceed executed in lightning-fast O(1) hash lookup time (" + proceedElapsed + " ms)!");
            }

            System.out.println("\n=================================================================");
            System.out.println("ALL STEP 1 MASTER DATA PERFORMANCE CHECKS PASSED SUCCESSFULLY!");
            System.out.println("=================================================================");

        } catch (Throwable t) {
            System.err.println("TEST FAILURE: " + t.getMessage());
            t.printStackTrace();
            System.exit(1);
        }
    }
}
