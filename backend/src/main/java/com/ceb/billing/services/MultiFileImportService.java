package com.ceb.billing.services;

import com.ceb.billing.entities.*;
import com.ceb.billing.repositories.*;
import com.ceb.billing.models.ExcelValidationError;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Orchestrates the 3-step Excel import workflow using the robust auto-detection
 * engine of PreviewService.java:
 *   Step 1 — Master Data (customer profiles)
 *   Step 2 — CEB Assist  (previous / current reading dates)
 *   Step 3 — NGEN        (kWh import/export, calculations, set-off)
 */
@Service
@SuppressWarnings({"null", "unused"})
public class MultiFileImportService {

    @Autowired private ImportSessionRepository sessionRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private BillingRecordRepository billingRecordRepository;
    @Autowired private CostCodeRepository costCodeRepository;
    @Autowired private NetTypeRepository netTypeRepository;
    @Autowired private ExpenseCodeRepository expenseCodeRepository;
    @Autowired private AuditLogService auditLogService;
    @Autowired private PreviewService previewService;
    @Autowired private ExcelValidationService excelValidationService;
    @Autowired private UploadHistoryRepository uploadHistoryRepository;
    @Autowired private BillingUploadStagingRepository billingUploadStagingRepository;
    // unused repository
    @Autowired private StagingChangeLogRepository stagingChangeLogRepository;

    // ════════════════════════════════════════════════════════════════════
    //  STEP 1 — MASTER DATA
    // ════════════════════════════════════════════════════════════════════

    public Map<String, Object> previewMasterData(byte[] fileBytes, String filename) throws Exception {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> globalErrors = new ArrayList<>();
        int errorCount = 0;

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> colMap = previewService.autoDetectColumns(sheet, headerRowIdx);

            List<String> missingCols = new ArrayList<>();
            for (String required : Arrays.asList("accountno", "customername", "customeraddress",
                    "mobileno", "panelcapacity", "agreementdate", "bankcode", "bankaccountno",
                    "solartype", "unitcost", "tarifftype")) {
                if (!colMap.containsKey(required)) missingCols.add(required);
            }
            if (!missingCols.isEmpty()) {
                globalErrors.add("Missing required columns: " + missingCols);
            }

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    Map<String, Object> rowData = new LinkedHashMap<>();
                    rowData.put("rowNum", r + 1);
                    rowData.put("accountNo",       strVal(row, colMap.get("accountno")));
                    rowData.put("customerName",    strVal(row, colMap.get("customername")));
                    rowData.put("customerAddress", strVal(row, colMap.get("customeraddress")));
                    rowData.put("refNo",           strVal(row, colMap.get("refno")));
                    rowData.put("costCode",        strVal(row, colMap.get("costcode")));
                    rowData.put("mobileNo",        strVal(row, colMap.get("mobileno")));
                    rowData.put("panelCapacity",   numVal(row, colMap.get("panelcapacity")));
                    rowData.put("agreementDate",   dateStr(row, colMap.get("agreementdate")));
                    rowData.put("bankCode",        strVal(row, colMap.get("bankcode")));
                    rowData.put("branchCode",      strVal(row, colMap.get("branchcode")));
                    rowData.put("bankAccountNo",   strVal(row, colMap.get("bankaccountno")));
                    String solarType = ExcelValidationService.normalizeSolarType(strVal(row, colMap.get("solartype")));
                    String tariffType = strVal(row, colMap.get("tarifftype"));
                    String billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);
                    rowData.put("solarType",       solarType);
                    rowData.put("unitRate",        numVal(row, colMap.get("unitcost"))); // maps unitrate/unitcost
                    rowData.put("tariffType",      tariffType);
                    rowData.put("billingMode",     billingMode);

                    List<String> rowErrors = validateMasterDataRow(rowData);
                    rowData.put("errors", rowErrors);
                    rowData.put("status", rowErrors.isEmpty() ? "VALID" : "ERROR");
                    rows.add(rowData);
                } catch (Exception rowEx) {
                    // Single row failure must not crash the entire preview
                    Map<String, Object> errorRow = new LinkedHashMap<>();
                    errorRow.put("rowNum", r + 1);
                    errorRow.put("accountNo", strVal(row, colMap.get("accountno")));
                    errorRow.put("errors", List.of("Row processing failed: " + rowEx.getMessage()));
                    errorRow.put("status", "ERROR");
                    rows.add(errorRow);
                }
            }
        }

        // Run duplicate detection
        detectDuplicates(rows, "Master Data");

        errorCount = 0;
        int warningCount = 0;
        int duplicateCount = 0;
        int validCount = 0;
        for (Map<String, Object> r : rows) {
            String status = (String) r.get("status");
            if ("ERROR".equals(status)) {
                errorCount++;
            } else if ("WARNING".equals(status)) {
                warningCount++;
            } else if ("DUPLICATE".equals(status)) {
                duplicateCount++;
            } else if ("VALID".equals(status)) {
                validCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filename", filename);
        result.put("fileType", "MASTER_DATA");
        result.put("totalRows", rows.size());
        result.put("validCount", validCount);
        result.put("warningCount", warningCount);
        result.put("duplicateCount", duplicateCount);
        result.put("errorCount", errorCount);
        result.put("rows", rows);
        result.put("globalErrors", globalErrors);
        return result;
    }

    @Transactional
    public Map<String, Object> approveMasterData(byte[] fileBytes, String filename, String username,
                                                  Map<String, Map<String, Object>> corrections) throws Exception {
        List<Map<String, Object>> cachedRows = new ArrayList<>();
        int skippedRows = 0;

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> colMap = previewService.autoDetectColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                String accountNo = strVal(row, colMap.get("accountno"));
                String rowNumStr = String.valueOf(r + 1);

                // Corrections overlay by row number (primary) or accountNo (fallback for non-empty accounts)
                Map<String, Object> corr = null;
                if (corrections != null) {
                    if (corrections.containsKey(rowNumStr)) {
                        corr = corrections.get(rowNumStr);
                    } else if (accountNo != null && !accountNo.trim().isEmpty() && corrections.containsKey(accountNo.trim())) {
                        corr = corrections.get(accountNo.trim());
                    }
                }

                // Apply corrections overlay before any skip/delete decisions
                if (corr != null) {
                    if (corr.containsKey("accountNo")) accountNo = (String) corr.get("accountNo");
                }

                // Skip rows that are permanently deleted by the user
                if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                    String displayAcct = (accountNo != null && !accountNo.trim().isEmpty()) ? accountNo.trim() : "[empty]";
                    auditLogService.log("EXCEL_ROW_DELETED", String.format("Master Data Row %d (Account %s) excluded from batch during import.", r + 1, displayAcct));
                    skippedRows++;
                    continue;
                }

                // Skip rows where Account No is still empty/blank after corrections
                if (accountNo == null || accountNo.trim().isEmpty()) { skippedRows++; continue; }
                accountNo = accountNo.trim();

                String customerName    = strVal(row, colMap.get("customername"));
                String customerAddress = strVal(row, colMap.get("customeraddress"));
                String refNo           = strVal(row, colMap.get("refno"));
                String costCode        = strVal(row, colMap.get("costcode"));
                String mobileNo        = strVal(row, colMap.get("mobileno"));
                Double panelCapacity   = numVal(row, colMap.get("panelcapacity"));
                String agreementDate   = dateStr(row, colMap.get("agreementdate"));
                String bankCode        = strVal(row, colMap.get("bankcode"));
                String branchCode      = strVal(row, colMap.get("branchcode"));
                String bankAccountNo   = strVal(row, colMap.get("bankaccountno"));
                String solarType       = ExcelValidationService.normalizeSolarType(strVal(row, colMap.get("solartype")));
                Double unitRate        = numVal(row, colMap.get("unitcost"));
                String tariffType      = strVal(row, colMap.get("tarifftype"));
                String billingMode     = ExcelValidationService.deriveLCode(solarType, tariffType);

                // Apply remaining corrections (non-accountNo fields)
                if (corr != null) {
                    if (corr.containsKey("customerName"))    customerName    = (String) corr.get("customerName");
                    if (corr.containsKey("customerAddress")) customerAddress = (String) corr.get("customerAddress");
                    if (corr.containsKey("refNo"))           refNo           = (String) corr.get("refNo");
                    if (corr.containsKey("mobileNo"))        mobileNo        = (String) corr.get("mobileNo");
                    if (corr.containsKey("panelCapacity")) {
                        panelCapacity = parseDouble(corr.get("panelCapacity"));
                    }
                    if (corr.containsKey("agreementDate"))   agreementDate   = (String) corr.get("agreementDate");
                    if (corr.containsKey("bankCode"))        bankCode        = (String) corr.get("bankCode");
                    if (corr.containsKey("branchCode"))      branchCode      = (String) corr.get("branchCode");
                    if (corr.containsKey("bankAccountNo"))   bankAccountNo   = (String) corr.get("bankAccountNo");
                    if (corr.containsKey("solarType"))       solarType       = ExcelValidationService.normalizeSolarType((String) corr.get("solarType"));
                    if (corr.containsKey("unitRate")) {
                        unitRate = parseDouble(corr.get("unitRate"));
                    }
                    if (corr.containsKey("tariffType"))      tariffType      = (String) corr.get("tariffType");
                    if (corr.containsKey("costCode"))        costCode        = (String) corr.get("costCode");
                }


                billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);

                Map<String, Object> cachedRow = new LinkedHashMap<>();
                cachedRow.put("accountNo", accountNo);
                cachedRow.put("customerName", customerName);
                cachedRow.put("customerAddress", customerAddress);
                cachedRow.put("refNo", refNo);
                cachedRow.put("costCode", costCode);
                cachedRow.put("mobileNo", mobileNo);
                cachedRow.put("panelCapacity", panelCapacity);
                cachedRow.put("agreementDate", agreementDate);
                cachedRow.put("bankCode", bankCode);
                cachedRow.put("branchCode", branchCode);
                cachedRow.put("bankAccountNo", bankAccountNo);
                cachedRow.put("solarType", solarType);
                cachedRow.put("unitRate", unitRate);
                cachedRow.put("tariffType", tariffType);
                cachedRow.put("billingMode", billingMode);
                cachedRow.put("rowNum", r + 1);

                // Store validation status so unresolved records are tracked as Pending
                List<String> rowErrors = validateMasterDataRow(cachedRow);
                if (rowErrors.isEmpty()) {
                    cachedRow.put("validationStatus", "VALID");
                    cachedRow.put("validationErrors", "");
                } else {
                    cachedRow.put("validationStatus", "PENDING");
                    cachedRow.put("validationErrors", String.join("; ", rowErrors));
                }

                cachedRows.add(cachedRow);
            }
        }

        // Count pending records for audit and response
        int pendingCount = 0;
        for (Map<String, Object> row : cachedRows) {
            if ("PENDING".equals(row.get("validationStatus"))) {
                pendingCount++;
            }
        }

        ImportSession session = findOrCreateSession(username);
        saveMasterDataToStaging(session.getId(), cachedRows);

        session.setStage("MASTER_APPROVED");
        session.setMasterCustomerCount(cachedRows.size());
        sessionRepository.save(session);

        auditLogService.log("MASTER_DATA_APPROVED",
                String.format("Master Data staged by %s for session %d. Customers: %d, Pending: %d, Skipped: %d",
                        username, session.getId(), cachedRows.size(), pendingCount, skippedRows));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", session.getId());
        result.put("stage", session.getStage());
        result.put("newCustomers", cachedRows.size());
        result.put("updatedCustomers", 0);
        result.put("skippedRows", skippedRows);
        result.put("pendingCount", pendingCount);
        result.put("totalImported", cachedRows.size());
        result.put("message", String.format("Master Data staged successfully. %d customers cached (%d pending).", cachedRows.size(), pendingCount));
        return result;
    }

    // ════════════════════════════════════════════════════════════════════
    //  STEP 2 — CEB ASSIST
    // ════════════════════════════════════════════════════════════════════

    public Map<String, Object> previewCebAssist(byte[] fileBytes, String filename, Long sessionId) throws Exception {
        List<Map<String, Object>> rows = new ArrayList<>();

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> colMap = previewService.autoDetectColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                String accountNo      = strVal(row, colMap.get("accountno"));
                String customerName   = colMap.containsKey("customername") && colMap.get("customername") != null ? strVal(row, colMap.get("customername")) : null;
                String prevDate       = dateStr(row, colMap.get("prevreadingdate"));
                String currDate       = dateStr(row, colMap.get("currreadingdate"));

                String cleanAcc = accountNo != null ? accountNo.trim() : "";

                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", cleanAcc);
                rowData.put("customerName", customerName != null ? customerName : "");
                rowData.put("prevReadingDate", prevDate != null ? prevDate : "");
                rowData.put("currReadingDate", currDate != null ? currDate : "");

                List<String> errors = new ArrayList<>();
                List<String> warnings = new ArrayList<>();

                if (cleanAcc.isEmpty()) {
                    errors.add("Account No is missing");
                } else if (!cleanAcc.matches("\\d+")) {
                    errors.add("Invalid Account Number: Only numeric values are allowed.");
                } else if (cleanAcc.length() != 10) {
                    errors.add("Account number must be a valid 10-digit numeric string");
                }

                if (customerName == null || customerName.trim().isEmpty()) {
                    errors.add("Customer Name is missing or empty");
                }
                if (prevDate == null || prevDate.isEmpty()) {
                    errors.add("Previous Reading Date is missing or empty");
                }
                if (currDate == null || currDate.isEmpty()) {
                    errors.add("Current Reading Date is missing or empty");
                }

                rowData.put("errors", errors);
                rowData.put("warnings", warnings);
                rowData.put("status", errors.isEmpty() ? "VALID" : "ERROR");
                rows.add(rowData);
            }
        }

        // Run duplicate detection
        detectDuplicates(rows, "CEB Assist");

        int errorCount = 0;
        int warningCount = 0;
        int duplicateCount = 0;
        int validCount = 0;
        for (Map<String, Object> r : rows) {
            String status = (String) r.get("status");
            if ("ERROR".equals(status)) {
                errorCount++;
            } else if ("WARNING".equals(status)) {
                warningCount++;
            } else if ("DUPLICATE".equals(status)) {
                duplicateCount++;
            } else if ("VALID".equals(status)) {
                validCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filename", filename);
        result.put("fileType", "CEB_ASSIST");
        result.put("totalRows", rows.size());
        result.put("validCount", validCount);
        result.put("warningCount", warningCount);
        result.put("duplicateCount", duplicateCount);
        result.put("errorCount", errorCount);
        result.put("rows", rows);
        return result;
    }

    @Transactional
    public Map<String, Object> approveCebAssist(byte[] fileBytes, String username, Long sessionId,
                                                 Map<String, Map<String, Object>> corrections) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));
        if ("PENDING_MASTER".equals(session.getStage())) {
            throw new IllegalStateException("Master Data must be approved first. Current stage: " + session.getStage());
        }

        List<Map<String, Object>> processedRows = new ArrayList<>();
        int skippedCount = 0;

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> colMap = previewService.autoDetectColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                String accountNo      = strVal(row, colMap.get("accountno"));
                String customerName   = colMap.containsKey("customername") && colMap.get("customername") != null ? strVal(row, colMap.get("customername")) : null;
                String prevDate       = dateStr(row, colMap.get("prevreadingdate"));
                String currDate       = dateStr(row, colMap.get("currreadingdate"));

                String rowNumStr = String.valueOf(r + 1);
                Map<String, Object> corr = null;
                if (corrections != null) {
                    if (corrections.containsKey(rowNumStr)) {
                        corr = corrections.get(rowNumStr);
                    } else if (accountNo != null && corrections.containsKey(accountNo.trim())) {
                        corr = corrections.get(accountNo.trim());
                    }
                }

                if (corr != null) {
                    if (corr.containsKey("accountNo"))        accountNo = (String) corr.get("accountNo");
                    if (corr.containsKey("customerName"))     customerName = (String) corr.get("customerName");
                    if (corr.containsKey("prevReadingDate"))  prevDate  = (String) corr.get("prevReadingDate");
                    if (corr.containsKey("currReadingDate"))  currDate  = (String) corr.get("currReadingDate");
                }

                if (accountNo == null || accountNo.trim().isEmpty() || !accountNo.trim().matches("\\d+") || accountNo.trim().length() != 10) {
                    skippedCount++;
                    continue;
                }
                accountNo = accountNo.trim();

                if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                    auditLogService.log("EXCEL_ROW_DELETED", String.format("CEB Assist Row %d (Account %s) excluded from batch during import.", r + 1, accountNo));
                    skippedCount++;
                    continue;
                }

                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", accountNo);
                rowData.put("customerName", customerName != null ? customerName : "");
                rowData.put("prevReadingDate", prevDate != null ? prevDate : "");
                rowData.put("currReadingDate", currDate != null ? currDate : "");

                processedRows.add(rowData);
            }
        }

        saveCebDataToStaging(sessionId, processedRows);

        session.setCebApproved(true);
        session.setCebAssistCount(processedRows.size());
        updateSessionStage(session);
        sessionRepository.save(session);

        if (session.allFilesApproved()) {
            generateMainDataset(sessionId);
        }

        auditLogService.log("CEB_ASSIST_APPROVED",
                String.format("CEB Assist approved by %s for session %d. Records cached: %d, Skipped: %d",
                        username, sessionId, processedRows.size(), skippedCount));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", session.getStage());
        result.put("cebAssistCount", processedRows.size());
        result.put("allFilesApproved", session.allFilesApproved());
        result.put("message", String.format("CEB Assist data cached successfully. %d records cached.", processedRows.size()));
        return result;
    }

    // ════════════════════════════════════════════════════════════════════
    //  STEP 3 — NGEN
    // ════════════════════════════════════════════════════════════════════

    /**
     * NGEN-specific column aliases (logical field -> accepted header variants).
     * Aliases are compared after normalization (lowercase, punctuation/space stripped),
     * so "Retention Money", "Retn Money", "RETENTION_MONEY" all resolve to retentionMoney.
     * This is intentionally isolated from the shared PreviewService.FIELD_ALIASES so that
     * improving NGEN header detection does not affect any other import step.
     */
    private static final LinkedHashMap<String, List<String>> NGEN_COLUMN_ALIASES = new LinkedHashMap<>();
    static {
        NGEN_COLUMN_ALIASES.put("accountNo", Arrays.asList(
                "accountno", "accountnumber", "acctno", "accno", "account", "acc"));
        NGEN_COLUMN_ALIASES.put("ngenNetType", Arrays.asList(
                "nettype", "solartype", "systemtype", "ngennettype", "net", "type"));
        NGEN_COLUMN_ALIASES.put("kwhImport", Arrays.asList(
                "kwhimport", "importkwh", "kwhin", "imports", "import", "importunits", "importunit"));
        NGEN_COLUMN_ALIASES.put("kwhExport", Arrays.asList(
                "kwhexport", "exportkwh", "kwhout", "exports", "export", "exportunits", "exportunit"));
        NGEN_COLUMN_ALIASES.put("kwhUnitSales", Arrays.asList(
                "kwhunitsales", "kwhunitssales", "kwhsalesunits", "unitsales", "kwhsales", "salesunits", "netunits", "sales"));
        NGEN_COLUMN_ALIASES.put("ngenUnitRate", Arrays.asList(
                "unitrate", "unitcost", "perunit", "tariff", "rate", "price"));
        NGEN_COLUMN_ALIASES.put("retentionMoney", Arrays.asList(
                "retentionmoney", "retnmoney", "retmoney", "retention", "retn"));
        NGEN_COLUMN_ALIASES.put("kwhSalesAmount", Arrays.asList(
                "kwhsalesamount", "salesamount", "totalamount", "netamount", "billamount", "amount", "total"));
        NGEN_COLUMN_ALIASES.put("billSetOff", Arrays.asList(
                "billoutstandingsetoff", "billoutstdsetoff", "billoutsetoff", "billsetoff", "billoutstanding",
                "billoutstd", "outstandingsetoff", "setoff", "outstanding"));
        NGEN_COLUMN_ALIASES.put("paymentSettled", Arrays.asList(
                "paymentsettled", "paymentsettle", "paymentsettlement", "pmtsettled", "payment", "settled"));
        NGEN_COLUMN_ALIASES.put("outstandingBalance", Arrays.asList(
                "outstandingbalance", "outstandingbal", "outstbalance", "closingbalance", "outbalance",
                "obalance", "obal", "balance"));
    }

    /**
     * Detect NGEN columns using flexible header normalization + abbreviation aliases.
     * Normalization ignores case, spaces and punctuation ('.', '-', '_', etc.).
     * Pass 1 resolves exact normalized matches; Pass 2 falls back to substring matches
     * for any fields still unmapped. A column is never assigned to more than one field.
     */
    private Map<String, Integer> detectNgenColumns(Sheet sheet, int headerRowIdx) {
        Map<String, Integer> result = new HashMap<>();
        Row headerRow = sheet.getRow(headerRowIdx);
        if (headerRow == null) return result;

        boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum()
                && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
        int lastCellNum = headerRow.getLastCellNum();
        if (hasSubHeader) {
            Row subRow = sheet.getRow(headerRowIdx + 1);
            if (subRow != null && subRow.getLastCellNum() > lastCellNum) {
                lastCellNum = subRow.getLastCellNum();
            }
        }

        List<String> cleanHeaders = new ArrayList<>();
        for (int col = 0; col < lastCellNum; col++) {
            String raw = previewService.getColCleanHeader(sheet, headerRowIdx, hasSubHeader, col);
            cleanHeaders.add(raw != null ? raw.toLowerCase().replaceAll("[^a-z0-9]", "") : "");
        }

        Set<Integer> used = new HashSet<>();

        // Pass 1 — exact normalized match
        for (Map.Entry<String, List<String>> entry : NGEN_COLUMN_ALIASES.entrySet()) {
            for (String alias : entry.getValue()) {
                String a = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (a.isEmpty()) continue;
                for (int col = 0; col < cleanHeaders.size(); col++) {
                    if (used.contains(col)) continue;
                    if (cleanHeaders.get(col).equals(a)) {
                        result.put(entry.getKey(), col);
                        used.add(col);
                        break;
                    }
                }
                if (result.containsKey(entry.getKey())) break;
            }
        }

        // Pass 2 — substring fallback for still-unmapped fields
        for (Map.Entry<String, List<String>> entry : NGEN_COLUMN_ALIASES.entrySet()) {
            if (result.containsKey(entry.getKey())) continue;
            for (String alias : entry.getValue()) {
                String a = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (a.isEmpty()) continue;
                for (int col = 0; col < cleanHeaders.size(); col++) {
                    if (used.contains(col)) continue;
                    String h = cleanHeaders.get(col);
                    if (!h.isEmpty() && h.contains(a)) {
                        result.put(entry.getKey(), col);
                        used.add(col);
                        break;
                    }
                }
                if (result.containsKey(entry.getKey())) break;
            }
        }

        return result;
    }

    public Map<String, Object> previewNgen(byte[] fileBytes, String filename, Long sessionId) throws Exception {
        List<Map<String, Object>> rows = new ArrayList<>();

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> ngenCols = detectNgenColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                // Read values directly from the uploaded Excel file — no calculations.
                String accountNo          = strVal(row, ngenCols.get("accountNo"));
                String ngenNetType        = strVal(row, ngenCols.get("ngenNetType"));
                Double kwhImport          = numVal(row, ngenCols.get("kwhImport"));
                Double kwhExport          = numVal(row, ngenCols.get("kwhExport"));
                Double kwhUnitSales       = numVal(row, ngenCols.get("kwhUnitSales"));
                Double ngenUnitRate       = numVal(row, ngenCols.get("ngenUnitRate"));
                Double retentionMoney     = numVal(row, ngenCols.get("retentionMoney"));
                Double billSetOff         = numVal(row, ngenCols.get("billSetOff"));
                Double kwhSalesAmount     = numVal(row, ngenCols.get("kwhSalesAmount"));
                Double paymentSettled     = numVal(row, ngenCols.get("paymentSettled"));
                Double outstandingBalance = numVal(row, ngenCols.get("outstandingBalance"));

                String cleanAcc = accountNo != null ? accountNo.trim() : "";

                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", cleanAcc);
                rowData.put("ngenNetType", ngenNetType != null ? ngenNetType : "");
                rowData.put("kwhImport", kwhImport);
                rowData.put("kwhExport", kwhExport);
                rowData.put("kwhUnitSales", kwhUnitSales);
                rowData.put("ngenUnitRate", ngenUnitRate);
                rowData.put("retentionMoney", retentionMoney);
                rowData.put("billSetOff", billSetOff);
                rowData.put("kwhSalesAmount", kwhSalesAmount);
                rowData.put("paymentSettled", paymentSettled);
                rowData.put("outstandingBalance", outstandingBalance);

                List<String> errors = new ArrayList<>();
                List<String> warnings = new ArrayList<>();

                if (cleanAcc.isEmpty()) {
                    errors.add("Account No is missing");
                } else if (!cleanAcc.matches("\\d+")) {
                    errors.add("Invalid Account Number: Only numeric values are allowed.");
                } else if (cleanAcc.length() != 10) {
                    errors.add("Account number must be a valid 10-digit numeric string");
                }

                if (ngenNetType == null || ngenNetType.trim().isEmpty()) {
                    errors.add("Net Type is missing");
                }
                if (kwhImport == null) errors.add("kWh Import is missing or invalid");
                if (kwhExport == null) errors.add("kWh Export is missing or invalid");
                if (ngenUnitRate == null) errors.add("Unit Rate is missing or invalid");
                if (billSetOff == null) errors.add("Bill OutStd Set Off is missing or invalid");
                if (retentionMoney == null) errors.add("Retention Money is missing or invalid");

                rowData.put("errors", errors);
                rowData.put("warnings", warnings);
                rowData.put("status", errors.isEmpty() ? "VALID" : "ERROR");
                rows.add(rowData);
            }
        }

        // Run duplicate detection
        detectDuplicates(rows, "NGEN");

        int errorCount = 0;
        int warningCount = 0;
        int duplicateCount = 0;
        int validCount = 0;
        for (Map<String, Object> r : rows) {
            String status = (String) r.get("status");
            if ("ERROR".equals(status)) {
                errorCount++;
            } else if ("WARNING".equals(status)) {
                warningCount++;
            } else if ("DUPLICATE".equals(status)) {
                duplicateCount++;
            } else if ("VALID".equals(status)) {
                validCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filename", filename);
        result.put("fileType", "NGEN");
        result.put("totalRows", rows.size());
        result.put("validCount", validCount);
        result.put("warningCount", warningCount);
        result.put("duplicateCount", duplicateCount);
        result.put("errorCount", errorCount);
        result.put("rows", rows);
        return result;
    }

    @Transactional
    public Map<String, Object> approveNgen(byte[] fileBytes, String username, Long sessionId,
                                            Map<String, Map<String, Object>> corrections, boolean isAdmin) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));
        if ("PENDING_MASTER".equals(session.getStage())) {
            throw new IllegalStateException("Master Data must be approved first. Current stage: " + session.getStage());
        }

        List<Map<String, Object>> processedRows = new ArrayList<>();
        int skippedRowsCount = 0;

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> ngenCols = detectNgenColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                // Read values directly from the uploaded Excel file — no calculations.
                String accountNo          = strVal(row, ngenCols.get("accountNo"));
                String ngenNetType        = strVal(row, ngenCols.get("ngenNetType"));
                Double kwhImport          = numVal(row, ngenCols.get("kwhImport"));
                Double kwhExport          = numVal(row, ngenCols.get("kwhExport"));
                Double kwhUnitSales       = numVal(row, ngenCols.get("kwhUnitSales"));
                Double ngenUnitRate       = numVal(row, ngenCols.get("ngenUnitRate"));
                Double retentionMoney     = numVal(row, ngenCols.get("retentionMoney"));
                Double billSetOff         = numVal(row, ngenCols.get("billSetOff"));
                Double kwhSalesAmount     = numVal(row, ngenCols.get("kwhSalesAmount"));
                Double paymentSettled     = numVal(row, ngenCols.get("paymentSettled"));
                Double outstandingBalance = numVal(row, ngenCols.get("outstandingBalance"));

                String rowNumStr = String.valueOf(r + 1);
                Map<String, Object> corr = null;
                if (corrections != null) {
                    if (corrections.containsKey(rowNumStr)) {
                        corr = corrections.get(rowNumStr);
                    } else if (accountNo != null && corrections.containsKey(accountNo.trim())) {
                        corr = corrections.get(accountNo.trim());
                    }
                }

                if (corr != null) {
                    if (corr.containsKey("accountNo"))          accountNo          = (String) corr.get("accountNo");
                    if (corr.containsKey("kwhImport"))          kwhImport          = parseDouble(corr.get("kwhImport"));
                    if (corr.containsKey("kwhExport"))          kwhExport          = parseDouble(corr.get("kwhExport"));
                    if (corr.containsKey("kwhUnitSales"))       kwhUnitSales       = parseDouble(corr.get("kwhUnitSales"));
                    if (corr.containsKey("ngenUnitRate"))       ngenUnitRate       = parseDouble(corr.get("ngenUnitRate"));
                    if (corr.containsKey("billSetOff"))         billSetOff         = parseDouble(corr.get("billSetOff"));
                    if (corr.containsKey("retentionMoney"))     retentionMoney     = parseDouble(corr.get("retentionMoney"));
                    if (corr.containsKey("paymentSettled"))     paymentSettled     = parseDouble(corr.get("paymentSettled"));
                    if (corr.containsKey("outstandingBalance")) outstandingBalance = parseDouble(corr.get("outstandingBalance"));
                    if (corr.containsKey("ngenNetType"))        ngenNetType        = (String) corr.get("ngenNetType");
                }

                if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                    auditLogService.log("EXCEL_ROW_DELETED", String.format("NGEN Row %d (Account %s) excluded from batch during import.", r + 1, accountNo));
                    skippedRowsCount++;
                    continue;
                }

                if (accountNo == null || accountNo.trim().isEmpty() || !accountNo.trim().matches("\\d+") || accountNo.trim().length() != 10) {
                    skippedRowsCount++;
                    continue;
                }
                accountNo = accountNo.trim();

                // Store Excel values exactly as read. Field names preserved for Step 5 (Main Data Set).
                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", accountNo);
                rowData.put("kwhImport", kwhImport != null ? kwhImport : 0.0);
                rowData.put("kwhExport", kwhExport != null ? kwhExport : 0.0);
                rowData.put("kwhSales", kwhUnitSales != null ? kwhUnitSales : 0.0);
                rowData.put("ngenUnitRate", ngenUnitRate != null ? ngenUnitRate : 0.0);
                rowData.put("billSetOff", billSetOff != null ? billSetOff : 0.0);
                rowData.put("retentionMoney", retentionMoney != null ? retentionMoney : 0.0);
                rowData.put("salesAmount", kwhSalesAmount != null ? kwhSalesAmount : 0.0);
                rowData.put("paymentSettled", paymentSettled != null ? paymentSettled : 0.0);
                rowData.put("outstandingBalance", outstandingBalance != null ? outstandingBalance : 0.0);
                rowData.put("ngenNetType", ngenNetType != null ? ngenNetType : "");

                processedRows.add(rowData);
            }
        }

        saveNgenDataToStaging(sessionId, processedRows);

        session.setNgenApproved(true);
        session.setNgenCount(processedRows.size());
        updateSessionStage(session);
        sessionRepository.save(session);

        if (session.allFilesApproved()) {
            generateMainDataset(sessionId);
        }

        auditLogService.log("NGEN_APPROVED",
                String.format("NGEN approved by %s for session %d. Records cached: %d, Skipped: %d",
                        username, sessionId, processedRows.size(), skippedRowsCount));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", session.getStage());
        result.put("ngenCount", processedRows.size());
        result.put("allFilesApproved", session.allFilesApproved());
        result.put("message", String.format("NGEN data cached successfully. %d records cached.", processedRows.size()));
        return result;
    }

    private int stageOfficerData(
            List<Map<String, Object>> masterStaged,
            byte[] fileBytes,
            Long sessionId,
            Long uploadId,
            Map<String, Map<String, Object>> corrections,
            String username
    ) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        int totalErrorRows = 0;

        // 1. Stage Customer Profiles
        for (Map<String, Object> stagedCust : masterStaged) {
            String accountNo = (String) stagedCust.get("accountNo");
            if (accountNo == null || accountNo.trim().isEmpty()) continue;
            accountNo = accountNo.trim();

            String rowNumStr = String.valueOf(stagedCust.get("rowNum"));
            Map<String, Object> corr = corrections != null ? corrections.get(rowNumStr) : null;
            if (corr == null && corrections != null) {
                corr = corrections.get(accountNo);
            }
            Map<String, Object> finalCustData = new LinkedHashMap<>(stagedCust);
            if (corr != null) {
                if (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted")))) {
                    int custRowNum = finalCustData.get("rowNum") != null ? Integer.parseInt(finalCustData.get("rowNum").toString()) : 0;
                    auditLogService.log("EXCEL_ROW_DELETED", String.format("Master Data Row %d (Account %s) excluded from batch during staging.", custRowNum, accountNo));
                    continue;
                }
                finalCustData.putAll(corr);
            }

            // unused: validateMasterDataRow(finalCustData);
            String custAccountNo = finalCustData.get("accountNo") != null ? finalCustData.get("accountNo").toString() : "";
            String custName = finalCustData.get("customerName") != null ? finalCustData.get("customerName").toString() : "";
            String custAddress = finalCustData.get("customerAddress") != null ? finalCustData.get("customerAddress").toString() : "";
            String custMobile = finalCustData.get("mobileNo") != null ? finalCustData.get("mobileNo").toString() : "";
            String custBankCode = finalCustData.get("bankCode") != null ? finalCustData.get("bankCode").toString() : "";
            String custBranchCode = finalCustData.get("branchCode") != null ? finalCustData.get("branchCode").toString() : "";
            String custBankAcctNo = finalCustData.get("bankAccountNo") != null ? finalCustData.get("bankAccountNo").toString() : "";
            String custAgreementDate = finalCustData.get("agreementDate") != null ? finalCustData.get("agreementDate").toString() : "";
            Double custPanelCapacity = finalCustData.get("panelCapacity") != null && !finalCustData.get("panelCapacity").toString().isEmpty()
                    ? ((Number) finalCustData.get("panelCapacity")).doubleValue() : null;
            String custSolarType = ExcelValidationService.normalizeSolarType(finalCustData.get("solarType") != null ? finalCustData.get("solarType").toString() : "");
            String custCostCode = finalCustData.get("costCode") != null ? finalCustData.get("costCode").toString() : "";
            String custTariffType = finalCustData.get("tariffType") != null ? finalCustData.get("tariffType").toString() : "";
            String custBillingMode = ExcelValidationService.deriveLCode(custSolarType, custTariffType);
            finalCustData.put("billingMode", custBillingMode);
            String custRefNo = finalCustData.get("refNo") != null ? finalCustData.get("refNo").toString() : "";
            Double custUnitRate = finalCustData.get("unitRate") != null && !finalCustData.get("unitRate").toString().isEmpty()
                    ? ((Number) finalCustData.get("unitRate")).doubleValue() : null;

            int custRowNum = finalCustData.get("rowNum") != null ? Integer.parseInt(finalCustData.get("rowNum").toString()) : 0;

            ExcelValidationService.RowValidationResult valResult =
                    excelValidationService.validateCustomerRow(
                            "MasterData", custRowNum, custAccountNo, custName, custAddress, custMobile,
                            custBankCode, custBranchCode, custBankAcctNo, custAgreementDate,
                            custPanelCapacity, custSolarType, custCostCode, custBillingMode,
                            custRefNo, custUnitRate, custTariffType);

            String valStatus = valResult.hasErrors() ? "ERROR" : valResult.hasWarnings() ? "WARNING" : "VALID";

            // Serialize structured error objects for frontend
            List<Map<String, Object>> structuredErrors = new ArrayList<>();
            for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                Map<String, Object> errMap = new LinkedHashMap<>();
                errMap.put("field", err.getField());
                errMap.put("errorMessage", err.getErrorMessage());
                errMap.put("warning", err.isWarning());
                structuredErrors.add(errMap);
            }

            BillingUploadStaging staging = new BillingUploadStaging(
                    uploadId,
                    mapper.writeValueAsString(finalCustData),
                    valStatus,
                    mapper.writeValueAsString(structuredErrors),
                    "CUSTOMER_PROFILE"
            );
            billingUploadStagingRepository.save(staging);
            if (corr != null) {
                try {
                    StagingChangeLog changeLog = new StagingChangeLog(
                            uploadId,
                            staging.getStagingId(),
                            "CUSTOMER_PROFILE",
                            "EDIT",
                            mapper.writeValueAsString(stagedCust),
                            mapper.writeValueAsString(finalCustData),
                            username
                    );
                    changeLog.setStatus("APPROVED");
                    stagingChangeLogRepository.save(changeLog);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            if (valResult.hasErrors()) totalErrorRows++;
        }

        List<Map<String, Object>> cebStaged = loadCebDataFromStaging(sessionId);
        Map<String, Map<String, String>> cebData = new HashMap<>();
        for (Map<String, Object> c : cebStaged) {
            String acc = (String) c.get("accountNo");
            if (acc != null) {
                Map<String, String> cebRow = new HashMap<>();
                cebRow.put("prevReadingDate", c.get("prevReadingDate") != null ? c.get("prevReadingDate").toString() : null);
                cebRow.put("currReadingDate", c.get("currReadingDate") != null ? c.get("currReadingDate").toString() : null);
                cebRow.put("customerName", c.get("customerName") != null ? c.get("customerName").toString() : null);
                cebData.put(acc.trim(), cebRow);
            }
        }

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> colMap = previewService.autoDetectColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                String accountNo    = strVal(row, colMap.get("accountno"));
                Double kwhImport    = numVal(row, colMap.get("imports"));
                Double kwhExport    = numVal(row, colMap.get("exports"));
                Double ngenUnitRate = numVal(row, colMap.get("unitcost"));
                Double billSetOff   = numVal(row, colMap.get("billsetoff"));

                String rowNumStr = String.valueOf(r + 1);
                Map<String, Object> corr = null;
                if (corrections != null) {
                    if (corrections.containsKey(rowNumStr)) {
                        corr = corrections.get(rowNumStr);
                    } else if (corrections.containsKey(accountNo)) {
                        corr = corrections.get(accountNo);
                    }
                }

                if (corr != null) {
                    if (corr.containsKey("accountNo"))    accountNo    = (String) corr.get("accountNo");
                    if (corr.containsKey("kwhImport")) {
                        kwhImport = parseDouble(corr.get("kwhImport"));
                    }
                    if (corr.containsKey("kwhExport")) {
                        kwhExport = parseDouble(corr.get("kwhExport"));
                    }
                    if (corr.containsKey("ngenUnitRate")) {
                        ngenUnitRate = parseDouble(corr.get("ngenUnitRate"));
                    }
                    if (corr.containsKey("billSetOff")) {
                        billSetOff = parseDouble(corr.get("billSetOff"));
                    }
                }

                if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                    auditLogService.log("EXCEL_ROW_DELETED", String.format("NGEN Row %d (Account %s) excluded from batch during staging.", r + 1, accountNo));
                    continue;
                }

                if (accountNo == null || accountNo.trim().isEmpty()) continue;
                accountNo = accountNo.trim();

                // Get master data profile info from cached master data list to build full json
                Map<String, Object> matchedMaster = null;
                for (Map<String, Object> m : masterStaged) {
                    if (accountNo.equals(m.get("accountNo"))) {
                        matchedMaster = m;
                        break;
                    }
                }

                String customerName = matchedMaster != null ? (String) matchedMaster.get("customerName") : "";
                String customerAddress = matchedMaster != null ? (String) matchedMaster.get("customerAddress") : "";
                String refNo = matchedMaster != null ? (String) matchedMaster.get("refNo") : "";
                String mobileNo = matchedMaster != null ? (String) matchedMaster.get("mobileNo") : "";
                Double panelCapacity = matchedMaster != null && matchedMaster.get("panelCapacity") != null ? ((Number) matchedMaster.get("panelCapacity")).doubleValue() : null;
                String agreementDate = matchedMaster != null ? (String) matchedMaster.get("agreementDate") : null;
                String bankCode = matchedMaster != null ? (String) matchedMaster.get("bankCode") : null;
                String branchCode = matchedMaster != null ? (String) matchedMaster.get("branchCode") : null;
                String bankAccountNo = matchedMaster != null ? (String) matchedMaster.get("bankAccountNo") : null;
                String solarType = matchedMaster != null ? (String) matchedMaster.get("solarType") : null;
                Double masterUnitRate = matchedMaster != null && matchedMaster.get("unitRate") != null ? ((Number) matchedMaster.get("unitRate")).doubleValue() : null;
                String tariffType = matchedMaster != null ? (String) matchedMaster.get("tariffType") : null;
                String billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);

                double effectiveRate = masterUnitRate != null ? masterUnitRate : (ngenUnitRate != null ? ngenUnitRate : 0.0);
                double outstandingCharges = billSetOff != null ? billSetOff : 0.0;

                Map<String, String> cebRow = cebData.get(accountNo);
                String prevReadingDate = cebRow != null ? cebRow.get("prevReadingDate") : null;
                String currReadingDate = cebRow != null ? cebRow.get("currReadingDate") : null;

                String refNoStr = isNotBlank(refNo) ? refNo
                        : "REF-" + accountNo + "-" + (currReadingDate != null ? currReadingDate.replace("-", "") : "");

                // Comprehensive validation using ExcelValidationService
                String rawFromDate = prevReadingDate != null ? prevReadingDate : "";
                String rawToDate = currReadingDate != null ? currReadingDate : "";
                LocalDate parsedFromDate = prevReadingDate != null ? safeParseDate(prevReadingDate) : null;
                LocalDate parsedToDate = currReadingDate != null ? safeParseDate(currReadingDate) : null;
                String rawImports = kwhImport != null ? kwhImport.toString() : "";
                String rawExports = kwhExport != null ? kwhExport.toString() : "";
                String rawUnitCost = effectiveRate > 0 ? String.valueOf(effectiveRate) : "";
                Double unitCostVal = effectiveRate > 0 ? effectiveRate : null;

                ExcelValidationService.RowValidationResult valResult =
                        excelValidationService.validateRow(
                                "NGEN", r + 1, "BILLING", accountNo, customerName,
                                rawFromDate, parsedFromDate, rawToDate, parsedToDate,
                                rawImports, kwhImport, rawExports, kwhExport,
                                rawUnitCost, unitCostVal,
                                bankCode != null ? bankCode : "",
                                customerAddress != null ? customerAddress : "",
                                mobileNo != null ? mobileNo : "",
                                bankAccountNo != null ? bankAccountNo : "",
                                branchCode != null ? branchCode : "",
                                billingMode != null ? billingMode : "",
                                agreementDate != null ? agreementDate : "",
                                panelCapacity,
                                solarType != null ? solarType : "",
                                tariffType != null ? tariffType : "",
                                new HashSet<String>()
                        );

                // Validation 1: Account No Match
                if (matchedMaster == null) {
                    valResult.addError(new com.ceb.billing.models.ExcelValidationError(
                            "NGEN", r + 1, "Account No",
                            "Account No not found in Master Data", false));
                } else {
                    // Validation 2: Net Type Match
                    String ngenNetType = colMap.get("solartype") != null ? strVal(row, colMap.get("solartype")) : null;
                    if (solarType != null && ngenNetType != null && !ngenNetType.trim().isEmpty()) {
                        String normMasterType = ExcelValidationService.normalizeSolarType(solarType);
                        String normNgenType = ExcelValidationService.normalizeSolarType(ngenNetType);
                        if (normMasterType != null && normNgenType != null && !normMasterType.equals(normNgenType)) {
                            valResult.addError(new com.ceb.billing.models.ExcelValidationError(
                                    "NGEN", r + 1, "Net Type",
                                    String.format("Net Type Mismatch: NGEN='%s', Master Data='%s'", ngenNetType, solarType), false));
                        }
                    }

                    // Validation 3: Unit Rate Match
                    if (ngenUnitRate != null && masterUnitRate != null && Math.abs(ngenUnitRate - masterUnitRate) > 0.001) {
                        valResult.addWarning(new com.ceb.billing.models.ExcelValidationError(
                                "NGEN", r + 1, "Unit Rate",
                                String.format("Unit Rate mismatch: NGEN=%.2f, Master Data=%.2f. Using Master Data rate.", ngenUnitRate, masterUnitRate), true));
                    }
                }

                // Proceed to Calculation Phase only if no errors
                Double kwhSales = null;
                Double salesAmount = null;
                Double paymentSettled = null;

                if (!valResult.hasErrors()) {
                    kwhSales = (kwhExport != null ? kwhExport : 0.0) - (kwhImport != null ? kwhImport : 0.0);
                    salesAmount = kwhSales * effectiveRate;
                    paymentSettled = salesAmount - outstandingCharges;

                    salesAmount = Math.round(salesAmount * 100.0) / 100.0;
                    paymentSettled = Math.round(paymentSettled * 100.0) / 100.0;
                }

                Map<String, Object> rawJson = new LinkedHashMap<>();
                rawJson.put("accountNo", accountNo);
                rawJson.put("customerName", customerName);
                rawJson.put("customerAddress", customerAddress);
                rawJson.put("refNo", refNoStr);
                rawJson.put("mobileNo", mobileNo);
                rawJson.put("panelCapacity", panelCapacity);
                rawJson.put("agreementDate", agreementDate);
                rawJson.put("bankCode", bankCode);
                rawJson.put("branchCode", branchCode);
                rawJson.put("bankAccountNo", bankAccountNo);
                rawJson.put("solarType", solarType);
                rawJson.put("unitCost", effectiveRate);
                rawJson.put("tariffType", tariffType);
                rawJson.put("billingMode", billingMode);

                rawJson.put("fromDate", prevReadingDate);
                rawJson.put("toDate", currReadingDate);
                rawJson.put("importUnits", kwhImport);
                rawJson.put("exportUnits", kwhExport);
                rawJson.put("netUnit", kwhSales);
                rawJson.put("totalAmount", salesAmount);
                rawJson.put("billSetOff", outstandingCharges);
                rawJson.put("payment", paymentSettled);
                rawJson.put("paymentSettled", paymentSettled);

                String valStatus = valResult.hasDuplicate() ? "DUPLICATE"
                        : valResult.hasErrors() ? "ERROR"
                        : valResult.hasWarnings() ? "WARNING" : "VALID";

                // Serialize structured error objects for frontend
                List<Map<String, Object>> structuredErrors = new ArrayList<>();
                for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                    Map<String, Object> errMap = new LinkedHashMap<>();
                    errMap.put("field", err.getField());
                    errMap.put("errorMessage", err.getErrorMessage());
                    errMap.put("warning", err.isWarning());
                    structuredErrors.add(errMap);
                }

                BillingUploadStaging staging = new BillingUploadStaging(
                        uploadId,
                        mapper.writeValueAsString(rawJson),
                        valStatus,
                        mapper.writeValueAsString(structuredErrors),
                        "BILLING"
                );
                billingUploadStagingRepository.save(staging);
                if (valResult.hasErrors() || valResult.hasDuplicate()) totalErrorRows++;
            }
        }
        return totalErrorRows;
    }

    // ════════════════════════════════════════════════════════════════════
    //  SESSION MANAGEMENT
    // ════════════════════════════════════════════════════════════════════

    public Map<String, Object> getActiveSession(String username) {
        Optional<ImportSession> opt = sessionRepository
                .findTopByCreatedByAndStageNotOrderByCreatedAtDesc(username, "COMPLETED");
        if (opt.isEmpty()) {
            return Map.of("hasActiveSession", false);
        }
        ImportSession session = opt.get();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasActiveSession", true);
        result.put("sessionId", session.getId());
        result.put("stage", session.getStage());
        result.put("masterCustomerCount", session.getMasterCustomerCount());
        result.put("cebAssistCount", session.getCebAssistCount());
        result.put("ngenCount", session.getNgenCount());
        result.put("npayCount", session.getNpayCount());
        result.put("mainDatasetApproved", session.getMainDatasetApproved());
        result.put("masterComparisonApproved", session.getMasterComparisonApproved());
        result.put("createdAt", session.getCreatedAt());
        return result;
    }

    public void discardSession(Long sessionId, String username) {
        sessionRepository.findById(sessionId.longValue()).ifPresent(session -> {
            if (session.getCreatedBy().equals(username)) {
                session.setStage("COMPLETED");
                sessionRepository.save(session);
                cleanupCebStaging(sessionId);
            }
        });
    }

    // ════════════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ════════════════════════════════════════════════════════════════════

    private ImportSession findOrCreateSession(String username) {
        List<ImportSession> existing = sessionRepository.findByCreatedByAndStageNot(username, "COMPLETED");
        existing.forEach(s -> {
            s.setStage("COMPLETED");
            sessionRepository.save(s);
        });

        ImportSession session = new ImportSession();
        session.setCreatedBy(username);
        session.setStage("PENDING_MASTER");
        session.setSessionKey(username + "_" + System.currentTimeMillis());
        return sessionRepository.save(session);
    }

    private static final Map<Long, List<Map<String, Object>>> CEB_DATA_CACHE = new HashMap<>();
    private static final Map<Long, List<Map<String, Object>>> MASTER_DATA_CACHE = new HashMap<>();

    private void saveCebDataToStaging(Long sessionId, List<Map<String, Object>> data) {
        CEB_DATA_CACHE.put(sessionId, data);
    }

    private List<Map<String, Object>> loadCebDataFromStaging(Long sessionId) {
        return CEB_DATA_CACHE.getOrDefault(sessionId, new ArrayList<>());
    }

    private void cleanupCebStaging(Long sessionId) {
        CEB_DATA_CACHE.remove(sessionId);
    }

    private void saveMasterDataToStaging(Long sessionId, List<Map<String, Object>> data) {
        MASTER_DATA_CACHE.put(sessionId, data);
    }

    private List<Map<String, Object>> loadMasterDataFromStaging(Long sessionId) {
        return MASTER_DATA_CACHE.getOrDefault(sessionId, new ArrayList<>());
    }

    private void cleanupMasterStaging(Long sessionId) {
        MASTER_DATA_CACHE.remove(sessionId);
    }

    private static final Map<Long, List<Map<String, Object>>> NGEN_DATA_CACHE = new HashMap<>();

    private void saveNgenDataToStaging(Long sessionId, List<Map<String, Object>> data) {
        NGEN_DATA_CACHE.put(sessionId, data);
    }

    private List<Map<String, Object>> loadNgenDataFromStaging(Long sessionId) {
        return NGEN_DATA_CACHE.getOrDefault(sessionId, new ArrayList<>());
    }

    private void cleanupNgenStaging(Long sessionId) {
        NGEN_DATA_CACHE.remove(sessionId);
    }

    private static final Map<Long, List<Map<String, Object>>> NPAY_DATA_CACHE = new HashMap<>();

    private void saveNpayDataToStaging(Long sessionId, List<Map<String, Object>> data) {
        NPAY_DATA_CACHE.put(sessionId, data);
    }

    private List<Map<String, Object>> loadNpayDataFromStaging(Long sessionId) {
        return NPAY_DATA_CACHE.getOrDefault(sessionId, new ArrayList<>());
    }

    private void cleanupNpayStaging(Long sessionId) {
        NPAY_DATA_CACHE.remove(sessionId);
    }

    private static final Map<Long, List<Map<String, Object>>> MAIN_DATA_CACHE = new HashMap<>();

    // Holds display/review-only duplicate source records (extra NGEN/NPAY occurrences beyond the
    // merged primary). Kept separate so Step 6 and the final import continue to see only the
    // merged primary rows in MAIN_DATA_CACHE — duplicates are never imported automatically.
    private static final Map<Long, List<Map<String, Object>>> MAIN_DUP_CACHE = new HashMap<>();

    // Holds incomplete merged records (an Account No present in only some of CEB/NGEN/NPAY). These
    // are auto-removed from the Main Dataset and collected here for review only — Step 6 and the
    // final import continue to see only the complete merged rows in MAIN_DATA_CACHE.
    private static final Map<Long, List<Map<String, Object>>> MAIN_REJECTED_CACHE = new HashMap<>();


    private List<String> validateMasterDataRow(Map<String, Object> row) {
        List<String> errors = new ArrayList<>();
        
        String accountNo = row.get("accountNo") != null ? row.get("accountNo").toString() : null;
        if (accountNo == null || accountNo.trim().isEmpty()) {
            errors.add("Account No is missing");
        } else if (!accountNo.trim().matches("\\d+")) {
            errors.add("Invalid Account Number: Only numeric values are allowed.");
        } else if (accountNo.trim().length() != 10) {
            errors.add("Account No must be a 10-digit numeric value");
        }
        
        if (isBlank((String) row.get("customerName"))) {
            errors.add("Customer Name is missing");
        }
        
        if (isBlank((String) row.get("customerAddress"))) {
            errors.add("Address is missing");
        }
        
        if (isBlank((String) row.get("refNo"))) {
            errors.add("Ref. No. is missing");
        }
        
        String costCode = row.get("costCode") != null ? row.get("costCode").toString() : null;
        if (costCode == null || costCode.trim().isEmpty()) {
            errors.add("Cost Code is missing");
        } else {
            boolean ccExists = costCodeRepository.findByCostCode(costCode.trim()).isPresent();
            if (!ccExists) {
                errors.add("Unrecognized cost code: '" + costCode + "'");
            }
        }
        
        if (isBlank((String) row.get("mobileNo"))) {
            errors.add("Mobile Number is missing");
        }
        
        Object panelCapacity = row.get("panelCapacity");
        if (panelCapacity == null || panelCapacity.toString().trim().isEmpty()) {
            errors.add("PANEL CAPACITY is missing");
        }
        
        if (isBlank((String) row.get("agreementDate"))) {
            errors.add("AGREEMENT DATE is missing");
        }
        
        if (isBlank((String) row.get("bankCode"))) {
            errors.add("Bank Code is missing");
        }
        
        if (isBlank((String) row.get("branchCode"))) {
            errors.add("Branch Code is missing");
        }
        
        if (isBlank((String) row.get("bankAccountNo"))) {
            errors.add("Bank Account No is missing");
        }
        
        String solarType = (String) row.get("solarType");
        if (isBlank(solarType)) {
            errors.add("TYPE (Solar Type) is missing");
        } else {
            String normalized = ExcelValidationService.normalizeSolarType(solarType);
            boolean ntExists = netTypeRepository.findByName(normalized).isPresent();
            if (!ntExists) {
                errors.add("Unrecognized net type/solar type: '" + solarType + "'");
            }
        }
        
        Object unitRate = row.get("unitRate");
        if (unitRate == null || unitRate.toString().trim().isEmpty()) {
            errors.add("UNIT RATE is missing");
        }
        
        if (isBlank((String) row.get("tariffType"))) {
            errors.add("FIX/VARIABLE is missing");
        }
        
        String tariffType = (String) row.get("tariffType");
        String expectedLCode = ExcelValidationService.deriveLCode(solarType, tariffType);
        row.put("billingMode", expectedLCode);

        if (isBlank(expectedLCode)) {
            errors.add("L-Code cannot be generated for the given Type and Fix/Variable combination");
        } else {
            boolean ecExists = expenseCodeRepository.findByExpCode(expectedLCode).isPresent();
            if (!ecExists) {
                errors.add("L-Code '" + expectedLCode + "' does not exist in the database");
            }
        }
        
        return errors;
    }

    private String strVal(Row row, Integer colIdx) {
        if (colIdx == null) return null;
        Cell cell = row.getCell(colIdx);
        return cellStr(cell);
    }

    private Double numVal(Row row, Integer colIdx) {
        if (colIdx == null) return null;
        Cell cell = row.getCell(colIdx);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) return cell.getNumericCellValue();
        String str = cellStr(cell);
        if (str == null || str.trim().isEmpty()) return null;
        try { return Double.parseDouble(str.trim().replace(",", "")); } catch (Exception e) { return null; }
    }

    private String dateStr(Row row, Integer colIdx) {
        if (colIdx == null) return null;
        Cell cell = row.getCell(colIdx);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            LocalDate ld = cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
            return ld.toString();
        }
        String str = cellStr(cell);
        if (str == null || str.trim().isEmpty()) return null;
        String[] patterns = {"yyyy-MM-dd", "M/d/yyyy", "d/M/yyyy", "MM/dd/yyyy", "dd/MM/yyyy",
                "dd-MM-yyyy", "MM-dd-yyyy", "yyyy/MM/dd", "yyyy.MM.dd", "dd.MM.yyyy", "yyyy.M.d", "d.M.yyyy"};
        for (String p : patterns) {
            try { return LocalDate.parse(str.trim(), DateTimeFormatter.ofPattern(p)).toString(); }
            catch (Exception ignored) {}
        }
        return str.trim();
    }

    private String cellStr(Cell cell) {
        if (cell == null) return null;
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate().toString();
                }
                double d = cell.getNumericCellValue();
                return d == (long) d ? String.valueOf((long) d) : String.valueOf(d);
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try { return cell.getStringCellValue().trim(); }
                catch (Exception e) {
                    try { double fv = cell.getNumericCellValue(); return fv == (long) fv ? String.valueOf((long) fv) : String.valueOf(fv); }
                    catch (Exception ex) { return ""; }
                }
            default: return null;
        }
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String v = cellStr(cell);
                if (v != null && !v.trim().isEmpty()) return false;
            }
        }
        return true;
    }

    private void detectDuplicates(List<Map<String, Object>> rows, String stepName) {
        Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String acc = (String) row.get("accountNo");
            if (acc != null && !acc.trim().isEmpty() && acc.trim().matches("\\d+") && acc.trim().length() == 10) {
                String cleanAcc = acc.trim();
                groups.computeIfAbsent(cleanAcc, k -> new ArrayList<>()).add(row);
            }
        }

        for (Map.Entry<String, List<Map<String, Object>>> entry : groups.entrySet()) {
            List<Map<String, Object>> group = entry.getValue();
            if (group.size() > 1) {
                int firstRowNum = (Integer) group.get(0).get("rowNum");
                for (int i = 0; i < group.size(); i++) {
                    Map<String, Object> r = group.get(i);
                    r.put("status", "DUPLICATE");
                    r.put("isOriginalDuplicate", i == 0);
                    r.put("originalRowNum", firstRowNum);
                    r.put("duplicateReason", "Duplicate Account Number found in " + stepName + " file (Row #" + firstRowNum + ")");
                }
            }
        }
    }

    private void updateSessionStage(ImportSession session) {
        if (session.getCebApproved() && session.getNgenApproved() && session.getNpayApproved()) {
            session.setStage("MAIN_DATASET_GENERATED");
        } else if (session.getCebApproved() && session.getNgenApproved()) {
            session.setStage("NGEN_APPROVED");
        } else if (session.getCebApproved()) {
            session.setStage("CEB_APPROVED");
        } else {
            session.setStage("MASTER_APPROVED");
        }
    }

    private LocalDate safeParseDate(String s) {
        if (s == null || s.trim().isEmpty()) return null;
        try { return LocalDate.parse(s.trim()); } catch (Exception e) { return null; }
    }

    private boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
    private boolean isNotBlank(String s) { return s != null && !s.trim().isEmpty(); }

    // ════════════════════════════════════════════════════════════════════
    //  STEP 4 — NPAY
    // ════════════════════════════════════════════════════════════════════

    /**
     * NPAY-specific column aliases (logical field -> accepted header variants).
     * Aliases are compared after normalization (lowercase, punctuation/space stripped),
     * so "Energy Purchase", "Energy Purches" and "Energy Purch." all resolve to energyPurchase.
     * This is intentionally isolated from the shared PreviewService.FIELD_ALIASES and from the
     * NGEN aliases so that improving NPAY header detection does not affect any other import step.
     */
    private static final LinkedHashMap<String, List<String>> NPAY_COLUMN_ALIASES = new LinkedHashMap<>();
    static {
        NPAY_COLUMN_ALIASES.put("accountNo", Arrays.asList(
                "accountno", "accountnumber", "acctno", "accno", "account", "acc"));
        NPAY_COLUMN_ALIASES.put("npayNetType", Arrays.asList(
                "nettype", "solartype", "systemtype", "npaynettype", "net", "type"));
        NPAY_COLUMN_ALIASES.put("npayName", Arrays.asList(
                "customername", "custname", "accountname", "consumername", "name"));
        NPAY_COLUMN_ALIASES.put("energyPurchase", Arrays.asList(
                "energypurchase", "energypurches", "energypurch", "energypurchased", "energybought",
                "purchaseenergy", "energy", "purchase", "purches"));
        NPAY_COLUMN_ALIASES.put("billSetOff", Arrays.asList(
                "billsetoff", "billsetof", "billset", "billsetoffamount",
                "billoutstandingsetoff", "billoutstdsetoff", "billoutsetoff", "billoutstandingsetof",
                "billoutstanding", "billoutstd", "billos", "outstandingsetoff", "setoffamount",
                "setoff", "setof", "outstanding"));
        NPAY_COLUMN_ALIASES.put("retentionMoney", Arrays.asList(
                "retentionmoney", "retnmoney", "retmoney", "retention", "retn"));
        NPAY_COLUMN_ALIASES.put("payment", Arrays.asList(
                "payment", "paymentsettled", "paymentamount", "amountpaid", "netpayment", "paid", "pay"));
    }

    /**
     * Detect NPAY columns using flexible header normalization + abbreviation aliases.
     * Normalization ignores case, spaces and punctuation ('.', '-', '_', etc.).
     * Pass 1 resolves exact normalized matches; Pass 2 falls back to substring matches
     * for any fields still unmapped. A column is never assigned to more than one field.
     */
    private Map<String, Integer> detectNpayColumns(Sheet sheet, int headerRowIdx) {
        Map<String, Integer> result = new HashMap<>();
        Row headerRow = sheet.getRow(headerRowIdx);
        if (headerRow == null) return result;

        boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum()
                && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
        int lastCellNum = headerRow.getLastCellNum();
        if (hasSubHeader) {
            Row subRow = sheet.getRow(headerRowIdx + 1);
            if (subRow != null && subRow.getLastCellNum() > lastCellNum) {
                lastCellNum = subRow.getLastCellNum();
            }
        }

        List<String> cleanHeaders = new ArrayList<>();
        for (int col = 0; col < lastCellNum; col++) {
            String raw = previewService.getColCleanHeader(sheet, headerRowIdx, hasSubHeader, col);
            cleanHeaders.add(raw != null ? raw.toLowerCase().replaceAll("[^a-z0-9]", "") : "");
        }

        Set<Integer> used = new HashSet<>();

        // Pass 1 — exact normalized match
        for (Map.Entry<String, List<String>> entry : NPAY_COLUMN_ALIASES.entrySet()) {
            for (String alias : entry.getValue()) {
                String a = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (a.isEmpty()) continue;
                for (int col = 0; col < cleanHeaders.size(); col++) {
                    if (used.contains(col)) continue;
                    if (cleanHeaders.get(col).equals(a)) {
                        result.put(entry.getKey(), col);
                        used.add(col);
                        break;
                    }
                }
                if (result.containsKey(entry.getKey())) break;
            }
        }

        // Pass 2 — substring fallback for still-unmapped fields
        for (Map.Entry<String, List<String>> entry : NPAY_COLUMN_ALIASES.entrySet()) {
            if (result.containsKey(entry.getKey())) continue;
            for (String alias : entry.getValue()) {
                String a = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (a.isEmpty()) continue;
                for (int col = 0; col < cleanHeaders.size(); col++) {
                    if (used.contains(col)) continue;
                    String h = cleanHeaders.get(col);
                    if (!h.isEmpty() && h.contains(a)) {
                        result.put(entry.getKey(), col);
                        used.add(col);
                        break;
                    }
                }
                if (result.containsKey(entry.getKey())) break;
            }
        }

        return result;
    }

    public Map<String, Object> previewNpay(byte[] fileBytes, String filename, Long sessionId) throws Exception {
        List<Map<String, Object>> rows = new ArrayList<>();

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> npayCols = detectNpayColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                // Read values directly from the uploaded Excel file — no calculations, no comparisons.
                String accountNo        = strVal(row, npayCols.get("accountNo"));
                String npayNetType      = strVal(row, npayCols.get("npayNetType"));
                String npayName         = strVal(row, npayCols.get("npayName"));
                Double energyPurchase   = numVal(row, npayCols.get("energyPurchase"));
                Double billSetOff       = numVal(row, npayCols.get("billSetOff"));
                Double retentionMoney   = numVal(row, npayCols.get("retentionMoney"));
                Double payment          = numVal(row, npayCols.get("payment"));

                String cleanAcc = accountNo != null ? accountNo.trim() : "";

                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", cleanAcc);
                rowData.put("npayNetType", npayNetType != null ? npayNetType : "");
                rowData.put("npayName", npayName != null ? npayName : "");
                rowData.put("energyPurchase", energyPurchase != null ? energyPurchase : 0.0);
                rowData.put("billSetOff", billSetOff != null ? billSetOff : 0.0);
                rowData.put("retentionMoney", retentionMoney != null ? retentionMoney : 0.0);
                rowData.put("payment", payment != null ? payment : 0.0);

                List<String> errors = new ArrayList<>();
                List<String> warnings = new ArrayList<>();

                if (cleanAcc.isEmpty()) {
                    errors.add("Account No is missing");
                } else if (!cleanAcc.matches("\\d+")) {
                    errors.add("Invalid Account Number: Only numeric values are allowed.");
                } else if (cleanAcc.length() != 10) {
                    errors.add("Account number must be a valid 10-digit numeric string");
                }

                if (npayNetType == null || npayNetType.trim().isEmpty()) {
                    errors.add("Net Type is missing");
                }
                if (npayName == null || npayName.trim().isEmpty()) {
                    errors.add("Name is missing");
                }
                if (energyPurchase == null) errors.add("Energy Purchase is missing or invalid");
                if (billSetOff == null) errors.add("Bill Set Off is missing or invalid");
                if (retentionMoney == null) errors.add("Retention Money is missing or invalid");
                if (payment == null) errors.add("Payment is missing or invalid");

                rowData.put("errors", errors);
                rowData.put("warnings", warnings);
                rowData.put("status", errors.isEmpty() ? "VALID" : "ERROR");
                rows.add(rowData);
            }
        }

        // Run duplicate detection
        detectDuplicates(rows, "NPAY");

        int errorCount = 0;
        int warningCount = 0;
        int duplicateCount = 0;
        int validCount = 0;
        for (Map<String, Object> r : rows) {
            String status = (String) r.get("status");
            if ("ERROR".equals(status)) {
                errorCount++;
            } else if ("WARNING".equals(status)) {
                warningCount++;
            } else if ("DUPLICATE".equals(status)) {
                duplicateCount++;
            } else if ("VALID".equals(status)) {
                validCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filename", filename);
        result.put("fileType", "NPAY");
        result.put("totalRows", rows.size());
        result.put("validCount", validCount);
        result.put("warningCount", warningCount);
        result.put("duplicateCount", duplicateCount);
        result.put("errorCount", errorCount);
        result.put("rows", rows);
        return result;
    }

    @Transactional
    public Map<String, Object> approveNpay(byte[] fileBytes, String username, Long sessionId,
                                            Map<String, Map<String, Object>> corrections, boolean isAdmin) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));
        if ("PENDING_MASTER".equals(session.getStage())) {
            throw new IllegalStateException("Master Data must be approved first. Current stage: " + session.getStage());
        }

        List<Map<String, Object>> processedRows = new ArrayList<>();
        int skippedCount = 0;

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> npayCols = detectNpayColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                // Read values directly from the uploaded Excel file — no calculations, no comparisons.
                String accountNo        = strVal(row, npayCols.get("accountNo"));
                String npayNetType      = strVal(row, npayCols.get("npayNetType"));
                String npayName         = strVal(row, npayCols.get("npayName"));
                Double energyPurchase   = numVal(row, npayCols.get("energyPurchase"));
                Double billSetOff       = numVal(row, npayCols.get("billSetOff"));
                Double retentionMoney   = numVal(row, npayCols.get("retentionMoney"));
                Double payment          = numVal(row, npayCols.get("payment"));

                String rowNumStr = String.valueOf(r + 1);
                Map<String, Object> corr = null;
                if (corrections != null) {
                    if (corrections.containsKey(rowNumStr)) {
                        corr = corrections.get(rowNumStr);
                    } else if (accountNo != null && corrections.containsKey(accountNo.trim())) {
                        corr = corrections.get(accountNo.trim());
                    }
                }

                if (corr != null) {
                    if (corr.containsKey("accountNo"))      accountNo = (String) corr.get("accountNo");
                    if (corr.containsKey("npayName"))        npayName  = (String) corr.get("npayName");
                    if (corr.containsKey("npayNetType"))     npayNetType = (String) corr.get("npayNetType");
                    if (corr.containsKey("energyPurchase")) {
                        energyPurchase = parseDouble(corr.get("energyPurchase"));
                    }
                    if (corr.containsKey("billSetOff")) {
                        billSetOff = parseDouble(corr.get("billSetOff"));
                    }
                    if (corr.containsKey("retentionMoney")) {
                        retentionMoney = parseDouble(corr.get("retentionMoney"));
                    }
                    if (corr.containsKey("payment")) {
                        payment = parseDouble(corr.get("payment"));
                    }
                }

                if (accountNo == null || accountNo.trim().isEmpty() || !accountNo.trim().matches("\\d+") || accountNo.trim().length() != 10) {
                    skippedCount++;
                    continue;
                }
                accountNo = accountNo.trim();

                if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                    auditLogService.log("EXCEL_ROW_DELETED", String.format("NPAY Row %d (Account %s) excluded from batch during import.", r + 1, accountNo));
                    skippedCount++;
                    continue;
                }

                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", accountNo);
                rowData.put("npayNetType", npayNetType != null ? npayNetType : "");
                rowData.put("npayName", npayName != null ? npayName : "");
                rowData.put("energyPurchase", energyPurchase != null ? energyPurchase : 0.0);
                rowData.put("billSetOff", billSetOff != null ? billSetOff : 0.0);
                rowData.put("retentionMoney", retentionMoney != null ? retentionMoney : 0.0);
                rowData.put("payment", payment != null ? payment : 0.0);

                processedRows.add(rowData);
            }
        }

        saveNpayDataToStaging(sessionId, processedRows);

        session.setNpayApproved(true);
        session.setNpayCount(processedRows.size());
        updateSessionStage(session);
        sessionRepository.save(session);

        if (session.allFilesApproved()) {
            generateMainDataset(sessionId);
        }

        auditLogService.log("NPAY_APPROVED",
                String.format("NPAY approved by %s for session %d. Records cached: %d, Skipped: %d",
                        username, sessionId, processedRows.size(), skippedCount));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", session.getStage());
        result.put("npayCount", processedRows.size());
        result.put("allFilesApproved", session.allFilesApproved());
        result.put("message", String.format("NPAY data cached successfully. %d records cached.", processedRows.size()));
        return result;
    }

    private int stageOfficerNpayData(
            List<Map<String, Object>> masterStaged,
            Map<String, Map<String, String>> cebData,
            Map<String, Map<String, Object>> stagedNgen,
            byte[] fileBytes,
            Long sessionId,
            Long uploadId,
            Map<String, Map<String, Object>> corrections,
            String username
    ) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        int totalErrorRows = 0;

        // 1. Stage CUSTOMER_PROFILE rows
        for (Map<String, Object> stagedCust : masterStaged) {
            String accountNo = (String) stagedCust.get("accountNo");
            if (accountNo == null || accountNo.trim().isEmpty()) continue;
            accountNo = accountNo.trim();

            String rowNumStr = String.valueOf(stagedCust.get("rowNum"));
            Map<String, Object> corr = corrections != null ? corrections.get(rowNumStr) : null;
            if (corr == null && corrections != null) {
                corr = corrections.get(accountNo);
            }
            Map<String, Object> finalCustData = new LinkedHashMap<>(stagedCust);
            if (corr != null) {
                if (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted")))) {
                    continue;
                }
                finalCustData.putAll(corr);
            }

            String custAccountNo = finalCustData.get("accountNo") != null ? finalCustData.get("accountNo").toString() : "";
            String custName = finalCustData.get("customerName") != null ? finalCustData.get("customerName").toString() : "";
            String custAddress = finalCustData.get("customerAddress") != null ? finalCustData.get("customerAddress").toString() : "";
            String custMobile = finalCustData.get("mobileNo") != null ? finalCustData.get("mobileNo").toString() : "";
            String custBankCode = finalCustData.get("bankCode") != null ? finalCustData.get("bankCode").toString() : "";
            String custBranchCode = finalCustData.get("branchCode") != null ? finalCustData.get("branchCode").toString() : "";
            String custBankAcctNo = finalCustData.get("bankAccountNo") != null ? finalCustData.get("bankAccountNo").toString() : "";
            String custAgreementDate = finalCustData.get("agreementDate") != null ? finalCustData.get("agreementDate").toString() : "";
            Double custPanelCapacity = finalCustData.get("panelCapacity") != null && !finalCustData.get("panelCapacity").toString().isEmpty()
                    ? ((Number) finalCustData.get("panelCapacity")).doubleValue() : null;
            String custSolarType = ExcelValidationService.normalizeSolarType(finalCustData.get("solarType") != null ? finalCustData.get("solarType").toString() : "");
            String custCostCode = finalCustData.get("costCode") != null ? finalCustData.get("costCode").toString() : "";
            String custTariffType = finalCustData.get("tariffType") != null ? finalCustData.get("tariffType").toString() : "";
            String custBillingMode = ExcelValidationService.deriveLCode(custSolarType, custTariffType);
            finalCustData.put("billingMode", custBillingMode);
            String custRefNo = finalCustData.get("refNo") != null ? finalCustData.get("refNo").toString() : "";
            Double custUnitRate = finalCustData.get("unitRate") != null && !finalCustData.get("unitRate").toString().isEmpty()
                    ? ((Number) finalCustData.get("unitRate")).doubleValue() : null;

            int custRowNum = finalCustData.get("rowNum") != null ? Integer.parseInt(finalCustData.get("rowNum").toString()) : 0;

            ExcelValidationService.RowValidationResult valResult =
                    excelValidationService.validateCustomerRow(
                            "MasterData", custRowNum, custAccountNo, custName, custAddress, custMobile,
                            custBankCode, custBranchCode, custBankAcctNo, custAgreementDate,
                            custPanelCapacity, custSolarType, custCostCode, custBillingMode,
                            custRefNo, custUnitRate, custTariffType);

            String valStatus = valResult.hasErrors() ? "ERROR" : valResult.hasWarnings() ? "WARNING" : "VALID";

            List<Map<String, Object>> structuredErrors = new ArrayList<>();
            for (com.ceb.billing.models.ExcelValidationError err : valResult.getValidationMessages()) {
                Map<String, Object> errMap = new LinkedHashMap<>();
                errMap.put("field", err.getField());
                errMap.put("errorMessage", err.getErrorMessage());
                errMap.put("warning", err.isWarning());
                structuredErrors.add(errMap);
            }

            BillingUploadStaging staging = new BillingUploadStaging(
                    uploadId,
                    mapper.writeValueAsString(finalCustData),
                    valStatus,
                    mapper.writeValueAsString(structuredErrors),
                    "CUSTOMER_PROFILE"
            );
            billingUploadStagingRepository.save(staging);
            if (valResult.hasErrors()) totalErrorRows++;
        }

        // 2. Stage BILLING rows (NPAY merged with CEB/NGEN/Master)
        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> colMap = previewService.autoDetectColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                String accountNo        = strVal(row, colMap.get("accountno"));
                Double energyPurchase   = numVal(row, colMap.get("energypurchase"));
                Double billSetOff       = numVal(row, colMap.get("billsetoff"));
                Double retentionMoney   = numVal(row, colMap.get("retentionmoney"));
                Double payment          = numVal(row, colMap.get("payment"));

                String rowNumStr = String.valueOf(r + 1);
                Map<String, Object> corr = null;
                if (corrections != null) {
                    if (corrections.containsKey(rowNumStr)) {
                        corr = corrections.get(rowNumStr);
                    } else if (accountNo != null && corrections.containsKey(accountNo)) {
                        corr = corrections.get(accountNo);
                    }
                }

                if (corr != null) {
                    if (corr.containsKey("accountNo")) accountNo = (String) corr.get("accountNo");
                    if (corr.containsKey("energyPurchase")) {
                        Object val = corr.get("energyPurchase");
                        energyPurchase = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("billSetOff")) {
                        Object val = corr.get("billSetOff");
                        billSetOff = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("retentionMoney")) {
                        Object val = corr.get("retentionMoney");
                        retentionMoney = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("payment")) {
                        Object val = corr.get("payment");
                        payment = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                }

                if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                    continue;
                }

                if (accountNo == null || accountNo.trim().isEmpty() || !accountNo.trim().matches("\\d+") || accountNo.trim().length() != 10) {
                    continue;
                }
                accountNo = accountNo.trim();

                Map<String, Object> masterCust = null;
                for (Map<String, Object> mc : masterStaged) {
                    if (accountNo.equals(mc.get("accountNo"))) {
                        masterCust = mc;
                        break;
                    }
                }

                String customerName = "—";
                String solarType = null;
                Double unitRate = 0.0;
                if (masterCust != null) {
                    customerName = masterCust.get("customerName") != null ? masterCust.get("customerName").toString() : "—";
                    solarType = masterCust.get("solarType") != null ? masterCust.get("solarType").toString() : null;
                    unitRate = masterCust.get("unitRate") != null ? ((Number) masterCust.get("unitRate")).doubleValue() : 0.0;
                } else {
                    Optional<Customer> cOpt = customerRepository.findById(accountNo);
                    if (cOpt.isPresent()) {
                        Customer c = cOpt.get();
                        customerName = c.getCustomerName() != null ? c.getCustomerName() : "—";
                        solarType = c.getSolarType();
                        unitRate = c.getUnitRate() != null ? c.getUnitRate() : 0.0;
                    }
                }

                Map<String, String> cebRow = cebData.get(accountNo);
                String prevDateStr = cebRow != null ? cebRow.get("prevReadingDate") : null;
                String currDateStr = cebRow != null ? cebRow.get("currReadingDate") : null;

                Map<String, Object> ngenRow = stagedNgen.get(accountNo);
                Double kwhImport = ngenRow != null && ngenRow.get("kwhImport") != null ? ((Number) ngenRow.get("kwhImport")).doubleValue() : 0.0;
                Double kwhExport = ngenRow != null && ngenRow.get("kwhExport") != null ? ((Number) ngenRow.get("kwhExport")).doubleValue() : 0.0;
                Double kwhSales = kwhExport - kwhImport;

                Map<String, Object> finalBillingData = new LinkedHashMap<>();
                finalBillingData.put("rowNum", r + 1);
                finalBillingData.put("accountNo", accountNo);
                finalBillingData.put("customerName", customerName);
                finalBillingData.put("prevReadingDate", prevDateStr);
                finalBillingData.put("currReadingDate", currDateStr);
                finalBillingData.put("kwhImport", kwhImport);
                finalBillingData.put("kwhExport", kwhExport);
                finalBillingData.put("kwhSales", kwhSales);
                finalBillingData.put("unitRate", unitRate);
                finalBillingData.put("energyPurchase", energyPurchase != null ? energyPurchase : 0.0);
                finalBillingData.put("billSetOff", billSetOff != null ? billSetOff : 0.0);
                finalBillingData.put("retentionMoney", retentionMoney != null ? retentionMoney : 0.0);
                finalBillingData.put("payment", payment != null ? payment : 0.0);

                List<ExcelValidationError> errorsList = new ArrayList<>();
                if (masterCust == null && !customerRepository.existsById(accountNo)) {
                    errorsList.add(new ExcelValidationError("NPAY", r + 1, "Account No",
                            "Account No not found in customer database or Master Data", false));
                }

                String npayNetType = colMap.get("solartype") != null ? strVal(row, colMap.get("solartype")) : null;
                if (solarType != null && npayNetType != null && !npayNetType.trim().isEmpty()) {
                    String normMasterType = ExcelValidationService.normalizeSolarType(solarType);
                    String normNpayType = ExcelValidationService.normalizeSolarType(npayNetType);
                    if (normMasterType != null && normNpayType != null && !normMasterType.equals(normNpayType)) {
                        errorsList.add(new ExcelValidationError("NPAY", r + 1, "Net Type",
                                String.format("Net Type Mismatch: NPAY='%s', Master Data='%s'", npayNetType, solarType), false));
                    }
                }

                String valStatus = errorsList.isEmpty() ? "VALID" : "ERROR";
                List<Map<String, Object>> structuredErrors = new ArrayList<>();
                for (ExcelValidationError err : errorsList) {
                    Map<String, Object> errMap = new LinkedHashMap<>();
                    errMap.put("field", err.getField());
                    errMap.put("errorMessage", err.getErrorMessage());
                    errMap.put("warning", err.isWarning());
                    structuredErrors.add(errMap);
                }

                BillingUploadStaging staging = new BillingUploadStaging(
                        uploadId,
                        mapper.writeValueAsString(finalBillingData),
                        valStatus,
                        mapper.writeValueAsString(structuredErrors),
                        "BILLING"
                );
                billingUploadStagingRepository.save(staging);
                if (!errorsList.isEmpty()) totalErrorRows++;
            }
        }
        return totalErrorRows;
    }

    @Transactional
    public void generateMainDataset(Long sessionId) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));

        List<Map<String, Object>> cebStaged = loadCebDataFromStaging(sessionId);
        Map<String, Map<String, Object>> cebMap = new HashMap<>();
        for (Map<String, Object> c : cebStaged) {
            String acc = (String) c.get("accountNo");
            if (acc != null) cebMap.put(acc.trim(), c);
        }

        List<Map<String, Object>> ngenStaged = loadNgenDataFromStaging(sessionId);
        Map<String, Map<String, Object>> ngenMap = new HashMap<>();
        Map<String, Integer> ngenCounts = new HashMap<>();
        Map<String, List<Map<String, Object>>> ngenAll = new LinkedHashMap<>();
        for (Map<String, Object> n : ngenStaged) {
            String acc = (String) n.get("accountNo");
            if (acc != null) {
                String key = acc.trim();
                ngenMap.putIfAbsent(key, n);
                ngenCounts.merge(key, 1, Integer::sum);
                ngenAll.computeIfAbsent(key, k -> new ArrayList<>()).add(n);
            }
        }

        List<Map<String, Object>> npayStaged = loadNpayDataFromStaging(sessionId);
        Map<String, Map<String, Object>> npayMap = new HashMap<>();
        Map<String, Integer> npayCounts = new HashMap<>();
        Map<String, List<Map<String, Object>>> npayAll = new LinkedHashMap<>();
        for (Map<String, Object> p : npayStaged) {
            String acc = (String) p.get("accountNo");
            if (acc != null) {
                String key = acc.trim();
                npayMap.putIfAbsent(key, p);
                npayCounts.merge(key, 1, Integer::sum);
                npayAll.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
            }
        }

        // Gather all unique account numbers from CEB, NGEN, and NPAY only (no Master Data)
        Set<String> allAccounts = new HashSet<>();
        allAccounts.addAll(cebMap.keySet());
        allAccounts.addAll(ngenMap.keySet());
        allAccounts.addAll(npayMap.keySet());

        List<Map<String, Object>> mergedList = new ArrayList<>();
        List<Map<String, Object>> rejectedList = new ArrayList<>();
        int rowIdx = 1;

        for (String acc : allAccounts) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("rowNum", rowIdx++);
            row.put("accountNo", acc);

            // No Master Data lookup in Step 5 — only CEB, NGEN, NPAY
            row.put("customerName", "—");
            row.put("customerAddress", "—");
            row.put("refNo", "—");
            row.put("costCode", "—");
            row.put("mobileNo", "—");
            row.put("panelCapacity", null);
            row.put("agreementDate", null);
            row.put("bankCode", "—");
            row.put("branchCode", "—");
            row.put("bankAccountNo", "—");
            row.put("solarType", null);
            row.put("tariffType", null);
            row.put("billingMode", null);

            Map<String, Object> ceb = cebMap.get(acc);
            Map<String, Object> ngen = ngenMap.get(acc);
            Map<String, Object> npay = npayMap.get(acc);
            boolean hasCeb = ceb != null;
            boolean hasNgen = ngen != null;
            boolean hasNpay = npay != null;
            row.put("hasCeb", hasCeb);
            row.put("hasNgen", hasNgen);
            row.put("hasNpay", hasNpay);

            int ngc = ngenCounts.getOrDefault(acc, 0);
            int npc = npayCounts.getOrDefault(acc, 0);
            row.put("ngenSourceCount", ngc);
            row.put("npaySourceCount", npc);

            // ── 1. CEB Assist fields: Account No, Previous/Current Reading Date ──
            String prevReadingDate = hasCeb ? (String) ceb.get("prevReadingDate") : null;
            String currReadingDate = hasCeb ? (String) ceb.get("currReadingDate") : null;
            row.put("prevReadingDate", prevReadingDate);
            row.put("currReadingDate", currReadingDate);
            String cebName = hasCeb ? (String) ceb.get("customerName") : null;
            row.put("cebName", cebName != null ? cebName : "");

            // ── 2. NGEN fields ──
            Double kwhImport = numOrNull(ngen, "kwhImport");
            Double kwhExport = numOrNull(ngen, "kwhExport");
            Double kwhSales = numOrNull(ngen, "kwhSales");
            Double ngenUnitRate = numOrNull(ngen, "ngenUnitRate");
            Double ngenBillSetOff = numOrNull(ngen, "billSetOff");
            Double ngenRetentionMoney = numOrNull(ngen, "retentionMoney");
            Double ngenSalesAmount = numOrNull(ngen, "salesAmount");
            Double ngenPaymentSettled = numOrNull(ngen, "paymentSettled");
            Double ngenOutstandingBalance = numOrNull(ngen, "outstandingBalance");
            String ngenNetType = hasNgen ? (String) ngen.get("ngenNetType") : null;

            row.put("kwhImport", kwhImport);
            row.put("kwhExport", kwhExport);
            row.put("kwhSales", kwhSales);
            row.put("ngenUnitRate", ngenUnitRate);
            row.put("unitRate", ngenUnitRate);
            row.put("ngenBillSetOff", ngenBillSetOff);
            row.put("ngenRetentionMoney", ngenRetentionMoney);
            row.put("ngenNetType", ngenNetType);
            row.put("salesAmount", ngenSalesAmount);
            row.put("paymentSettled", ngenPaymentSettled);
            // Carry the NGEN Outstanding Balance through unchanged so it reaches Step 6. It is a
            // pass-through display value only — never recalculated and not a required validation field.
            row.put("outstandingBalance", ngenOutstandingBalance);

            // ── 3. NPAY fields ──
            String npayNetType = hasNpay ? (String) npay.get("npayNetType") : null;
            String npayName = hasNpay ? (String) npay.get("npayName") : null;
            Double npayEnergyPurchase = numOrNull(npay, "energyPurchase");
            Double npayBillSetOff = numOrNull(npay, "billSetOff");
            Double npayRetentionMoney = numOrNull(npay, "retentionMoney");
            Double npayPayment = numOrNull(npay, "payment");

            row.put("npayNetType", npayNetType);
            row.put("npayName", npayName);
            row.put("npayEnergyPurchase", npayEnergyPurchase);
            row.put("npayBillSetOff", npayBillSetOff);
            row.put("npayRetentionMoney", npayRetentionMoney);
            row.put("npayPayment", npayPayment);

            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            List<String> missingFields = new ArrayList<>();
            List<String> mismatchFields = new ArrayList<>();

            // ── 4. Build merged equivalent fields (NGEN vs NPAY) ──
            Map<String, Object> mergedNetType = buildMergedType(ngenNetType, npayNetType);
            Map<String, Object> mergedEnergyPurchase = buildMergedNum(ngenSalesAmount, npayEnergyPurchase, hasNgen, hasNpay);
            Map<String, Object> mergedBillSetOff = buildMergedNum(ngenBillSetOff, npayBillSetOff, hasNgen, hasNpay);
            Map<String, Object> mergedRetentionMoney = buildMergedNum(ngenRetentionMoney, npayRetentionMoney, hasNgen, hasNpay);
            Map<String, Object> mergedPayment = buildMergedNum(ngenPaymentSettled, npayPayment, hasNgen, hasNpay);
            row.put("mergedNetType", mergedNetType);
            row.put("mergedEnergyPurchase", mergedEnergyPurchase);
            row.put("mergedBillSetOff", mergedBillSetOff);
            row.put("mergedRetentionMoney", mergedRetentionMoney);
            row.put("mergedPayment", mergedPayment);

            // Effective flat values (NPAY preferred when present, else NGEN) for Step 6 / finalize
            row.put("energyPurchase", effectiveNum(hasNpay, npayEnergyPurchase, ngenSalesAmount));
            row.put("billSetOff", effectiveNum(hasNpay, npayBillSetOff, ngenBillSetOff));
            row.put("retentionMoney", effectiveNum(hasNpay, npayRetentionMoney, ngenRetentionMoney));
            row.put("payment", effectiveNum(hasNpay, npayPayment, ngenPaymentSettled));

            // ── 5. Missing value detection across the three files ──
            if (!hasCeb) {
                errors.add("No CEB Assist data found for this account");
                missingFields.add("CEB Assist record");
            } else {
                if (isBlank(prevReadingDate)) { missingFields.add("Previous Reading Date (CEB)"); errors.add("Missing value: Previous Reading Date (CEB)"); }
                if (isBlank(currReadingDate)) { missingFields.add("Current Reading Date (CEB)"); errors.add("Missing value: Current Reading Date (CEB)"); }
            }
            if (!hasNgen) {
                errors.add("No NGEN billing data found for this account");
                missingFields.add("NGEN record");
            } else {
                if (kwhImport == null) { missingFields.add("kWh Import (NGEN)"); errors.add("Missing value: kWh Import (NGEN)"); }
                if (kwhExport == null) { missingFields.add("kWh Export (NGEN)"); errors.add("Missing value: kWh Export (NGEN)"); }
                if (kwhSales == null) { missingFields.add("kWh Unit Sales (NGEN)"); errors.add("Missing value: kWh Unit Sales (NGEN)"); }
                if (ngenUnitRate == null) { missingFields.add("Unit Rate (NGEN)"); errors.add("Missing value: Unit Rate (NGEN)"); }
                if (ngenSalesAmount == null) { missingFields.add("kWh Sales Amount (NGEN)"); errors.add("Missing value: kWh Sales Amount (NGEN)"); }
                if (isBlank(ngenNetType)) { missingFields.add("Net Type (NGEN)"); errors.add("Missing value: Net Type (NGEN)"); }
            }
            if (!hasNpay) {
                errors.add("No NPAY billing data found for this account");
                missingFields.add("NPAY record");
            } else {
                if (isBlank(npayName)) { missingFields.add("Name (NPAY)"); errors.add("Missing value: Name (NPAY)"); }
                if (isBlank(npayNetType)) { missingFields.add("Net Type (NPAY)"); errors.add("Missing value: Net Type (NPAY)"); }
                if (npayEnergyPurchase == null) { missingFields.add("Energy Purchase (NPAY)"); errors.add("Missing value: Energy Purchase (NPAY)"); }
            }

            // ── 6. Mismatch detection on merged fields ──
            if (Boolean.TRUE.equals(mergedNetType.get("mismatch"))) {
                mismatchFields.add("Net Type");
                warnings.add(String.format("Net Type mismatch: NGEN='%s', NPAY='%s'", ngenNetType, npayNetType));
            }
            if (Boolean.TRUE.equals(mergedEnergyPurchase.get("mismatch"))) {
                mismatchFields.add("Energy Purchase / kWh Sales Amount");
                warnings.add(String.format("Energy Purchase / kWh Sales Amount mismatch: NGEN=%.2f, NPAY=%.2f", ngenSalesAmount, npayEnergyPurchase));
            }
            if (Boolean.TRUE.equals(mergedBillSetOff.get("mismatch"))) {
                mismatchFields.add("Bill Set Off");
                warnings.add(String.format("Bill Set Off mismatch: NGEN=%.2f, NPAY=%.2f", ngenBillSetOff, npayBillSetOff));
            }
            if (Boolean.TRUE.equals(mergedRetentionMoney.get("mismatch"))) {
                mismatchFields.add("Retention Money");
                warnings.add(String.format("Retention Money mismatch: NGEN=%.2f, NPAY=%.2f", ngenRetentionMoney, npayRetentionMoney));
            }
            if (Boolean.TRUE.equals(mergedPayment.get("mismatch"))) {
                mismatchFields.add("Payment");
                warnings.add(String.format("Payment mismatch: NGEN=%.2f, NPAY=%.2f", ngenPaymentSettled, npayPayment));
            }

            // ── 7. Duplicate detection (Account No carried more than once from NGEN/NPAY) ──
            // The merged row is the single reconciled record for this account. Every duplicate
            // source occurrence (including the first) is emitted as its own review-only row after
            // this loop, so the merged row is NOT itself flagged/counted as a duplicate — otherwise
            // it would double-count against the totals detected in Step 3 (NGEN) and Step 4 (NPAY).
            // An informational note is kept so reviewers can see it has duplicate source records.
            boolean isDuplicate = ngc > 1 || npc > 1;
            if (isDuplicate) {
                List<String> src = new ArrayList<>();
                if (ngc > 1) src.add("NGEN (" + ngc + " records)");
                if (npc > 1) src.add("NPAY (" + npc + " records)");
                String dupReason = "Duplicate Account No carried from " + String.join(" and ", src)
                        + " — see the Duplicates list for every source record";
                row.put("duplicateReason", dupReason);
                row.put("hasDuplicateSources", true);
            }

            // ── 8. Errors: missing/invalid Account No ──
            if (acc == null || acc.trim().isEmpty()) {
                errors.add("Account No is missing");
            }

            // ── 9. Incomplete merges (an Account No missing an entire CEB / NGEN / NPAY source
            //        record) are auto-rejected: removed from the Main Dataset and collected in a
            //        separate Rejected list for review. They are never carried into Step 6 / import.
            boolean incomplete = !hasCeb || !hasNgen || !hasNpay;
            if (incomplete) {
                List<String> missSrc = new ArrayList<>();
                if (!hasCeb) missSrc.add("CEB Assist");
                if (!hasNgen) missSrc.add("NGEN");
                if (!hasNpay) missSrc.add("NPAY");
                row.put("rejected", true);
                row.put("rejectionReason", "Incomplete merge — missing source file(s): " + String.join(", ", missSrc));
            }

            // ── 10. Status precedence: REJECTED > ERROR > WARNING > VALID ──
            // Duplicates are represented by dedicated source rows (built below) and are not a
            // status of the merged row itself, so DUPLICATE is intentionally not in this precedence.
            String status;
            if (incomplete) status = "REJECTED";
            else if (!errors.isEmpty()) status = "ERROR";
            else if (!warnings.isEmpty()) status = "WARNING";
            else status = "VALID";

            row.put("errors", errors);
            row.put("warnings", warnings);
            row.put("missingFields", missingFields);
            row.put("mismatchFields", mismatchFields);
            row.put("status", status);

            if (incomplete) rejectedList.add(row);
            else mergedList.add(row);
        }

        // ── Build separate duplicate-record rows so EVERY duplicate occurrence is visible ──
        // For every source (NGEN / NPAY) that carries an Account No more than once we emit one
        // review-only row per occurrence, including the first ("original"). This keeps the Step 5
        // Duplicates section a complete, faithful mirror of the duplicates detected in Step 3
        // (NGEN) and Step 4 (NPAY): the number of DUPLICATE rows here equals the totals flagged in
        // those steps, and no occurrence is collapsed into the merged row. These rows are display /
        // review-only and are NOT carried into Step 6 or the final import (only the merged row is).
        List<Map<String, Object>> dupEntries = new ArrayList<>();
        for (String acc : allAccounts) {
            int ngc = ngenCounts.getOrDefault(acc, 0);
            int npc = npayCounts.getOrDefault(acc, 0);
            if (ngc <= 1 && npc <= 1) continue;
            List<String> src = new ArrayList<>();
            if (ngc > 1) src.add("NGEN (" + ngc + " records)");
            if (npc > 1) src.add("NPAY (" + npc + " records)");
            String dupReason = "Duplicate Account No carried from " + String.join(" and ", src);

            if (ngc > 1) {
                List<Map<String, Object>> nList = ngenAll.getOrDefault(acc, Collections.emptyList());
                Object originalRowNum = nList.isEmpty() ? null : nList.get(0).get("rowNum");
                for (int k = 0; k < nList.size(); k++) {
                    dupEntries.add(buildDuplicateEntryRow(rowIdx++, acc, true, nList.get(k), dupReason,
                            "NGEN occurrence " + (k + 1) + " of " + nList.size() + (k == 0 ? " (original)" : ""),
                            k == 0, originalRowNum));
                }
            }
            if (npc > 1) {
                List<Map<String, Object>> pList = npayAll.getOrDefault(acc, Collections.emptyList());
                Object originalRowNum = pList.isEmpty() ? null : pList.get(0).get("rowNum");
                for (int k = 0; k < pList.size(); k++) {
                    dupEntries.add(buildDuplicateEntryRow(rowIdx++, acc, false, pList.get(k), dupReason,
                            "NPAY occurrence " + (k + 1) + " of " + pList.size() + (k == 0 ? " (original)" : ""),
                            k == 0, originalRowNum));
                }
            }
        }
        MAIN_DUP_CACHE.put(sessionId, dupEntries);
        MAIN_REJECTED_CACHE.put(sessionId, rejectedList);

        MAIN_DATA_CACHE.put(sessionId, mergedList);
        session.setStage("MAIN_DATASET_GENERATED");
        sessionRepository.save(session);
    }

    public List<Map<String, Object>> getMainDataset(Long sessionId) {
        return MAIN_DATA_CACHE.getOrDefault(sessionId, new ArrayList<>());
    }

    @Transactional
    public Map<String, Object> approveMainDataset(Long sessionId, String username,
                                                  Map<String, Map<String, Object>> corrections) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));

        List<Map<String, Object>> mainDataset = getMainDataset(sessionId);
        if (mainDataset.isEmpty()) {
            throw new IllegalStateException("No Main Dataset found. Please approve files first.");
        }

        List<Map<String, Object>> correctedDataset = new ArrayList<>();
        for (Map<String, Object> row : mainDataset) {
            String accountNo = (String) row.get("accountNo");
            String rowNumStr = String.valueOf(row.get("rowNum"));

            Map<String, Object> corr = null;
            if (corrections != null) {
                if (corrections.containsKey(rowNumStr)) {
                    corr = corrections.get(rowNumStr);
                } else if (accountNo != null && corrections.containsKey(accountNo)) {
                    corr = corrections.get(accountNo);
                }
            }

            if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                Map<String, Object> finalRow = new LinkedHashMap<>(row);
                finalRow.put("deleted", true);
                correctedDataset.add(finalRow);
                continue;
            }

            Map<String, Object> finalRow = new LinkedHashMap<>(row);
            if (corr != null) {
                finalRow.putAll(corr);
            }
            revalidateMergedRow(finalRow);
            correctedDataset.add(finalRow);
        }

        MAIN_DATA_CACHE.put(sessionId, correctedDataset);

        // Duplicate source rows and rejected (incomplete merge) rows are review-only for Step 5
        // and are not carried downstream.
        MAIN_DUP_CACHE.remove(sessionId);
        MAIN_REJECTED_CACHE.remove(sessionId);

        session.setStage("MAIN_DATASET_APPROVED");
        sessionRepository.save(session);

        auditLogService.log("MAIN_DATASET_APPROVED",
                String.format("Main Dataset cross-file validation approved by %s for session %d.", username, sessionId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", "MAIN_DATASET_APPROVED");
        result.put("message", "Main dataset cross-file validation approved successfully.");
        return result;
    }

    /**
     * Re-applies corrections and recomputes merge/mismatch/duplicate/status for every row without
     * advancing the session stage. Used by the Step 5 "Revalidate" action so officers can see the
     * effect of their edits before approving. Deleted rows are dropped from the returned dataset.
     */
    @Transactional
    public List<Map<String, Object>> revalidateMainDataset(Long sessionId,
                                                           Map<String, Map<String, Object>> corrections) {
        List<Map<String, Object>> mainDataset = getMainDataset(sessionId);
        if (mainDataset.isEmpty()) {
            throw new IllegalStateException("No Main Dataset found. Please approve files first.");
        }

        // Revalidate the merged primary rows (kept in MAIN_DATA_CACHE, used downstream).
        MAIN_DATA_CACHE.put(sessionId, applyCorrectionsAndRevalidate(mainDataset, corrections));
        // Revalidate the display-only duplicate rows separately (kept in MAIN_DUP_CACHE).
        List<Map<String, Object>> dups = MAIN_DUP_CACHE.getOrDefault(sessionId, new ArrayList<>());
        MAIN_DUP_CACHE.put(sessionId, applyCorrectionsAndRevalidate(dups, corrections));
        // Revalidate the review-only rejected (incomplete merge) rows separately (kept in MAIN_REJECTED_CACHE).
        List<Map<String, Object>> rejected = MAIN_REJECTED_CACHE.getOrDefault(sessionId, new ArrayList<>());
        MAIN_REJECTED_CACHE.put(sessionId, applyCorrectionsAndRevalidate(rejected, corrections));

        return getMainDatasetWithDuplicates(sessionId);
    }

    // Applies row-keyed corrections (skipping deleted rows) and revalidates each surviving row.
    private List<Map<String, Object>> applyCorrectionsAndRevalidate(List<Map<String, Object>> rows,
                                                                    Map<String, Map<String, Object>> corrections) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String accountNo = (String) row.get("accountNo");
            String rowNumStr = String.valueOf(row.get("rowNum"));

            Map<String, Object> corr = null;
            if (corrections != null) {
                if (corrections.containsKey(rowNumStr)) {
                    corr = corrections.get(rowNumStr);
                } else if (accountNo != null && corrections.containsKey(accountNo)) {
                    corr = corrections.get(accountNo);
                }
            }

            if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                continue;
            }

            Map<String, Object> finalRow = new LinkedHashMap<>(row);
            if (corr != null) {
                finalRow.putAll(corr);
            }
            revalidateMergedRow(finalRow);
            out.add(finalRow);
        }
        return out;
    }

    // ════════════════════════════════════════════════════════════════════
    //  STEP 6 — MASTER DATA COMPARISON
    // ════════════════════════════════════════════════════════════════════

    @Transactional
    public Map<String, Object> compareWithMasterData(Long sessionId) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));

        if (!"MAIN_DATASET_APPROVED".equals(session.getStage())) {
            throw new IllegalStateException("Main Dataset must be approved first. Current stage: " + session.getStage());
        }

        List<Map<String, Object>> mainDataset = getMainDataset(sessionId);
        if (mainDataset.isEmpty()) {
            throw new IllegalStateException("No Main Dataset found. Please complete Step 5 first.");
        }

        // Load Master Data
        List<Map<String, Object>> masterStaged = loadMasterDataFromStaging(sessionId);
        Map<String, Map<String, Object>> masterMap = new HashMap<>();
        for (Map<String, Object> m : masterStaged) {
            String acc = (String) m.get("accountNo");
            if (acc != null) masterMap.put(acc.trim(), m);
        }

        // ── Carry the approved NGEN "Outstanding Balance" through to Step 6 ──
        //    Step 5 merges NGEN by first occurrence per Account No but does not copy the
        //    Outstanding Balance into the merged row. Map it here by Account No so it can be
        //    surfaced in the final Step 6 preview. The value is preserved exactly as imported
        //    from NGEN (Step 3) — no recalculation or modification. The first NGEN occurrence
        //    per account is used, matching the Step 5 merge choice.
        Map<String, Object> ngenOutstandingByAcc = new HashMap<>();
        for (Map<String, Object> n : loadNgenDataFromStaging(sessionId)) {
            String nAcc = n.get("accountNo") != null ? n.get("accountNo").toString().trim() : null;
            if (nAcc == null || nAcc.isEmpty()) continue;
            ngenOutstandingByAcc.putIfAbsent(nAcc, n.get("outstandingBalance"));
        }

        List<Map<String, Object>> enrichedList = new ArrayList<>();
        int matchCount = 0;
        int mismatchCount = 0;
        int notFoundCount = 0;
        // Tracks approved Master Data accounts that were matched by a Main Data Set row, so the
        // remaining (unmatched) Master Data records can be preserved as base rows afterwards.
        Set<String> matchedMasterAccounts = new HashSet<>();

        for (Map<String, Object> row : mainDataset) {
            Map<String, Object> enriched = new LinkedHashMap<>(row);
            String acc = (String) row.get("accountNo");

            // Surface the NGEN Outstanding Balance for this Account No, preserving the imported
            // value exactly. If NGEN has no matching record the field stays empty (null).
            if (acc != null && ngenOutstandingByAcc.containsKey(acc.trim())) {
                enriched.put("outstandingBalance", ngenOutstandingByAcc.get(acc.trim()));
            }

            Map<String, Object> masterCust = masterMap.get(acc);
            List<String> errors = new ArrayList<>(row.get("errors") != null ? (List<String>) row.get("errors") : Collections.emptyList());
            List<String> warnings = new ArrayList<>(row.get("warnings") != null ? (List<String>) row.get("warnings") : Collections.emptyList());

            if (masterCust != null) {
                // Enrich with Master Data profile
                String masterName = masterCust.get("customerName") != null ? masterCust.get("customerName").toString() : "—";
                String masterAddress = masterCust.get("customerAddress") != null ? masterCust.get("customerAddress").toString() : "—";
                String masterRefNo = masterCust.get("refNo") != null ? masterCust.get("refNo").toString() : "—";
                String masterCostCode = masterCust.get("costCode") != null ? masterCust.get("costCode").toString() : "—";
                String masterMobile = masterCust.get("mobileNo") != null ? masterCust.get("mobileNo").toString() : "—";
                Double masterPanelCap = masterCust.get("panelCapacity") != null && !masterCust.get("panelCapacity").toString().isEmpty()
                        ? ((Number) masterCust.get("panelCapacity")).doubleValue() : null;
                String masterAgrDate = masterCust.get("agreementDate") != null ? masterCust.get("agreementDate").toString() : null;
                String masterBankCode = masterCust.get("bankCode") != null ? masterCust.get("bankCode").toString() : "—";
                String masterBranchCode = masterCust.get("branchCode") != null ? masterCust.get("branchCode").toString() : "—";
                String masterBankAcct = masterCust.get("bankAccountNo") != null ? masterCust.get("bankAccountNo").toString() : "—";
                String masterSolarType = masterCust.get("solarType") != null ? masterCust.get("solarType").toString() : null;
                String masterTariffType = masterCust.get("tariffType") != null ? masterCust.get("tariffType").toString() : null;
                String masterBillingMode = masterCust.get("billingMode") != null ? masterCust.get("billingMode").toString() : null;
                Double masterUnitRate = masterCust.get("unitRate") != null && !masterCust.get("unitRate").toString().isEmpty()
                        ? ((Number) masterCust.get("unitRate")).doubleValue() : null;

                enriched.put("customerName", masterName);
                enriched.put("customerAddress", masterAddress);
                enriched.put("refNo", masterRefNo);
                enriched.put("costCode", masterCostCode);
                enriched.put("mobileNo", masterMobile);
                enriched.put("panelCapacity", masterPanelCap);
                enriched.put("agreementDate", masterAgrDate);
                enriched.put("bankCode", masterBankCode);
                enriched.put("branchCode", masterBranchCode);
                enriched.put("bankAccountNo", masterBankAcct);
                enriched.put("solarType", masterSolarType);
                enriched.put("tariffType", masterTariffType);
                enriched.put("billingMode", masterBillingMode);
                enriched.put("unitRate", masterUnitRate);
                enriched.put("masterDataFound", true);

                // Cross-file comparisons with Master Data
                String ngenNetType = (String) row.get("ngenNetType");
                String npayNetType = (String) row.get("npayNetType");

                if (masterSolarType != null) {
                    String normMaster = ExcelValidationService.normalizeSolarType(masterSolarType);
                    if (ngenNetType != null) {
                        String normNgen = ExcelValidationService.normalizeSolarType(ngenNetType);
                        if (normMaster != null && normNgen != null && !normMaster.equals(normNgen)) {
                            errors.add(String.format("Net Type Mismatch: NGEN='%s', Master='%s'", ngenNetType, masterSolarType));
                        }
                    }
                    if (npayNetType != null) {
                        String normNpay = ExcelValidationService.normalizeSolarType(npayNetType);
                        if (normMaster != null && normNpay != null && !normMaster.equals(normNpay)) {
                            errors.add(String.format("Net Type Mismatch: NPAY='%s', Master='%s'", npayNetType, masterSolarType));
                        }
                    }
                }

                // Name comparison: NPAY Name vs Master Name
                String npayName = (String) row.get("npayName");
                if (masterName != null && !"—".equals(masterName) && npayName != null && !npayName.trim().isEmpty()) {
                    // Tolerant name comparison: normalizes case/spaces/punctuation, strips titles and
                    // matches reordered names, initials, abbreviations and minor spelling variants.
                    // Only names that clearly refer to different people raise a mismatch warning.
                    if (!namesMatch(masterName, npayName)) {
                        warnings.add(String.format("Name mismatch: NPAY='%s', Master='%s'", npayName, masterName));
                    }
                }

                matchedMasterAccounts.add(acc);
                matchCount++;
            } else {
                // Check DB for existing customer
                Optional<Customer> cOpt = customerRepository.findById(acc);
                if (cOpt.isPresent()) {
                    Customer c = cOpt.get();
                    enriched.put("customerName", c.getCustomerName() != null ? c.getCustomerName() : "—");
                    enriched.put("customerAddress", c.getCustomerAddress() != null ? c.getCustomerAddress() : "—");
                    enriched.put("refNo", c.getRefNo() != null ? c.getRefNo() : "—");
                    enriched.put("mobileNo", c.getMobileNo() != null ? c.getMobileNo() : "—");
                    enriched.put("bankCode", c.getBankCode() != null ? c.getBankCode() : "—");
                    enriched.put("branchCode", c.getBranchCode() != null ? c.getBranchCode() : "—");
                    enriched.put("bankAccountNo", c.getBankAccountNo() != null ? c.getBankAccountNo() : "—");
                    enriched.put("solarType", c.getSolarType());
                    enriched.put("billingMode", c.getExpenseCode() != null ? c.getExpenseCode().getExpCode() : null);
                    enriched.put("unitRate", c.getUnitRate());
                    enriched.put("masterDataFound", true);
                    matchCount++;
                } else {
                    enriched.put("masterDataFound", false);
                    errors.add("Account No not found in Master Data or customer database");
                    notFoundCount++;
                }
            }

            enriched.put("errors", errors);
            enriched.put("warnings", warnings);
            enriched.put("status", !errors.isEmpty() ? "ERROR" : !warnings.isEmpty() ? "WARNING" : "VALID");
            if (!errors.isEmpty()) mismatchCount++;
            enrichedList.add(enriched);
        }

        // ── Preserve EVERY approved Master Data record ──────────────────────
        //    The loop above walks the Main Data Set, so a Master Data account with no matching
        //    Main row would otherwise be dropped from Step 6. Here we add those Master Data
        //    records back as base rows, keeping every Master Data column exactly as stored, and
        //    mark the imported (Main Data Set) fields as missing ("—"/null). No comparison,
        //    merge, validation or approval logic for the existing rows is changed.
        int masterOnlyCount = 0;
        int nextRowNum = 0;
        for (Map<String, Object> e : enrichedList) {
            Object rn = e.get("rowNum");
            if (rn instanceof Number) nextRowNum = Math.max(nextRowNum, ((Number) rn).intValue());
        }
        for (Map<String, Object> m : masterStaged) {
            String mAcc = m.get("accountNo") != null ? m.get("accountNo").toString().trim() : null;
            if (mAcc == null || mAcc.isEmpty() || matchedMasterAccounts.contains(mAcc)) continue;

            // Base row = the Master Data record itself, preserving every Master column as stored.
            Map<String, Object> enriched = new LinkedHashMap<>(m);
            enriched.put("accountNo", mAcc);
            enriched.put("rowNum", ++nextRowNum);
            enriched.put("masterDataFound", true);
            // Display-only in Step 6: this Master Data account has no billing to import, so it is
            // excluded from the final billing insertion (its customer profile is still saved).
            enriched.put("masterOnly", true);

            // Imported Main Data Set fields have no matching account — mark them as missing.
            enriched.put("prevReadingDate", "—");
            enriched.put("currReadingDate", "—");
            enriched.put("kwhImport", null);
            enriched.put("kwhExport", null);
            enriched.put("kwhSales", null);
            enriched.put("energyPurchase", null);
            enriched.put("salesAmount", null);
            enriched.put("billSetOff", null);
            enriched.put("retentionMoney", null);
            enriched.put("payment", null);
            enriched.put("paymentSettled", null);
            enriched.put("outstandingBalance", null);

            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            warnings.add("No matching Main Data Set (billing) record — imported fields marked as missing.");
            enriched.put("errors", errors);
            enriched.put("warnings", warnings);
            enriched.put("status", "WARNING");
            enrichedList.add(enriched);
            masterOnlyCount++;
        }

        // ── Preserve the approved Master Data ordering ──────────────────────
        //    Display and finalize records in Master Data sequence, using Ref No
        //    as the primary sort key (e.g. 462-0001, 462-0002, … 462-0539). Rows
        //    without a usable Ref No keep their original Master Data order (the
        //    sort is stable). This only reorders rows — no comparison / merge /
        //    validation / approval logic is changed.
        enrichedList.sort((a, b) -> {
            String ra = refNoSortKey(a);
            String rb = refNoSortKey(b);
            boolean ea = ra.isEmpty();
            boolean eb = rb.isEmpty();
            if (ea && eb) return 0;
            if (ea) return 1;
            if (eb) return -1;
            return naturalCompare(ra, rb);
        });

        // Store enriched dataset (replaces the Step 5 dataset in cache)
        MAIN_DATA_CACHE.put(sessionId, enrichedList);
        session.setStage("MASTER_COMPARISON_GENERATED");
        sessionRepository.save(session);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", "MASTER_COMPARISON_GENERATED");
        result.put("totalRecords", enrichedList.size());
        result.put("matchedCount", matchCount);
        result.put("mismatchCount", mismatchCount);
        result.put("notFoundCount", notFoundCount);
        result.put("masterOnlyCount", masterOnlyCount);
        result.put("rows", enrichedList);
        result.put("message", String.format("Master Data comparison complete. %d matched, %d mismatches, %d not found, %d master-only (no billing).", matchCount, mismatchCount, notFoundCount, masterOnlyCount));
        return result;
    }

    /** Extracts a trimmed Ref No sort key; treats null / blank / "—" as absent. */
    private static String refNoSortKey(Map<String, Object> row) {
        Object v = row.get("refNo");
        if (v == null) return "";
        String s = v.toString().trim();
        return "—".equals(s) ? "" : s;
    }

    /**
     * Natural (human) ordering so numeric segments sort by value, keeping Ref Nos
     * such as 462-0001 … 462-0539 in true ascending order regardless of digit
     * width. Non-numeric segments compare case-insensitively.
     */
    private static int naturalCompare(String a, String b) {
        int i = 0, j = 0, la = a.length(), lb = b.length();
        while (i < la && j < lb) {
            char ca = a.charAt(i);
            char cb = b.charAt(j);
            if (Character.isDigit(ca) && Character.isDigit(cb)) {
                int si = i, sj = j;
                while (i < la && Character.isDigit(a.charAt(i))) i++;
                while (j < lb && Character.isDigit(b.charAt(j))) j++;
                String na = a.substring(si, i).replaceFirst("^0+(?=\\d)", "");
                String nb = b.substring(sj, j).replaceFirst("^0+(?=\\d)", "");
                if (na.length() != nb.length()) return na.length() - nb.length();
                int cmp = na.compareTo(nb);
                if (cmp != 0) return cmp;
            } else {
                int cmp = Character.toLowerCase(ca) - Character.toLowerCase(cb);
                if (cmp != 0) return cmp;
                i++; j++;
            }
        }
        return (la - i) - (lb - j);
    }

    /** Common honorific / title tokens stripped before comparing names. */
    private static final java.util.Set<String> NAME_TITLES = new java.util.HashSet<>(java.util.Arrays.asList(
            "MR", "MRS", "MS", "MISS", "DR", "REV", "PROF", "MDM", "MADAM", "MASTER", "MESSRS", "SIR", "HON"));

    /**
     * Splits a name into normalized uppercase tokens for comparison:
     *   • upper-cases (case-insensitive),
     *   • treats '.', ',', '-', '(', ')' and any non-alphanumeric char as a separator,
     *   • trims and collapses spaces,
     *   • drops common honorific titles (Mr, Mrs, Dr, Rev, …).
     * e.g. "DR.N. PRATHEESH" -> [N, PRATHEESH]; "A.L.H.Sahabdeen" -> [A, L, H, SAHABDEEN].
     */
    private static java.util.List<String> nameTokens(String s) {
        java.util.List<String> out = new java.util.ArrayList<>();
        if (s == null) return out;
        String n = s.toUpperCase().replaceAll("[^A-Z0-9]", " ").trim();
        if (n.isEmpty()) return out;
        for (String tok : n.split("\\s+")) {
            if (tok.isEmpty() || NAME_TITLES.contains(tok)) continue;
            out.add(tok);
        }
        return out;
    }

    /** True when two significant (multi-letter) name words are close enough to be the same. */
    private static boolean wordsSimilar(String a, String b) {
        if (a.equals(b)) return true;
        int minLen = Math.min(a.length(), b.length());
        // one word is a prefix/suffix of the other (e.g. SAHABDEE ↔ SAHABDEEN, SOTHY ↔ ...SOTHY)
        if (minLen >= 4 && (a.startsWith(b) || b.startsWith(a) || a.endsWith(b) || b.endsWith(a))) return true;
        // minor spelling variants (e.g. SANTHAKUMAR ↔ SHANTHAKUMAR, RAVISHANKAR ↔ RAVISHANGER)
        if (minLen >= 5 && levenshtein(a, b) <= Math.max(2, minLen / 4)) return true;
        return false;
    }

    /**
     * Tolerant person/business name comparison used by Step 6. Two names are considered the same
     * person when they share at least one significant (multi-letter) word after normalization,
     * tolerating reordering, initials vs expanded names, abbreviations and minor spelling variants.
     * Returns false only when the names clearly refer to different people.
     */
    private static boolean namesMatch(String masterName, String npayName) {
        java.util.List<String> ta = nameTokens(masterName);
        java.util.List<String> tb = nameTokens(npayName);
        java.util.List<String> wa = new java.util.ArrayList<>();
        java.util.List<String> wb = new java.util.ArrayList<>();
        for (String t : ta) if (t.length() >= 2) wa.add(t);
        for (String t : tb) if (t.length() >= 2) wb.add(t);
        // If either side is only initials, fall back to comparing the full token sets.
        if (wa.isEmpty() || wb.isEmpty()) {
            return new java.util.HashSet<>(ta).equals(new java.util.HashSet<>(tb));
        }
        for (String a : wa)
            for (String b : wb)
                if (wordsSimilar(a, b)) return true;
        return false;
    }

    /** Standard Levenshtein edit distance (two-row DP). */
    private static int levenshtein(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] tmp = prev; prev = cur; cur = tmp;
        }
        return prev[b.length()];
    }

    @Transactional
    public Map<String, Object> approveMasterComparison(Long sessionId, String username,
                                                      Map<String, Map<String, Object>> corrections) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));

        if (!"MASTER_COMPARISON_GENERATED".equals(session.getStage())) {
            throw new IllegalStateException("Master Data comparison must be generated first. Current stage: " + session.getStage());
        }

        List<Map<String, Object>> mainDataset = getMainDataset(sessionId);
        if (mainDataset.isEmpty()) {
            throw new IllegalStateException("No comparison data found.");
        }

        // Apply corrections
        List<Map<String, Object>> correctedDataset = new ArrayList<>();
        for (Map<String, Object> row : mainDataset) {
            String accountNo = (String) row.get("accountNo");
            String rowNumStr = String.valueOf(row.get("rowNum"));

            Map<String, Object> corr = null;
            if (corrections != null) {
                if (corrections.containsKey(rowNumStr)) {
                    corr = corrections.get(rowNumStr);
                } else if (accountNo != null && corrections.containsKey(accountNo)) {
                    corr = corrections.get(accountNo);
                }
            }

            if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                Map<String, Object> finalRow = new LinkedHashMap<>(row);
                finalRow.put("deleted", true);
                correctedDataset.add(finalRow);
                continue;
            }

            Map<String, Object> finalRow = new LinkedHashMap<>(row);
            if (corr != null) {
                finalRow.putAll(corr);
            }
            correctedDataset.add(finalRow);
        }

        MAIN_DATA_CACHE.put(sessionId, correctedDataset);
        session.setMasterComparisonApproved(true);
        session.setStage("MASTER_COMPARISON_APPROVED");
        sessionRepository.save(session);

        auditLogService.log("MASTER_COMPARISON_APPROVED",
                String.format("Master Data comparison approved by %s for session %d.", username, sessionId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", "MASTER_COMPARISON_APPROVED");
        result.put("message", "Master Data comparison approved. Ready to finalize.");
        return result;
    }

    private void revalidateMergedRow(Map<String, Object> row) {
        // Duplicate-entry rows are single-source review-only records — revalidate them lightly
        // (rebuild merged display, keep status DUPLICATE) without cross-file missing-value checks.
        if (Boolean.TRUE.equals(row.get("isDuplicateEntry"))) {
            revalidateDuplicateEntryRow(row);
            return;
        }
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<String> missingFields = new ArrayList<>();
        List<String> mismatchFields = new ArrayList<>();

        String accountNo = (String) row.get("accountNo");
        boolean hasCeb = Boolean.TRUE.equals(row.get("hasCeb"));
        boolean hasNgen = Boolean.TRUE.equals(row.get("hasNgen"));
        boolean hasNpay = Boolean.TRUE.equals(row.get("hasNpay"));

        String prevReadingDate = (String) row.get("prevReadingDate");
        String currReadingDate = (String) row.get("currReadingDate");

        Double kwhImport = parseDouble(row.get("kwhImport"));
        Double kwhExport = parseDouble(row.get("kwhExport"));
        Double kwhSales = parseDouble(row.get("kwhSales"));
        Double ngenUnitRate = parseDouble(row.get("ngenUnitRate"));
        Double ngenBillSetOff = parseDouble(row.get("ngenBillSetOff"));
        Double ngenRetentionMoney = parseDouble(row.get("ngenRetentionMoney"));
        Double ngenSalesAmount = parseDouble(row.get("salesAmount"));
        Double ngenPaymentSettled = parseDouble(row.get("paymentSettled"));
        String ngenNetType = (String) row.get("ngenNetType");

        Double npayEnergyPurchase = parseDouble(row.get("npayEnergyPurchase"));
        Double npayBillSetOff = parseDouble(row.get("npayBillSetOff"));
        Double npayRetentionMoney = parseDouble(row.get("npayRetentionMoney"));
        Double npayPayment = parseDouble(row.get("npayPayment"));
        String npayNetType = (String) row.get("npayNetType");
        String npayName = (String) row.get("npayName");

        int ngc = row.get("ngenSourceCount") != null ? ((Number) row.get("ngenSourceCount")).intValue() : (hasNgen ? 1 : 0);
        int npc = row.get("npaySourceCount") != null ? ((Number) row.get("npaySourceCount")).intValue() : (hasNpay ? 1 : 0);

        // Rebuild merged equivalent fields (NGEN vs NPAY)
        Map<String, Object> mergedNetType = buildMergedType(ngenNetType, npayNetType);
        Map<String, Object> mergedEnergyPurchase = buildMergedNum(ngenSalesAmount, npayEnergyPurchase, hasNgen, hasNpay);
        Map<String, Object> mergedBillSetOff = buildMergedNum(ngenBillSetOff, npayBillSetOff, hasNgen, hasNpay);
        Map<String, Object> mergedRetentionMoney = buildMergedNum(ngenRetentionMoney, npayRetentionMoney, hasNgen, hasNpay);
        Map<String, Object> mergedPayment = buildMergedNum(ngenPaymentSettled, npayPayment, hasNgen, hasNpay);
        row.put("mergedNetType", mergedNetType);
        row.put("mergedEnergyPurchase", mergedEnergyPurchase);
        row.put("mergedBillSetOff", mergedBillSetOff);
        row.put("mergedRetentionMoney", mergedRetentionMoney);
        row.put("mergedPayment", mergedPayment);

        row.put("unitRate", ngenUnitRate);
        row.put("energyPurchase", effectiveNum(hasNpay, npayEnergyPurchase, ngenSalesAmount));
        row.put("billSetOff", effectiveNum(hasNpay, npayBillSetOff, ngenBillSetOff));
        row.put("retentionMoney", effectiveNum(hasNpay, npayRetentionMoney, ngenRetentionMoney));
        row.put("payment", effectiveNum(hasNpay, npayPayment, ngenPaymentSettled));

        // Missing value detection across the three files
        if (!hasCeb) { errors.add("No CEB Assist data found for this account"); missingFields.add("CEB Assist record"); }
        else {
            if (isBlank(prevReadingDate)) { missingFields.add("Previous Reading Date (CEB)"); errors.add("Missing value: Previous Reading Date (CEB)"); }
            if (isBlank(currReadingDate)) { missingFields.add("Current Reading Date (CEB)"); errors.add("Missing value: Current Reading Date (CEB)"); }
        }
        if (!hasNgen) { errors.add("No NGEN billing data found for this account"); missingFields.add("NGEN record"); }
        else {
            if (kwhImport == null) { missingFields.add("kWh Import (NGEN)"); errors.add("Missing value: kWh Import (NGEN)"); }
            if (kwhExport == null) { missingFields.add("kWh Export (NGEN)"); errors.add("Missing value: kWh Export (NGEN)"); }
            if (kwhSales == null) { missingFields.add("kWh Unit Sales (NGEN)"); errors.add("Missing value: kWh Unit Sales (NGEN)"); }
            if (ngenUnitRate == null) { missingFields.add("Unit Rate (NGEN)"); errors.add("Missing value: Unit Rate (NGEN)"); }
            if (ngenSalesAmount == null) { missingFields.add("kWh Sales Amount (NGEN)"); errors.add("Missing value: kWh Sales Amount (NGEN)"); }
            if (isBlank(ngenNetType)) { missingFields.add("Net Type (NGEN)"); errors.add("Missing value: Net Type (NGEN)"); }
        }
        if (!hasNpay) { errors.add("No NPAY billing data found for this account"); missingFields.add("NPAY record"); }
        else {
            if (isBlank(npayName)) { missingFields.add("Name (NPAY)"); errors.add("Missing value: Name (NPAY)"); }
            if (isBlank(npayNetType)) { missingFields.add("Net Type (NPAY)"); errors.add("Missing value: Net Type (NPAY)"); }
            if (npayEnergyPurchase == null) { missingFields.add("Energy Purchase (NPAY)"); errors.add("Missing value: Energy Purchase (NPAY)"); }
        }

        // Mismatch detection on merged fields
        if (Boolean.TRUE.equals(mergedNetType.get("mismatch"))) { mismatchFields.add("Net Type"); warnings.add(String.format("Net Type mismatch: NGEN='%s', NPAY='%s'", ngenNetType, npayNetType)); }
        if (Boolean.TRUE.equals(mergedEnergyPurchase.get("mismatch"))) { mismatchFields.add("Energy Purchase / kWh Sales Amount"); warnings.add(String.format("Energy Purchase / kWh Sales Amount mismatch: NGEN=%.2f, NPAY=%.2f", ngenSalesAmount, npayEnergyPurchase)); }
        if (Boolean.TRUE.equals(mergedBillSetOff.get("mismatch"))) { mismatchFields.add("Bill Set Off"); warnings.add(String.format("Bill Set Off mismatch: NGEN=%.2f, NPAY=%.2f", ngenBillSetOff, npayBillSetOff)); }
        if (Boolean.TRUE.equals(mergedRetentionMoney.get("mismatch"))) { mismatchFields.add("Retention Money"); warnings.add(String.format("Retention Money mismatch: NGEN=%.2f, NPAY=%.2f", ngenRetentionMoney, npayRetentionMoney)); }
        if (Boolean.TRUE.equals(mergedPayment.get("mismatch"))) { mismatchFields.add("Payment"); warnings.add(String.format("Payment mismatch: NGEN=%.2f, NPAY=%.2f", ngenPaymentSettled, npayPayment)); }

        boolean isDuplicate = ngc > 1 || npc > 1;
        if (isDuplicate) {
            List<String> src = new ArrayList<>();
            if (ngc > 1) src.add("NGEN (" + ngc + " records)");
            if (npc > 1) src.add("NPAY (" + npc + " records)");
            String dupReason = "Duplicate Account No carried from " + String.join(" and ", src)
                    + " — see the Duplicates list for every source record";
            row.put("duplicateReason", dupReason);
            row.put("hasDuplicateSources", true);
        }

        if (accountNo == null || accountNo.trim().isEmpty()) errors.add("Account No is missing");

        // Incomplete merges (missing an entire source file) are auto-rejected, mirroring generateMainDataset.
        boolean incomplete = !hasCeb || !hasNgen || !hasNpay;
        if (incomplete) {
            List<String> missSrc = new ArrayList<>();
            if (!hasCeb) missSrc.add("CEB Assist");
            if (!hasNgen) missSrc.add("NGEN");
            if (!hasNpay) missSrc.add("NPAY");
            row.put("rejected", true);
            row.put("rejectionReason", "Incomplete merge — missing source file(s): " + String.join(", ", missSrc));
        }

        String status;
        if (incomplete) status = "REJECTED";
        else if (!errors.isEmpty()) status = "ERROR";
        else if (!warnings.isEmpty()) status = "WARNING";
        else status = "VALID";

        row.put("errors", errors);
        row.put("warnings", warnings);
        row.put("missingFields", missingFields);
        row.put("mismatchFields", mismatchFields);
        row.put("status", status);
    }

    // ── Step 5 merge helpers ─────────────────────────────────────────────
    private Double numOrNull(Map<String, Object> m, String key) {
        if (m == null) return null;
        Object v = m.get(key);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try { return Double.valueOf(Double.parseDouble(v.toString().trim())); } catch (Exception e) { return null; }
    }

    private Double effectiveNum(boolean npayPresent, Double npayVal, Double ngenVal) {
        if (npayPresent) return npayVal != null ? npayVal : 0.0;
        return ngenVal != null ? ngenVal : 0.0;
    }

    private Map<String, Object> buildMergedNum(Double ngenVal, Double npayVal, boolean ngenPresent, boolean npayPresent) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ngen", ngenVal);
        m.put("npay", npayVal);
        boolean mismatch = false;
        String source;
        Double display = null;
        if (ngenPresent && npayPresent) {
            source = "BOTH";
            boolean nn = ngenVal != null, pn = npayVal != null;
            if (nn && pn) {
                if (Math.abs(ngenVal - npayVal) > 0.05) mismatch = true;
                else display = ngenVal;
            } else if (nn) display = ngenVal;
            else if (pn) display = npayVal;
        } else if (ngenPresent) { source = "NGEN"; display = ngenVal; }
        else if (npayPresent) { source = "NPAY"; display = npayVal; }
        else { source = "NONE"; }
        m.put("mismatch", mismatch);
        m.put("source", source);
        m.put("display", display);
        return m;
    }

    private Map<String, Object> buildMergedType(String ngenType, String npayType) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ngen", ngenType);
        m.put("npay", npayType);
        boolean ngenPresent = ngenType != null && !ngenType.trim().isEmpty();
        boolean npayPresent = npayType != null && !npayType.trim().isEmpty();
        boolean mismatch = false;
        String source;
        String display = null;
        if (ngenPresent && npayPresent) {
            source = "BOTH";
            String a = ExcelValidationService.normalizeSolarType(ngenType);
            String b = ExcelValidationService.normalizeSolarType(npayType);
            if (a != null && b != null && !a.equalsIgnoreCase(b)) mismatch = true;
            else display = ngenType;
        } else if (ngenPresent) { source = "NGEN"; display = ngenType; }
        else if (npayPresent) { source = "NPAY"; display = npayType; }
        else { source = "NONE"; }
        m.put("mismatch", mismatch);
        m.put("source", source);
        m.put("display", display);
        return m;
    }

    /**
     * Builds a display/review-only row for a single duplicate source record (an extra NGEN or NPAY
     * occurrence beyond the merged primary). The row carries Account No, source file, source row
     * number, duplicate reason and status = DUPLICATE, and is fully editable/deletable in Step 5.
     */
    private Map<String, Object> buildDuplicateEntryRow(int rowNum, String acc, boolean isNgen,
                                                       Map<String, Object> src, String dupReason, String occLabel,
                                                       boolean isOriginal, Object originalRowNum) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("rowNum", rowNum);
        row.put("accountNo", acc);

        // Master placeholders (no Master Data lookup in Step 5)
        row.put("customerName", "—"); row.put("customerAddress", "—"); row.put("refNo", "—");
        row.put("costCode", "—"); row.put("mobileNo", "—"); row.put("panelCapacity", null);
        row.put("agreementDate", null); row.put("bankCode", "—"); row.put("branchCode", "—");
        row.put("bankAccountNo", "—"); row.put("solarType", null); row.put("tariffType", null);
        row.put("billingMode", null);

        row.put("isDuplicateEntry", true);
        row.put("isOriginalDuplicate", isOriginal);
        row.put("originalRowNum", originalRowNum);
        row.put("duplicateReason", dupReason);
        row.put("duplicateOccurrence", occLabel);
        row.put("hasCeb", false);
        row.put("cebName", "");
        row.put("prevReadingDate", null);
        row.put("currReadingDate", null);

        if (isNgen) {
            row.put("sourceFile", "NGEN");
            row.put("sourceRowNum", src.get("rowNum"));
            row.put("hasNgen", true);
            row.put("hasNpay", false);
            row.put("ngenSourceCount", 1);
            row.put("npaySourceCount", 0);
            Double kwhImport = numOrNull(src, "kwhImport");
            Double kwhExport = numOrNull(src, "kwhExport");
            Double kwhSales = numOrNull(src, "kwhSales");
            Double ngenUnitRate = numOrNull(src, "ngenUnitRate");
            Double ngenBillSetOff = numOrNull(src, "billSetOff");
            Double ngenRetentionMoney = numOrNull(src, "retentionMoney");
            Double ngenSalesAmount = numOrNull(src, "salesAmount");
            Double ngenPaymentSettled = numOrNull(src, "paymentSettled");
            Double ngenOutstandingBalance = numOrNull(src, "outstandingBalance");
            String ngenNetType = (String) src.get("ngenNetType");
            row.put("kwhImport", kwhImport);
            row.put("kwhExport", kwhExport);
            row.put("kwhSales", kwhSales);
            row.put("ngenUnitRate", ngenUnitRate);
            row.put("unitRate", ngenUnitRate);
            row.put("ngenBillSetOff", ngenBillSetOff);
            row.put("ngenRetentionMoney", ngenRetentionMoney);
            row.put("ngenNetType", ngenNetType);
            row.put("salesAmount", ngenSalesAmount);
            row.put("paymentSettled", ngenPaymentSettled);
            row.put("outstandingBalance", ngenOutstandingBalance);
            row.put("npayNetType", null); row.put("npayName", null);
            row.put("npayEnergyPurchase", null); row.put("npayBillSetOff", null);
            row.put("npayRetentionMoney", null); row.put("npayPayment", null);
            row.put("mergedNetType", buildMergedType(ngenNetType, null));
            row.put("mergedEnergyPurchase", buildMergedNum(ngenSalesAmount, null, true, false));
            row.put("mergedBillSetOff", buildMergedNum(ngenBillSetOff, null, true, false));
            row.put("mergedRetentionMoney", buildMergedNum(ngenRetentionMoney, null, true, false));
            row.put("mergedPayment", buildMergedNum(ngenPaymentSettled, null, true, false));
            row.put("energyPurchase", ngenSalesAmount != null ? ngenSalesAmount : 0.0);
            row.put("billSetOff", ngenBillSetOff != null ? ngenBillSetOff : 0.0);
            row.put("retentionMoney", ngenRetentionMoney != null ? ngenRetentionMoney : 0.0);
            row.put("payment", ngenPaymentSettled != null ? ngenPaymentSettled : 0.0);
        } else {
            row.put("sourceFile", "NPAY");
            row.put("sourceRowNum", src.get("rowNum"));
            row.put("hasNgen", false);
            row.put("hasNpay", true);
            row.put("ngenSourceCount", 0);
            row.put("npaySourceCount", 1);
            String npayNetType = (String) src.get("npayNetType");
            String npayName = (String) src.get("npayName");
            Double npayEnergyPurchase = numOrNull(src, "energyPurchase");
            Double npayBillSetOff = numOrNull(src, "billSetOff");
            Double npayRetentionMoney = numOrNull(src, "retentionMoney");
            Double npayPayment = numOrNull(src, "payment");
            row.put("kwhImport", null); row.put("kwhExport", null); row.put("kwhSales", null);
            row.put("ngenUnitRate", null); row.put("unitRate", null);
            row.put("ngenBillSetOff", null); row.put("ngenRetentionMoney", null);
            row.put("ngenNetType", null); row.put("salesAmount", null); row.put("paymentSettled", null);
            row.put("outstandingBalance", null);
            row.put("npayNetType", npayNetType);
            row.put("npayName", npayName);
            row.put("npayEnergyPurchase", npayEnergyPurchase);
            row.put("npayBillSetOff", npayBillSetOff);
            row.put("npayRetentionMoney", npayRetentionMoney);
            row.put("npayPayment", npayPayment);
            row.put("mergedNetType", buildMergedType(null, npayNetType));
            row.put("mergedEnergyPurchase", buildMergedNum(null, npayEnergyPurchase, false, true));
            row.put("mergedBillSetOff", buildMergedNum(null, npayBillSetOff, false, true));
            row.put("mergedRetentionMoney", buildMergedNum(null, npayRetentionMoney, false, true));
            row.put("mergedPayment", buildMergedNum(null, npayPayment, false, true));
            row.put("energyPurchase", npayEnergyPurchase != null ? npayEnergyPurchase : 0.0);
            row.put("billSetOff", npayBillSetOff != null ? npayBillSetOff : 0.0);
            row.put("retentionMoney", npayRetentionMoney != null ? npayRetentionMoney : 0.0);
            row.put("payment", npayPayment != null ? npayPayment : 0.0);
        }

        List<String> warnings = new ArrayList<>();
        warnings.add(dupReason);
        row.put("errors", new ArrayList<String>());
        row.put("warnings", warnings);
        row.put("missingFields", new ArrayList<String>());
        row.put("mismatchFields", new ArrayList<String>());
        row.put("status", "DUPLICATE");
        return row;
    }

    /**
     * Lightweight revalidation for a duplicate-entry row: rebuilds the merged display objects from
     * its single-source values (in case the user edited them) but always keeps status = DUPLICATE
     * and does not apply cross-file missing-value errors.
     */
    private void revalidateDuplicateEntryRow(Map<String, Object> row) {
        boolean hasNgen = Boolean.TRUE.equals(row.get("hasNgen"));
        boolean hasNpay = Boolean.TRUE.equals(row.get("hasNpay"));
        Double ngenBillSetOff = parseDouble(row.get("ngenBillSetOff"));
        Double ngenRetentionMoney = parseDouble(row.get("ngenRetentionMoney"));
        Double ngenSalesAmount = parseDouble(row.get("salesAmount"));
        Double ngenPaymentSettled = parseDouble(row.get("paymentSettled"));
        Double ngenUnitRate = parseDouble(row.get("ngenUnitRate"));
        String ngenNetType = (String) row.get("ngenNetType");
        Double npayEnergyPurchase = parseDouble(row.get("npayEnergyPurchase"));
        Double npayBillSetOff = parseDouble(row.get("npayBillSetOff"));
        Double npayRetentionMoney = parseDouble(row.get("npayRetentionMoney"));
        Double npayPayment = parseDouble(row.get("npayPayment"));
        String npayNetType = (String) row.get("npayNetType");

        row.put("mergedNetType", buildMergedType(ngenNetType, npayNetType));
        row.put("mergedEnergyPurchase", buildMergedNum(ngenSalesAmount, npayEnergyPurchase, hasNgen, hasNpay));
        row.put("mergedBillSetOff", buildMergedNum(ngenBillSetOff, npayBillSetOff, hasNgen, hasNpay));
        row.put("mergedRetentionMoney", buildMergedNum(ngenRetentionMoney, npayRetentionMoney, hasNgen, hasNpay));
        row.put("mergedPayment", buildMergedNum(ngenPaymentSettled, npayPayment, hasNgen, hasNpay));
        row.put("unitRate", ngenUnitRate);
        row.put("energyPurchase", effectiveNum(hasNpay, npayEnergyPurchase, ngenSalesAmount));
        row.put("billSetOff", effectiveNum(hasNpay, npayBillSetOff, ngenBillSetOff));
        row.put("retentionMoney", effectiveNum(hasNpay, npayRetentionMoney, ngenRetentionMoney));
        row.put("payment", effectiveNum(hasNpay, npayPayment, ngenPaymentSettled));

        List<String> warnings = new ArrayList<>();
        Object dr = row.get("duplicateReason");
        if (dr != null) warnings.add(dr.toString());
        row.put("errors", new ArrayList<String>());
        row.put("warnings", warnings);
        row.put("missingFields", new ArrayList<String>());
        row.put("mismatchFields", new ArrayList<String>());
        row.put("status", "DUPLICATE");
    }

    /**
     * Returns the Step 5 display dataset: each merged primary row followed by any of its duplicate
     * source records, so all duplicate occurrences are visible and grouped together. Internal
     * callers (Step 6, finalize) keep using {@link #getMainDataset} which is primary-only.
     */
    public List<Map<String, Object>> getMainDatasetWithDuplicates(Long sessionId) {
        List<Map<String, Object>> primary = MAIN_DATA_CACHE.getOrDefault(sessionId, new ArrayList<>());
        List<Map<String, Object>> dups = MAIN_DUP_CACHE.getOrDefault(sessionId, new ArrayList<>());
        List<Map<String, Object>> rejected = MAIN_REJECTED_CACHE.getOrDefault(sessionId, new ArrayList<>());
        if (dups.isEmpty() && rejected.isEmpty()) return new ArrayList<>(primary);

        Map<String, List<Map<String, Object>>> dupByAcc = new LinkedHashMap<>();
        for (Map<String, Object> d : dups) {
            String acc = (String) d.get("accountNo");
            dupByAcc.computeIfAbsent(acc, k -> new ArrayList<>()).add(d);
        }
        List<Map<String, Object>> combined = new ArrayList<>();
        for (Map<String, Object> p : primary) {
            combined.add(p);
            List<Map<String, Object>> group = dupByAcc.remove((String) p.get("accountNo"));
            if (group != null) combined.addAll(group);
        }
        // Rejected (incomplete merge) rows are appended for review only. They are never returned by
        // getMainDataset (used by Step 6 / finalize), so they are excluded from the final import.
        // Attach any duplicate source records for those accounts too, so an incomplete account's
        // duplicates remain visible in the Duplicates section.
        for (Map<String, Object> r : rejected) {
            combined.add(r);
            List<Map<String, Object>> group = dupByAcc.remove((String) r.get("accountNo"));
            if (group != null) combined.addAll(group);
        }
        // Any remaining duplicate source records belong to accounts that were neither a merged
        // primary nor a rejected row — append them so no duplicate is ever dropped from the view.
        for (List<Map<String, Object>> group : dupByAcc.values()) {
            combined.addAll(group);
        }
        return combined;
    }

    @Transactional
    public Map<String, Object> finalizeImport(Long sessionId, String username,
                                              Map<String, Map<String, Object>> corrections, boolean isAdmin) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));

        // Require Step 6 (Master Data Comparison) to be approved before finalization
        if (!"MASTER_COMPARISON_APPROVED".equals(session.getStage())) {
            throw new IllegalStateException("Master Data comparison must be approved before finalizing. Current stage: " + session.getStage());
        }

        List<Map<String, Object>> mainDataset = getMainDataset(sessionId);
        if (mainDataset.isEmpty()) {
            throw new IllegalStateException("No Main Dataset found. Please approve files first.");
        }

        List<Map<String, Object>> masterStaged = loadMasterDataFromStaging(sessionId);

        // Apply corrections overlay to main dataset rows
        List<Map<String, Object>> correctedDataset = new ArrayList<>();
        int skippedCount = 0;

        for (Map<String, Object> row : mainDataset) {
            // Master-only rows (Master Data records with no matching Main Data Set billing) are
            // shown in Step 6 for completeness but carry no importable billing — exclude them from
            // the final import. Their customer profiles are still persisted from masterStaged below.
            if (Boolean.TRUE.equals(row.get("masterOnly"))) continue;
            String accountNo = (String) row.get("accountNo");
            String rowNumStr = String.valueOf(row.get("rowNum"));

            Map<String, Object> corr = null;
            if (corrections != null) {
                if (corrections.containsKey(rowNumStr)) {
                    corr = corrections.get(rowNumStr);
                } else if (accountNo != null && corrections.containsKey(accountNo)) {
                    corr = corrections.get(accountNo);
                }
            }

            if (corr != null && (Boolean.TRUE.equals(corr.get("deleted")) || "true".equals(String.valueOf(corr.get("deleted"))))) {
                skippedCount++;
                continue;
            }

            Map<String, Object> finalRow = new LinkedHashMap<>(row);
            if (corr != null) {
                finalRow.putAll(corr);
            }
            correctedDataset.add(finalRow);
        }

        if (!isAdmin) {
            // --- OFFICER STAGING FLOW ---
            UploadHistory uploadHistory = new UploadHistory(
                    "Multi-File Import (Session " + sessionId + ")",
                    username,
                    "PENDING_APPROVAL",
                    correctedDataset.size(),
                    0, 0, 0
            );
            uploadHistory = uploadHistoryRepository.save(uploadHistory);
            final Long uploadId = uploadHistory.getId();

            ObjectMapper mapper = new ObjectMapper();

            // Stage customer profiles
            for (Map<String, Object> mc : masterStaged) {
                String acc = (String) mc.get("accountNo");
                boolean isDeleted = false;
                if (corrections != null) {
                    if (corrections.containsKey(acc) && Boolean.TRUE.equals(corrections.get(acc).get("deleted"))) isDeleted = true;
                    String rNum = String.valueOf(mc.get("rowNum"));
                    if (corrections.containsKey(rNum) && Boolean.TRUE.equals(corrections.get(rNum).get("deleted"))) isDeleted = true;
                }
                if (isDeleted) continue;

                BillingUploadStaging staging = new BillingUploadStaging(
                        uploadId,
                        mapper.writeValueAsString(mc),
                        "VALID",
                        "[]",
                        "CUSTOMER_PROFILE"
                );
                billingUploadStagingRepository.save(staging);
            }

            // Stage billing records
            for (Map<String, Object> row : correctedDataset) {
                BillingUploadStaging staging = new BillingUploadStaging(
                        uploadId,
                        mapper.writeValueAsString(row),
                        "VALID",
                        "[]",
                        "BILLING"
                );
                billingUploadStagingRepository.save(staging);
            }

            session.setStage("COMPLETED");
            sessionRepository.save(session);

            cleanupCebStaging(sessionId);
            cleanupMasterStaging(sessionId);
            cleanupNgenStaging(sessionId);
            cleanupNpayStaging(sessionId);
            MAIN_DATA_CACHE.remove(sessionId);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sessionId", sessionId);
            result.put("stage", "PENDING_APPROVAL");
            result.put("message", "Import batch successfully submitted for Admin approval.");
            return result;
        }

        // --- ADMIN IMMEDIATE LIVE WRITE FLOW ---
        UploadHistory uploadHistory = new UploadHistory(
                "Multi-File Import (Session " + sessionId + ")",
                username,
                "SUCCESS",
                correctedDataset.size(),
                0, 0, 0
        );
        uploadHistory = uploadHistoryRepository.save(uploadHistory);
        final Long uploadId = uploadHistory.getId();

        int newCustCount = 0;

        // 1. Save / Update Customers
        for (Map<String, Object> stagedCust : masterStaged) {
            String accountNo = (String) stagedCust.get("accountNo");
            if (accountNo == null || accountNo.trim().isEmpty())
                continue;
            accountNo = accountNo.trim();

            boolean isDeleted = false;
            if (corrections != null) {
                if (corrections.containsKey(accountNo) && Boolean.TRUE.equals(corrections.get(accountNo).get("deleted"))) isDeleted = true;
                String rNum = String.valueOf(stagedCust.get("rowNum"));
                if (corrections.containsKey(rNum) && Boolean.TRUE.equals(corrections.get(rNum).get("deleted"))) isDeleted = true;
            }
            if (isDeleted) continue;

            String customerName = (String) stagedCust.get("customerName");
            String customerAddress = (String) stagedCust.get("customerAddress");
            String refNo = (String) stagedCust.get("refNo");
            String costCode = (String) stagedCust.get("costCode");
            String mobileNo = (String) stagedCust.get("mobileNo");
            Double panelCapacity = stagedCust.get("panelCapacity") != null
                    ? ((Number) stagedCust.get("panelCapacity")).doubleValue()
                    : null;
            String agreementDate = (String) stagedCust.get("agreementDate");
            String bankCode = (String) stagedCust.get("bankCode");
            String branchCode = (String) stagedCust.get("branchCode");
            String bankAccountNo = (String) stagedCust.get("bankAccountNo");
            String solarType = ExcelValidationService.normalizeSolarType((String) stagedCust.get("solarType"));
            Double unitRate = stagedCust.get("unitRate") != null ? ((Number) stagedCust.get("unitRate")).doubleValue()
                    : null;
            String tariffType = (String) stagedCust.get("tariffType");
            String billingMode = (String) stagedCust.get("billingMode");

            LocalDate agrDate = agreementDate != null && !agreementDate.isEmpty() ? safeParseDate(agreementDate) : null;
            String detBranch = com.ceb.billing.utils.BranchDetector.detectBranch(accountNo);
            String finalBranch = detBranch != null ? detBranch : (branchCode != null ? branchCode : "");

            Optional<Customer> existing = customerRepository.findById(accountNo);
            Customer c;
            if (existing.isEmpty()) {
                c = new Customer(accountNo, customerName, customerAddress, mobileNo,
                        agrDate, panelCapacity, bankCode, finalBranch, bankAccountNo, solarType);
                c.setRefNo(refNo);
                c.setUnitRate(unitRate);
                c.setTariffType(tariffType);
                c.setCreatedByUploadId(uploadId);
                newCustCount++;
                if (isNotBlank(costCode))
                    c.setCostCode(costCodeRepository.findByCostCode(costCode.trim()).orElse(null));
                if (isNotBlank(solarType))
                    c.setNetType(netTypeRepository.findByName(solarType.trim()).orElse(null));
                if (isNotBlank(billingMode))
                    c.setExpenseCode(expenseCodeRepository.findByExpCode(billingMode.trim()).orElse(null));
            } else {
                c = existing.get();
                if (isNotBlank(customerName))
                    c.setCustomerName(customerName);
                if (isNotBlank(customerAddress))
                    c.setCustomerAddress(customerAddress);
                if (isNotBlank(mobileNo))
                    c.setMobileNo(mobileNo);
                if (isNotBlank(bankCode))
                    c.setBankCode(bankCode);
                if (isNotBlank(finalBranch))
                    c.setBranchCode(finalBranch);
                if (isNotBlank(bankAccountNo))
                    c.setBankAccountNo(bankAccountNo);
                if (agrDate != null)
                    c.setAgreementDate(agrDate);
                if (panelCapacity != null)
                    c.setPanelCapacity(panelCapacity);
                if (isNotBlank(solarType))
                    c.setSolarType(solarType);
                if (isNotBlank(refNo))
                    c.setRefNo(refNo);
                if (unitRate != null)
                    c.setUnitRate(unitRate);
                if (isNotBlank(tariffType))
                    c.setTariffType(tariffType);
                if (isNotBlank(costCode))
                    c.setCostCode(costCodeRepository.findByCostCode(costCode.trim()).orElse(null));
                if (isNotBlank(solarType))
                    c.setNetType(netTypeRepository.findByName(solarType.trim()).orElse(null));
                if (isNotBlank(billingMode))
                    c.setExpenseCode(expenseCodeRepository.findByExpCode(billingMode.trim()).orElse(null));
            }
            excelValidationService.revalidateCustomer(c);
            customerRepository.save(c);
        }

        int createdBilling = 0;

        // 2. Save Billing Records
        for (Map<String, Object> row : correctedDataset) {
            String accountNo = (String) row.get("accountNo");
            Double energyPurchase = row.get("energyPurchase") != null ? ((Number) row.get("energyPurchase")).doubleValue() : 0.0;
            Double billSetOff = row.get("billSetOff") != null ? ((Number) row.get("billSetOff")).doubleValue() : 0.0;
            Double retentionMoney = row.get("retentionMoney") != null ? ((Number) row.get("retentionMoney")).doubleValue() : 0.0;
            Double payment = row.get("payment") != null ? ((Number) row.get("payment")).doubleValue() : 0.0;

            Optional<Customer> custOpt = customerRepository.findById(accountNo);
            if (custOpt.isEmpty()) {
                continue;
            }
            Customer cust = custOpt.get();

            String prevReadingDateStr = (String) row.get("prevReadingDate");
            String currReadingDateStr = (String) row.get("currReadingDate");
            LocalDate prevDate = safeParseDate(prevReadingDateStr);
            LocalDate currDate = safeParseDate(currReadingDateStr);

            LocalDate fromDate = prevDate != null ? prevDate : LocalDate.now().withDayOfMonth(1);
            LocalDate toDate = currDate != null ? currDate : LocalDate.now();

            Double kwhImport = row.get("kwhImport") != null ? ((Number) row.get("kwhImport")).doubleValue() : null;
            Double kwhExport = row.get("kwhExport") != null ? ((Number) row.get("kwhExport")).doubleValue() : null;
            Double kwhSales = row.get("kwhSales") != null ? ((Number) row.get("kwhSales")).doubleValue() : null;

            String refNoStr = isNotBlank(cust.getRefNo()) ? cust.getRefNo()
                    : "REF-" + accountNo + "-" + toDate.toString().replace("-", "");

            BillingRecord br = new BillingRecord();
            br.setCustomer(cust);
            br.setRefNo(refNoStr);
            br.setFromDate(fromDate);
            br.setToDate(toDate);
            br.setPrevReadingDate(prevDate);
            br.setCurrReadingDate(currDate);
            br.setKwhImport(kwhImport);
            br.setKwhExport(kwhExport);
            br.setKwhSales(kwhSales);
            br.setImportUnits(kwhImport != null ? kwhImport : 0.0);
            br.setExportUnits(kwhExport != null ? kwhExport : 0.0);
            br.setNetUnit(kwhSales != null ? kwhSales : 0.0);
            br.setUnitCost(cust.getUnitRate() != null ? cust.getUnitRate() : 0.0);
            br.setTotalAmount(energyPurchase != null ? energyPurchase : 0.0);
            br.setBillingMode(cust.getExpenseCode() != null ? cust.getExpenseCode().getExpCode() : null);
            br.setUploadHistoryId(uploadId);

            br.setEnergyPurchase(energyPurchase != null ? energyPurchase : 0.0);
            br.setBillSetOff(billSetOff != null ? billSetOff : 0.0);
            br.setRetentionMoney(retentionMoney != null ? retentionMoney : 0.0);
            br.setPayment(payment != null ? payment : 0.0);
            br.setPaymentSettled(payment != null ? payment : 0.0);

            billingRecordRepository.save(br);
            createdBilling++;
        }

        uploadHistory.setBillingInserted(createdBilling);
        uploadHistory.setNewCustomers(newCustCount);
        uploadHistoryRepository.save(uploadHistory);

        session.setStage("COMPLETED");
        sessionRepository.save(session);

        cleanupCebStaging(sessionId);
        cleanupMasterStaging(sessionId);
        cleanupNgenStaging(sessionId);
        cleanupNpayStaging(sessionId);
        MAIN_DATA_CACHE.remove(sessionId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", "COMPLETED");
        result.put("billingRecordsCreated", createdBilling);
        result.put("skippedCount", skippedCount);
        result.put("message", String.format("Import complete! %d billing records created.", createdBilling));
        return result;
    }

    private Double parseDouble(Object val) {
        if (val == null) return null;
        if (val instanceof Number) return Double.valueOf(((Number) val).doubleValue());
        try {
            return Double.valueOf(Double.parseDouble(val.toString().trim()));
        } catch (Exception e) {
            return null;
        }
    }
}
