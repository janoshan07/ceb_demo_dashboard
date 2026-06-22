package com.ceb.billing.models;

import java.util.List;

public class ExcelUploadResponse {
    private String filename;
    private String status; // SUCCESS, COMPLETED_WITH_ERRORS, FAILED
    private int rowsProcessed;
    private int newCustomers;
    private int billingInserted;
    private int errorsCount;
    private List<ExcelValidationError> errors;

    // Detailed Validation Summary
    private int totalRows;
    private int validRows;
    private int invalidRows;
    private int duplicateRows;
    private int warningCount;

    public ExcelUploadResponse() {
    }

    public ExcelUploadResponse(String filename, String status, int rowsProcessed, int newCustomers, int billingInserted, int errorsCount, List<ExcelValidationError> errors) {
        this.filename = filename;
        this.status = status;
        this.rowsProcessed = rowsProcessed;
        this.newCustomers = newCustomers;
        this.billingInserted = billingInserted;
        this.errorsCount = errorsCount;
        this.errors = errors;
        // Default mappings for fallback
        this.totalRows = rowsProcessed;
        this.validRows = billingInserted;
        this.invalidRows = errorsCount;
        this.duplicateRows = 0;
        this.warningCount = 0;
    }

    public ExcelUploadResponse(String filename, String status, int rowsProcessed, int newCustomers, int billingInserted, int errorsCount, List<ExcelValidationError> errors, int totalRows, int validRows, int invalidRows, int duplicateRows, int warningCount) {
        this.filename = filename;
        this.status = status;
        this.rowsProcessed = rowsProcessed;
        this.newCustomers = newCustomers;
        this.billingInserted = billingInserted;
        this.errorsCount = errorsCount;
        this.errors = errors;
        this.totalRows = totalRows;
        this.validRows = validRows;
        this.invalidRows = invalidRows;
        this.duplicateRows = duplicateRows;
        this.warningCount = warningCount;
    }

    // Getters and Setters
    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getRowsProcessed() {
        return rowsProcessed;
    }

    public void setRowsProcessed(int rowsProcessed) {
        this.rowsProcessed = rowsProcessed;
    }

    public int getNewCustomers() {
        return newCustomers;
    }

    public void setNewCustomers(int newCustomers) {
        this.newCustomers = newCustomers;
    }

    public int getBillingInserted() {
        return billingInserted;
    }

    public void setBillingInserted(int billingInserted) {
        this.billingInserted = billingInserted;
    }

    public int getErrorsCount() {
        return errorsCount;
    }

    public void setErrorsCount(int errorsCount) {
        this.errorsCount = errorsCount;
    }

    public List<ExcelValidationError> getErrors() {
        return errors;
    }

    public void setErrors(List<ExcelValidationError> errors) {
        this.errors = errors;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public int getValidRows() {
        return validRows;
    }

    public void setValidRows(int validRows) {
        this.validRows = validRows;
    }

    public int getInvalidRows() {
        return invalidRows;
    }

    public void setInvalidRows(int invalidRows) {
        this.invalidRows = invalidRows;
    }

    public int getDuplicateRows() {
        return duplicateRows;
    }

    public void setDuplicateRows(int duplicateRows) {
        this.duplicateRows = duplicateRows;
    }

    public int getWarningCount() {
        return warningCount;
    }

    public void setWarningCount(int warningCount) {
        this.warningCount = warningCount;
    }
}

