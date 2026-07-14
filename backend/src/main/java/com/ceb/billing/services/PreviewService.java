package com.ceb.billing.services;

import com.ceb.billing.entities.HeaderMapping;
import com.ceb.billing.entities.SheetConfiguration;
import com.ceb.billing.models.ExcelValidationError;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
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

    @Autowired
    private com.ceb.billing.repositories.BillingRecordRepository billingRecordRepository;

    // Comprehensive alias map for all logical billing/customer fields
    public static final Map<String, List<String>> FIELD_ALIASES = new LinkedHashMap<>();

    static {
        FIELD_ALIASES.put("accountno",      Arrays.asList("accountno", "accountnumber", "account_no", "acc_no", "accno", "account", "acctno"));
        FIELD_ALIASES.put("customername",   Arrays.asList("customername", "name", "customer_name", "cust_name", "clientname", "consumername"));
        FIELD_ALIASES.put("customeraddress",Arrays.asList("customeraddress", "address", "customer_address", "cust_address", "addr"));
        FIELD_ALIASES.put("mobileno",       Arrays.asList("mobileno", "mobile", "phone", "contact", "mobile_no", "tel", "phoneno", "mobilenumber", "mobile_number", "mobnum"));
        FIELD_ALIASES.put("refno",          Arrays.asList("refno", "ref_no", "referenceno", "referencenumber", "reference", "billno", "invoiceno", "refnum"));
        FIELD_ALIASES.put("fromdate",       Arrays.asList("fromdate", "from_date", "startdate", "start_date", "billingfrom", "datefrom", "period_from", "from", "billperiod", "period"));
        FIELD_ALIASES.put("todate",         Arrays.asList("todate", "to_date", "enddate", "end_date", "billingto", "dateto", "period_to", "to"));
        FIELD_ALIASES.put("imports",        Arrays.asList("imports", "import", "importunits", "import_units", "consumption", "kwhin", "units_import", "importkwh", "importunit", "kwhimport"));
        FIELD_ALIASES.put("exports",        Arrays.asList("exports", "export", "exportunits", "export_units", "kwhout", "units_export", "solar_export", "exportkwh", "exportunit", "kwhexport"));
        FIELD_ALIASES.put("unitcost",       Arrays.asList("unitcost", "unit_cost", "rate", "cost", "tariff", "price_per_unit", "unitrate", "perunit", "unit_rate"));
        FIELD_ALIASES.put("totalamount",    Arrays.asList("totalamount", "total_amount", "total", "amount", "bill_amount", "billamount", "netamount", "kwhsalesamount", "salesamount"));
        FIELD_ALIASES.put("billingmode",    Arrays.asList("billingmode", "billing_mode", "expcode", "exportcode", "mode", "type_billing", "exp"));
        FIELD_ALIASES.put("tarifftype",     Arrays.asList("tarifftype", "tariff_type", "tariff", "fixedvariable", "fixed_variable", "fixed/variable", "fixvariable", "fix_variable", "fix/variable"));
        FIELD_ALIASES.put("costcode",       Arrays.asList("costcode", "cost_code", "costcode_id"));
        FIELD_ALIASES.put("bankcode",       Arrays.asList("bankcode", "bank_code", "bank", "bankname"));
        FIELD_ALIASES.put("branchcode",     Arrays.asList("branchcode", "branch_code", "branch", "branchname"));
        FIELD_ALIASES.put("bankaccountno",  Arrays.asList("bankaccountno", "bankaccount", "bank_account_no", "bank_acc", "accountnumber_bank"));
        FIELD_ALIASES.put("agreementdate",  Arrays.asList("agreementdate", "agreement_date", "agreement", "contractdate", "installdate"));
        FIELD_ALIASES.put("panelcapacity",  Arrays.asList("panelcapacity", "panel_capacity", "capacity", "kw", "solarcapacity", "panel_kw"));
        FIELD_ALIASES.put("solartype",      Arrays.asList("solartype", "solar_type", "systemtype", "system_type", "nettype", "type"));
        
        // Add Step 2/3 specific fields
        FIELD_ALIASES.put("prevreadingdate", Arrays.asList("prevreadingdate", "prev_reading_date", "prvrdgdate", "previousreadingdate", "previous_reading_date", "prv_rdg_date"));
        FIELD_ALIASES.put("currreadingdate", Arrays.asList("currreadingdate", "curr_reading_date", "crntrdgdate", "currentreadingdate", "current_reading_date", "crnt_rdg_date"));
        FIELD_ALIASES.put("billsetoff",      Arrays.asList("billsetoff", "bill_set_off", "setoff", "billoutstanding", "billoutstdsetoff", "billoutstd", "outstanding", "outstandingsetoff"));
        FIELD_ALIASES.put("paymentsettled",  Arrays.asList("paymentsettled", "payment_settled", "settled", "payment"));
        FIELD_ALIASES.put("kwhsales",        Arrays.asList("kwhsales", "sales", "salesunits", "kwhunits_sales"));
    }

    // Minimum columns required to classify a sheet
    private static final List<String> BILLING_REQUIRED = Arrays.asList("accountno", "fromdate", "imports", "exports");
    private static final List<String> CUSTOMER_REQUIRED = Arrays.asList("accountno", "customername");

    // Keywords for detecting the header row index
    private static final Set<String> HEADER_KEYWORDS = new HashSet<>(Arrays.asList(
        "accountno", "accountnumber", "account", "customername", "name", "customeraddress", "address",
        "mobileno", "mobile", "phone", "contact", "refno", "referenceno", "fromdate", "startdate", "todate", "enddate",
        "imports", "import", "importunits", "exports", "export", "exportunits", "unitcost", "rate", "totalamount",
        "total", "amount", "billingmode", "expcode", "exportcode", "mode", "bankcode", "branchcode", "bankaccountno",
        "bankaccount", "agreementdate", "panelcapacity", "capacity", "solartype", "nettype", "costcode", "cost_code",
        "tarifftype", "exp", "fixvariable", "unitrate", "ref", "kwh", "payment", "outstanding", "setoff", "settled",
        "sales", "tarif", "tariff", "billing", "index", "bi", "kwhsales", "billoutstd", "billoutstanding", 
        "paymentsettled", "fixed", "tax", "totalbill", "retn"
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
                boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && isSubHeaderRow(sheet, headerRowIdx + 1);

                // Auto-detect logical column mapping using the detected header row and sub-header row presence
                Map<String, Integer> colIndices = autoDetectColumns(sheet, headerRowIdx);

                // Parse raw headers from the detected header rows, merging parent + sub-headers if present
                List<String> rawHeaders = new ArrayList<>();
                Map<String, Integer> headerCounts = new HashMap<>();
                Row headerRow = sheet.getRow(headerRowIdx);
                int lastCellNum = headerRow != null ? headerRow.getLastCellNum() : 0;
                if (hasSubHeader) {
                    Row subRow = sheet.getRow(headerRowIdx + 1);
                    if (subRow != null && subRow.getLastCellNum() > lastCellNum) {
                        lastCellNum = subRow.getLastCellNum();
                    }
                }

                for (int col = 0; col < lastCellNum; col++) {
                    String h1 = getMergedCellValue(sheet, headerRowIdx, col).trim();
                    String h2 = hasSubHeader ? getMergedCellValue(sheet, headerRowIdx + 1, col).trim() : "";
                    String trimmedHdr = "";
                    if (!h1.isEmpty() && !h2.isEmpty()) {
                        if (h1.equalsIgnoreCase(h2)) {
                            trimmedHdr = h1;
                        } else {
                            trimmedHdr = h1 + " (" + h2 + ")";
                        }
                    } else if (!h1.isEmpty()) {
                        trimmedHdr = h1;
                    } else if (!h2.isEmpty()) {
                        trimmedHdr = h2;
                    }

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
                int dataStartRow = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
                for (int r = dataStartRow; r <= lastRowNum; r++) {
                    Row row = sheet.getRow(r);
                    if (row == null || isRowEmpty(row)) continue;

                    sheetRowCount++;
                    totalRowsCount++;

                    Map<String, Object> rowData = new LinkedHashMap<>();
                    rowData.put("rowNum", r + 1);

                    // Always capture raw values keyed by actual Excel column header
                    Map<String, String> rawValues = new LinkedHashMap<>();
                    for (int col = 0; col < lastCellNum; col++) {
                        String hdr    = rawHeaders.size() > col ? rawHeaders.get(col) : "";
                        Cell dataCell = row.getCell(col);
                        String val    = getCellValueAsString(dataCell);
                        if (hdr != null && !hdr.trim().isEmpty()) {
                            rawValues.put(hdr, val != null ? val : "");
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

                        String customerAddress = getVal(row, colIndices.get("customeraddress"));
                        String mobileNo        = getVal(row, colIndices.get("mobileno"));
                        String bankAccountNo   = getVal(row, colIndices.get("bankaccountno"));
                        String branchCode      = getVal(row, colIndices.get("branchcode"));
                        String agreementDate   = getDateVal(row, colIndices.get("agreementdate"));
                        String rawPanelCapacity = getVal(row, colIndices.get("panelcapacity"));
                        Double panelCapacity   = parseDoubleStr(rawPanelCapacity);
                        String solarType       = getVal(row, colIndices.get("solartype"));
                        String tariffType      = getVal(row, colIndices.get("tarifftype"));
                        String billingMode     = ExcelValidationService.deriveLCode(solarType, tariffType);

                        LocalDate fromDate = parseDate(row, colIndices.get("fromdate"));
                        LocalDate toDate   = parseDate(row, colIndices.get("todate"));
                        Double imports  = parseDoubleStr(rawImports);
                        Double exports  = parseDoubleStr(rawExports);
                        Double unitCost = parseDoubleStr(rawUnitCost);

                        ExcelValidationService.RowValidationResult rowResult =
                                excelValidationService.validateRow(
                                        sheetName, r + 1,
                                        detectedType,
                                        accountNo, customerName,
                                        rawFromDate, fromDate,
                                        rawToDate, toDate,
                                        rawImports, imports,
                                        rawExports, exports,
                                        rawUnitCost, unitCost,
                                        bankCode,
                                        customerAddress,
                                        mobileNo,
                                        bankAccountNo,
                                        branchCode,
                                        billingMode,
                                        agreementDate,
                                        panelCapacity,
                                        solarType,
                                        tariffType,
                                        processedRecordsInUpload);

                        // Track duplicates within this upload
                        if (fromDate != null && accountNo != null && !accountNo.isEmpty()) {
                            processedRecordsInUpload.add(accountNo + "|" + fromDate.getYear() + "|" + fromDate.getMonthValue());
                        }

                        String status = rowResult.hasDuplicate() ? "DUPLICATE"
                                      : rowResult.hasErrors()    ? "INVALID"
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
                        rowData.put("customerAddress", customerAddress != null ? customerAddress : "");
                        rowData.put("mobileNo",        mobileNo        != null ? mobileNo        : "");
                        rowData.put("bankCode",        bankCode        != null ? bankCode        : "");
                        rowData.put("branchCode",      branchCode      != null ? branchCode      : "");
                        rowData.put("bankAccountNo",   bankAccountNo   != null ? bankAccountNo   : "");
                        rowData.put("agreementDate",   agreementDate   != null ? agreementDate   : "");
                        rowData.put("panelCapacity",   panelCapacity   != null ? panelCapacity   : "");
                        rowData.put("solarType",       solarType       != null ? solarType       : "");
                        rowData.put("billingMode",     billingMode     != null ? billingMode     : "");
                        rowData.put("validationStatus", status);
                        rowData.put("errors", errMsgs);

                        if ("DUPLICATE".equals(status) && fromDate != null && accountNo != null && !accountNo.isEmpty()) {
                            List<com.ceb.billing.entities.BillingRecord> dbRecords =
                                    billingRecordRepository.findByCustomerAccountNoAndFromDateYearAndMonth(accountNo, fromDate.getYear(), fromDate.getMonthValue());
                            if (dbRecords != null && !dbRecords.isEmpty()) {
                                com.ceb.billing.entities.BillingRecord firstDb = dbRecords.get(0);
                                Map<String, Object> dbRecordMap = new HashMap<>();
                                dbRecordMap.put("customerName", firstDb.getCustomer() != null ? firstDb.getCustomer().getCustomerName() : "");
                                dbRecordMap.put("fromDate", firstDb.getFromDate() != null ? firstDb.getFromDate().toString() : "");
                                dbRecordMap.put("toDate", firstDb.getToDate() != null ? firstDb.getToDate().toString() : "");
                                dbRecordMap.put("imports", firstDb.getImportUnits());
                                dbRecordMap.put("exports", firstDb.getExportUnits());
                                dbRecordMap.put("unitCost", firstDb.getUnitCost());
                                rowData.put("dbRecord", dbRecordMap);
                            }
                        }

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

                        String customerAddress = getVal(row, colIndices.get("customeraddress"));
                        String mobileNo        = getVal(row, colIndices.get("mobileno"));
                        String bankCode        = getVal(row, colIndices.get("bankcode"));
                        String branchCode      = getVal(row, colIndices.get("branchcode"));
                        String bankAccountNo   = getVal(row, colIndices.get("bankaccountno"));
                        String agreementDate   = getDateVal(row, colIndices.get("agreementdate"));
                        String rawPanelCapacity = getVal(row, colIndices.get("panelcapacity"));
                        Double panelCapacity   = parseDoubleStr(rawPanelCapacity);
                        String solarType       = getVal(row, colIndices.get("solartype"));
                        String costCode        = getVal(row, colIndices.get("costcode"));
                        String refNo           = getVal(row, colIndices.get("refno"));
                        String rawUnitRate     = getVal(row, colIndices.get("unitcost"));
                        Double unitRate        = parseDoubleStr(rawUnitRate);
                        String tariffType      = getVal(row, colIndices.get("tarifftype"));
                        String billingMode     = ExcelValidationService.deriveLCode(solarType, tariffType);

                        ExcelValidationService.RowValidationResult rowResult =
                                excelValidationService.validateCustomerRow(
                                        sheetName, r + 1,
                                        accountNo,
                                        customerName,
                                        customerAddress,
                                        mobileNo,
                                        bankCode,
                                        branchCode,
                                        bankAccountNo,
                                        agreementDate,
                                        panelCapacity,
                                        solarType,
                                        costCode,
                                        billingMode,
                                        refNo,
                                        unitRate,
                                        tariffType);

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
                        rowData.put("customerAddress", customerAddress != null ? customerAddress : "");
                        rowData.put("mobileNo",        mobileNo        != null ? mobileNo        : "");
                        rowData.put("bankCode",        bankCode        != null ? bankCode        : "");
                        rowData.put("branchCode",      branchCode      != null ? branchCode      : "");
                        rowData.put("bankAccountNo",   bankAccountNo   != null ? bankAccountNo   : "");
                        rowData.put("agreementDate",   agreementDate   != null ? agreementDate   : "");
                        rowData.put("panelCapacity",   panelCapacity   != null ? panelCapacity   : "");
                        rowData.put("solarType",       solarType       != null ? solarType       : "");
                        rowData.put("costCode",        costCode        != null ? costCode        : "");
                        rowData.put("billingMode",     billingMode     != null ? billingMode     : "");
                        rowData.put("refNo",           refNo           != null ? refNo           : "");
                        rowData.put("unitRate",        unitRate        != null ? unitRate        : "");
                        rowData.put("tariffType",      tariffType      != null ? tariffType      : "");
                        rowData.put("validationStatus", status);
                        rowData.put("errors", errMsgs);

                        if (rowResult.hasErrors())    { sheetErrors++;     errorCount++;     }
                        if (rowResult.hasWarnings())  { sheetWarnings++;   warningCount++;   }

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

        boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && isSubHeaderRow(sheet, headerRowIdx + 1);
        int lastCellNum = headerRow.getLastCellNum();
        if (hasSubHeader) {
            Row subRow = sheet.getRow(headerRowIdx + 1);
            if (subRow != null && subRow.getLastCellNum() > lastCellNum) {
                lastCellNum = subRow.getLastCellNum();
            }
        }

        // Build clean list of actual headers (index -> clean header) to allow duplicate headers
        List<String> colCleanHeaders = new ArrayList<>();
        for (int col = 0; col < lastCellNum; col++) {
            String rawHdr = getColCleanHeader(sheet, headerRowIdx, hasSubHeader, col);
            colCleanHeaders.add(rawHdr != null ? rawHdr.toLowerCase().replaceAll("[^a-z0-9]", "") : "");
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

    public boolean isSubHeaderRow(Sheet sheet, int r) {
        Row row = sheet.getRow(r);
        if (row == null) return false;
        for (int c = 0; c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell == null) continue;
            String val = getCellValueAsString(cell);
            if (val != null && !val.trim().isEmpty()) {
                String clean = val.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (clean.equals("from") || clean.equals("to") || clean.equals("imports") || 
                    clean.equals("exports") || clean.equals("net") || clean.equals("e3131") ||
                    clean.equals("l5229") || clean.equals("l9001") ||
                    clean.equals("import") || clean.equals("export") || clean.equals("sales") ||
                    clean.equals("rate") || clean.equals("setoff") || clean.equals("settled")) {
                    return true;
                }
            }
        }
        return false;
    }

    public String getMergedCellValue(Sheet sheet, int rowNum, int columnNum) {
        int numMergedRegions = sheet.getNumMergedRegions();
        for (int i = 0; i < numMergedRegions; i++) {
            CellRangeAddress range = sheet.getMergedRegion(i);
            if (range.isInRange(rowNum, columnNum)) {
                Row firstRow = sheet.getRow(range.getFirstRow());
                if (firstRow != null) {
                    Cell firstCell = firstRow.getCell(range.getFirstColumn());
                    if (firstCell != null) {
                        String val = getCellValueAsString(firstCell);
                        return val != null ? val : "";
                    }
                }
            }
        }
        Row row = sheet.getRow(rowNum);
        if (row != null) {
            Cell cell = row.getCell(columnNum);
            if (cell != null) {
                String val = getCellValueAsString(cell);
                return val != null ? val : "";
            }
        }
        return "";
    }

    public String getColCleanHeader(Sheet sheet, int headerRowIdx, boolean hasSubHeader, int col) {
        String mainText = getMergedCellValue(sheet, headerRowIdx, col);
        if (mainText == null) mainText = "";
        String cleanMain = mainText.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (!hasSubHeader) {
            return cleanMain;
        }
        String subText = getMergedCellValue(sheet, headerRowIdx + 1, col);
        if (subText == null) subText = "";
        String cleanSub = subText.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (cleanSub.isEmpty()) {
            return cleanMain;
        }
        for (List<String> aliases : FIELD_ALIASES.values()) {
            for (String alias : aliases) {
                String cleanAlias = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (cleanSub.equals(cleanAlias)) {
                    return cleanSub;
                }
            }
        }
        if (cleanSub.equals("e3131") || cleanSub.equals("l5229") || cleanSub.equals("l9001")) {
            return cleanSub;
        }
        return cleanMain.isEmpty() ? cleanSub : cleanMain + "_" + cleanSub;
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
        String str = getCellValueAsString(cell);
        if (str == null || str.trim().isEmpty()) return null;
        String trimmed = str.trim();
        String[] patterns = {"yyyy-MM-dd", "M/d/yyyy", "d/M/yyyy", "MM/dd/yyyy", "dd/MM/yyyy",
                             "dd-MM-yyyy", "MM-dd-yyyy", "yyyy/MM/dd", "yyyy.MM.dd", "dd.MM.yyyy", "MM.dd.yyyy", "yyyy.M.d", "d.M.yyyy"};
        for (String pattern : patterns) {
            try {
                LocalDate ld = LocalDate.parse(trimmed, DateTimeFormatter.ofPattern(pattern));
                return ld.toString();
            } catch (Exception ignored) {}
        }
        return trimmed;
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
                             "dd/MM/yyyy", "dd-MM-yyyy", "MM-dd-yyyy", "yyyy/MM/dd", "yyyy.MM.dd", "dd.MM.yyyy", "MM.dd.yyyy", "yyyy.M.d", "d.M.yyyy"};
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
