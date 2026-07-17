package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "billing_records", indexes = {
    @Index(name = "idx_billing_from_date", columnList = "from_date"),
    @Index(name = "idx_billing_account_no", columnList = "account_no"),
    @Index(name = "idx_billing_upload_history", columnList = "upload_history_id")
})
public class BillingRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "billing_id")
    private Long billingId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "account_no", referencedColumnName = "account_no", nullable = false)
    private Customer customer;

    @Column(name = "ref_no", nullable = false, length = 100)
    private String refNo;

    @Column(name = "from_date", nullable = false)
    private LocalDate fromDate;

    @Column(name = "to_date", nullable = false)
    private LocalDate toDate;

    @Column(name = "import_units", nullable = false)
    private Double importUnits;

    @Column(name = "export_units", nullable = false)
    private Double exportUnits;

    @Column(name = "net_unit", nullable = false)
    private Double netUnit;

    @Column(name = "unit_cost", nullable = false)
    private Double unitCost;

    @Column(name = "total_amount", nullable = false)
    private Double totalAmount;

    @Column(name = "billing_mode", length = 50)
    private String billingMode; // Fixed, Variable

    @Column(name = "bill_cycle")
    private Integer billCycle;

    @Column(name = "bill_set_off")
    private Double billSetOff;

    @Column(name = "retention_money")
    private Double retentionMoney;

    @Column(name = "payment")
    private Double payment;

    @Column(name = "energy_purchase")
    private Double energyPurchase;

    // ── CEB Assist fields (Step 2) ────────────────────────────
    @Column(name = "prev_reading_date")
    private LocalDate prevReadingDate;

    @Column(name = "curr_reading_date")
    private LocalDate currReadingDate;

    // ── NGEN fields (Step 3) ──────────────────────────────────
    @Column(name = "kwh_import")
    private Double kwhImport;

    @Column(name = "kwh_export")
    private Double kwhExport;

    @Column(name = "kwh_sales")
    private Double kwhSales;  // kWh Export − kWh Import

    @Column(name = "payment_settled")
    private Double paymentSettled;  // kWh Sales × Unit Rate

    @Column(name = "upload_history_id")
    private Long uploadHistoryId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        calculateFields();
    }

    @PreUpdate
    protected void onUpdate() {
        calculateFields();
    }

    public void calculateFields() {
        this.netUnit = (this.exportUnits != null ? this.exportUnits : 0.0) - (this.importUnits != null ? this.importUnits : 0.0);
        this.totalAmount = this.netUnit * (this.unitCost != null ? this.unitCost : 0.0);
    }

    public BillingRecord() {
    }

    public BillingRecord(Customer customer, String refNo, LocalDate fromDate, LocalDate toDate, Double importUnits, Double exportUnits, Double unitCost, String billingMode, Long uploadHistoryId) {
        this.customer = customer;
        this.refNo = refNo;
        this.fromDate = fromDate;
        this.toDate = toDate;
        this.importUnits = importUnits;
        this.exportUnits = exportUnits;
        this.unitCost = unitCost;
        this.billingMode = billingMode;
        this.uploadHistoryId = uploadHistoryId;
        calculateFields();
    }

    // Getters and Setters
    public Long getBillingId() {
        return billingId;
    }

    public void setBillingId(Long billingId) {
        this.billingId = billingId;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public String getRefNo() {
        return refNo;
    }

    public void setRefNo(String refNo) {
        this.refNo = refNo;
    }

    public LocalDate getFromDate() {
        return fromDate;
    }

    public void setFromDate(LocalDate fromDate) {
        this.fromDate = fromDate;
    }

    public LocalDate getToDate() {
        return toDate;
    }

    public void setToDate(LocalDate toDate) {
        this.toDate = toDate;
    }

    public Double getImportUnits() {
        return importUnits;
    }

    public void setImportUnits(Double importUnits) {
        this.importUnits = importUnits;
        calculateFields();
    }

    public Double getExportUnits() {
        return exportUnits;
    }

    public void setExportUnits(Double exportUnits) {
        this.exportUnits = exportUnits;
        calculateFields();
    }

    public Double getNetUnit() {
        return netUnit;
    }

    public void setNetUnit(Double netUnit) {
        this.netUnit = netUnit;
    }

    public Double getUnitCost() {
        return unitCost;
    }

    public void setUnitCost(Double unitCost) {
        this.unitCost = unitCost;
        calculateFields();
    }

    public Double getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(Double totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getBillingMode() {
        return billingMode;
    }

    public void setBillingMode(String billingMode) {
        this.billingMode = billingMode;
    }

    public Long getUploadHistoryId() {
        return uploadHistoryId;
    }

    public void setUploadHistoryId(Long uploadHistoryId) {
        this.uploadHistoryId = uploadHistoryId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Integer getBillCycle() {
        return billCycle;
    }

    public void setBillCycle(Integer billCycle) {
        this.billCycle = billCycle;
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

    public Double getPayment() {
        return payment;
    }

    public void setPayment(Double payment) {
        this.payment = payment;
    }

    public LocalDate getPrevReadingDate() { return prevReadingDate; }
    public void setPrevReadingDate(LocalDate prevReadingDate) { this.prevReadingDate = prevReadingDate; }

    public LocalDate getCurrReadingDate() { return currReadingDate; }
    public void setCurrReadingDate(LocalDate currReadingDate) { this.currReadingDate = currReadingDate; }

    public Double getKwhImport() { return kwhImport; }
    public void setKwhImport(Double kwhImport) { this.kwhImport = kwhImport; }

    public Double getKwhExport() { return kwhExport; }
    public void setKwhExport(Double kwhExport) { this.kwhExport = kwhExport; }

    public Double getKwhSales() { return kwhSales; }
    public void setKwhSales(Double kwhSales) { this.kwhSales = kwhSales; }

    public Double getPaymentSettled() { return paymentSettled; }
    public void setPaymentSettled(Double paymentSettled) { this.paymentSettled = paymentSettled; }

    public Double getEnergyPurchase() { return energyPurchase; }
    public void setEnergyPurchase(Double energyPurchase) { this.energyPurchase = energyPurchase; }
}
