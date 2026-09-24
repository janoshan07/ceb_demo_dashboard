package com.ceb.billing.services;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class TariffColumnDetectionTest {

    private PreviewService previewService;

    @BeforeEach
    public void setUp() {
        previewService = new PreviewService();
    }

    private Sheet createMockSheetWithHeader(Workbook wb, String tariffHeaderName) {
        Sheet sheet = wb.createSheet("TestSheet");
        Row headerRow = sheet.createRow(0);
        String[] headers = {
            "Account No", "Customer Name", "Address", "Mobile No",
            "Panel Capacity", "Agreement Date", "Bank Code", "Bank Account No",
            "Solar Type", "Unit Rate", tariffHeaderName
        };
        for (int i = 0; i < headers.length; i++) {
            headerRow.createCell(i).setCellValue(headers[i]);
        }
        return sheet;
    }

    @Test
    public void testDetectTariffType_StandardTariffType() throws Exception {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = createMockSheetWithHeader(wb, "Tariff Type");
            Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, 0);
            assertTrue(colIndices.containsKey("tarifftype"), "Should detect 'Tariff Type'");
            assertEquals(10, colIndices.get("tarifftype"));
        }
    }

    @Test
    public void testDetectTariffType_TariffFixVariable() throws Exception {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = createMockSheetWithHeader(wb, "Tariff (Fix/Variable)");
            Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, 0);
            assertTrue(colIndices.containsKey("tarifftype"), "Should detect 'Tariff (Fix/Variable)'");
            assertEquals(10, colIndices.get("tarifftype"));
        }
    }

    @Test
    public void testDetectTariffType_TariffFixedVariable() throws Exception {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = createMockSheetWithHeader(wb, "Tariff (Fixed/Variable)");
            Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, 0);
            assertTrue(colIndices.containsKey("tarifftype"), "Should detect 'Tariff (Fixed/Variable)'");
            assertEquals(10, colIndices.get("tarifftype"));
        }
    }

    @Test
    public void testDetectTariffType_FixVariable() throws Exception {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = createMockSheetWithHeader(wb, "Fix/Variable");
            Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, 0);
            assertTrue(colIndices.containsKey("tarifftype"), "Should detect 'Fix/Variable'");
            assertEquals(10, colIndices.get("tarifftype"));
        }
    }

    @Test
    public void testDetectTariffType_TariffDashFixVariable() throws Exception {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = createMockSheetWithHeader(wb, "Tariff - Fix / Variable");
            Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, 0);
            assertTrue(colIndices.containsKey("tarifftype"), "Should detect 'Tariff - Fix / Variable'");
            assertEquals(10, colIndices.get("tarifftype"));
        }
    }

    @Test
    public void testDetectTariffType_PlainTariffWithUnitRate() throws Exception {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = createMockSheetWithHeader(wb, "Tariff");
            Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, 0);
            assertTrue(colIndices.containsKey("tarifftype"), "Should detect 'Tariff'");
            assertEquals(10, colIndices.get("tarifftype"));
            assertEquals(9, colIndices.get("unitcost"), "Unit Rate should remain mapped to unitcost");
        }
    }

    @Test
    public void testDetectTariffType_ContentBasedFallback() throws Exception {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("ContentTest");
            Row headerRow = sheet.createRow(0);
            String[] headers = {
                "Account No", "Customer Name", "Address", "Mobile No",
                "Panel Capacity", "Agreement Date", "Bank Code", "Bank Account No",
                "Solar Type", "Unit Rate", "RandomUnknownHeader"
            };
            for (int i = 0; i < headers.length; i++) {
                headerRow.createCell(i).setCellValue(headers[i]);
            }

            // Add 2 data rows with Fix and Variable values
            Row row1 = sheet.createRow(1);
            row1.createCell(0).setCellValue("1234567890");
            row1.createCell(10).setCellValue("Fix");

            Row row2 = sheet.createRow(2);
            row2.createCell(0).setCellValue("0987654321");
            row2.createCell(10).setCellValue("Variable");

            Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, 0);
            assertTrue(colIndices.containsKey("tarifftype"), "Should detect column 10 via content inspection");
            assertEquals(10, colIndices.get("tarifftype"));
        }
    }

    @Test
    public void testNormalizeTariffType() {
        assertEquals("Fix", ExcelValidationService.normalizeTariffType("FIX"));
        assertEquals("Fix", ExcelValidationService.normalizeTariffType("Fixed"));
        assertEquals("Fix", ExcelValidationService.normalizeTariffType("Fix"));
        assertEquals("Fix", ExcelValidationService.normalizeTariffType("L5001"));
        assertEquals("Fix", ExcelValidationService.normalizeTariffType("L5002"));
        assertEquals("Fix", ExcelValidationService.normalizeTariffType("L5005"));
        assertEquals("Variable", ExcelValidationService.normalizeTariffType("VAR"));
        assertEquals("Variable", ExcelValidationService.normalizeTariffType("Variable"));
        assertEquals("Variable", ExcelValidationService.normalizeTariffType("L5006"));
    }
}
