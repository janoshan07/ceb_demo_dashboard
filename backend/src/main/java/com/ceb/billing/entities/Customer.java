package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "customers", indexes = {
    @Index(name = "idx_customer_branch_code", columnList = "branch_code"),
    @Index(name = "idx_customer_solar_type", columnList = "solar_type")
})
public class Customer {

    @Id
    @Column(name = "account_no", length = 50)
    private String accountNo;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "customer_address", length = 255)
    private String customerAddress;

    @Column(name = "mobile_no", length = 50)
    private String mobileNo;

    @Column(name = "agreement_date")
    private LocalDate agreementDate;

    @Column(name = "panel_capacity")
    private Double panelCapacity;

    @Column(name = "bank_code", length = 50)
    private String bankCode;

    @Column(name = "branch_code", length = 50)
    private String branchCode;

    @Column(name = "bank_account_no", length = 50)
    private String bankAccountNo;

    @Column(name = "solar_type", length = 50)
    private String solarType; // Net Plus, Net Plus Plus, Net Metering, Net Accounting

    @Column(name = "created_by_upload_id")
    private Long createdByUploadId;

    @Column(name = "ref_no", length = 100)
    private String refNo;

    @Column(name = "unit_rate")
    private Double unitRate;

    @Column(name = "tariff_type", length = 100)
    private String tariffType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cost_code_id")
    private CostCode costCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "net_type_id")
    private NetType netType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expense_code_id")
    private ExpenseCode expenseCode;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        autoDeriveBranch();
    }

    @PreUpdate
    protected void onUpdate() {
        autoDeriveBranch();
    }

    private void autoDeriveBranch() {
        String detected = com.ceb.billing.utils.BranchDetector.detectBranch(this.accountNo);
        if (detected != null) {
            this.branchCode = detected;
        }
    }

    public Customer() {
    }

    public Customer(String accountNo, String customerName, String bankCode, String branchCode, String bankAccountNo) {
        this.accountNo = accountNo;
        this.customerName = customerName;
        this.bankCode = bankCode;
        this.branchCode = branchCode;
        this.bankAccountNo = bankAccountNo;
    }

    public Customer(String accountNo, String customerName, String customerAddress, String mobileNo, LocalDate agreementDate, Double panelCapacity, String bankCode, String branchCode, String bankAccountNo, String solarType) {
        this.accountNo = accountNo;
        this.customerName = customerName;
        this.customerAddress = customerAddress;
        this.mobileNo = mobileNo;
        this.agreementDate = agreementDate;
        this.panelCapacity = panelCapacity;
        this.bankCode = bankCode;
        this.branchCode = branchCode;
        this.bankAccountNo = bankAccountNo;
        this.solarType = solarType;
    }

    // Getters and Setters
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

    public String getCustomerAddress() {
        return customerAddress;
    }

    public void setCustomerAddress(String customerAddress) {
        this.customerAddress = customerAddress;
    }

    public String getMobileNo() {
        return mobileNo;
    }

    public void setMobileNo(String mobileNo) {
        this.mobileNo = mobileNo;
    }

    public LocalDate getAgreementDate() {
        return agreementDate;
    }

    public void setAgreementDate(LocalDate agreementDate) {
        this.agreementDate = agreementDate;
    }

    public Double getPanelCapacity() {
        return panelCapacity;
    }

    public void setPanelCapacity(Double panelCapacity) {
        this.panelCapacity = panelCapacity;
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

    public String getSolarType() {
        return solarType;
    }

    public void setSolarType(String solarType) {
        this.solarType = solarType;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Long getCreatedByUploadId() {
        return createdByUploadId;
    }

    public void setCreatedByUploadId(Long createdByUploadId) {
        this.createdByUploadId = createdByUploadId;
    }

    public String getRefNo() {
        return refNo;
    }

    public void setRefNo(String refNo) {
        this.refNo = refNo;
    }

    public Double getUnitRate() {
        return unitRate;
    }

    public void setUnitRate(Double unitRate) {
        this.unitRate = unitRate;
    }

    public String getTariffType() {
        return tariffType;
    }

    public void setTariffType(String tariffType) {
        this.tariffType = tariffType;
    }

    public CostCode getCostCode() {
        return costCode;
    }

    public void setCostCode(CostCode costCode) {
        this.costCode = costCode;
    }

    public NetType getNetType() {
        return netType;
    }

    public void setNetType(NetType netType) {
        this.netType = netType;
    }

    public ExpenseCode getExpenseCode() {
        return expenseCode;
    }

    public void setExpenseCode(ExpenseCode expenseCode) {
        this.expenseCode = expenseCode;
    }
}
