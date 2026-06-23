package com.ceb.billing.services;

import com.ceb.billing.entities.HeaderMapping;
import com.ceb.billing.entities.SheetConfiguration;
import com.ceb.billing.models.ExcelValidationError;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class PreviewService {

    @Autowired
    private ExcelValidationService excelValidationService;

    // Comprehensive alias map for all logical billing/customer fields
    private static final Map<String, List<String>> FIELD_ALIASES = new LinkedHashMap<>();

    static {
        FIELD_ALIASES.put("accountno",      Arrays.asList("accountno", "accountnumber", "account_no", "acc_no", "accno", "account", "acctno"));
        FIELD_ALIASES.put("customername",   Arrays.asList("customername", "name", "customer_name", "cust_name", "clientname", "consumername"));
        FIELD_ALIASES.put("customeraddress",Arrays.asList("customeraddress", "address", "customer_address", "cust_address", "addr"));
        FIELD_ALIASES.put("mobileno",       Arrays.asList("mobileno", "mobile", "phone", "contact", "mobile_no", "tel", "phoneno"));
        FIELD_ALIASES.put("refno",          Arrays.asList("refno", "ref_no", "referenceno", "referencenumber", "reference", "billno", "invoiceno", "refnum"));
        FIELD_ALIASES.put("fromdate",       Arrays.asList("fromdate", "from_date", "startdate", "start_date", "billingfrom", "datefrom", "period_from", "from"));
        FIELD_ALIASES.put("todate",         Arrays.asList("todate", "to_date", "enddate", "end_date", "billingto", "dateto", "period_to", "to"));
        FIELD_ALIASES.put("imports",        Arrays.asList("imports", "import", "importunits", "import_units", "consumption", "kwhin", "units_import", "importkwh", "importunit"));
        FIELD_ALIASES.put("exports",        Arrays.asList("exports", "export", "exportunits", "export_units", "kwhout", "units_export", "solar_export", "exportkwh", "exportunit"));
        FIELD_ALIASES.put("unitcost",       Arrays.asList("unitcost", "unit_cost", "rate", "cost", "tariff", "price_per_unit", "unitrate", "perunit"));
        FIELD_ALIASES.put("totalamount",    Arrays.asList("totalamount", "total_amount", "total", "amount", "bill_amount", "billamount", "netamount"));
        FIELD_ALIASES.put("billingmode",    Arrays.asList("billingmode", "billing_mode", "expcode", "exportcode", "mode", "type_billing"));
        FIELD_ALIASES.put("bankcode",       Arrays.asList("bankcode", "bank_code", "bank", "bankname"));
        FIELD_ALIASES.put("branchcode",     Arrays.asList("branchcode", "branch_code", "branch", "branchname"));
        FIELD_ALIASES.put("bankaccountno",  Arrays.asList("bankaccountno", "bankaccount", "bank_account_no", "bank_acc", "accountnumber_bank"));
        FIELD_ALIASES.put("agreementdate",  Arrays.asList("agreementdate", "agreement_date", "agreement", "contractdate", "installdate"));
        FIELD_ALIASES.put("panelcapacity",  Arrays.asList("panelcapacity", "panel_capacity", "capacity", "kw", "solarcapacity", "panel_kw"));
        FIELD_ALIASES.put("solartype",      Arrays.asList("solartype", "solar_type", "systemtype", "system_type", "nettype"));
    }

    // Minimum columns required to classify a sheet
    private static final List<String> BILLING_REQUIRED = Arrays.asList("accountno", "imports", "exports");
    private static final List<String> CUSTOMER_REQUIRED = Arrays.asList("accountno", "customername");

    /**
     * Generate a full preview of ALL sheets with ALL rows.
     * Sheets are never skipped — unrecognized sheets show their raw data.
     */
    public Map<String, Object> generatePreview(byte[] fileData,
                                               List<SheetConfiguration> sheetConfigs,
                                               Map<Long, List<HeaderMapping>> mappingsBySheetConfigId) throws Exception {
        Map<String, Object> preview = new HashMap<>();
        List<Map<String, Object>> sheetPreviews = new ArrayList<>();

        int totalRowsCount = 0;
        int errorCount = 0;
        int warningCount = 0;
        int duplicateCount = 0;

        Set<String> processedRecordsInUpload = new HashSet<>();

        try (InputStream is = new ByteArrayInputStream(fileData);
             Workbook workbook = WorkbookFactory.create(is)) {

            int numSheets = workbook.getNumberOfSheets();
            for (int sheetIdx = 0; sheetIdx < numSheets; sheetIdx++) {
                Sheet sheet = workbook.getSheetAt(sheetIdx);
                String sheetName = sheet.getSheetName();

                // Parse raw headers from row 0
                List<String> rawHeaders = new ArrayList<>();
                Row headerRow = sheet.getRow(0);
                if (headerRow != null) {
                    for (int col = 0; col < headerRow.getLastCellNum(); col++) {
                        Cell cell = headerRow.getCell(col);
                        String hdr = getCellValueAsString(cell);
                        rawHeaders.add(hdr != null ? hdr.trim() : "");
                    }
                }

                // Auto-detect logical column mapping
                Map<String, Integer> colIndices = autoDetectColumns(sheet);

                boolean hasBillingCols  = BILLING_REQUIRED.stream().allMatch(colIndices::containsKey);
                boolean hasCustomerCols = !hasBillingCols && CUSTOMER_REQUIRED.stream().allMatch(colIndices::containsKey);
                boolean canImport       = hasBillingCols || hasCustomerCols;
                String  detectedType    = hasBillingCols ? "BILLING"
                                        : hasCustomerCols ? "CUSTOMER_PROFILE"
                                        : "UNKNOWN";

                List<Map<String, Object>> allRows = new ArrayList<>();
                int sheetRowCount  = 0;
                int sheetErrors    = 0;
                int sheetWarnings  = 0;
                int sheetDuplicates = 0;

                int lastRowNum = sheet.getLastRowNum();
                for (int r = 1; r <= lastRowNum; r++) {
                    Row row = sheet.getRow(r);
                    if (row == null || isRowEmpty(row)) continue;

                    sheetRowCount++;
                    totalRowsCount++;

                    Map<String, Object> rowData = new LinkedHashMap<>();
                    rowData.put("rowNum", r + 1);

                    // Always capture raw values keyed by actual Excel column header
                    Map<String, String> rawValues = new LinkedHashMap<>();
                    if (headerRow != null) {
                        for (int col = 0; col < headerRow.getLastCellNum(); col++) {
                            Cell hdrCell  = headerRow.getCell(col);
                            String hdr    = getCellValueAsString(hdrCell);
                            Cell dataCell = row.getCell(col);
                            String val    = getCellValueAsString(dataCell);
                            if (hdr != null && !hdr.trim().isEmpty()) {
                                rawValues.put(hdr.trim(), val != null ? val : "");
                            }
                        }
                    }
                    rowData.put("rawValues", rawValues);

                    if (hasBillingCols) {
                        // ── Billing row: structured parse + validation ──
                        String accountNo    = getVal(row, colIndices.get("accountno"));
                        String customerName = getVal(row, colIndices.get("customername"));
                        String rawFromDate  = getDateVal(row, colIndices.get("fromdate"));
                        String rawToDate    = getDateVal(row, colIndices.get("todate"));
                        String rawImports   = getVal(row, colIndices.get("imports"));
                        String rawExports   = getVal(row, colIndices.get("exports"));
                        String rawUnitCost  = getVal(row, colIndices.get("unitcost"));
                        String bankCode     = getVal(row, colIndices.get("bankcode"));

                        LocalDate fromDate = parseDate(row, colIndices.get("fromdate"));
                        LocalDate toDate   = parseDate(row, colIndices.get("todate"));
                        Double imports  = parseDoubleStr(rawImports);
                        Double exports  = parseDoubleStr(rawExports);
                        Double unitCost = parseDoubleStr(rawUnitCost);

                        ExcelValidationService.RowValidationResult rowResult =
                                excelValidationService.validateRow(
                                        sheetName, r + 1,
                                        accountNo, customerName,
                                        rawFromDate, fromDate,
                                        rawToDate, toDate,
                                        rawImports, imports,
                                        rawExports, exports,
                                        rawUnitCost, unitCost,
                                        bankCode, processedRecordsInUpload);

                        // Track duplicates within this upload
                        if (fromDate != null && accountNo != null && !accountNo.isEmpty()) {
                            processedRecordsInUpload.add(accountNo + "|" + fromDate.getYear() + "|" + fromDate.getMonthValue());
                        }

                        String status = rowResult.hasErrors()    ? "INVALID"
                                      : rowResult.hasDuplicate() ? "DUPLICATE"
                                      : rowResult.hasWarnings()  ? "WARNING"
                                      : "VALID";

                        List<String> errMsgs = new ArrayList<>();
                        for (ExcelValidationError msg : rowResult.getValidationMessages()) {
                            errMsgs.add(msg.getErrorMessage());
                        }

                        rowData.put("accountNo",    accountNo    != null ? accountNo    : "");
                        rowData.put("customerName", customerName != null ? customerName : "");
                        rowData.put("fromDate",     rawFromDate  != null ? rawFromDate  : "");
                        rowData.put("toDate",       rawToDate    != null ? rawToDate    : "");
                        rowData.put("imports",      rawImports   != null ? rawImports   : "");
                        rowData.put("exports",      rawExports   != null ? rawExports   : "");
                        rowData.put("unitCost",     rawUnitCost  != null ? rawUnitCost  : "");
                        rowData.put("validationStatus", status);
                        rowData.put("errors", errMsgs);

                        if (rowResult.hasErrors())    { sheetErrors++;     errorCount++;     }
                        if (rowResult.hasWarnings())  { sheetWarnings++;   warningCount++;   }
                        if (rowResult.hasDuplicate()) { sheetDuplicates++; duplicateCount++; }

                    } else if (hasCustomerCols) {
                        // ── Customer profile row ──
                        String accountNo    = getVal(row, colIndices.get("accountno"));
                        String customerName = getVal(row, colIndices.get("customername"));
                        String status = (accountNo == null || accountNo.isEmpty()) ? "INVALID" : "VALID";
                        rowData.put("accountNo",    accountNo    != null ? accountNo    : "");
                        rowData.put("customerName", customerName != null ? customerName : "");
                        rowData.put("validationStatus", status);
                        rowData.put("errors", new ArrayList<>());
                        if ("INVALID".equals(status)) { sheetErrors++; errorCount++; }

                    } else {
                        // ── Unknown sheet — raw data only ──
                        rowData.put("validationStatus", "INFO");
                        rowData.put("errors", new ArrayList<>());
                    }

                    allRows.add(rowData);
                }

                Map<String, Object> sheetPrev = new LinkedHashMap<>();
                sheetPrev.put("sheetName",    sheetName);
                sheetPrev.put("detectedType", detectedType);
                sheetPrev.put("canImport",    canImport);
                sheetPrev.put("headers",      rawHeaders);
                sheetPrev.put("rowCount",     sheetRowCount);
                sheetPrev.put("errorCount",   sheetErrors);
                sheetPrev.put("warningCount", sheetWarnings);
                sheetPrev.put("duplicateCount", sheetDuplicates);
                sheetPrev.put("rows",         allRows);
                sheetPreviews.add(sheetPrev);
            }
        }

        preview.put("totalRows",     totalRowsCount);
        preview.put("errorCount",    errorCount);
        preview.put("warningCount",  warningCount);
        preview.put("duplicateCount", duplicateCount);
        preview.put("sheets",        sheetPreviews);
        return preview;
    }

    /**
     * Intelligently detect column indices from actual row-0 headers, regardless of order or naming.
     * Public so the controller can reuse it.
     */
    public Map<String, Integer> autoDetectColumns(Sheet sheet) {
        Map<String, Integer> colIndices = new HashMap<>();
        Row headerRow = sheet.getRow(0);
        if (headerRow == null) return colIndices;

        // Build clean map of actual headers
        Map<String, Integer> actualCleanMap = new LinkedHashMap<>();
        for (int col = 0; col < headerRow.getLastCellNum(); col++) {
            Cell cell = headerRow.getCell(col);
            String txt = getCellValueAsString(cell);
            if (txt != null && !txt.trim().isEmpty()) {
                String clean = txt.toLowerCase().replaceAll("[^a-z0-9]", "");
                actualCleanMap.put(clean, col);
            }
        }

        // Match each logical field to the actual column via alias list
        for (Map.Entry<String, List<String>> entry : FIELD_ALIASES.entrySet()) {
            String fieldName = entry.getKey();
            for (String alias : entry.getValue()) {
                String cleanAlias = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (actualCleanMap.containsKey(cleanAlias)) {
                    colIndices.put(fieldName, actualCleanMap.get(cleanAlias));
                    break;
                }
            }
            // Fallback: substring match
            if (!colIndices.containsKey(fieldName)) {
                for (Map.Entry<String, Integer> actual : actualCleanMap.entrySet()) {
                    if (isSubstringMatch(fieldName, actual.getKey())) {
                        colIndices.put(fieldName, actual.getValue());
                        break;
                    }
                }
            }
        }
        return colIndices;
    }

    private boolean isSubstringMatch(String fieldName, String cleanActual) {
        if (fieldName.length() >= 5 && cleanActual.contains(fieldName)) return true;
        if (cleanActual.length() >= 5 && fieldName.contains(cleanActual)) return true;
        return false;
    }

    private String getVal(Row row, Integer idx) {
        if (idx == null) return "";
        Cell cell = row.getCell(idx);
        return getCellValueAsString(cell);
    }

    private String getDateVal(Row row, Integer idx) {
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            Date d = cell.getDateCellValue();
            LocalDate ld = d.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
            return ld.toString();
        }
        return getCellValueAsString(cell);
    }

    private LocalDate parseDate(Row row, Integer idx) {
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            Date d = cell.getDateCellValue();
            return d.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        String str = getCellValueAsString(cell);
        if (str == null || str.trim().isEmpty()) return null;
        String trimmed = str.trim();
        String[] patterns = {"yyyy-MM-dd", "M/d/yyyy", "d/M/yyyy", "MM/dd/yyyy",
                             "dd/MM/yyyy", "dd-MM-yyyy", "MM-dd-yyyy", "yyyy/MM/dd"};
        for (String pattern : patterns) {
            try { return LocalDate.parse(trimmed, DateTimeFormatter.ofPattern(pattern)); }
            catch (Exception ignored) {}
        }
        return null;
    }

    private Double parseDoubleStr(String str) {
        if (str == null || str.trim().isEmpty()) return null;
        try { return Double.parseDouble(str.trim().replace(",", "")); }
        catch (Exception e) { return null; }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return null;
        switch (cell.getCellType()) {
            case STRING:
                String s = cell.getStringCellValue();
                return s == null ? null : s.trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    Date d = cell.getDateCellValue();
                    LocalDate ld = d.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                    return ld.toString();
                }
                double numVal = cell.getNumericCellValue();
                if (numVal == (long) numVal) return String.valueOf((long) numVal);
                return String.valueOf(numVal);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    String fs = cell.getStringCellValue();
                    return fs == null ? null : fs.trim();
                } catch (Exception e) {
                    try {
                        double fv = cell.getNumericCellValue();
                        if (fv == (long) fv) return String.valueOf((long) fv);
                        return String.valueOf(fv);
                    } catch (Exception ex) { return ""; }
                }
            default:
                return null;
        }
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String val = getCellValueAsString(cell);
                if (val != null && !val.trim().isEmpty()) return false;
            }
        }
        return true;
    }
}
