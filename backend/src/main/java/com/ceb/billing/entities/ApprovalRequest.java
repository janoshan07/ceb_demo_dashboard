package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import jakarta.persistence.Version;

@Entity
@Table(name = "approval_requests")
public class ApprovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "request_id")
    private Long requestId;

    @Column(name = "billing_id")
    private Long billingId;

    @Column(name = "account_no", length = 50)
    private String accountNo;

    @Column(name = "changed_by", nullable = false, length = 100)
    private String changedBy;

    @Column(name = "old_values", nullable = false, columnDefinition = "TEXT")
    private String oldValues;

    @Column(name = "new_values", nullable = false, columnDefinition = "TEXT")
    private String newValues;

    @Column(nullable = false, length = 50)
    private String status; // PENDING, APPROVED, REJECTED

    @Column(name = "action_type", length = 50)
    private String actionType = "UPDATE"; // CREATE, UPDATE, DELETE

    @Column(name = "entity_type", length = 50)
    private String entityType; // CUSTOMER, BILLING

    @Column(name = "division", length = 50)
    private String division;

    @Column(name = "billing_month", length = 20)
    private String billingMonth;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private long version;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public ApprovalRequest() {
    }

    public ApprovalRequest(Long billingId, String accountNo, String changedBy, String oldValues, String newValues, String status) {
        this.billingId = billingId;
        this.accountNo = accountNo;
        this.changedBy = changedBy;
        this.oldValues = oldValues;
        this.newValues = newValues;
        this.status = status;
        this.actionType = "UPDATE";
        this.entityType = (billingId == null) ? "CUSTOMER" : "BILLING";
    }

    public ApprovalRequest(Long billingId, String accountNo, String changedBy, String oldValues, String newValues, String status, String actionType, String entityType) {
        this.billingId = billingId;
        this.accountNo = accountNo;
        this.changedBy = changedBy;
        this.oldValues = oldValues;
        this.newValues = newValues;
        this.status = status;
        this.actionType = actionType;
        this.entityType = entityType;
    }

    // Getters and Setters
    public Long getRequestId() {
        return requestId;
    }

    public void setRequestId(Long requestId) {
        this.requestId = requestId;
    }

    public Long getBillingId() {
        return billingId;
    }

    public void setBillingId(Long billingId) {
        this.billingId = billingId;
    }

    public String getAccountNo() {
        return accountNo;
    }

    public void setAccountNo(String accountNo) {
        this.accountNo = accountNo;
    }

    public String getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(String changedBy) {
        this.changedBy = changedBy;
    }

    public String getOldValues() {
        return oldValues;
    }

    public void setOldValues(String oldValues) {
        this.oldValues = oldValues;
    }

    public String getNewValues() {
        return newValues;
    }

    public void setNewValues(String newValues) {
        this.newValues = newValues;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public String getDivision() { return division; }
    public void setDivision(String division) { this.division = division; }
    public String getBillingMonth() { return billingMonth; }
    public void setBillingMonth(String billingMonth) { this.billingMonth = billingMonth; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
}
