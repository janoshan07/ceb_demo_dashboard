package com.ceb.billing;

import org.apache.poi.ss.usermodel.*;
import java.io.File;
import java.io.FileInputStream;

public class InspectXls {
    public static void main(String[] args) {
        String filePath = "C:\\Users\\janos\\OneDrive\\Desktop\\EDL\\EDL Records\\CEB Files\\CEB npay and ngen\\449\\34npay449.xls";
        try (FileInputStream fis = new FileInputStream(new File(filePath));
             Workbook wb = WorkbookFactory.create(fis)) {
            Sheet sheet = wb.getSheetAt(0);
            System.out.println("Total Rows: " + sheet.getPhysicalNumberOfRows());
            System.out.println("Last Row Num: " + sheet.getLastRowNum());
            java.util.Map<String, Integer> prefixes = new java.util.HashMap<>();
            for (int r = 16; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                Cell cell = row.getCell(0);
                if (cell == null) continue;
                String valStr = cell.toString();
                if (cell.getCellType() == CellType.NUMERIC) {
                    double d = cell.getNumericCellValue();
                    valStr = d == (long) d ? String.valueOf((long) d) : String.valueOf(d);
                }
                if (valStr.length() >= 4) {
                    String pref = valStr.substring(0, 4);
                    prefixes.put(pref, prefixes.getOrDefault(pref, 0) + 1);
                }
            }
            System.out.println("Prefix distribution:");
            for (java.util.Map.Entry<String, Integer> entry : prefixes.entrySet()) {
                System.out.println("  " + entry.getKey() + "*: " + entry.getValue());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
