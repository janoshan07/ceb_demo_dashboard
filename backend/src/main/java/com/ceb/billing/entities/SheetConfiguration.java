package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sheet_configurations")
public class SheetConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "template_id", nullable = false)
    private ExcelTemplate template;

    @Column(name = "sheet_name", nullable = false, length = 100)
    private String sheetName;

    @Column(name = "is_required", nullable = false)
    private Boolean isRequired = true;

    @Column(name = "is_ignored", nullable = false)
    private Boolean isIgnored = false;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "restored_at")
    private LocalDateTime restoredAt;

    @PrePersist
    protected void onCreate() {
        if (this.isRequired == null) this.isRequired = true;
        if (this.isIgnored == null) this.isIgnored = false;
        if (this.isDeleted == null) this.isDeleted = false;
    }

    public SheetConfiguration() {
    }

    public SheetConfiguration(ExcelTemplate template, String sheetName, Boolean isRequired, Boolean isIgnored) {
        this.template = template;
        this.sheetName = sheetName;
        this.isRequired = isRequired;
        this.isIgnored = isIgnored;
        this.isDeleted = false;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ExcelTemplate getTemplate() {
        return template;
    }

    public void setTemplate(ExcelTemplate template) {
        this.template = template;
    }

    public String getSheetName() {
        return sheetName;
    }

    public void setSheetName(String sheetName) {
        this.sheetName = sheetName;
    }

    public Boolean getIsRequired() {
        return isRequired;
    }

    public void setIsRequired(Boolean isRequired) {
        this.isRequired = isRequired;
    }

    public Boolean getIsIgnored() {
        return isIgnored;
    }

    public void setIsIgnored(Boolean isIgnored) {
        this.isIgnored = isIgnored;
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }

    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(LocalDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }

    public LocalDateTime getRestoredAt() {
        return restoredAt;
    }

    public void setRestoredAt(LocalDateTime restoredAt) {
        this.restoredAt = restoredAt;
    }
}
