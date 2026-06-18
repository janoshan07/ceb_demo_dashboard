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
}
