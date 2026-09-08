package com.ceb.billing.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_batch_items")
public class PaymentBatchItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    @JsonIgnore
    private PaymentBatch batch;

    @Column(name = "account_no", nullable = false, length = 50)
    private String accountNo;

    @Column(name = "customer_name", length = 255)
    private String customerName;

    @Column(name = "solar_type", length = 50)
    private String solarType;

    @Column(name = "current_payment")
    private Double currentPayment = 0.0;

    @Column(name = "bill_set_off")
    private Double billSetOff = 0.0;

    @Column(name = "retention_money")
    private Double retentionMoney = 0.0;

    @Column(name = "outstanding_balance")
    private Double outstandingBalance = 0.0;

    @Column(name = "total_payable", nullable = false)
    private Double totalPayable = 0.0;

    @Column(name = "bank_code", length = 50)
    private String bankCode;

    @Column(name = "branch_code", length = 50)
    private String branchCode;

    @Column(name = "bank_account_no", length = 50)
    private String bankAccountNo;

    @Column(name = "payment_status", length = 50)
    private String paymentStatus = "READY"; // READY, APPROVED, PROCESSED, PAID, REJECTED, ON_HOLD

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.paymentStatus == null) {
            this.paymentStatus = "READY";
        }
    }

    public PaymentBatchItem() {
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public PaymentBatch getBatch() {
        return batch;
    }

    public void setBatch(PaymentBatch batch) {
        this.batch = batch;
    }

    public String getAccountNo() {
        return accountNo;
    }

    public void setAccountNo(String accountNo) {
        this.accountNo = accountNo;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getSolarType() {
        return solarType;
    }

    public void setSolarType(String solarType) {
        this.solarType = solarType;
    }

    public Double getCurrentPayment() {
        return currentPayment;
    }

    public void setCurrentPayment(Double currentPayment) {
        this.currentPayment = currentPayment;
    }

    public Double getBillSetOff() {
        return billSetOff;
    }

    public void setBillSetOff(Double billSetOff) {
        this.billSetOff = billSetOff;
    }

    public Double getRetentionMoney() {
        return retentionMoney;
    }

    public void setRetentionMoney(Double retentionMoney) {
        this.retentionMoney = retentionMoney;
    }

    public Double getOutstandingBalance() {
        return outstandingBalance;
    }

    public void setOutstandingBalance(Double outstandingBalance) {
        this.outstandingBalance = outstandingBalance;
    }

    public Double getTotalPayable() {
        return totalPayable;
    }

    public void setTotalPayable(Double totalPayable) {
        this.totalPayable = totalPayable;
    }

    public String getBankCode() {
        return bankCode;
    }

    public void setBankCode(String bankCode) {
        this.bankCode = bankCode;
    }

    public String getBranchCode() {
        return branchCode;
    }

    public void setBranchCode(String branchCode) {
        this.branchCode = branchCode;
    }

    public String getBankAccountNo() {
        return bankAccountNo;
    }

    public void setBankAccountNo(String bankAccountNo) {
        this.bankAccountNo = bankAccountNo;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
