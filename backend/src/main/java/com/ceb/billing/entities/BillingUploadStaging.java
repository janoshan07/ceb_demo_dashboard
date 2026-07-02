package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "billing_upload_staging")
public class BillingUploadStaging {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "staging_id")
    private Long stagingId;

    @Column(name = "upload_batch_id", nullable = false)
    private Long uploadBatchId;

    @Column(name = "raw_json", nullable = false, columnDefinition = "TEXT")
    private String rawJson;

    @Column(name = "validation_status", nullable = false, length = 50)
    private String validationStatus;

    @Column(name = "validation_errors", columnDefinition = "TEXT")
    private String validationErrors;

    /**
     * Distinguishes the kind of data in raw_json:
     * "BILLING"          — a billing record row (has fromDate, importUnits, exportUnits, unitCost)
     * "CUSTOMER_PROFILE" — a customer-profile-only row (no billing fields)
     */
    @Column(name = "row_type", nullable = false, length = 30)
    private String rowType = "BILLING";

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public BillingUploadStaging() {
    }

    public BillingUploadStaging(Long uploadBatchId, String rawJson, String validationStatus, String validationErrors) {
        this.uploadBatchId = uploadBatchId;
        this.rawJson = rawJson;
        this.validationStatus = validationStatus;
        this.validationErrors = validationErrors;
        this.rowType = "BILLING";
    }

    public BillingUploadStaging(Long uploadBatchId, String rawJson, String validationStatus,
                                String validationErrors, String rowType) {
        this.uploadBatchId = uploadBatchId;
        this.rawJson = rawJson;
        this.validationStatus = validationStatus;
        this.validationErrors = validationErrors;
        this.rowType = rowType != null ? rowType : "BILLING";
    }

    // Getters and Setters
    public Long getStagingId() {
        return stagingId;
    }

    public void setStagingId(Long stagingId) {
        this.stagingId = stagingId;
    }

    public Long getUploadBatchId() {
        return uploadBatchId;
    }

    public void setUploadBatchId(Long uploadBatchId) {
        this.uploadBatchId = uploadBatchId;
    }

    public String getRawJson() {
        return rawJson;
    }

    public void setRawJson(String rawJson) {
        this.rawJson = rawJson;
    }

    public String getValidationStatus() {
        return validationStatus;
    }

    public void setValidationStatus(String validationStatus) {
        this.validationStatus = validationStatus;
    }

    public String getValidationErrors() {
        return validationErrors;
    }

    public void setValidationErrors(String validationErrors) {
        this.validationErrors = validationErrors;
    }

    public String getRowType() {
        return rowType;
    }

    public void setRowType(String rowType) {
        this.rowType = rowType;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
