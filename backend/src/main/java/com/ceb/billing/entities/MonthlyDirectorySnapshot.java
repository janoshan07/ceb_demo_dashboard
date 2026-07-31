package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * A permanent, per-month archive of a fully approved final Customer Directory dataset.
 *
 * One row is created each time a Step 6 (Master Data Comparison) import is approved. Each approved
 * month is stored separately and is never overwritten — snapshots are kept permanently until an
 * operator deletes them manually.
 *
 * This entity is purely an archive/save target for the post-Step-6 workflow. It does not
 * participate in any validation, merge, comparison, duplicate handling or approval logic.
 */
@Entity
@Table(name = "monthly_directory_snapshot")
public class MonthlyDirectorySnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** User-editable display name for the archived dataset (e.g. "July 2026 Billing"). */
    @Column(name = "dataset_name", nullable = false, length = 255)
    private String datasetName;

    /** Billing month label the snapshot belongs to (e.g. "July 2026"). */
    @Column(name = "billing_month", length = 60)
    private String billingMonth;

    /** Eastern Province division the snapshot belongs to (e.g. "Ampara"). */
    @Column(name = "division", length = 60)
    private String division;

    /** When the Step 6 dataset was approved / archived. */
    @Column(name = "approval_date")
    private LocalDateTime approvalDate;

    /** Username of the operator who approved the import. */
    @Column(name = "approved_by", length = 150)
    private String approvedBy;

    /** Number of customer/billing records stored in the snapshot. */
    @Column(name = "total_records")
    private Integer totalRecords = 0;

    /** JSON blob capturing the validation summary counts shown at approval time. */
    @Lob
    @Column(name = "validation_summary", columnDefinition = "LONGTEXT")
    private String validationSummary;

    /** JSON array with the full, final Customer Directory data for this month. */
    @Lob
    @Column(name = "final_data_json", columnDefinition = "LONGTEXT")
    private String finalDataJson;

    /**
     * JSON array holding the complete audit history of post-Step-6 edits and approvals made to
     * individual records in this snapshot (newest first). Purely additive record-keeping.
     */
    @Lob
    @Column(name = "audit_log_json", columnDefinition = "LONGTEXT")
    private String auditLogJson;

    /** When the snapshot row itself was created. */
    @Column(name = "created_date")
    private LocalDateTime createdDate;

    /** Snapshot status (e.g. APPROVED / PENDING_APPROVAL). */
    @Column(name = "status", length = 50)
    private String status;

    /** Source import session id (informational). */
    @Column(name = "session_id")
    private Long sessionId;

    @PrePersist
    protected void onCreate() {
        this.createdDate = LocalDateTime.now();
        if (this.approvalDate == null) {
            this.approvalDate = this.createdDate;
        }
    }

    public MonthlyDirectorySnapshot() {
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDatasetName() { return datasetName; }
    public void setDatasetName(String datasetName) { this.datasetName = datasetName; }

    public String getBillingMonth() { return billingMonth; }
    public void setBillingMonth(String billingMonth) { this.billingMonth = billingMonth; }

    public String getDivision() { return division; }
    public void setDivision(String division) { this.division = division; }

    public LocalDateTime getApprovalDate() { return approvalDate; }
    public void setApprovalDate(LocalDateTime approvalDate) { this.approvalDate = approvalDate; }

    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }

    public Integer getTotalRecords() { return totalRecords; }
    public void setTotalRecords(Integer totalRecords) { this.totalRecords = totalRecords; }

    public String getValidationSummary() { return validationSummary; }
    public void setValidationSummary(String validationSummary) { this.validationSummary = validationSummary; }

    public String getFinalDataJson() { return finalDataJson; }
    public void setFinalDataJson(String finalDataJson) { this.finalDataJson = finalDataJson; }

    public String getAuditLogJson() { return auditLogJson; }
    public void setAuditLogJson(String auditLogJson) { this.auditLogJson = auditLogJson; }

    public LocalDateTime getCreatedDate() { return createdDate; }
    public void setCreatedDate(LocalDateTime createdDate) { this.createdDate = createdDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
}
