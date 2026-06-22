package com.ceb.billing.services;

import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.models.ExcelValidationError;
import com.ceb.billing.repositories.BillingRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class ExcelValidationService {

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    private static final Set<String> VALID_BANK_CODES = new HashSet<>(Arrays.asList(
        "BOC", "HNB", "SAMP", "COM", "COMB", "SEYB", "NTB", "PEOP", "DFCC", "NDB", "NSB", "HSBC", "PABC", "SCB",
        "CGL", "CARG", "SMIB", "RDB", "MCB", "UNI", "AIB", "UNION"
    ));

    /**
     * Validates a single parsed row from the Excel sheet.
     */
    public RowValidationResult validateRow(
            String sheetName,
            int rowNum,
            String accountNo,
            String customerName,
            String rawFromDate,
            LocalDate fromDate,
            String rawToDate,
            LocalDate toDate,
            String rawImports,
            Double importUnits,
            String rawExports,
            Double exportUnits,
            String rawUnitCost,
            Double unitCost,
            String bankCode,
            Set<String> processedRecordsInUpload
    ) {
        RowValidationResult result = new RowValidationResult();

        // 1. Mandatory Columns presence/missing value checks
        if (accountNo == null || accountNo.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Account No", "Account number is missing or empty", false));
        }

        if (customerName == null || customerName.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Customer Name", "Customer name is missing or empty", false));
        }

        // From Date check
        if (rawFromDate == null || rawFromDate.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "From Date", "From Date is missing or empty", false));
        } else if (fromDate == null) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "From Date", "Invalid date format for From Date: '" + rawFromDate + "'. Expected format: YYYY-MM-DD", false));
        }

        // To Date check
        if (rawToDate == null || rawToDate.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "To Date", "To Date is missing or empty", false));
        } else if (toDate == null) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "To Date", "Invalid date format for To Date: '" + rawToDate + "'. Expected format: YYYY-MM-DD", false));
        }

        // Imports check
        if (rawImports == null || rawImports.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Imports", "Imports units is missing or empty", false));
        } else if (importUnits == null) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Imports", "Imports units must be a valid numeric value: '" + rawImports + "'", false));
        } else if (importUnits < 0) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Imports", "Imports units cannot be negative: " + importUnits, false));
        }

        // Exports check
        if (rawExports == null || rawExports.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Exports", "Exports units is missing or empty", false));
        } else if (exportUnits == null) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Exports", "Exports units must be a valid numeric value: '" + rawExports + "'", false));
        } else if (exportUnits < 0) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Exports", "Exports units cannot be negative: " + exportUnits, false));
        }

        // Unit Cost check
        if (rawUnitCost == null || rawUnitCost.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Unit Cost", "Unit Cost is missing or empty", false));
        } else if (unitCost == null) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Unit Cost", "Unit Cost must be a valid numeric value: '" + rawUnitCost + "'", false));
        } else if (unitCost < 0) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Unit Cost", "Unit Cost cannot be negative: " + unitCost, false));
        }

        // If we found any critical format or missing value errors, stop and do not run duplicate or warning checks
        if (result.hasErrors()) {
            return result;
        }

        // 2. Duplicate Checks (Account + Billing Month/Year)
        int year = fromDate.getYear();
        int month = fromDate.getMonthValue();
        String billingMonthStr = fromDate.getMonth().name() + " " + year;
        String dupKey = accountNo + "|" + year + "|" + month;

        // Check in current Excel upload session
        if (processedRecordsInUpload.contains(dupKey)) {
            result.addDuplicate(new ExcelValidationError(sheetName, rowNum, "Duplicate",
                "Duplicate billing record found for Account: " + accountNo + " in billing month: " + billingMonthStr + " within this Excel sheet", false));
            return result;
        }

        // Check against database
        Optional<BillingRecord> dbRecord = billingRecordRepository.findByCustomerAccountNoAndFromDateYearAndMonth(accountNo, year, month);
        if (dbRecord.isPresent()) {
            result.addDuplicate(new ExcelValidationError(sheetName, rowNum, "Duplicate",
                "Duplicate billing record already exists in database for Account: " + accountNo + " in billing month: " + billingMonthStr, false));
            return result;
        }

        // 3. Bank Code warnings (Invalid bank code check)
        if (bankCode != null && !bankCode.isEmpty()) {
            String cleanBank = bankCode.trim().toUpperCase();
            if (!VALID_BANK_CODES.contains(cleanBank)) {
                result.addWarning(new ExcelValidationError(sheetName, rowNum, "Bank Code",
                    "Unrecognized bank code: '" + bankCode + "'. Verified codes are standard Sri Lankan bank acronyms (e.g., BOC, HNB, SAMP, COM)", true));
            }
        }

        return result;
    }

    public static class RowValidationResult {
        private final List<ExcelValidationError> validationMessages = new ArrayList<>();
        private boolean hasErrors = false;
        private boolean hasDuplicate = false;
        private boolean hasWarnings = false;

        public void addError(ExcelValidationError error) {
            validationMessages.add(error);
            hasErrors = true;
        }

        public void addDuplicate(ExcelValidationError duplicate) {
            validationMessages.add(duplicate);
            hasDuplicate = true;
        }

        public void addWarning(ExcelValidationError warning) {
            validationMessages.add(warning);
            hasWarnings = true;
        }

        public List<ExcelValidationError> getValidationMessages() {
            return validationMessages;
        }

        public boolean hasErrors() {
            return hasErrors;
        }

        public boolean hasDuplicate() {
            return hasDuplicate;
        }

        public boolean hasWarnings() {
            return hasWarnings;
        }
    }
}
