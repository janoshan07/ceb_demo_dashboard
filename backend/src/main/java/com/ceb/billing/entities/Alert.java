package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerts", indexes = {
    @Index(name = "idx_alert_account_no", columnList = "account_no"),
    @Index(name = "idx_alert_status", columnList = "status"),
    @Index(name = "idx_alert_severity", columnList = "severity")
})
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alert_id")
    private Long alertId;

    @Column(name = "account_no", length = 50, nullable = false)
    private String accountNo;

    @Column(name = "alert_type", length = 50, nullable = false)
    private String alertType; // EXPORT_DROP, IMPORT_SPIKE, DUPLICATE_BILL, MISSING_BILL, IMPOSSIBLE_VALUE

    @Column(name = "severity", length = 50, nullable = false)
    private String severity; // CRITICAL, WARNING, INFO

    @Column(name = "message", columnDefinition = "TEXT", nullable = false)
    private String message;

    @Column(name = "status", length = 50, nullable = false)
    private String status; // UNREAD, RESOLVED

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = "UNREAD";
        }
    }

    public Alert() {
    }

    public Alert(String accountNo, String alertType, String severity, String message, String status) {
        this.accountNo = accountNo;
        this.alertType = alertType;
        this.severity = severity;
        this.message = message;
        this.status = status;
    }

    // Getters and Setters
    public Long getAlertId() {
        return alertId;
    }

    public void setAlertId(Long alertId) {
        this.alertId = alertId;
    }

    public String getAccountNo() {
        return accountNo;
    }

    public void setAccountNo(String accountNo) {
        this.accountNo = accountNo;
    }

    public String getAlertType() {
        return alertType;
    }

    public void setAlertType(String alertType) {
        this.alertType = alertType;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
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
}
