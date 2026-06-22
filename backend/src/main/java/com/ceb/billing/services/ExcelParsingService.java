package com.ceb.billing.services;

import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.entities.BillingUploadStaging;
import com.ceb.billing.models.ExcelUploadResponse;
import com.ceb.billing.models.ExcelValidationError;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.repositories.BillingUploadStagingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    @Autowired
    private ExcelValidationService excelValidationService;

    @Autowired
    private BillingUploadStagingRepository billingUploadStagingRepository;

    @Autowired
    private ObjectMapper objectMapper;


    @Transactional
    public ExcelUploadResponse parseAndSaveExcel(MultipartFile file, String uploadedBy) throws Exception {
        String filename = file.getOriginalFilename();
        List<ExcelValidationError> errors = new ArrayList<>();
        int rowsProcessed = 0;
        int newCustomers = 0;
        int billingInserted = 0;

        // Validation Summary Counters
        int totalRows = 0;
        int validRows = 0;
        int invalidRows = 0;
        int duplicateRows = 0;
        int warningCount = 0;

        // In-memory set to track duplicate account + billing month/year combinations in this upload
        Set<String> processedRecordsInUpload = new HashSet<>();

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

                // Check required headers (mandatory columns list)
                List<String> missingHeaders = new ArrayList<>();
                verifyHeader(headerMap, Arrays.asList("accountno", "accountnumber"), "Account No", missingHeaders);
                verifyHeader(headerMap, Arrays.asList("customername", "name"), "Customer Name", missingHeaders);
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
                    totalRows++;

                    // Extract raw cell values as string to detect format errors or missing fields
                    String rawFromDate = fromDateCol != -1 ? getCellValueAsString(row.getCell(fromDateCol)) : null;
                    String rawToDate = toDateCol != -1 ? getCellValueAsString(row.getCell(toDateCol)) : null;
                    String rawImports = importsCol != -1 ? getCellValueAsString(row.getCell(importsCol)) : null;
                    String rawExports = exportsCol != -1 ? getCellValueAsString(row.getCell(exportsCol)) : null;
                    String rawUnitCost = unitCostCol != -1 ? getCellValueAsString(row.getCell(unitCostCol)) : null;

                    // Extract parsed values
                    String accountNo = getCellValueAsString(row.getCell(accountNoCol));
                    String customerName = getCellValueAsString(row.getCell(customerNameCol));
                    String refNo = refNoCol != -1 ? getCellValueAsString(row.getCell(refNoCol)) : "";
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

                    // Call the ExcelValidationService to validate row data
                    ExcelValidationService.RowValidationResult validationResult = excelValidationService.validateRow(
                            sheetName,
                            r + 1,
                            accountNo,
                            customerName,
                            rawFromDate,
                            fromDate,
                            rawToDate,
                            toDate,
                            rawImports,
                            importUnits,
                            rawExports,
                            exportUnits,
                            rawUnitCost,
                            unitCost,
                            bankCode,
                            processedRecordsInUpload
                    );

                    // Add all messages (errors, duplicates, warnings) to validation log
                    errors.addAll(validationResult.getValidationMessages());

                    // Determine validation status for staging
                    String validationStatus = "VALID";
                    if (validationResult.hasErrors()) {
                        validationStatus = "INVALID";
                        invalidRows++;
                    } else if (validationResult.hasDuplicate()) {
                        validationStatus = "DUPLICATE";
                        duplicateRows++;
                    } else if (validationResult.hasWarnings()) {
                        validationStatus = "WARNING";
                        long rowWarningsCount = validationResult.getValidationMessages().stream()
                                .filter(ExcelValidationError::isWarning)
                                .count();
                        warningCount += (int) rowWarningsCount;
                    } else {
                        validRows++;
                    }

                    // Add to in-memory set to prevent duplicates within this upload sheet
                    if (fromDate != null && ("VALID".equals(validationStatus) || "WARNING".equals(validationStatus))) {
                        int year = fromDate.getYear();
                        int month = fromDate.getMonthValue();
                        processedRecordsInUpload.add(accountNo + "|" + year + "|" + month);
                    }

                    // Serialize row data to raw_json
                    Map<String, Object> rowDataMap = new HashMap<>();
                    rowDataMap.put("accountNo", accountNo);
                    rowDataMap.put("customerName", customerName);
                    // Handle reference number fallback logic
                    if ((refNo == null || refNo.trim().isEmpty()) && fromDate != null) {
                        refNo = "REF-" + accountNo + "-" + fromDate.toString().replaceAll("-", "");
                    }
                    rowDataMap.put("refNo", refNo);
                    rowDataMap.put("fromDate", fromDate != null ? fromDate.toString() : rawFromDate);
                    rowDataMap.put("toDate", toDate != null ? toDate.toString() : rawToDate);
                    rowDataMap.put("importUnits", importUnits != null ? importUnits : rawImports);
                    rowDataMap.put("exportUnits", exportUnits != null ? exportUnits : rawExports);
                    rowDataMap.put("unitCost", unitCost != null ? unitCost : rawUnitCost);
                    rowDataMap.put("bankCode", bankCode);
                    rowDataMap.put("branchCode", branchCode);
                    rowDataMap.put("bankAccountNo", bankAccountNo);
                    rowDataMap.put("billingMode", billingMode);
                    rowDataMap.put("customerAddress", customerAddress);
                    rowDataMap.put("mobileNo", mobileNo);
                    rowDataMap.put("agreementDate", agreementDate != null ? agreementDate.toString() : null);
                    rowDataMap.put("panelCapacity", panelCapacity);
                    rowDataMap.put("solarType", solarType);

                    String rawJson = objectMapper.writeValueAsString(rowDataMap);
                    String validationErrorsJson = objectMapper.writeValueAsString(validationResult.getValidationMessages());

                    // Create staging record
                    BillingUploadStaging stagingRecord = new BillingUploadStaging(historyId, rawJson, validationStatus, validationErrorsJson);
                    billingUploadStagingRepository.save(stagingRecord);
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
        String finalStatus = "PENDING_APPROVAL";

        history.setStatus(finalStatus);
        history.setRowsProcessed(rowsProcessed);
        history.setNewCustomers(0);
        history.setBillingInserted(0);
        history.setErrorsCount(errors.size());
        uploadHistoryRepository.save(history);

        // Audit Log Entry
        String auditDetails = String.format(
                "File: %s, Processed and staged: %d rows, Errors/warnings: %d",
                filename, rowsProcessed, errors.size());
        auditLogService.log("EXCEL_UPLOAD", auditDetails);

        return new ExcelUploadResponse(filename, finalStatus, rowsProcessed, 0, 0,
                errors.size(), errors, totalRows, validRows, invalidRows, duplicateRows, warningCount);
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
    }

}
