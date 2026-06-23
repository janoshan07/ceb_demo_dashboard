package com.ceb.billing.services;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class WorkbookScannerService {

    public Map<String, Object> scanWorkbook(byte[] fileData) throws Exception {
        try (InputStream is = new ByteArrayInputStream(fileData);
             Workbook workbook = WorkbookFactory.create(is)) {
            
            int totalSheets = workbook.getNumberOfSheets();
            List<Map<String, Object>> sheetList = new ArrayList<>();
            
            for (int i = 0; i < totalSheets; i++) {
                Sheet sheet = workbook.getSheetAt(i);
                Map<String, Object> sInfo = new HashMap<>();
                sInfo.put("name", sheet.getSheetName());
                
                // POI physical number of rows counts all rows with data. 
                // We'll count up to getLastRowNum() + 1 to check total scanned height, but ignore blank rows.
                int totalRows = 0;
                int lastRowNum = sheet.getLastRowNum();
                for (int r = 0; r <= lastRowNum; r++) {
                    if (sheet.getRow(r) != null && !isRowEmpty(sheet.getRow(r))) {
                        totalRows++;
                    }
                }
                
                sInfo.put("rowCount", totalRows);
                sheetList.add(sInfo);
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("totalSheets", totalSheets);
            result.put("sheets", sheetList);
            return result;
        }
    }

    private boolean isRowEmpty(org.apache.poi.ss.usermodel.Row row) {
        if (row == null) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            org.apache.poi.ss.usermodel.Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != org.apache.poi.ss.usermodel.CellType.BLANK) {
                return false;
            }
        }
        return true;
    }
}
