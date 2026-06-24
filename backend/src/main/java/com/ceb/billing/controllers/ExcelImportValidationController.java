package com.ceb.billing.controllers;

import com.ceb.billing.entities.*;
import com.ceb.billing.repositories.*;
import com.ceb.billing.services.*;
import com.ceb.billing.models.ExcelValidationError;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ExcelImportValidationController {

    @Autowired
    private ExcelTemplateRepository excelTemplateRepository;

    @Autowired
    private SheetConfigurationRepository sheetConfigurationRepository;

    @Autowired
    private HeaderMappingRepository headerMappingRepository;

    @Autowired
    private ImportBatchRepository importBatchRepository;

    @Autowired
    private BillingUploadStagingRepository stagingRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private WorkbookScannerService scannerService;

    @Autowired
    private SheetValidationService sheetValidationService;

    @Autowired
    private HeaderValidationService headerValidationService;

    @Autowired
    private PreviewService previewService;

    @Autowired
    private StagingMigrationService stagingMigrationService;

    @Autowired
    private ExcelValidationService excelValidationService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuditLogService auditLogService;

    // ─────────────────────────────────────────────────────────────────────
    //  UPLOAD & SCAN WIZARD  (Step 1 → backend does steps 1-4 in one shot)
    // ─────────────────────────────────────────────────────────────────────

    @PostMapping("/officer/import/upload")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> uploadAndValidateWorkbook(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File cannot be empty."));
        }

        try {
            String filename = file.getOriginalFilename();
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            byte[] fileBytes = file.getBytes();

            // 1. Persist initial ImportBatch record
            ImportBatch batch = new ImportBatch(filename, username, fileBytes);
            batch = importBatchRepository.save(batch);

            // 2. Fetch Active Template (optional – we still work without it)
            List<ExcelTemplate> templates = excelTemplateRepository.findByIsDeletedFalse();
            ExcelTemplate activeTemplate = templates.isEmpty() ? null : templates.get(0);
            if (activeTemplate != null) {
                batch.setExcelTemplate(activeTemplate);
            }

            // 3. Scan Workbook
            Map<String, Object> scanResult = scannerService.scanWorkbook(fileBytes);
            int totalSheets = (int) scanResult.get("totalSheets");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sheets = (List<Map<String, Object>>) scanResult.get("sheets");

            batch.setTotalSheets(totalSheets);
            batch.setSheetInfo(objectMapper.writeValueAsString(sheets));

            // 4. Intelligent per-sheet header analysis (no strict DB template matching)
            List<Map<String, Object>> consolidatedLogs = new ArrayList<>();
            boolean anySheetHasBillingCols = false;

            try (InputStream is = new ByteArrayInputStream(fileBytes);
                 Workbook workbook = WorkbookFactory.create(is)) {

                for (int sIdx = 0; sIdx < workbook.getNumberOfSheets(); sIdx++) {
                    Sheet sheet = workbook.getSheetAt(sIdx);
                    String sheetName = sheet.getSheetName();

                    Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet);

                    boolean hasBilling = Arrays.asList("accountno", "fromdate", "imports", "exports")
                            .stream().allMatch(colIndices::containsKey);
                    boolean hasCustomer = !hasBilling &&
                            Arrays.asList("accountno", "customername").stream().allMatch(colIndices::containsKey);

                    if (hasBilling) {
                        anySheetHasBillingCols = true;
                        Map<String, Object> log = new HashMap<>();
                        log.put("type", "SHEET_DETECTED");
                        log.put("severity", "INFO");
                        log.put("details", "Sheet '" + sheetName + "' detected as BILLING DATA — found columns: "
                                + colIndices.keySet());
                        consolidatedLogs.add(log);
                    } else if (hasCustomer) {
                        Map<String, Object> log = new HashMap<>();
                        log.put("type", "SHEET_DETECTED");
                        log.put("severity", "INFO");
                        log.put("details", "Sheet '" + sheetName + "' detected as CUSTOMER PROFILE data — found columns: "
                                + colIndices.keySet());
                        consolidatedLogs.add(log);
                    } else {
                        // Check if it has at least an account no
                        Row row0 = sheet.getRow(0);
                        if (row0 == null || row0.getLastCellNum() <= 0) {
                            Map<String, Object> log = new HashMap<>();
                            log.put("type", "SHEET_EMPTY");
                            log.put("severity", "WARNING");
                            log.put("details", "Sheet '" + sheetName + "' appears to be empty or has no header row. It will be skipped.");
                            consolidatedLogs.add(log);
                        } else {
                            Map<String, Object> log = new HashMap<>();
                            log.put("type", "SHEET_UNRECOGNISED");
                            log.put("severity", "WARNING");
                            log.put("details", "Sheet '" + sheetName + "' has no recognisable billing columns and will be skipped. "
                                    + "Expected at minimum: Account No, From Date, Imports, Exports.");
                            consolidatedLogs.add(log);
                        }
                    }
                }
            }

            // Determine validation statuses
            // Sheet validation: PASS if at least one billing sheet detected
            String sheetValStatus = anySheetHasBillingCols ? "PASS" : "FAIL";
            if (!anySheetHasBillingCols) {
                Map<String, Object> errLog = new HashMap<>();
                errLog.put("type", "NO_BILLING_SHEET");
                errLog.put("severity", "ERROR");
                errLog.put("details", "No sheet with required billing columns (Account No, From Date, Imports, Exports) was found in the workbook.");
                consolidatedLogs.add(0, errLog);
            }

            // Header validation: always PASS when billing sheet found (columns auto-detected)
            String headerValStatus = anySheetHasBillingCols ? "PASS" : "FAIL";

            batch.setSheetValidationStatus(sheetValStatus);
            batch.setHeaderValidationStatus(headerValStatus);
            batch.setValidationDetails(objectMapper.writeValueAsString(consolidatedLogs));

            // 5. Generate Data Preview (uses intelligent column detection internally)
            List<SheetConfiguration> emptyConfigs = new ArrayList<>();
            Map<Long, List<HeaderMapping>> emptyMappings = new HashMap<>();
            Map<String, Object> dataPreview = previewService.generatePreview(fileBytes, emptyConfigs, emptyMappings);

            batch.setStatus("SCANNED");
            importBatchRepository.save(batch);

            // Assemble Response
            Map<String, Object> response = new HashMap<>();
            response.put("batchId", batch.getId());
            response.put("filename", filename);
            response.put("excelTemplate", activeTemplate != null ? activeTemplate.getTemplateName() : "Auto-Detected");
            response.put("totalSheets", totalSheets);
            response.put("sheetsScan", sheets);
            response.put("sheetValidationStatus", sheetValStatus);
            response.put("headerValidationStatus", headerValStatus);
            response.put("logs", consolidatedLogs);
            response.put("preview", dataPreview);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(
                    Map.of("message", "Validation Engine Error: " + e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  BATCH MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────

    @GetMapping("/admin/import/batches")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ImportBatch>> getImportBatches() {
        return ResponseEntity.ok(importBatchRepository.findAll());
    }

    @PostMapping("/admin/import/batches/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approveImportBatch(@PathVariable Long id,
            @org.springframework.web.bind.annotation.RequestBody(required = false) Map<String, Object> requestBody) {
        Optional<ImportBatch> optBatch = importBatchRepository.findById(id);
        if (optBatch.isEmpty()) return ResponseEntity.notFound().build();

        ImportBatch batch = optBatch.get();
        if (batch.getIsApproved()) {
            return ResponseEntity.badRequest().body(Map.of("message", "This batch has already been approved."));
        }

        // Extract selectedSheets list from request body (null = process all billing sheets)
        @SuppressWarnings("unchecked")
        List<String> selectedSheets = (requestBody != null && requestBody.get("selectedSheets") != null)
                ? (List<String>) requestBody.get("selectedSheets")
                : null;
        // Convert to lowercase-trimmed set for case-insensitive matching
        Set<String> selectedSheetSet = selectedSheets != null
                ? new HashSet<>(selectedSheets.stream().map(String::trim).collect(java.util.stream.Collectors.toList()))
                : null;

        String username = SecurityContextHolder.getContext().getAuthentication().getName();

        try {
            byte[] fileBytes = batch.getFileData();

            // Create staging upload history record
            UploadHistory uploadHistory = new UploadHistory(batch.getFilename(), batch.getUploadedBy(), "STAGED_IMPORT", 0, 0, 0, 0);
            uploadHistory = uploadHistoryRepository.save(uploadHistory);
            Long stagingBatchId = uploadHistory.getId();

            // In-memory structures
            Map<String, Map<String, Object>> customerProfiles = new LinkedHashMap<>();
            List<Map<String, Object>> billingRecordsList = new ArrayList<>();
            Set<String> processedRecordsInUpload = new HashSet<>();

            try (InputStream is = new ByteArrayInputStream(fileBytes);
                 Workbook workbook = WorkbookFactory.create(is)) {

                int numSheets = workbook.getNumberOfSheets();
                for (int sIdx = 0; sIdx < numSheets; sIdx++) {
                    Sheet sheet = workbook.getSheetAt(sIdx);
                    String currentSheetName = sheet.getSheetName();

                    // Skip sheets not in the selectedSheets list (if provided)
                    if (selectedSheetSet != null && !selectedSheetSet.contains(currentSheetName.trim())) {
                        continue;
                    }

                    // Intelligent column detection
                    Map<String, Integer> colIndices = previewService.autoDetectColumns(sheet);

                    boolean hasBilling = Arrays.asList("accountno", "fromdate", "imports", "exports")
                            .stream().allMatch(colIndices::containsKey);
                    boolean hasCustomer = !hasBilling &&
                            Arrays.asList("accountno", "customername").stream().allMatch(colIndices::containsKey);

                    if (!hasBilling && !hasCustomer) continue; // skip unrecognised sheets

                    int lastRowNum = sheet.getLastRowNum();

                    if (hasCustomer) {
                        // Parse customer profile rows
                        for (int r = 1; r <= lastRowNum; r++) {
                            Row row = sheet.getRow(r);
                            if (row == null || isRowEmpty(row)) continue;

                            String accountNo = getVal(row, colIndices.get("accountno"));
                            if (accountNo == null || accountNo.trim().isEmpty()) continue;

                            Map<String, Object> profile = new HashMap<>();
                            profile.put("customerName",    getVal(row, colIndices.get("customername")));
                            profile.put("customerAddress", getVal(row, colIndices.get("customeraddress")));
                            profile.put("mobileNo",        getVal(row, colIndices.get("mobileno")));
                            profile.put("agreementDate",   getDateStr(row, colIndices.get("agreementdate")));
                            profile.put("panelCapacity",   parseDoubleVal(row, colIndices.get("panelcapacity")));
                            profile.put("solarType",       getVal(row, colIndices.get("solartype")));
                            profile.put("bankCode",        getVal(row, colIndices.get("bankcode")));
                            String detBranch = com.ceb.billing.utils.BranchDetector.detectBranch(accountNo.trim());
                            profile.put("branchCode",      detBranch != null ? detBranch : getVal(row, colIndices.get("branchcode")));
                            profile.put("bankAccountNo",   getVal(row, colIndices.get("bankaccountno")));

                            customerProfiles.put(accountNo.trim(), profile);
                        }
                    } else {
                        // Parse billing record rows
                        for (int r = 1; r <= lastRowNum; r++) {
                            Row row = sheet.getRow(r);
                            if (row == null || isRowEmpty(row)) continue;

                            String accountNo = getVal(row, colIndices.get("accountno"));
                            if (accountNo == null || accountNo.trim().isEmpty()) continue;

                            Map<String, Object> bill = new HashMap<>();
                            bill.put("accountNo",      accountNo.trim());
                            bill.put("customerName",   getVal(row, colIndices.get("customername")));
                            bill.put("refNo",          getVal(row, colIndices.get("refno")));
                            bill.put("fromDate",       getDateStr(row, colIndices.get("fromdate")));
                            bill.put("toDate",         getDateStr(row, colIndices.get("todate")));
                            bill.put("importUnits",    parseDoubleVal(row, colIndices.get("imports")));
                            bill.put("exportUnits",    parseDoubleVal(row, colIndices.get("exports")));
                            bill.put("unitCost",       parseDoubleVal(row, colIndices.get("unitcost")));
                            bill.put("billingMode",    getVal(row, colIndices.get("billingmode")));
                            bill.put("customerAddress",getVal(row, colIndices.get("customeraddress")));
                            bill.put("mobileNo",       getVal(row, colIndices.get("mobileno")));
                            bill.put("agreementDate",  getDateStr(row, colIndices.get("agreementdate")));
                            bill.put("panelCapacity",  parseDoubleVal(row, colIndices.get("panelcapacity")));
                            bill.put("solarType",      getVal(row, colIndices.get("solartype")));
                            bill.put("bankCode",       getVal(row, colIndices.get("bankcode")));
                            String detBranch = com.ceb.billing.utils.BranchDetector.detectBranch(accountNo.trim());
                            bill.put("branchCode",     detBranch != null ? detBranch : getVal(row, colIndices.get("branchcode")));
                            bill.put("bankAccountNo",  getVal(row, colIndices.get("bankaccountno")));

                            billingRecordsList.add(bill);
                        }
                    }
                }
            }

            // If only customer sheets found, treat each customer as a billing placeholder
            if (billingRecordsList.isEmpty() && !customerProfiles.isEmpty()) {
                for (Map.Entry<String, Map<String, Object>> entry : customerProfiles.entrySet()) {
                    Map<String, Object> bill = new HashMap<>(entry.getValue());
                    bill.put("accountNo", entry.getKey());
                    billingRecordsList.add(bill);
                }
            }

            // Validate and stage rows
            int insertedStaging = 0;
            for (Map<String, Object> bill : billingRecordsList) {
                String accountNo = (String) bill.get("accountNo");

                // Merge customer profile if available
                Map<String, Object> profile = customerProfiles.get(accountNo);
                if (profile != null) {
                    for (Map.Entry<String, Object> entry : profile.entrySet()) {
                        if (bill.get(entry.getKey()) == null || "".equals(bill.get(entry.getKey()))) {
                            bill.put(entry.getKey(), entry.getValue());
                        }
                    }
                }

                // Resolve ref no if missing
                String refNo = (String) bill.get("refNo");
                String rawFromDate = (String) bill.get("fromDate");
                if ((refNo == null || refNo.trim().isEmpty()) && rawFromDate != null) {
                    bill.put("refNo", "REF-" + accountNo + "-" + rawFromDate.replaceAll("[^0-9]", ""));
                }

                String customerName = (String) bill.get("customerName");
                String rawToDate   = (String) bill.get("toDate");
                Double imports  = bill.get("importUnits") != null ? Double.valueOf(bill.get("importUnits").toString()) : null;
                Double exports  = bill.get("exportUnits") != null ? Double.valueOf(bill.get("exportUnits").toString()) : null;
                Double unitCost = bill.get("unitCost") != null ? Double.valueOf(bill.get("unitCost").toString()) : null;
                String bankCode = (String) bill.get("bankCode");

                LocalDate fromDate = null, toDate = null;
                try { if (rawFromDate != null) fromDate = LocalDate.parse(rawFromDate); } catch (Exception ignored) {}
                try { if (rawToDate != null)   toDate   = LocalDate.parse(rawToDate); }   catch (Exception ignored) {}

                ExcelValidationService.RowValidationResult validationResult = excelValidationService.validateRow(
                        "Import", insertedStaging + 2,
                        accountNo, customerName,
                        rawFromDate, fromDate,
                        rawToDate, toDate,
                        imports != null ? imports.toString() : "",
                        imports,
                        exports != null ? exports.toString() : "",
                        exports,
                        unitCost != null ? unitCost.toString() : "",
                        unitCost,
                        bankCode,
                        processedRecordsInUpload
                );

                if (fromDate != null && accountNo != null) {
                    processedRecordsInUpload.add(accountNo + "|" + fromDate.getYear() + "|" + fromDate.getMonthValue());
                }

                String rowStatus = validationResult.hasErrors() ? "INVALID"
                        : validationResult.hasDuplicate() ? "DUPLICATE"
                        : validationResult.hasWarnings() ? "WARNING" : "VALID";

                List<String> errorMsgs = new ArrayList<>();
                for (ExcelValidationError error : validationResult.getValidationMessages()) {
                    errorMsgs.add(error.getErrorMessage());
                }

                String rawJson = objectMapper.writeValueAsString(bill);
                String validationErrorsJson = objectMapper.writeValueAsString(errorMsgs);

                BillingUploadStaging stagingRow = new BillingUploadStaging(stagingBatchId, rawJson, rowStatus, validationErrorsJson);
                stagingRepository.save(stagingRow);
                insertedStaging++;
            }

            // Migrate staging → live tables
            stagingMigrationService.migrateApprovedBatch(stagingBatchId, username);

            // Update ImportBatch
            batch.setIsApproved(true);
            batch.setApprovedBy(username);
            batch.setApprovedAt(LocalDateTime.now());
            batch.setStatus("APPROVED");
            importBatchRepository.save(batch);

            auditLogService.log("VALIDATION_ENGINE_APPROVE",
                    String.format("Import Batch ID %d ('%s') approved. Migrated %d rows.", id, batch.getFilename(), insertedStaging));

            Map<String, Object> approveResponse = new HashMap<>();
            approveResponse.put("message", "Import batch successfully validated, approved, and migrated to live tables.");
            approveResponse.put("rowsMigrated", insertedStaging);
            return ResponseEntity.ok(approveResponse);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Approve failed: " + e.getMessage()));
        }
    }

    @PostMapping("/admin/import/batches/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> rejectImportBatch(@PathVariable Long id) {
        Optional<ImportBatch> optBatch = importBatchRepository.findById(id);
        if (optBatch.isEmpty()) return ResponseEntity.notFound().build();

        ImportBatch batch = optBatch.get();
        batch.setStatus("REJECTED");
        importBatchRepository.save(batch);

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("VALIDATION_ENGINE_REJECT",
                String.format("Import Batch ID %d ('%s') rejected by %s.", id, batch.getFilename(), username));

        return ResponseEntity.ok(Map.of("message", "Batch validation review rejected."));
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TEMPLATE & MAPPINGS MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────

    @GetMapping("/admin/import/templates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getActiveTemplates() {
        List<ExcelTemplate> templates = excelTemplateRepository.findByIsDeletedFalse();
        List<Map<String, Object>> response = new ArrayList<>();

        for (ExcelTemplate t : templates) {
            Map<String, Object> tMap = new HashMap<>();
            tMap.put("id", t.getId());
            tMap.put("templateName", t.getTemplateName());
            tMap.put("description", t.getDescription());
            tMap.put("createdAt", t.getCreatedAt());

            List<SheetConfiguration> sheets = sheetConfigurationRepository.findByTemplateId(t.getId());
            List<Map<String, Object>> sheetsResponse = new ArrayList<>();

            for (SheetConfiguration s : sheets) {
                Map<String, Object> sMap = new HashMap<>();
                sMap.put("id", s.getId());
                sMap.put("sheetName", s.getSheetName());
                sMap.put("isRequired", s.getIsRequired());
                sMap.put("isIgnored", s.getIsIgnored());
                sMap.put("isDeleted", s.getIsDeleted());
                sMap.put("deletedAt", s.getDeletedAt());

                List<HeaderMapping> headers = headerMappingRepository.findBySheetConfigurationId(s.getId());
                sMap.put("headers", headers);
                sheetsResponse.add(sMap);
            }
            tMap.put("sheets", sheetsResponse);
            response.add(tMap);
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/admin/import/sheet-configs/{id}/toggle-ignore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> toggleIgnoreSheet(@PathVariable Long id) {
        Optional<SheetConfiguration> opt = sheetConfigurationRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        SheetConfiguration sheet = opt.get();
        sheet.setIsIgnored(!sheet.getIsIgnored());
        sheetConfigurationRepository.save(sheet);

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("TEMPLATE_UPDATE",
                String.format("Sheet config '%s' (ID %d) toggle isIgnored to: %b by %s",
                        sheet.getSheetName(), id, sheet.getIsIgnored(), username));
        return ResponseEntity.ok(sheet);
    }

    @DeleteMapping("/admin/import/sheet-configs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> softDeleteSheetConfig(@PathVariable Long id) {
        Optional<SheetConfiguration> opt = sheetConfigurationRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        SheetConfiguration sheet = opt.get();
        sheet.setIsDeleted(true);
        sheet.setDeletedAt(LocalDateTime.now());
        sheetConfigurationRepository.save(sheet);

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("TEMPLATE_UPDATE",
                String.format("Sheet config '%s' (ID %d) soft deleted by %s", sheet.getSheetName(), id, username));
        return ResponseEntity.ok(sheet);
    }

    @PostMapping("/admin/import/sheet-configs/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> restoreSheetConfig(@PathVariable Long id) {
        Optional<SheetConfiguration> opt = sheetConfigurationRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        SheetConfiguration sheet = opt.get();
        sheet.setIsDeleted(false);
        sheet.setRestoredAt(LocalDateTime.now());
        sheetConfigurationRepository.save(sheet);

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("TEMPLATE_UPDATE",
                String.format("Sheet config '%s' (ID %d) restored by %s", sheet.getSheetName(), id, username));
        return ResponseEntity.ok(sheet);
    }

    @DeleteMapping("/admin/import/header-mappings/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> softDeleteHeaderMapping(@PathVariable Long id) {
        Optional<HeaderMapping> opt = headerMappingRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        HeaderMapping mapping = opt.get();
        mapping.setIsDeleted(true);
        mapping.setDeletedAt(LocalDateTime.now());
        headerMappingRepository.save(mapping);

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("TEMPLATE_UPDATE",
                String.format("Header mapping '%s' (ID %d) soft deleted by %s", mapping.getHeaderName(), id, username));
        return ResponseEntity.ok(mapping);
    }

    @PostMapping("/admin/import/header-mappings/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> restoreHeaderMapping(@PathVariable Long id) {
        Optional<HeaderMapping> opt = headerMappingRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        HeaderMapping mapping = opt.get();
        mapping.setIsDeleted(false);
        mapping.setRestoredAt(LocalDateTime.now());
        headerMappingRepository.save(mapping);

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        auditLogService.log("TEMPLATE_UPDATE",
                String.format("Header mapping '%s' (ID %d) restored by %s", mapping.getHeaderName(), id, username));
        return ResponseEntity.ok(mapping);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────────────

    private String getVal(Row row, Integer idx) {
        if (idx == null) return "";
        Cell cell = row.getCell(idx);
        return getCellValueAsString(cell);
    }

    private String getDateStr(Row row, Integer idx) {
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
                             "dd-MM-yyyy", "MM-dd-yyyy", "yyyy/MM/dd"};
        for (String pattern : patterns) {
            try {
                LocalDate ld = LocalDate.parse(trimmed, DateTimeFormatter.ofPattern(pattern));
                return ld.toString();
            } catch (Exception ignored) {}
        }
        return trimmed;
    }

    private Double parseDoubleVal(Row row, Integer idx) {
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            return cell.getNumericCellValue();
        }
        String str = getCellValueAsString(cell);
        if (str == null || str.trim().isEmpty()) return null;
        try {
            return Double.parseDouble(str.trim().replace(",", ""));
        } catch (Exception e) {
            return null;
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return null;
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    Date d = cell.getDateCellValue();
                    LocalDate ld = d.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                    return ld.toString();
                }
                double numVal = cell.getNumericCellValue();
                if (numVal == (long) numVal) {
                    return String.valueOf((long) numVal);
                }
                return String.valueOf(numVal);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (Exception e) {
                    try {
                        double fv = cell.getNumericCellValue();
                        if (fv == (long) fv) return String.valueOf((long) fv);
                        return String.valueOf(fv);
                    } catch (Exception ex) {
                        return "";
                    }
                }
            default:
                return "";
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
