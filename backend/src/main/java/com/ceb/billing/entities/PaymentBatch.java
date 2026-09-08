package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "payment_batches")
public class PaymentBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_number", nullable = false, unique = true, length = 100)
    private String batchNumber;

    @Column(name = "billing_period", length = 100)
    private String billingPeriod;

    @Column(name = "division", length = 100)
    private String division;

    @Column(name = "created_date", nullable = false)
    private LocalDateTime createdDate;

    @Column(name = "created_by", nullable = false, length = 100)
    private String createdBy;

    @Column(name = "customer_count", nullable = false)
    private Integer customerCount = 0;

    @Column(name = "total_payable_amount", nullable = false)
    private Double totalPayableAmount = 0.0;

    @Column(name = "approved_amount")
    private Double approvedAmount = 0.0;

    @Column(name = "on_hold_customer_count")
    private Integer onHoldCustomerCount = 0;

    @Column(name = "on_hold_amount")
    private Double onHoldAmount = 0.0;

    /**
     * Workflow status:
     * READY -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> PAYMENT_PROCESSED -> PAID
     * Or if rejected: UNDER_REVIEW -> REJECTED -> CORRECTION -> RE_VALIDATE -> READY
     */
    @Column(name = "status", nullable = false, length = 50)
    private String status = "READY";

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "approved_by", length = 100)
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "processed_by", length = 100)
    private String processedBy;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PaymentBatchItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (this.createdDate == null) {
            this.createdDate = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = "READY";
        }
    }

    public PaymentBatch() {
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBatchNumber() {
        return batchNumber;
    }

    public void setBatchNumber(String batchNumber) {
        this.batchNumber = batchNumber;
    }

    public String getBillingPeriod() {
        return billingPeriod;
    }

    public void setBillingPeriod(String billingPeriod) {
        this.billingPeriod = billingPeriod;
    }

    public String getDivision() {
        return division;
    }

    public void setDivision(String division) {
        this.division = division;
    }

    public LocalDateTime getCreatedDate() {
        return createdDate;
    }

    public void setCreatedDate(LocalDateTime createdDate) {
        this.createdDate = createdDate;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public Integer getCustomerCount() {
        return customerCount;
    }

    public void setCustomerCount(Integer customerCount) {
        this.customerCount = customerCount;
    }

    public Double getTotalPayableAmount() {
        return totalPayableAmount;
    }

    public void setTotalPayableAmount(Double totalPayableAmount) {
        this.totalPayableAmount = totalPayableAmount;
    }

    public Double getApprovedAmount() {
        return approvedAmount;
    }

    public void setApprovedAmount(Double approvedAmount) {
        this.approvedAmount = approvedAmount;
    }

    public Integer getOnHoldCustomerCount() {
        return onHoldCustomerCount;
    }

    public void setOnHoldCustomerCount(Integer onHoldCustomerCount) {
        this.onHoldCustomerCount = onHoldCustomerCount;
    }

    public Double getOnHoldAmount() {
        return onHoldAmount;
    }

    public void setOnHoldAmount(Double onHoldAmount) {
        this.onHoldAmount = onHoldAmount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
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

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getProcessedBy() {
        return processedBy;
    }

    public void setProcessedBy(String processedBy) {
        this.processedBy = processedBy;
    }

    public LocalDateTime getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(LocalDateTime processedAt) {
        this.processedAt = processedAt;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<PaymentBatchItem> getItems() {
        return items;
    }

    public void setItems(List<PaymentBatchItem> items) {
        this.items = items;
    }

    public void addItem(PaymentBatchItem item) {
        items.add(item);
        item.setBatch(this);
    }
}
