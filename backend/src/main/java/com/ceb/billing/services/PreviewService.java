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
        FIELD_ALIASES.put("fromdate",       Arrays.asList("fromdate", "from_date", "startdate", "start_date", "billingfrom", "datefrom", "period_from", "from", "billperiod", "period"));
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
    private static final List<String> BILLING_REQUIRED = Arrays.asList("accountno", "fromdate", "imports", "exports");
    private static final List<String> CUSTOMER_REQUIRED = Arrays.asList("accountno", "customername");

    // Keywords for detecting the header row index
    private static final Set<String> HEADER_KEYWORDS = new HashSet<>(Arrays.asList(
        "accountno", "accountnumber", "customername", "name", "customeraddress", "address",
        "mobileno", "mobile", "phone", "contact", "refno", "referenceno", "fromdate", "startdate", "todate", "enddate",
        "imports", "import", "importunits", "exports", "export", "exportunits", "unitcost", "rate", "totalamount",
        "total", "amount", "billingmode", "expcode", "exportcode", "mode", "bankcode", "branchcode", "bankaccountno",
        "bankaccount", "agreementdate", "panelcapacity", "capacity", "solartype", "nettype"
    ));

    /**
     * Find the header row index by scoring the first 15 rows of the sheet.
     */
    public int findHeaderRowIndex(Sheet sheet) {
        int bestRowIdx = 0;
        int maxScore = -1;
        int searchLimit = Math.max(0, Math.min(15, sheet.getLastRowNum()));
        for (int r = 0; r <= searchLimit; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            int matches = 0;
            int nonEmptyCount = 0;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                Cell cell = row.getCell(c);
                if (cell == null || cell.getCellType() == CellType.BLANK) continue;
                String txt = getCellValueAsString(cell);
                if (txt != null && !txt.trim().isEmpty()) {
                    nonEmptyCount++;
                    String clean = txt.toLowerCase().replaceAll("[^a-z0-9]", "");
                    if (HEADER_KEYWORDS.contains(clean)) {
                        matches++;
                    }
                }
            }
            int score = matches * 10 + nonEmptyCount;
            if (score > maxScore) {
                maxScore = score;
                bestRowIdx = r;
            }
        }
        return bestRowIdx;
    }

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

                // Detect the header row index
                int headerRowIdx = findHeaderRowIndex(sheet);

                // Build clean list of actual headers (index -> clean header) to allow duplicate headers
                List<String> colCleanHeaders = new ArrayList<>();
                Row headerRow = sheet.getRow(headerRowIdx);
                if (headerRow != null) {
                    for (int col = 0; col < headerRow.getLastCellNum(); col++) {
                        Cell cell = headerRow.getCell(col);
                        String txt = getCellValueAsString(cell);
                        if (txt != null && !txt.trim().isEmpty()) {
                            colCleanHeaders.add(txt.toLowerCase().replaceAll("[^a-z0-9]", ""));
                        } else {
                            colCleanHeaders.add("");
                        }
                    }
                }

                // Auto-detect logical column mapping using the detected header row
                Map<String, Integer> colIndices = autoDetectColumns(sheet, headerRowIdx);

                // Parse raw headers from the detected header row, assign friendly names to empty mapped columns, and ensure they are unique
                List<String> rawHeaders = new ArrayList<>();
                Map<String, Integer> headerCounts = new HashMap<>();
                if (headerRow != null) {
                    for (int col = 0; col < headerRow.getLastCellNum(); col++) {
                        Cell cell = headerRow.getCell(col);
                        String hdr = getCellValueAsString(cell);
                        String trimmedHdr = hdr != null ? hdr.trim() : "";
                        
                        if (trimmedHdr.isEmpty()) {
                            // If this empty column maps to a logical field, give it a friendly name
                            if (colIndices.containsValue(col)) {
                                for (Map.Entry<String, Integer> entry : colIndices.entrySet()) {
                                    if (entry.getValue() == col) {
                                        String field = entry.getKey();
                                        if ("todate".equals(field)) {
                                            trimmedHdr = "To Date";
                                        } else if ("fromdate".equals(field)) {
                                            trimmedHdr = "From Date";
                                        }
                                        break;
                                    }
                                }
                            }
                        }

                        if (!trimmedHdr.isEmpty()) {
                            int count = headerCounts.getOrDefault(trimmedHdr, 0) + 1;
                            headerCounts.put(trimmedHdr, count);
                            if (count > 1) {
                                // If it's a duplicate of "Account No", label the second one as "Account No: (Bank)"
                                if (trimmedHdr.toLowerCase().replaceAll("[^a-z0-9]", "").equals("accountno")) {
                                    trimmedHdr = trimmedHdr + " (Bank)";
                                } else {
                                    trimmedHdr = trimmedHdr + " (" + count + ")";
                                }
                            }
                        }
                        rawHeaders.add(trimmedHdr);
                    }
                }

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
                for (int r = headerRowIdx + 1; r <= lastRowNum; r++) {
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
                            String hdr    = rawHeaders.get(col);
                            Cell dataCell = row.getCell(col);
                            String val    = getCellValueAsString(dataCell);
                            if (hdr != null && !hdr.trim().isEmpty()) {
                                rawValues.put(hdr, val != null ? val : "");
                            }
                        }
                    }
                    rowData.put("rawValues", rawValues);

                    if (hasBillingCols) {
                        // ── Billing row: structured parse + validation ──
                        String accountNo    = getVal(row, colIndices.get("accountno"));
                        if (accountNo == null || accountNo.trim().isEmpty()) {
                            continue; // Skip summation / footer rows
                        }
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
                        if (accountNo == null || accountNo.trim().isEmpty()) {
                            continue; // Skip summation / footer rows
                        }
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
     * Intelligently detect column indices from actual headers, regardless of order or naming.
     * Public so the controller can reuse it.
     */
    public Map<String, Integer> autoDetectColumns(Sheet sheet) {
        int headerRowIdx = findHeaderRowIndex(sheet);
        return autoDetectColumns(sheet, headerRowIdx);
    }

    public Map<String, Integer> autoDetectColumns(Sheet sheet, int headerRowIdx) {
        Map<String, Integer> colIndices = new HashMap<>();
        Row headerRow = sheet.getRow(headerRowIdx);
        if (headerRow == null) return colIndices;

        // Build clean list of actual headers (index -> clean header) to allow duplicate headers
        List<String> colCleanHeaders = new ArrayList<>();
        for (int col = 0; col < headerRow.getLastCellNum(); col++) {
            Cell cell = headerRow.getCell(col);
            String txt = getCellValueAsString(cell);
            if (txt != null && !txt.trim().isEmpty()) {
                colCleanHeaders.add(txt.toLowerCase().replaceAll("[^a-z0-9]", ""));
            } else {
                colCleanHeaders.add("");
            }
        }

        // Handle duplicate accountno columns mapping (e.g. two columns with "Account No:")
        List<Integer> accountNoIndices = new ArrayList<>();
        List<String> accAliases = FIELD_ALIASES.get("accountno");
        for (int col = 0; col < colCleanHeaders.size(); col++) {
            String clean = colCleanHeaders.get(col);
            for (String alias : accAliases) {
                String cleanAlias = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (clean.equals(cleanAlias)) {
                    accountNoIndices.add(col);
                    break;
                }
            }
        }

        if (!accountNoIndices.isEmpty()) {
            colIndices.put("accountno", accountNoIndices.get(0));
            if (accountNoIndices.size() >= 2) {
                colIndices.put("bankaccountno", accountNoIndices.get(1));
            }
        }

        // Match each logical field to the actual column via alias list
        for (Map.Entry<String, List<String>> entry : FIELD_ALIASES.entrySet()) {
            String fieldName = entry.getKey();
            // Skip accountno, and only skip bankaccountno if it was already mapped by duplicate account number detection
            if ("accountno".equals(fieldName) || ("bankaccountno".equals(fieldName) && colIndices.containsKey("bankaccountno"))) {
                continue;
            }

            for (String alias : entry.getValue()) {
                String cleanAlias = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                int idx = colCleanHeaders.indexOf(cleanAlias);
                if (idx != -1) {
                    colIndices.put(fieldName, idx);
                    break;
                }
            }
            // Fallback: substring match
            if (!colIndices.containsKey(fieldName)) {
                for (int col = 0; col < colCleanHeaders.size(); col++) {
                    String clean = colCleanHeaders.get(col);
                    if (isSubstringMatch(fieldName, clean)) {
                        colIndices.put(fieldName, col);
                        break;
                    }
                }
            }
        }
        // Fallback for todate if fromdate is mapped but todate is not
        if (colIndices.containsKey("fromdate") && !colIndices.containsKey("todate")) {
            int fromIdx = colIndices.get("fromdate");
            if (fromIdx + 1 < colCleanHeaders.size()) {
                String nextClean = colCleanHeaders.get(fromIdx + 1);
                if (nextClean.isEmpty()) {
                    colIndices.put("todate", fromIdx + 1);
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
