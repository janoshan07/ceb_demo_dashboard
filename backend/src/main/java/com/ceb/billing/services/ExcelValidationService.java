package com.ceb.billing.services;

import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.models.ExcelValidationError;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CostCodeRepository;
import com.ceb.billing.repositories.NetTypeRepository;
import com.ceb.billing.repositories.ExpenseCodeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class ExcelValidationService {

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private CostCodeRepository costCodeRepository;

    @Autowired
    private NetTypeRepository netTypeRepository;

    @Autowired
    private ExpenseCodeRepository expenseCodeRepository;

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
            String rowType,
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
            String customerAddress,
            String mobileNo,
            String bankAccountNo,
            String branchCode,
            String billingMode,
            String agreementDate,
            Double panelCapacity,
            String solarType,
            Set<String> processedRecordsInUpload
    ) {
        RowValidationResult result = new RowValidationResult();
        boolean hasKeyFieldsErrors = false;

        // 1. Mandatory Columns presence/missing value checks
        if (accountNo == null || accountNo.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Account No", "Account number is missing or empty", false));
            hasKeyFieldsErrors = true;
        } else {
            String cleanAcc = accountNo.trim();
            if (cleanAcc.length() != 10 || !cleanAcc.matches("\\d+")) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Account No", "Account number must be a valid 10-digit numeric string: '" + accountNo + "'", false));
                hasKeyFieldsErrors = true;
            }
        }

        if (customerName == null || customerName.isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Customer Name", "Customer name is missing or empty", false));
        }

        // Only run billing-specific validation if sheet structure is BILLING
        if ("BILLING".equals(rowType)) {
            // From Date check
            if (rawFromDate == null || rawFromDate.isEmpty()) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "From Date", "From Date is missing or empty", false));
                hasKeyFieldsErrors = true;
            } else if (fromDate == null) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "From Date", "Invalid date format for From Date: '" + rawFromDate + "'. Expected format: YYYY-MM-DD", false));
                hasKeyFieldsErrors = true;
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
                result.addError(new ExcelValidationError(sheetName, rowNum, "Exports", "Exports units must be a valid numeric value: '" + rawImports + "'", false));
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
        }

        // Missing optional fields warnings check -> treated as non-critical errors
        if (customerAddress == null || customerAddress.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Address", "Address is missing", false));
        }
        if (mobileNo == null || mobileNo.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Mobile No", "Mobile No is missing", false));
        }
        if (bankCode == null || bankCode.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Bank Code", "Bank Code is missing", false));
        }
        if (branchCode == null || branchCode.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Branch Code", "Branch Code is missing", false));
        }
        if (bankAccountNo == null || bankAccountNo.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Bank Account No", "Bank Account No is missing", false));
        }
        if (billingMode == null || billingMode.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Exp. Code", "Exp. Code (Billing Mode) is missing", false));
        }
        if (agreementDate == null || agreementDate.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Agreement Date", "Agreement Date is missing", false));
        }
        if (panelCapacity == null) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Panel Capacity", "Panel Capacity is missing", false));
        }
        if (solarType == null || solarType.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Solar Type", "Solar Type is missing", false));
        } else {
            boolean ntExists = netTypeRepository.findByName(solarType.trim()).isPresent();
            if (!ntExists) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Solar Type", "Unrecognized net type/solar type: '" + solarType + "'", false));
            }
        }

        if (billingMode != null && !billingMode.trim().isEmpty()) {
            String cleanEc = billingMode.trim();
            boolean ecExists = expenseCodeRepository.findByExpCode(cleanEc).isPresent();
            if (!ecExists) {
                try {
                    Long ecId = Long.valueOf(cleanEc);
                    ecExists = expenseCodeRepository.existsById(ecId);
                } catch (Exception ignored) {}
            }
            if (!ecExists) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Exp. Code", "Unrecognized expense code: '" + billingMode + "'", false));
            }
        }

        // If key duplicate check fields are missing/invalid, stop and do not run duplicate checks
        if (hasKeyFieldsErrors || !"BILLING".equals(rowType) || fromDate == null) {
            if (bankCode != null && !bankCode.trim().isEmpty()) {
                String cleanBank = bankCode.trim().toUpperCase();
                if (!VALID_BANK_CODES.contains(cleanBank) && !cleanBank.matches("\\d{4}")) {
                    result.addWarning(new ExcelValidationError(sheetName, rowNum, "Bank Code",
                        "Unrecognized bank code: '" + bankCode + "'. Verified codes are standard Sri Lankan bank acronyms (e.g., BOC, HNB, SAMP, COM) or 4-digit numeric codes.", true));
                }
            }
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
        List<BillingRecord> dbRecords = billingRecordRepository.findByCustomerAccountNoAndFromDateYearAndMonth(accountNo, year, month);
        if (!dbRecords.isEmpty()) {
            result.addDuplicate(new ExcelValidationError(sheetName, rowNum, "Duplicate",
                "Duplicate billing record already exists in database for Account: " + accountNo + " in billing month: " + billingMonthStr, false));
            return result;
        }

        // 3. Bank Code warnings — only flag if a non-empty value was actually supplied and invalid
        if (bankCode != null && !bankCode.trim().isEmpty()) {
            String cleanBank = bankCode.trim().toUpperCase();
            if (!VALID_BANK_CODES.contains(cleanBank) && !cleanBank.matches("\\d{4}")) {
                result.addWarning(new ExcelValidationError(sheetName, rowNum, "Bank Code",
                    "Unrecognized bank code: '" + bankCode + "'. Verified codes are standard Sri Lankan bank acronyms (e.g., BOC, HNB, SAMP, COM) or 4-digit numeric codes.", true));
            }
        }

        return result;
    }

    /**
     * Lightweight validation for customer-profile-only rows.
     * These rows have no billing fields (imports/exports/dates), so we check
     * that accountNo and customerName are present and check optional fields.
     */
    public RowValidationResult validateCustomerRow(
            String sheetName,
            int rowNum,
            String accountNo,
            String customerName,
            String customerAddress,
            String mobileNo,
            String bankCode,
            String branchCode,
            String bankAccountNo,
            String agreementDate,
            Double panelCapacity,
            String solarType,
            String costCode,
            String billingMode
    ) {
        RowValidationResult result = new RowValidationResult();
        if (accountNo == null || accountNo.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Account No",
                    "Account number is missing or empty", false));
        } else {
            String cleanAcc = accountNo.trim();
            if (cleanAcc.length() != 10 || !cleanAcc.matches("\\d+")) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Account No",
                        "Account number must be a valid 10-digit numeric string: '" + accountNo + "'", false));
            }
        }
        if (customerName == null || customerName.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Customer Name",
                    "Customer name is missing or empty", false));
        }

        if (customerAddress == null || customerAddress.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Address", "Address is missing", false));
        }
        if (mobileNo == null || mobileNo.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Mobile No", "Mobile No is missing", false));
        }
        if (bankCode == null || bankCode.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Bank Code", "Bank Code is missing", false));
        } else {
            String cleanBank = bankCode.trim().toUpperCase();
            if (!VALID_BANK_CODES.contains(cleanBank) && !cleanBank.matches("\\d{4}")) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Bank Code",
                    "Unrecognized bank code: '" + bankCode + "'. Verified codes are standard Sri Lankan bank acronyms (e.g., BOC, HNB, SAMP, COM) or 4-digit numeric codes.", false));
            }
        }
        if (branchCode == null || branchCode.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Branch Code", "Branch Code is missing", false));
        }
        if (bankAccountNo == null || bankAccountNo.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Bank Account No", "Bank Account No is missing", false));
        }
        if (agreementDate == null || agreementDate.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Agreement Date", "Agreement Date is missing", false));
        }
        if (panelCapacity == null) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Panel Capacity", "Panel Capacity is missing", false));
        }

        // Lookup validation for Cost Code
        if (costCode == null || costCode.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Cost Code", "Cost Code is missing", false));
        } else {
            boolean ccExists = costCodeRepository.findByCostCode(costCode.trim()).isPresent();
            if (!ccExists) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Cost Code", "Unrecognized cost code: '" + costCode + "'", false));
            }
        }

        // Lookup validation for Net Type / Solar Type
        if (solarType == null || solarType.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Solar Type", "Solar Type is missing", false));
        } else {
            boolean ntExists = netTypeRepository.findByName(solarType.trim()).isPresent();
            if (!ntExists) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Solar Type", "Unrecognized net type/solar type: '" + solarType + "'", false));
            }
        }

        // Lookup validation for Expense Code
        if (billingMode == null || billingMode.trim().isEmpty()) {
            result.addError(new ExcelValidationError(sheetName, rowNum, "Exp. Code", "Exp. Code (Billing Mode) is missing", false));
        } else {
            String cleanEc = billingMode.trim();
            boolean ecExists = expenseCodeRepository.findByExpCode(cleanEc).isPresent();
            if (!ecExists) {
                try {
                    Long ecId = Long.valueOf(cleanEc);
                    ecExists = expenseCodeRepository.existsById(ecId);
                } catch (Exception ignored) {}
            }
            if (!ecExists) {
                result.addError(new ExcelValidationError(sheetName, rowNum, "Exp. Code", "Unrecognized expense code: '" + billingMode + "'", false));
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
