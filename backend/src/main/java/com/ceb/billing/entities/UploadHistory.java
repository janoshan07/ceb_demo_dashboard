package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "upload_history")
public class UploadHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String filename;

    @Column(name = "uploaded_by", nullable = false)
    private String uploadedBy;

    @Column(name = "upload_time")
    private LocalDateTime uploadTime;

    @Column(nullable = false, length = 50)
    private String status; // SUCCESS, COMPLETED_WITH_ERRORS, FAILED

    @Column(name = "rows_processed")
    private Integer rowsProcessed = 0;

    @Column(name = "new_customers")
    private Integer newCustomers = 0;

    @Column(name = "billing_inserted")
    private Integer billingInserted = 0;

    @Column(name = "errors_count")
    private Integer errorsCount = 0;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @PrePersist
    protected void onCreate() {
        this.uploadTime = LocalDateTime.now();
    }

    public UploadHistory() {
    }

    public UploadHistory(String filename, String uploadedBy, String status, Integer rowsProcessed, Integer newCustomers, Integer billingInserted, Integer errorsCount) {
        this.filename = filename;
        this.uploadedBy = uploadedBy;
        this.status = status;
        this.rowsProcessed = rowsProcessed;
        this.newCustomers = newCustomers;
        this.billingInserted = billingInserted;
        this.errorsCount = errorsCount;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(String uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public LocalDateTime getUploadTime() {
        return uploadTime;
    }

    public void setUploadTime(LocalDateTime uploadTime) {
        this.uploadTime = uploadTime;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getRowsProcessed() {
        return rowsProcessed;
    }

    public void setRowsProcessed(Integer rowsProcessed) {
        this.rowsProcessed = rowsProcessed;
    }

    public Integer getNewCustomers() {
        return newCustomers;
    }

    public void setNewCustomers(Integer newCustomers) {
        this.newCustomers = newCustomers;
    }

    public Integer getBillingInserted() {
        return billingInserted;
    }

    public void setBillingInserted(Integer billingInserted) {
        this.billingInserted = billingInserted;
    }

    public Integer getErrorsCount() {
        return errorsCount;
    }

    public void setErrorsCount(Integer errorsCount) {
        this.errorsCount = errorsCount;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }
}
