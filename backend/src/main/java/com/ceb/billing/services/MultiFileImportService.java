package com.ceb.billing.services;

import com.ceb.billing.entities.*;
import com.ceb.billing.repositories.*;
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
    @Autowired private ImportBatchRepository importBatchRepository;
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
                if (!rowErrors.isEmpty()) errorCount++;

                rows.add(rowData);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filename", filename);
        result.put("fileType", "MASTER_DATA");
        result.put("totalRows", rows.size());
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

                // Corrections overlay by row number OR accountNo
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
                    if (corr.containsKey("accountNo"))       accountNo       = (String) corr.get("accountNo");
                    if (corr.containsKey("customerName"))    customerName    = (String) corr.get("customerName");
                    if (corr.containsKey("customerAddress")) customerAddress = (String) corr.get("customerAddress");
                    if (corr.containsKey("refNo"))           refNo           = (String) corr.get("refNo");
                    if (corr.containsKey("mobileNo"))        mobileNo        = (String) corr.get("mobileNo");
                    if (corr.containsKey("panelCapacity")) {
                        Object val = corr.get("panelCapacity");
                        panelCapacity = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("agreementDate"))   agreementDate   = (String) corr.get("agreementDate");
                    if (corr.containsKey("bankCode"))        bankCode        = (String) corr.get("bankCode");
                    if (corr.containsKey("branchCode"))      branchCode      = (String) corr.get("branchCode");
                    if (corr.containsKey("bankAccountNo"))   bankAccountNo   = (String) corr.get("bankAccountNo");
                    if (corr.containsKey("solarType"))       solarType       = ExcelValidationService.normalizeSolarType((String) corr.get("solarType"));
                    if (corr.containsKey("unitRate")) {
                        Object val = corr.get("unitRate");
                        unitRate = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
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

                cachedRows.add(cachedRow);
            }
        }

        ImportSession session = findOrCreateSession(username);
        saveMasterDataToStaging(session.getId(), cachedRows);

        session.setStage("MASTER_APPROVED");
        session.setMasterCustomerCount(cachedRows.size());
        sessionRepository.save(session);

        auditLogService.log("MASTER_DATA_APPROVED",
                String.format("Master Data staged by %s for session %d. Customers: %d, Skipped: %d",
                        username, session.getId(), cachedRows.size(), skippedRows));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", session.getId());
        result.put("stage", session.getStage());
        result.put("newCustomers", cachedRows.size());
        result.put("updatedCustomers", 0);
        result.put("skippedRows", skippedRows);
        result.put("totalImported", cachedRows.size());
        result.put("message", String.format("Master Data staged successfully. %d customers cached.", cachedRows.size()));
        return result;
    }

    // ════════════════════════════════════════════════════════════════════
    //  STEP 2 — CEB ASSIST
    // ════════════════════════════════════════════════════════════════════

    public Map<String, Object> previewCebAssist(byte[] fileBytes, String filename, Long sessionId) throws Exception {
        List<Map<String, Object>> rows = new ArrayList<>();
        int errorCount = 0;
        int matchCount = 0;
        int unmatchedCount = 0;

        List<Map<String, Object>> masterStaged = loadMasterDataFromStaging(sessionId);
        Set<String> stagedAccounts = new HashSet<>();
        Map<String, String> stagedNames = new HashMap<>();
        for (Map<String, Object> m : masterStaged) {
            String acc = (String) m.get("accountNo");
            if (acc != null) {
                stagedAccounts.add(acc.trim());
                stagedNames.put(acc.trim(), (String) m.get("customerName"));
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

                String accountNo      = strVal(row, colMap.get("accountno"));
                String prevDate       = dateStr(row, colMap.get("prevreadingdate"));
                String currDate       = dateStr(row, colMap.get("currreadingdate"));

                if (accountNo == null || accountNo.trim().isEmpty()) continue;
                accountNo = accountNo.trim();

                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", accountNo);
                rowData.put("prevReadingDate", prevDate);
                rowData.put("currReadingDate", currDate);

                List<String> errors = new ArrayList<>();
                if (prevDate == null || prevDate.isEmpty()) errors.add("Previous Reading Date is missing");
                if (currDate == null || currDate.isEmpty()) errors.add("Current Reading Date is missing");

                boolean customerExists = stagedAccounts.contains(accountNo) || customerRepository.findById(accountNo).isPresent();
                rowData.put("customerExists", customerExists);
                if (!customerExists) {
                    errors.add("Account No not found in customer database or Master Data");
                    unmatchedCount++;
                } else {
                    matchCount++;
                    if (stagedAccounts.contains(accountNo)) {
                        rowData.put("customerName", stagedNames.get(accountNo));
                    } else {
                        customerRepository.findById(accountNo).ifPresent(c -> rowData.put("customerName", c.getCustomerName()));
                    }
                }

                rowData.put("errors", errors);
                rowData.put("status", errors.isEmpty() ? "VALID" : "ERROR");
                if (!errors.isEmpty()) errorCount++;
                rows.add(rowData);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filename", filename);
        result.put("fileType", "CEB_ASSIST");
        result.put("totalRows", rows.size());
        result.put("matchedCount", matchCount);
        result.put("unmatchedCount", unmatchedCount);
        result.put("errorCount", errorCount);
        result.put("rows", rows);
        return result;
    }

    @Transactional
    public Map<String, Object> approveCebAssist(byte[] fileBytes, String username, Long sessionId,
                                                 Map<String, Map<String, Object>> corrections) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));
        if (!"MASTER_APPROVED".equals(session.getStage())) {
            throw new IllegalStateException("Session is not in the correct stage for CEB Assist upload. Current stage: " + session.getStage());
        }

        int updatedCount = 0;
        int skippedCount = 0;

        List<Map<String, Object>> masterStaged = loadMasterDataFromStaging(sessionId);
        Set<String> stagedAccounts = new HashSet<>();
        for (Map<String, Object> m : masterStaged) {
            String acc = (String) m.get("accountNo");
            if (acc != null) stagedAccounts.add(acc.trim());
        }

        try (InputStream is = new ByteArrayInputStream(fileBytes);
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int headerRowIdx = previewService.findHeaderRowIndex(sheet);
            Map<String, Integer> colMap = previewService.autoDetectColumns(sheet, headerRowIdx);

            boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
            int dataStart = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;
            int lastRow = sheet.getLastRowNum();

            Map<String, Map<String, String>> cebData = new LinkedHashMap<>();

            for (int r = dataStart; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                String accountNo = strVal(row, colMap.get("accountno"));
                if (accountNo == null || accountNo.trim().isEmpty()) continue;
                accountNo = accountNo.trim();

                String prevDate = dateStr(row, colMap.get("prevreadingdate"));
                String currDate = dateStr(row, colMap.get("currreadingdate"));

                // Corrections overlay by rowNum or accountNo
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
                    if (corr.containsKey("accountNo"))        accountNo = (String) corr.get("accountNo");
                    if (corr.containsKey("prevReadingDate"))  prevDate  = (String) corr.get("prevReadingDate");
                    if (corr.containsKey("currReadingDate"))  currDate  = (String) corr.get("currReadingDate");
                }

                boolean customerExists = stagedAccounts.contains(accountNo) || customerRepository.findById(accountNo).isPresent();
                if (!customerExists) {
                    skippedCount++;
                    continue;
                }

                Map<String, String> rowMap = new HashMap<>();
                rowMap.put("prevReadingDate", prevDate);
                rowMap.put("currReadingDate", currDate);
                cebData.put(accountNo, rowMap);
                updatedCount++;
            }

            session.setCebAssistBatchId(-1L);
            session.setStage("CEB_APPROVED");
            session.setCebAssistCount(updatedCount);
            sessionRepository.save(session);

            saveCebDataToStaging(session.getId(), cebData);
        }

        auditLogService.log("CEB_ASSIST_APPROVED",
                String.format("CEB Assist approved by %s for session %d. Updated: %d, Skipped: %d",
                        username, sessionId, updatedCount, skippedCount));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", "CEB_APPROVED");
        result.put("updatedCount", updatedCount);
        result.put("skippedCount", skippedCount);
        result.put("message", String.format("CEB Assist data saved. %d accounts updated.", updatedCount));
        return result;
    }

    // ════════════════════════════════════════════════════════════════════
    //  STEP 3 — NGEN
    // ════════════════════════════════════════════════════════════════════

    public Map<String, Object> previewNgen(byte[] fileBytes, String filename, Long sessionId) throws Exception {
        Map<String, Map<String, String>> cebData = loadCebDataFromStaging(sessionId);

        // Load staged master customers
        List<Map<String, Object>> masterStaged = loadMasterDataFromStaging(sessionId);
        Map<String, Map<String, Object>> stagedCustomers = new HashMap<>();
        for (Map<String, Object> m : masterStaged) {
            String acc = (String) m.get("accountNo");
            if (acc != null) stagedCustomers.put(acc.trim(), m);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        int errorCount = 0;
        int warningCount = 0;
        int matchCount = 0;

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

                String accountNo     = strVal(row, colMap.get("accountno"));
                Double kwhImport     = numVal(row, colMap.get("imports"));
                Double kwhExport     = numVal(row, colMap.get("exports"));
                Double ngenUnitRate  = numVal(row, colMap.get("unitcost"));
                Double billSetOff    = numVal(row, colMap.get("billsetoff"));

                if (accountNo == null || accountNo.trim().isEmpty()) continue;
                accountNo = accountNo.trim();

                Map<String, Object> rowData = new LinkedHashMap<>();
                rowData.put("rowNum", r + 1);
                rowData.put("accountNo", accountNo);
                rowData.put("kwhImport", kwhImport);
                rowData.put("kwhExport", kwhExport);
                rowData.put("billSetOff", billSetOff != null ? billSetOff : 0.0);

                List<String> errors = new ArrayList<>();
                List<String> warnings = new ArrayList<>();

                Optional<Customer> custOpt = customerRepository.findById(accountNo);
                boolean isStaged = stagedCustomers.containsKey(accountNo);
                boolean existsInDb = custOpt.isPresent();

                if (!isStaged && !existsInDb) {
                    errors.add("Account No not found in customer database or Master Data");
                } else {
                    matchCount++;

                    // kWh Sales = Export - Import
                    double sales = (kwhExport != null ? kwhExport : 0.0) - (kwhImport != null ? kwhImport : 0.0);
                    rowData.put("kwhSales", sales);

                    Double masterUnitRate;
                    if (isStaged) {
                        Map<String, Object> stagedCust = stagedCustomers.get(accountNo);
                        rowData.put("customerName",    stagedCust.get("customerName"));
                        rowData.put("customerAddress", stagedCust.get("customerAddress"));
                        rowData.put("refNo",           stagedCust.get("refNo"));
                        rowData.put("costCode",        stagedCust.get("costCode"));
                        rowData.put("mobileNo",        stagedCust.get("mobileNo"));
                        rowData.put("panelCapacity",   stagedCust.get("panelCapacity"));
                        rowData.put("agreementDate",   stagedCust.get("agreementDate"));
                        rowData.put("bankCode",        stagedCust.get("bankCode"));
                        rowData.put("branchCode",      stagedCust.get("branchCode"));
                        rowData.put("bankAccountNo",   stagedCust.get("bankAccountNo"));
                        rowData.put("solarType",       stagedCust.get("solarType"));
                        rowData.put("tariffType",      stagedCust.get("tariffType"));
                        rowData.put("billingMode",     stagedCust.get("billingMode"));

                        masterUnitRate = stagedCust.get("unitRate") != null ? ((Number) stagedCust.get("unitRate")).doubleValue() : null;
                    } else {
                        Customer cust = custOpt.get();
                        rowData.put("customerName",    cust.getCustomerName());
                        rowData.put("customerAddress", cust.getCustomerAddress());
                        rowData.put("refNo",           cust.getRefNo());
                        rowData.put("costCode",        cust.getCostCode() != null ? cust.getCostCode().getCostCode() : null);
                        rowData.put("mobileNo",        cust.getMobileNo());
                        rowData.put("panelCapacity",   cust.getPanelCapacity());
                        rowData.put("agreementDate",   cust.getAgreementDate() != null ? cust.getAgreementDate().toString() : null);
                        rowData.put("bankCode",        cust.getBankCode());
                        rowData.put("branchCode",      cust.getBranchCode());
                        rowData.put("bankAccountNo",   cust.getBankAccountNo());
                        rowData.put("solarType",       cust.getSolarType());
                        rowData.put("tariffType",      cust.getTariffType());
                        rowData.put("billingMode",     cust.getExpenseCode() != null ? cust.getExpenseCode().getExpCode() : null);

                        masterUnitRate = cust.getUnitRate();
                    }

                    rowData.put("masterUnitRate", masterUnitRate);
                    rowData.put("ngenUnitRate", ngenUnitRate);

                    if (ngenUnitRate != null && masterUnitRate != null && Math.abs(ngenUnitRate - masterUnitRate) > 0.001) {
                        warnings.add(String.format("Unit Rate mismatch: NGEN=%.2f, Master Data=%.2f. Using Master Data rate.", ngenUnitRate, masterUnitRate));
                        warningCount++;
                    }

                    double effectiveRate = masterUnitRate != null ? masterUnitRate : (ngenUnitRate != null ? ngenUnitRate : 0.0);
                    double salesAmount = sales * effectiveRate;
                    double outstandingCharges = billSetOff != null ? billSetOff : 0.0;
                    double finalPayment = salesAmount - outstandingCharges;

                    rowData.put("effectiveUnitRate", effectiveRate);
                    rowData.put("salesAmount", Math.round(salesAmount * 100.0) / 100.0);
                    rowData.put("paymentSettled", Math.round(finalPayment * 100.0) / 100.0);
                }

                if (kwhImport == null) errors.add("kWh Import is missing or invalid");
                if (kwhExport == null) errors.add("kWh Export is missing or invalid");

                Map<String, String> cebRow = cebData.get(accountNo);
                if (cebRow != null) {
                    rowData.put("prevReadingDate", cebRow.get("prevReadingDate"));
                    rowData.put("currReadingDate", cebRow.get("currReadingDate"));
                } else {
                    warnings.add("No CEB Assist reading dates found for this account");
                }

                rowData.put("errors", errors);
                rowData.put("warnings", warnings);
                rowData.put("status", !errors.isEmpty() ? "ERROR" : !warnings.isEmpty() ? "WARNING" : "VALID");
                if (!errors.isEmpty()) errorCount++;
                rows.add(rowData);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filename", filename);
        result.put("fileType", "NGEN");
        result.put("totalRows", rows.size());
        result.put("matchedCount", matchCount);
        result.put("errorCount", errorCount);
        result.put("warningCount", warningCount);
        result.put("rows", rows);
        return result;
    }

    @Transactional
    public Map<String, Object> approveNgen(byte[] fileBytes, String username, Long sessionId,
                                            Map<String, Map<String, Object>> corrections, boolean isAdmin) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));
        if (!"CEB_APPROVED".equals(session.getStage())) {
            throw new IllegalStateException("Session is not in the correct stage for NGEN upload. Current stage: " + session.getStage());
        }

        List<Map<String, Object>> masterStaged = loadMasterDataFromStaging(sessionId);

        if (!isAdmin) {
            // --- OFFICER STAGING FLOW ---
            // Create an UploadHistory record with PENDING_APPROVAL status
            UploadHistory uploadHistory = new UploadHistory(
                    "Multi-File Import (Session " + sessionId + ")",
                    username,
                    "PENDING_APPROVAL",
                    masterStaged.size(),
                    0,
                    0,
                    0
            );
            uploadHistory = uploadHistoryRepository.save(uploadHistory);
            final Long uploadId = uploadHistory.getId();

            // Stage customer profiles and NGEN billing records in database staging table
            int errorRows = stageOfficerData(masterStaged, fileBytes, sessionId, uploadId, corrections, username);

            // Update errors count on the UploadHistory for Admin review
            uploadHistory.setErrorsCount(errorRows);
            uploadHistoryRepository.save(uploadHistory);

            session.setStage("COMPLETED");
            session.setNgenBatchId(uploadId);
            sessionRepository.save(session);

            cleanupCebStaging(sessionId);
            cleanupMasterStaging(sessionId);

            auditLogService.log("NGEN_SUBMITTED",
                    String.format("NGEN submitted for Admin approval by %s for session %d.", username, sessionId));

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sessionId", sessionId);
            result.put("stage", "PENDING_APPROVAL");
            result.put("message", "Import batch successfully submitted for Admin approval.");
            return result;
        }

        // --- ADMIN IMMEDIATE LIVE WRITE FLOW ---
        // Create an UploadHistory record for this multi-file import session
        UploadHistory uploadHistory = new UploadHistory(
                "Multi-File Import (Session " + sessionId + ")",
                username,
                "SUCCESS",
                masterStaged.size(),
                0,
                0,
                0
        );
        uploadHistory = uploadHistoryRepository.save(uploadHistory);
        final Long uploadId = uploadHistory.getId();

        int newCustCount = 0;

        // 1. Load staged master customers and save/update them in DB first
        for (Map<String, Object> stagedCust : masterStaged) {
            String accountNo = (String) stagedCust.get("accountNo");
            if (accountNo == null || accountNo.trim().isEmpty()) continue;
            accountNo = accountNo.trim();

            String customerName    = (String) stagedCust.get("customerName");
            String customerAddress = (String) stagedCust.get("customerAddress");
            String refNo           = (String) stagedCust.get("refNo");
            String costCode        = (String) stagedCust.get("costCode");
            String mobileNo        = (String) stagedCust.get("mobileNo");
            Double panelCapacity   = stagedCust.get("panelCapacity") != null ? ((Number) stagedCust.get("panelCapacity")).doubleValue() : null;
            String agreementDate   = (String) stagedCust.get("agreementDate");
            String bankCode        = (String) stagedCust.get("bankCode");
            String branchCode      = (String) stagedCust.get("branchCode");
            String bankAccountNo   = (String) stagedCust.get("bankAccountNo");
            String solarType       = ExcelValidationService.normalizeSolarType((String) stagedCust.get("solarType"));
            Double unitRate        = stagedCust.get("unitRate") != null ? ((Number) stagedCust.get("unitRate")).doubleValue() : null;
            String tariffType      = (String) stagedCust.get("tariffType");
            String billingMode     = (String) stagedCust.get("billingMode");

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
                if (isNotBlank(costCode))    c.setCostCode(costCodeRepository.findByCostCode(costCode.trim()).orElse(null));
                if (isNotBlank(solarType))   c.setNetType(netTypeRepository.findByName(solarType.trim()).orElse(null));
                if (isNotBlank(billingMode)) c.setExpenseCode(expenseCodeRepository.findByExpCode(billingMode.trim()).orElse(null));
            } else {
                c = existing.get();
                if (isNotBlank(customerName))    c.setCustomerName(customerName);
                if (isNotBlank(customerAddress)) c.setCustomerAddress(customerAddress);
                if (isNotBlank(mobileNo))        c.setMobileNo(mobileNo);
                if (isNotBlank(bankCode))        c.setBankCode(bankCode);
                if (isNotBlank(finalBranch))     c.setBranchCode(finalBranch);
                if (isNotBlank(bankAccountNo))   c.setBankAccountNo(bankAccountNo);
                if (agrDate != null)             c.setAgreementDate(agrDate);
                if (panelCapacity != null)       c.setPanelCapacity(panelCapacity);
                if (isNotBlank(solarType))       c.setSolarType(solarType);
                if (isNotBlank(refNo))           c.setRefNo(refNo);
                if (unitRate != null)            c.setUnitRate(unitRate);
                if (isNotBlank(tariffType))      c.setTariffType(tariffType);
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

        // 2. Load cached CEB reading dates
        Map<String, Map<String, String>> cebData = loadCebDataFromStaging(sessionId);

        int createdBilling = 0;
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

                String accountNo    = strVal(row, colMap.get("accountno"));
                Double kwhImport    = numVal(row, colMap.get("imports"));
                Double kwhExport    = numVal(row, colMap.get("exports"));
                Double ngenUnitRate = numVal(row, colMap.get("unitcost"));
                Double billSetOff   = numVal(row, colMap.get("billsetoff"));

                // Corrections overlay by row number OR accountNo
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
                        Object val = corr.get("kwhImport");
                        kwhImport = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("kwhExport")) {
                        Object val = corr.get("kwhExport");
                        kwhExport = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("ngenUnitRate")) {
                        Object val = corr.get("ngenUnitRate");
                        ngenUnitRate = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("billSetOff")) {
                        Object val = corr.get("billSetOff");
                        billSetOff = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                }

                if (accountNo == null || accountNo.trim().isEmpty()) continue;
                accountNo = accountNo.trim();

                Optional<Customer> custOpt = customerRepository.findById(accountNo);
                if (custOpt.isEmpty() || kwhImport == null || kwhExport == null) {
                    skippedCount++;
                    continue;
                }

                Customer cust = custOpt.get();
                double effectiveRate = cust.getUnitRate() != null ? cust.getUnitRate()
                        : (ngenUnitRate != null ? ngenUnitRate : 0.0);
                double kwhSales = kwhExport - kwhImport;
                double salesAmount = kwhSales * effectiveRate;
                double outstandingCharges = billSetOff != null ? billSetOff : 0.0;
                double paymentSettled = salesAmount - outstandingCharges;

                Map<String, String> cebRow = cebData.get(accountNo);
                LocalDate prevDate = cebRow != null ? safeParseDate(cebRow.get("prevReadingDate")) : null;
                LocalDate currDate = cebRow != null ? safeParseDate(cebRow.get("currReadingDate")) : null;

                LocalDate fromDate = prevDate != null ? prevDate : LocalDate.now().withDayOfMonth(1);
                LocalDate toDate   = currDate != null ? currDate : LocalDate.now();

                String refNoStr = isNotBlank(cust.getRefNo()) ? cust.getRefNo()
                        : "REF-" + accountNo + "-" + toDate.toString().replace("-", "");

                BillingRecord br = new BillingRecord(cust, refNoStr, fromDate, toDate,
                        kwhImport, kwhExport, effectiveRate,
                        cust.getExpenseCode() != null ? cust.getExpenseCode().getExpCode() : null,
                        uploadId);
                br.setPrevReadingDate(prevDate);
                br.setCurrReadingDate(currDate);
                br.setKwhImport(kwhImport);
                br.setKwhExport(kwhExport);
                br.setKwhSales(kwhSales);
                br.setBillSetOff(outstandingCharges);
                br.setPayment(Math.round(paymentSettled * 100.0) / 100.0);
                br.setPaymentSettled(Math.round(paymentSettled * 100.0) / 100.0);
                billingRecordRepository.save(br);
                createdBilling++;
            }
        }

        uploadHistory.setBillingInserted(createdBilling);
        uploadHistory.setNewCustomers(newCustCount);
        uploadHistoryRepository.save(uploadHistory);

        session.setStage("COMPLETED");
        session.setNgenCount(createdBilling);
        session.setNgenBatchId(uploadId);
        sessionRepository.save(session);

        cleanupCebStaging(sessionId);
        cleanupMasterStaging(sessionId);

        auditLogService.log("NGEN_APPROVED",
                String.format("NGEN approved by %s for session %d. Billing records created: %d, Skipped: %d",
                        username, sessionId, createdBilling, skippedCount));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId);
        result.put("stage", "COMPLETED");
        result.put("billingRecordsCreated", createdBilling);
        result.put("skippedCount", skippedCount);
        result.put("message", String.format("Import complete! %d billing records created.", createdBilling));
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
                finalCustData.putAll(corr);
            }

            List<String> errors = validateMasterDataRow(finalCustData);
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
            String custBillingMode = finalCustData.get("billingMode") != null ? finalCustData.get("billingMode").toString() : "";
            String custRefNo = finalCustData.get("refNo") != null ? finalCustData.get("refNo").toString() : "";
            Double custUnitRate = finalCustData.get("unitRate") != null && !finalCustData.get("unitRate").toString().isEmpty()
                    ? ((Number) finalCustData.get("unitRate")).doubleValue() : null;
            String custTariffType = finalCustData.get("tariffType") != null ? finalCustData.get("tariffType").toString() : "";

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

        // 2. Stage Billing Records (NGEN merged with CEB)
        Map<String, Map<String, String>> cebData = loadCebDataFromStaging(sessionId);

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
                        Object val = corr.get("kwhImport");
                        kwhImport = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("kwhExport")) {
                        Object val = corr.get("kwhExport");
                        kwhExport = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("ngenUnitRate")) {
                        Object val = corr.get("ngenUnitRate");
                        ngenUnitRate = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("billSetOff")) {
                        Object val = corr.get("billSetOff");
                        billSetOff = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
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
                double kwhSales = (kwhExport != null ? kwhExport : 0.0) - (kwhImport != null ? kwhImport : 0.0);
                double salesAmount = kwhSales * effectiveRate;
                double outstandingCharges = billSetOff != null ? billSetOff : 0.0;
                double paymentSettled = salesAmount - outstandingCharges;

                Map<String, String> cebRow = cebData.get(accountNo);
                String prevReadingDate = cebRow != null ? cebRow.get("prevReadingDate") : null;
                String currReadingDate = cebRow != null ? cebRow.get("currReadingDate") : null;

                String refNoStr = isNotBlank(refNo) ? refNo
                        : "REF-" + accountNo + "-" + (currReadingDate != null ? currReadingDate.replace("-", "") : "");

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
        result.put("createdAt", session.getCreatedAt());
        return result;
    }

    public void discardSession(Long sessionId, String username) {
        sessionRepository.findById(sessionId).ifPresent(session -> {
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

    private static final Map<Long, Map<String, Map<String, String>>> CEB_DATA_CACHE = new HashMap<>();
    private static final Map<Long, List<Map<String, Object>>> MASTER_DATA_CACHE = new HashMap<>();

    private void saveCebDataToStaging(Long sessionId, Map<String, Map<String, String>> data) {
        CEB_DATA_CACHE.put(sessionId, data);
    }

    private Map<String, Map<String, String>> loadCebDataFromStaging(Long sessionId) {
        return CEB_DATA_CACHE.getOrDefault(sessionId, new LinkedHashMap<>());
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

    private List<String> validateMasterDataRow(Map<String, Object> row) {
        List<String> errors = new ArrayList<>();
        
        String accountNo = row.get("accountNo") != null ? row.get("accountNo").toString() : null;
        if (isBlank(accountNo)) {
            errors.add("Account No is missing");
        } else if (accountNo.trim().length() != 10 || !accountNo.trim().matches("\\d+")) {
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
        if (isBlank(costCode)) {
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

    private LocalDate safeParseDate(String s) {
        if (s == null || s.trim().isEmpty()) return null;
        try { return LocalDate.parse(s.trim()); } catch (Exception e) { return null; }
    }

    private boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
    private boolean isNotBlank(String s) { return s != null && !s.trim().isEmpty(); }
}
