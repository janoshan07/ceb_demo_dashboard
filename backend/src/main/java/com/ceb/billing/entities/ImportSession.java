package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "import_sessions", indexes = {
    @Index(name = "idx_session_created_by", columnList = "created_by"),
    @Index(name = "idx_session_stage", columnList = "stage")
})
public class ImportSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique session identifier — username + timestamp */
    @Column(name = "session_key", unique = true, length = 200)
    private String sessionKey;

    /**
     * Current stage of the import workflow.
     * Values: PENDING_MASTER | MASTER_APPROVED | CEB_APPROVED | COMPLETED
     */
    @Column(name = "stage", length = 50, nullable = false)
    private String stage = "PENDING_MASTER";

    /** FK to the ImportBatch for Master Data (Step 1) */
    @Column(name = "master_batch_id")
    private Long masterBatchId;

    /** FK to the ImportBatch for CEB Assist (Step 2) */
    @Column(name = "ceb_assist_batch_id")
    private Long cebAssistBatchId;

    /** FK to the ImportBatch for NGEN (Step 3) */
    @Column(name = "ngen_batch_id")
    private Long ngenBatchId;

    /** Number of customers imported from Master Data */
    @Column(name = "master_customer_count")
    private Integer masterCustomerCount = 0;

    /** Number of accounts updated from CEB Assist */
    @Column(name = "ceb_assist_count")
    private Integer cebAssistCount = 0;

    /** Number of billing records created/updated from NGEN */
    @Column(name = "ngen_count")
    private Integer ngenCount = 0;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public ImportSession() {}

    public ImportSession(String sessionKey, String createdBy, Long masterBatchId) {
        this.sessionKey = sessionKey;
        this.createdBy = createdBy;
        this.masterBatchId = masterBatchId;
        this.stage = "PENDING_MASTER";
    }

    // ── Getters & Setters ───────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSessionKey() { return sessionKey; }
    public void setSessionKey(String sessionKey) { this.sessionKey = sessionKey; }

    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }

    public Long getMasterBatchId() { return masterBatchId; }
    public void setMasterBatchId(Long masterBatchId) { this.masterBatchId = masterBatchId; }

    public Long getCebAssistBatchId() { return cebAssistBatchId; }
    public void setCebAssistBatchId(Long cebAssistBatchId) { this.cebAssistBatchId = cebAssistBatchId; }

    public Long getNgenBatchId() { return ngenBatchId; }
    public void setNgenBatchId(Long ngenBatchId) { this.ngenBatchId = ngenBatchId; }

    public Integer getMasterCustomerCount() { return masterCustomerCount; }
    public void setMasterCustomerCount(Integer masterCustomerCount) { this.masterCustomerCount = masterCustomerCount; }

    public Integer getCebAssistCount() { return cebAssistCount; }
    public void setCebAssistCount(Integer cebAssistCount) { this.cebAssistCount = cebAssistCount; }

    public Integer getNgenCount() { return ngenCount; }
    public void setNgenCount(Integer ngenCount) { this.ngenCount = ngenCount; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
