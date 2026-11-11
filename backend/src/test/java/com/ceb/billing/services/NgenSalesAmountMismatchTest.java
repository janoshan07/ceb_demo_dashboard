package com.ceb.billing.services;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class NgenSalesAmountMismatchTest {

    @Test
    public void testDetectNgenColumns_MapsKwhSalesToSalesAmount() throws Exception {
        MultiFileImportService service = new MultiFileImportService();
        PreviewService previewService = new PreviewService();

        // Inject previewService into multiFileImportService via reflection
        java.lang.reflect.Field pf = MultiFileImportService.class.getDeclaredField("previewService");
        pf.setAccessible(true);
        pf.set(service, previewService);

        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("NGEN");
            Row header = sheet.createRow(0);
            String[] headers = {
                "Account No", "Net Type", "kWh Import", "kWh Export", "kWh Sales",
                "Unit Rate", "Retention Money", "Bill Set Off", "Payment Settled", "Outstanding Balance"
            };
            for (int i = 0; i < headers.length; i++) {
                header.createCell(i).setCellValue(headers[i]);
            }

            Method m = MultiFileImportService.class.getDeclaredMethod("detectNgenColumns", Sheet.class, int.class);
            m.setAccessible(true);
            @SuppressWarnings("unchecked")
            Map<String, Integer> cols = (Map<String, Integer>) m.invoke(service, sheet, 0);

            // "kWh Sales" must map to kwhSalesAmount (index 4)
            assertEquals(4, cols.get("kwhSalesAmount"));
            assertNull(cols.get("kwhUnitSales"));
        }
    }

    @Test
    public void testRevalidateMergedRow_HealsMismatchAndRecalculatesUnits() throws Exception {
        MultiFileImportService service = new MultiFileImportService();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("accountNo", "6920136201");
        row.put("kwhImport", 375.0);
        row.put("kwhExport", 3018.0);
        row.put("kwhSales", 97791.0); // Mistakenly set to rupee amount during initial import
        row.put("salesAmount", 0.0);   // Mistakenly defaulted to 0.0
        row.put("ngenUnitRate", 37.0);
        row.put("ngenNetType", "ACCOUNTING");
        row.put("hasCeb", true);
        row.put("hasNgen", true);
        row.put("hasNpay", true);
        row.put("prevReadingDate", "2026-06-08");
        row.put("currReadingDate", "2026-07-09");
        row.put("cebName", "S. AKILAN");
        row.put("npayName", "S. AKILAN");
        row.put("npayNetType", "ACCOUNTING");
        row.put("npayEnergyPurchase", 97791.0);
        row.put("npayBillSetOff", 0.0);
        row.put("npayRetentionMoney", 0.0);
        row.put("npayPayment", 97791.0);
        row.put("paymentSettled", 97791.0);
        row.put("billSetOff", 0.0);
        row.put("retentionMoney", 0.0);

        Method m = MultiFileImportService.class.getDeclaredMethod("revalidateMergedRow", Map.class);
        m.setAccessible(true);
        m.invoke(service, row);

        // Sales amount must be recovered to 97791.0
        assertEquals(97791.0, (Double) row.get("salesAmount"), 1e-4);

        // Unit sales must be recalculated to net export: 3018 - 375 = 2643
        assertEquals(2643.0, (Double) row.get("kwhSales"), 1e-4);

        // Energy purchase must match without mismatch flag
        @SuppressWarnings("unchecked")
        Map<String, Object> mergedEnergyPurchase = (Map<String, Object>) row.get("mergedEnergyPurchase");
        assertNotNull(mergedEnergyPurchase);
        assertFalse((Boolean) mergedEnergyPurchase.get("mismatch"));
        assertEquals("BOTH", mergedEnergyPurchase.get("source"));
        assertEquals(97791.0, (Double) mergedEnergyPurchase.get("display"), 1e-4);

        // Status must be VALID and no warnings
        @SuppressWarnings("unchecked")
        List<String> warnings = (List<String>) row.get("warnings");
        assertTrue(warnings.isEmpty(), "Expected 0 warnings, found: " + warnings);
        assertEquals("VALID", row.get("status"));
    }
}

