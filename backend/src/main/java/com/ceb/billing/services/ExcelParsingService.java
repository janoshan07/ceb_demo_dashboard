package com.ceb.billing.services;

import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.entities.BillingUploadStaging;
import com.ceb.billing.models.ExcelUploadResponse;
import com.ceb.billing.models.ExcelValidationError;
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
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private ExcelValidationService excelValidationService;

    @Autowired
    private BillingUploadStagingRepository billingUploadStagingRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PreviewService previewService;

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


    @Transactional
    public ExcelUploadResponse parseAndSaveExcel(MultipartFile file, String uploadedBy) throws Exception {
        String filename = file.getOriginalFilename();
        List<ExcelValidationError> errors = new ArrayList<>();
        int rowsProcessed = 0;

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

                // 1. Detect header row index dynamically
                int headerRowIdx = findHeaderRowIndex(sheet);

                // 2. Map headers to column indices
                Row headerRow = sheet.getRow(headerRowIdx);
                if (headerRow == null) {
                    errors.add(new ExcelValidationError(sheetName, headerRowIdx + 1, "Header", "Sheet is empty"));
                    continue;
                }

                // Auto-detect logical column mapping using the detected header row and sub-header row presence
                Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet, headerRowIdx);

                boolean hasBillingCols = colIndices.containsKey("accountno") && colIndices.containsKey("fromdate") && colIndices.containsKey("imports") && colIndices.containsKey("exports");
                boolean hasCustomerCols = !hasBillingCols && colIndices.containsKey("accountno") && colIndices.containsKey("customername");
                
                if (!hasBillingCols && !hasCustomerCols) {
                    errors.add(new ExcelValidationError(sheetName, headerRowIdx + 1, "Headers",
                            "Unable to identify sheet structure. Sheet must be either a Billing Sheet (containing Account No, From Date, Imports, Exports) or a Customer Profile Sheet (containing Account No, Customer Name)."));
                    continue;
                }
                
                String detectedType = hasBillingCols ? "BILLING" : "CUSTOMER_PROFILE";

                int accountNoCol = colIndices.getOrDefault("accountno", -1);
                Integer bankAccountNoCol = colIndices.get("bankaccountno");
                int customerNameCol = colIndices.getOrDefault("customername", -1);
                int refNoCol = colIndices.getOrDefault("refno", -1);
                int fromDateCol = colIndices.getOrDefault("fromdate", -1);
                int toDateCol = colIndices.getOrDefault("todate", -1);
                int importsCol = colIndices.getOrDefault("imports", -1);
                int exportsCol = colIndices.getOrDefault("exports", -1);
                int unitCostCol = colIndices.getOrDefault("unitcost", -1);

                // Check required headers (mandatory columns list)
                List<String> missingHeaders = new ArrayList<>();
                if (accountNoCol == -1) missingHeaders.add("Account No");
                if (customerNameCol == -1) missingHeaders.add("Customer Name");
                
                if ("BILLING".equals(detectedType)) {
                    if (fromDateCol == -1) missingHeaders.add("From Date");
                    if (toDateCol == -1) missingHeaders.add("To Date");
                    if (importsCol == -1) missingHeaders.add("Imports");
                    if (exportsCol == -1) missingHeaders.add("Exports");
                    if (unitCostCol == -1) missingHeaders.add("Unit Cost");
                }

                if (!missingHeaders.isEmpty()) {
                    errors.add(new ExcelValidationError(sheetName, headerRowIdx + 1, "Headers",
                            "Missing required columns: " + String.join(", ", missingHeaders)));
                    continue;
                }

                // Optional indices
                Integer bankCodeCol = colIndices.get("bankcode");
                Integer branchCodeCol = colIndices.get("branchcode");
                Integer billingModeCol = colIndices.get("billingmode");
                Integer costCodeCol = colIndices.get("costcode");
                Integer tariffTypeCol = colIndices.get("tarifftype");

                // Extra optional solar details
                Integer customerAddressCol = colIndices.get("customeraddress");
                Integer mobileNoCol = colIndices.get("mobileno");
                Integer agreementDateCol = colIndices.get("agreementdate");
                Integer panelCapacityCol = colIndices.get("panelcapacity");
                Integer solarTypeCol = colIndices.get("solartype");

                boolean hasSubHeader = headerRowIdx + 1 <= sheet.getLastRowNum() && previewService.isSubHeaderRow(sheet, headerRowIdx + 1);
                int dataStartRow = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;

                // 3. Parse rows starting immediately after the header row(s)
                int lastRowNum = sheet.getLastRowNum();
                for (int r = dataStartRow; r <= lastRowNum; r++) {
                    Row row = sheet.getRow(r);
                    if (row == null || isRowEmpty(row)) {
                        continue;
                    }

                    // Extract parsed values
                    String accountNo = getCellValueAsString(row.getCell(accountNoCol));
                    if (accountNo == null || accountNo.trim().isEmpty()) {
                        continue; // Skip summation / non-data rows
                    }

                    rowsProcessed++;
                    totalRows++;

                    // Extract raw cell values as string to detect format errors or missing fields
                    String rawFromDate = fromDateCol != -1 ? getCellValueAsString(row.getCell(fromDateCol)) : null;
                    String rawToDate = toDateCol != -1 ? getCellValueAsString(row.getCell(toDateCol)) : null;
                    String rawImports = importsCol != -1 ? getCellValueAsString(row.getCell(importsCol)) : null;
                    String rawExports = exportsCol != -1 ? getCellValueAsString(row.getCell(exportsCol)) : null;
                    String rawUnitCost = unitCostCol != -1 ? getCellValueAsString(row.getCell(unitCostCol)) : null;
                    String customerName = getCellValueAsString(row.getCell(customerNameCol));
                    String refNo = refNoCol != -1 ? getCellValueAsString(row.getCell(refNoCol)) : "";
                    LocalDate fromDate = getCellValueAsDate(row.getCell(fromDateCol));
                    LocalDate toDate = getCellValueAsDate(row.getCell(toDateCol));
                    Double importUnits = getCellValueAsDouble(row.getCell(importsCol));
                    Double exportUnits = getCellValueAsDouble(row.getCell(exportsCol));
                    Double unitCost = getCellValueAsDouble(row.getCell(unitCostCol));

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
                    String costCode = costCodeCol != null ? getCellValueAsString(row.getCell(costCodeCol)) : "";
                    String tariffType = tariffTypeCol != null ? getCellValueAsString(row.getCell(tariffTypeCol)) : "";
                    Double unitRate = unitCost;

                    String bankCode = bankCodeCol != null ? getCellValueAsString(row.getCell(bankCodeCol)) : "";
                    String branchCode = branchCodeCol != null ? getCellValueAsString(row.getCell(branchCodeCol)) : "";
                    String bankAccountNo = bankAccountNoCol != null
                            ? getCellValueAsString(row.getCell(bankAccountNoCol))
                            : "";
                    // Automatically derive L-Code (billingMode) based on Type (solarType) and Fix/Variable (tariffType)
                    String billingMode = ExcelValidationService.deriveLCode(solarType, tariffType);

                    // Call the ExcelValidationService to validate row data
                    ExcelValidationService.RowValidationResult validationResult;
                    if ("CUSTOMER_PROFILE".equals(detectedType)) {
                        validationResult = excelValidationService.validateCustomerRow(
                                sheetName,
                                r + 1,
                                accountNo,
                                customerName,
                                customerAddress,
                                mobileNo,
                                bankCode,
                                branchCode,
                                bankAccountNo,
                                agreementDate != null ? agreementDate.toString() : null,
                                panelCapacity,
                                solarType,
                                costCode,
                                billingMode,
                                refNo,
                                unitRate,
                                tariffType
                        );
                    } else {
                        validationResult = excelValidationService.validateRow(
                                sheetName,
                                r + 1,
                                detectedType,
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
                                customerAddress,
                                mobileNo,
                                bankAccountNo,
                                branchCode,
                                billingMode,
                                agreementDate != null ? agreementDate.toString() : null,
                                panelCapacity,
                                solarType,
                                tariffType,
                                processedRecordsInUpload
                        );
                    }

                    // Add all messages (errors, duplicates, warnings) to validation log
                    errors.addAll(validationResult.getValidationMessages());

                    // Determine validation status for staging
                    // Determine validation status for staging (DUPLICATE status takes precedence over INVALID)
                    String validationStatus = "VALID";
                    if (validationResult.hasDuplicate()) {
                        validationStatus = "DUPLICATE";
                        duplicateRows++;
                    } else if (validationResult.hasErrors()) {
                        validationStatus = "INVALID";
                        invalidRows++;
                    } else if (validationResult.hasWarnings()) {
                        validationStatus = "WARNING";
                        long rowWarningsCount = 0;
                        if (validationResult.getValidationMessages() != null) {
                            for (ExcelValidationError error : validationResult.getValidationMessages()) {
                                if (error != null && error.isWarning()) {
                                    rowWarningsCount++;
                                }
                            }
                        }
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
                    rowDataMap.put("costCode", costCode);
                    rowDataMap.put("unitRate", unitRate != null ? unitRate : (unitCost != null ? unitCost : null));
                    rowDataMap.put("tariffType", tariffType);

                    String rawJson = objectMapper.writeValueAsString(rowDataMap);
                    String validationErrorsJson = objectMapper.writeValueAsString(validationResult.getValidationMessages());

                    // Create staging record
                    BillingUploadStaging stagingRecord = new BillingUploadStaging(historyId, rawJson, validationStatus, validationErrorsJson, detectedType);
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
