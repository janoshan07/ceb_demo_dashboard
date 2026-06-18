package com.ceb.billing.services;

import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.models.ExcelUploadResponse;
import com.ceb.billing.models.ExcelValidationError;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.*;

@Service
public class ExcelParsingService {

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public ExcelUploadResponse parseAndSaveExcel(MultipartFile file, String uploadedBy) throws Exception {
        String filename = file.getOriginalFilename();
        List<ExcelValidationError> errors = new ArrayList<>();
        int rowsProcessed = 0;
        int newCustomers = 0;
        int billingInserted = 0;

        // Save a placeholder history so we get an ID
        UploadHistory history = new UploadHistory(filename, uploadedBy, "PROCESSING", 0, 0, 0, 0);
        history = uploadHistoryRepository.save(history);
        Long historyId = history.getId();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            int numberOfSheets = workbook.getNumberOfSheets();

            for (int s = 0; s < numberOfSheets; s++) {
                Sheet sheet = workbook.getSheetAt(s);
                String sheetName = sheet.getSheetName();

                // 1. Map headers to column indices
                Row headerRow = sheet.getRow(0);
                if (headerRow == null) {
                    errors.add(new ExcelValidationError(sheetName, 1, "Header", "Sheet is empty"));
                    continue;
                }

                Map<String, Integer> headerMap = new HashMap<>();
                for (int col = 0; col < headerRow.getLastCellNum(); col++) {
                    Cell cell = headerRow.getCell(col);
                    String headerText = getCellValueAsString(cell);
                    if (headerText != null) {
                        String cleanHeader = headerText.toLowerCase().replaceAll("[^a-z0-9]", "");
                        headerMap.put(cleanHeader, col);
                    }
                }

                // Check required headers
                List<String> missingHeaders = new ArrayList<>();
                verifyHeader(headerMap, Arrays.asList("accountno", "accountnumber"), "Account No", missingHeaders);
                verifyHeader(headerMap, Arrays.asList("customername", "name"), "Customer Name", missingHeaders);
                verifyHeader(headerMap, Arrays.asList("refno", "referenceno", "referencenumber"), "Ref No",
                        missingHeaders);
                verifyHeader(headerMap, Arrays.asList("fromdate", "startdate"), "From Date", missingHeaders);
                verifyHeader(headerMap, Arrays.asList("todate", "enddate"), "To Date", missingHeaders);
                verifyHeader(headerMap, Arrays.asList("imports", "import", "importunits"), "Imports", missingHeaders);
                verifyHeader(headerMap, Arrays.asList("exports", "export", "exportunits"), "Exports", missingHeaders);
                verifyHeader(headerMap, Arrays.asList("unitcost", "rate"), "Unit Cost", missingHeaders);

                if (!missingHeaders.isEmpty()) {
                    errors.add(new ExcelValidationError(sheetName, 1, "Headers",
                            "Missing required columns: " + String.join(", ", missingHeaders)));
                    continue;
                }

                // Get indices
                int accountNoCol = getHeaderColIndex(headerMap, Arrays.asList("accountno", "accountnumber"));
                int customerNameCol = getHeaderColIndex(headerMap, Arrays.asList("customername", "name"));
                int refNoCol = getHeaderColIndex(headerMap, Arrays.asList("refno", "referenceno", "referencenumber"));
                int fromDateCol = getHeaderColIndex(headerMap, Arrays.asList("fromdate", "startdate"));
                int toDateCol = getHeaderColIndex(headerMap, Arrays.asList("todate", "enddate"));
                int importsCol = getHeaderColIndex(headerMap, Arrays.asList("imports", "import", "importunits"));
                int exportsCol = getHeaderColIndex(headerMap, Arrays.asList("exports", "export", "exportunits"));
                int unitCostCol = getHeaderColIndex(headerMap, Arrays.asList("unitcost", "rate"));

                // Optional indices
                Integer bankCodeCol = getHeaderColIndexNullable(headerMap, Arrays.asList("bankcode"));
                Integer branchCodeCol = getHeaderColIndexNullable(headerMap, Arrays.asList("branchcode"));
                Integer bankAccountNoCol = getHeaderColIndexNullable(headerMap,
                        Arrays.asList("bankaccountno", "bankaccountnumber", "bankaccount"));
                Integer billingModeCol = getHeaderColIndexNullable(headerMap,
                        Arrays.asList("expcode", "exportcode", "billingmode", "mode"));

                // Extra optional solar details
                Integer customerAddressCol = getHeaderColIndexNullable(headerMap,
                        Arrays.asList("customeraddress", "address"));
                Integer mobileNoCol = getHeaderColIndexNullable(headerMap,
                        Arrays.asList("mobileno", "mobile", "phone"));
                Integer agreementDateCol = getHeaderColIndexNullable(headerMap,
                        Arrays.asList("agreementdate", "agreement"));
                Integer panelCapacityCol = getHeaderColIndexNullable(headerMap,
                        Arrays.asList("panelcapacity", "capacity"));
                Integer solarTypeCol = getHeaderColIndexNullable(headerMap, Arrays.asList("solartype", "type"));

                // 2. Parse rows
                int lastRowNum = sheet.getLastRowNum();
                for (int r = 1; r <= lastRowNum; r++) {
                    Row row = sheet.getRow(r);
                    if (row == null || isRowEmpty(row)) {
                        continue;
                    }

                    rowsProcessed++;

                    // Extract values
                    String accountNo = getCellValueAsString(row.getCell(accountNoCol));
                    String customerName = getCellValueAsString(row.getCell(customerNameCol));
                    String refNo = getCellValueAsString(row.getCell(refNoCol));
                    LocalDate fromDate = getCellValueAsDate(row.getCell(fromDateCol));
                    LocalDate toDate = getCellValueAsDate(row.getCell(toDateCol));
                    Double importUnits = getCellValueAsDouble(row.getCell(importsCol));
                    Double exportUnits = getCellValueAsDouble(row.getCell(exportsCol));
                    Double unitCost = getCellValueAsDouble(row.getCell(unitCostCol));

                    String bankCode = bankCodeCol != null ? getCellValueAsString(row.getCell(bankCodeCol)) : "";
                    String branchCode = branchCodeCol != null ? getCellValueAsString(row.getCell(branchCodeCol)) : "";
                    String bankAccountNo = bankAccountNoCol != null
                            ? getCellValueAsString(row.getCell(bankAccountNoCol))
                            : "";
                    String billingMode = billingModeCol != null ? getCellValueAsString(row.getCell(billingModeCol))
                            : "Fixed";

                    String customerAddress = customerAddressCol != null
                            ? getCellValueAsString(row.getCell(customerAddressCol))
                            : "";
                    String mobileNo = mobileNoCol != null ? getCellValueAsString(row.getCell(mobileNoCol)) : "";
                    LocalDate agreementDate = agreementDateCol != null
                            ? getCellValueAsDate(row.getCell(agreementDateCol))
                            : null;
                    Double panelCapacity = panelCapacityCol != null
                            ? getCellValueAsDouble(row.getCell(panelCapacityCol))
                            : null;
                    String solarType = solarTypeCol != null ? getCellValueAsString(row.getCell(solarTypeCol))
                            : "Net Plus";

                    // Validation Checks
                    boolean hasRowErrors = false;

                    if (accountNo == null || accountNo.isEmpty()) {
                        errors.add(
                                new ExcelValidationError(sheetName, r + 1, "Account No", "Account number is required"));
                        hasRowErrors = true;
                    }
                    if (customerName == null || customerName.isEmpty()) {
                        errors.add(new ExcelValidationError(sheetName, r + 1, "Customer Name",
                                "Customer name is required"));
                        hasRowErrors = true;
                    }
                    if (refNo == null || refNo.isEmpty()) {
                        errors.add(
                                new ExcelValidationError(sheetName, r + 1, "Ref No", "Reference number is required"));
                        hasRowErrors = true;
                    }
                    if (fromDate == null) {
                        errors.add(new ExcelValidationError(sheetName, r + 1, "From Date",
                                "Valid From Date (YYYY-MM-DD) is required"));
                        hasRowErrors = true;
                    }
                    if (toDate == null) {
                        errors.add(new ExcelValidationError(sheetName, r + 1, "To Date",
                                "Valid To Date (YYYY-MM-DD) is required"));
                        hasRowErrors = true;
                    }
                    if (importUnits == null) {
                        errors.add(
                                new ExcelValidationError(sheetName, r + 1, "Imports", "Imports units must be numeric"));
                        hasRowErrors = true;
                    }
                    if (exportUnits == null) {
                        errors.add(
                                new ExcelValidationError(sheetName, r + 1, "Exports", "Exports units must be numeric"));
                        hasRowErrors = true;
                    }
                    if (unitCost == null) {
                        errors.add(
                                new ExcelValidationError(sheetName, r + 1, "Unit Cost", "Unit Cost must be numeric"));
                        hasRowErrors = true;
                    }

                    if (hasRowErrors) {
                        continue;
                    }

                    // Check for duplicate bill in DB (Account, RefNo, and Period)
                    Optional<BillingRecord> duplicateRecord = billingRecordRepository
                            .findByCustomerAccountNoAndRefNoAndFromDateAndToDate(accountNo, refNo, fromDate, toDate);

                    if (duplicateRecord.isPresent()) {
                        errors.add(new ExcelValidationError(sheetName, r + 1, "Duplicate",
                                "Duplicate billing record exists in DB for Account: " + accountNo + " Ref: " + refNo
                                        + " from " + fromDate + " to " + toDate));
                        continue;
                    }

                    // Save / Update Customer
                    Optional<Customer> optCustomer = customerRepository.findById(accountNo);
                    Customer customer;
                    if (optCustomer.isEmpty()) {
                        customer = new Customer(accountNo, customerName, customerAddress, mobileNo, agreementDate,
                                panelCapacity, bankCode, branchCode, bankAccountNo, solarType);
                        customerRepository.save(customer);
                        newCustomers++;
                    } else {
                        customer = optCustomer.get();
                        customer.setCustomerName(customerName);
                        if (bankCode != null && !bankCode.isEmpty())
                            customer.setBankCode(bankCode);
                        if (branchCode != null && !branchCode.isEmpty())
                            customer.setBranchCode(branchCode);
                        if (bankAccountNo != null && !bankAccountNo.isEmpty())
                            customer.setBankAccountNo(bankAccountNo);
                        if (customerAddress != null && !customerAddress.isEmpty())
                            customer.setCustomerAddress(customerAddress);
                        if (mobileNo != null && !mobileNo.isEmpty())
                            customer.setMobileNo(mobileNo);
                        if (agreementDate != null)
                            customer.setAgreementDate(agreementDate);
                        if (panelCapacity != null)
                            customer.setPanelCapacity(panelCapacity);
                        if (solarType != null && !solarType.isEmpty())
                            customer.setSolarType(solarType);
                        customerRepository.save(customer);
                    }

                    // Create Billing Record (Calculations are auto-performed in Entity @PrePersist)
                    BillingRecord record = new BillingRecord(customer, refNo, fromDate, toDate, importUnits,
                            exportUnits, unitCost, billingMode, historyId);
                    billingRecordRepository.save(record);
                    billingInserted++;
                }
            }
        } catch (Exception e) {
            history.setStatus("FAILED");
            history.setErrorsCount(errors.size() + 1);
            uploadHistoryRepository.save(history);
            auditLogService.log("EXCEL_UPLOAD_FAILED",
                    "Failed parsing file: " + filename + ". Error: " + e.getMessage());
            throw e;
        }

        // Determine final status
        String finalStatus = "SUCCESS";
        if (errors.size() > 0) {
            finalStatus = (billingInserted > 0) ? "COMPLETED_WITH_ERRORS" : "FAILED";
        }

        history.setStatus(finalStatus);
        history.setRowsProcessed(rowsProcessed);
        history.setNewCustomers(newCustomers);
        history.setBillingInserted(billingInserted);
        history.setErrorsCount(errors.size());
        uploadHistoryRepository.save(history);

        // Audit Log Entry
        String auditDetails = String.format(
                "File: %s, Processed rows: %d, Added customers: %d, Inserted bills: %d, Errors: %d",
                filename, rowsProcessed, newCustomers, billingInserted, errors.size());
        auditLogService.log("EXCEL_UPLOAD", auditDetails);

        return new ExcelUploadResponse(filename, finalStatus, rowsProcessed, newCustomers, billingInserted,
                errors.size(), errors);
    }

    private void verifyHeader(Map<String, Integer> headerMap, List<String> matchOptions, String columnName,
            List<String> missingHeaders) {
        boolean found = false;
        for (String option : matchOptions) {
            if (headerMap.containsKey(option)) {
                found = true;
                break;
            }
        }
        if (!found) {
            missingHeaders.add(columnName);
        }
    }

    private int getHeaderColIndex(Map<String, Integer> headerMap, List<String> matchOptions) {
        for (String option : matchOptions) {
            if (headerMap.containsKey(option)) {
                return headerMap.get(option);
            }
        }
        return -1;
    }

    private Integer getHeaderColIndexNullable(Map<String, Integer> headerMap, List<String> matchOptions) {
        for (String option : matchOptions) {
            if (headerMap.containsKey(option)) {
                return headerMap.get(option);
            }
        }
        return null;
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null)
            return null;
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                double numVal = cell.getNumericCellValue();
                if (numVal == (long) numVal) {
                    return String.format("%d", (long) numVal);
                } else {
                    return String.valueOf(numVal);
                }
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue().trim();
                } catch (Exception e) {
                    try {
                        return String.valueOf(cell.getNumericCellValue());
                    } catch (Exception ex) {
                        return null;
                    }
                }
            default:
                return null;
        }
    }

    private Double getCellValueAsDouble(Cell cell) {
        if (cell == null)
            return null;
        switch (cell.getCellType()) {
            case NUMERIC:
                return cell.getNumericCellValue();
            case STRING:
                try {
                    return Double.parseDouble(cell.getStringCellValue().trim());
                } catch (Exception e) {
                    return null;
                }
            case FORMULA:
                try {
                    return cell.getNumericCellValue();
                } catch (Exception e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private LocalDate getCellValueAsDate(Cell cell) {
        if (cell == null)
            return null;
        switch (cell.getCellType()) {
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toLocalDate();
                }
                return null;
            case STRING:
                try {
                    String val = cell.getStringCellValue().trim();
                    if (val.matches("\\d{4}-\\d{2}-\\d{2}")) {
                        return LocalDate.parse(val);
                    } else if (val.matches("\\d{2}/\\d{2}/\\d{4}")) {
                        String[] parts = val.split("/");
                        return LocalDate.of(Integer.parseInt(parts[2]), Integer.parseInt(parts[1]),
                                Integer.parseInt(parts[0]));
                    } else if (val.matches("\\d{2}-\\d{2}-\\d{4}")) {
                        String[] parts = val.split("-");
                        return LocalDate.of(Integer.parseInt(parts[2]), Integer.parseInt(parts[1]),
                                Integer.parseInt(parts[0]));
                    } else if (val.matches("\\d{4}/\\d{2}/\\d{2}")) {
                        String[] parts = val.split("/");
                        return LocalDate.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]),
                                Integer.parseInt(parts[2]));
                    }
                    return null;
                } catch (Exception e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private boolean isRowEmpty(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                return false;
            }
        }
        return true;
    }}return normalizeCellText(cell.getStringCellValue());case NUMERIC:if(DateUtil.isCellDateFormatted(cell)){return cell.getLocalDateTimeCellValue().toLocalDate().toString();}

    double numVal = cell.getNumericCellValue();if(numVal==(long)numVal)
    {
        return String.format("%d", (long) numVal);
    }else
    {
        return String.valueOf(numVal);
    }case BOOLEAN:return String.valueOf(cell.getBooleanCellValue());case FORMULA:try
    {
        return normalizeCellText(cell.getStringCellValue());
    }catch(
    Exception e)
    {
        try {
            return String.valueOf(cell.getNumericCellValue());
        } catch (Exception ex) {
            return null;
        }
    }default:return null;
    }}

    private Double getCellValueAsDouble(Cell cell, DataFormatter dataFormatter, FormulaEvaluator formulaEvaluator) {
        if (cell == null)
            return null;
        switch (cell.getCellType()) {
            case NUMERIC:
                return cell.getNumericCellValue();
            case STRING:
            case FORMULA:
                try {
                    String value = getFormattedCellValue(cell, dataFormatter, formulaEvaluator);
                    if (value == null)
                        return null;
                    return Double.parseDouble(value.replace(",", ""));
                } catch (Exception e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private LocalDate getCellValueAsDate(Cell cell, DataFormatter dataFormatter, FormulaEvaluator formulaEvaluator) {
        if (cell == null)
            return null;
        switch (cell.getCellType()) {
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toLocalDate();
                }
                return null;
            case STRING:
            case FORMULA:
                try {
                    String val = getFormattedCellValue(cell, dataFormatter, formulaEvaluator);
                    if (val == null)
                        return null;
                    if (val.matches("\\d{4}-\\d{2}-\\d{2}")) {
                        return LocalDate.parse(val);
                    } else if (val.matches("\\d{2}/\\d{2}/\\d{4}")) {
                        String[] parts = val.split("/");
                        return LocalDate.of(Integer.parseInt(parts[2]), Integer.parseInt(parts[1]),
                                Integer.parseInt(parts[0]));
                    } else if (val.matches("\\d{2}-\\d{2}-\\d{4}")) {
                        String[] parts = val.split("-");
                        return LocalDate.of(Integer.parseInt(parts[2]), Integer.parseInt(parts[1]),
                                Integer.parseInt(parts[0]));
                    } else if (val.matches("\\d{4}/\\d{2}/\\d{2}")) {
                        String[] parts = val.split("/");
                        return LocalDate.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]),
                                Integer.parseInt(parts[2]));
                    }
                    return null;
                } catch (Exception e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private boolean isRowEmpty(Row row, DataFormatter dataFormatter, FormulaEvaluator formulaEvaluator) {
        short firstCellNum = row.getFirstCellNum();
        short lastCellNum = row.getLastCellNum();
        if (firstCellNum < 0 || lastCellNum < 0)
            return true;

        for (int c = firstCellNum; c < lastCellNum; c++) {
            Cell cell = row.getCell(c);
            if (getFormattedCellValue(cell, dataFormatter, formulaEvaluator) != null) {
                return false;
            }
        }
        return true;
    }

    private Integer getCellValueAsInteger(Cell cell, DataFormatter dataFormatter, FormulaEvaluator formulaEvaluator) {
        if (cell == null)
            return null;
        switch (cell.getCellType()) {
            case NUMERIC:
                return (int) cell.getNumericCellValue();
            case STRING:
            case FORMULA:
                try {
                    String value = getFormattedCellValue(cell, dataFormatter, formulaEvaluator);
                    if (value == null)
                        return null;
                    return Integer.parseInt(value.replace(",", ""));
                } catch (Exception e) {
                    try {
                        String value = getFormattedCellValue(cell, dataFormatter, formulaEvaluator);
                        if (value == null)
                            return null;
                        return (int) Double.parseDouble(value.replace(",", ""));
                    } catch (Exception ex) {
                        return null;
                    }
                }
            default:
                return null;
        }
    }
}
