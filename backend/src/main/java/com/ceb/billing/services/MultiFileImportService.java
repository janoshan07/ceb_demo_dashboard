package com.ceb.billing.services;

import com.ceb.billing.entities.*;
import com.ceb.billing.repositories.*;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
                    "solartype", "unitcost", "tarifftype", "billingmode")) {
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
                rowData.put("solarType",       strVal(row, colMap.get("solartype")));
                rowData.put("unitRate",        numVal(row, colMap.get("unitcost"))); // maps unitrate/unitcost
                rowData.put("tariffType",      strVal(row, colMap.get("tarifftype")));
                rowData.put("billingMode",     strVal(row, colMap.get("billingmode")));

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
                String solarType       = strVal(row, colMap.get("solartype"));
                Double unitRate        = numVal(row, colMap.get("unitcost"));
                String tariffType      = strVal(row, colMap.get("tarifftype"));
                String billingMode     = strVal(row, colMap.get("billingmode"));

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
                    if (corr.containsKey("solarType"))       solarType       = (String) corr.get("solarType");
                    if (corr.containsKey("unitRate")) {
                        Object val = corr.get("unitRate");
                        unitRate = val instanceof Number ? ((Number) val).doubleValue() : val != null ? Double.parseDouble(val.toString()) : null;
                    }
                    if (corr.containsKey("tariffType"))      tariffType      = (String) corr.get("tariffType");
                    if (corr.containsKey("billingMode"))     billingMode     = (String) corr.get("billingMode");
                    if (corr.containsKey("costCode"))        costCode        = (String) corr.get("costCode");
                }

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
                                            Map<String, Map<String, Object>> corrections) throws Exception {
        ImportSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Import session not found: " + sessionId));
        if (!"CEB_APPROVED".equals(session.getStage())) {
            throw new IllegalStateException("Session is not in the correct stage for NGEN upload. Current stage: " + session.getStage());
        }

        // 1. Load staged master customers and save/update them in DB first
        List<Map<String, Object>> masterStaged = loadMasterDataFromStaging(sessionId);
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
            String solarType       = (String) stagedCust.get("solarType");
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

                String refNo = isNotBlank(cust.getRefNo()) ? cust.getRefNo()
                        : "REF-" + accountNo + "-" + toDate.toString().replace("-", "");

                BillingRecord br = new BillingRecord(cust, refNo, fromDate, toDate,
                        kwhImport, kwhExport, effectiveRate,
                        cust.getExpenseCode() != null ? cust.getExpenseCode().getExpCode() : null,
                        session.getId());
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

        session.setStage("COMPLETED");
        session.setNgenCount(createdBilling);
        session.setNgenBatchId(sessionId);
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
        String accountNo = (String) row.get("accountNo");
        if (isBlank(accountNo)) {
            errors.add("Account No is missing");
        } else if (accountNo.trim().length() != 10 || !accountNo.trim().matches("\\d+")) {
            errors.add("Account No must be a 10-digit numeric value");
        }
        if (isBlank((String) row.get("customerName"))) errors.add("Customer Name is missing");
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
