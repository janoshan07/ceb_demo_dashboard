package com.ceb.billing.models;

public class ExcelValidationError {
    private String sheetName;
    private int rowNum;
    private String field;
    private String errorMessage;

    public ExcelValidationError() {
    }

    public ExcelValidationError(String sheetName, int rowNum, String field, String errorMessage) {
        this.sheetName = sheetName;
        this.rowNum = rowNum;
        this.field = field;
        this.errorMessage = errorMessage;
    }

    // Getters and Setters
    public String getSheetName() {
        return sheetName;
    }

    public void setSheetName(String sheetName) {
        this.sheetName = sheetName;
    }

    public int getRowNum() {
        return rowNum;
    }

    public void setRowNum(int rowNum) {
        this.rowNum = rowNum;
    }

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
