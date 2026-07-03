package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "import_audit_logs")
public class ImportAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "upload_history_id", nullable = false)
    private Long uploadHistoryId;

    @Column(nullable = false)
    private String filename;

    @Column(name = "performed_by", nullable = false)
    private String performedBy;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(name = "original_errors", columnDefinition = "LONGTEXT")
    private String originalErrors; // JSON string

    @Column(name = "corrections_made", columnDefinition = "LONGTEXT")
    private String correctionsMade; // JSON string

    @Column(name = "duplicates_accepted", columnDefinition = "LONGTEXT")
    private String duplicatesAccepted; // JSON string

    @Column(name = "duplicates_ignored", columnDefinition = "LONGTEXT")
    private String duplicatesIgnored; // JSON string

    public ImportAuditLog() {
    }

    public ImportAuditLog(Long uploadHistoryId, String filename, String performedBy, LocalDateTime timestamp, String originalErrors, String correctionsMade, String duplicatesAccepted, String duplicatesIgnored) {
        this.uploadHistoryId = uploadHistoryId;
        this.filename = filename;
        this.performedBy = performedBy;
        this.timestamp = timestamp;
        this.originalErrors = originalErrors;
        this.correctionsMade = correctionsMade;
        this.duplicatesAccepted = duplicatesAccepted;
        this.duplicatesIgnored = duplicatesIgnored;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUploadHistoryId() {
        return uploadHistoryId;
    }

    public void setUploadHistoryId(Long uploadHistoryId) {
        this.uploadHistoryId = uploadHistoryId;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
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

    public String getOriginalErrors() {
        return originalErrors;
    }

    public void setOriginalErrors(String originalErrors) {
        this.originalErrors = originalErrors;
    }

    public String getCorrectionsMade() {
        return correctionsMade;
    }

    public void setCorrectionsMade(String correctionsMade) {
        this.correctionsMade = correctionsMade;
    }

    public String getDuplicatesAccepted() {
        return duplicatesAccepted;
    }

    public void setDuplicatesAccepted(String duplicatesAccepted) {
        this.duplicatesAccepted = duplicatesAccepted;
    }

    public String getDuplicatesIgnored() {
        return duplicatesIgnored;
    }

    public void setDuplicatesIgnored(String duplicatesIgnored) {
        this.duplicatesIgnored = duplicatesIgnored;
    }
}
