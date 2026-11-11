package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_logs_performed_action_timestamp", columnList = "performed_by, action, timestamp"),
        @Index(name = "idx_audit_logs_timestamp", columnList = "timestamp"),
        @Index(name = "idx_audit_logs_id", columnList = "id")
})
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String action;

    @Column(name = "performed_by", nullable = false)
    private String performedBy;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(columnDefinition = "TEXT")
    private String details;

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }

    public AuditLog() {
    }

    public AuditLog(String action, String performedBy, String details) {
        this.action = action;
        this.performedBy = performedBy;
        this.details = details;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getPerformedBy() {
        return performedBy;
    }

    public void setPerformedBy(String performedBy) {
        this.performedBy = performedBy;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
