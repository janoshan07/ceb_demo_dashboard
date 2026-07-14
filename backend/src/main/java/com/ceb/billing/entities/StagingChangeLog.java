package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "staging_change_logs")
public class StagingChangeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "upload_batch_id", nullable = false)
    private Long uploadBatchId;

    @Column(name = "staging_id")
    private Long stagingId;

    @Column(name = "row_type", length = 30)
    private String rowType; // "BILLING" or "CUSTOMER_PROFILE"

    @Column(name = "action_type", nullable = false, length = 30)
    private String actionType; // "EDIT", "DELETE", "ADD"

    @Column(name = "original_data", columnDefinition = "TEXT")
    private String originalData; // json representation

    @Column(name = "modified_data", columnDefinition = "TEXT")
    private String modifiedData; // json representation

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING"; // "PENDING", "APPROVED", "REJECTED"

    @Column(name = "performed_by", nullable = false, length = 100)
    private String performedBy;

    @Column(name = "performed_at", nullable = false)
    private LocalDateTime performedAt;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @PrePersist
    protected void onCreate() {
        this.performedAt = LocalDateTime.now();
    }

    public StagingChangeLog() {
    }

    public StagingChangeLog(Long uploadBatchId, Long stagingId, String rowType, String actionType,
                            String originalData, String modifiedData, String performedBy) {
        this.uploadBatchId = uploadBatchId;
        this.stagingId = stagingId;
        this.rowType = rowType;
        this.actionType = actionType;
        this.originalData = originalData;
        this.modifiedData = modifiedData;
        this.performedBy = performedBy;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUploadBatchId() {
        return uploadBatchId;
    }

    public void setUploadBatchId(Long uploadBatchId) {
        this.uploadBatchId = uploadBatchId;
    }

    public Long getStagingId() {
        return stagingId;
    }

    public void setStagingId(Long stagingId) {
        this.stagingId = stagingId;
    }

    public String getRowType() {
        return rowType;
    }

    public void setRowType(String rowType) {
        this.rowType = rowType;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getOriginalData() {
        return originalData;
    }

    public void setOriginalData(String originalData) {
        this.originalData = originalData;
    }

    public String getModifiedData() {
        return modifiedData;
    }

    public void setModifiedData(String modifiedData) {
        this.modifiedData = modifiedData;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPerformedBy() {
        return performedBy;
    }

    public void setPerformedBy(String performedBy) {
        this.performedBy = performedBy;
    }

    public LocalDateTime getPerformedAt() {
        return performedAt;
    }

    public void setPerformedAt(LocalDateTime performedAt) {
        this.performedAt = performedAt;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }
}
