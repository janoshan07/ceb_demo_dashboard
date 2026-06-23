package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "header_mappings")
public class HeaderMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sheet_config_id", nullable = false)
    private SheetConfiguration sheetConfiguration;

    @Column(name = "header_name", nullable = false, length = 100)
    private String headerName;

    @Column(name = "mapped_column_index")
    private Integer mappedColumnIndex;

    @Column(name = "is_required", nullable = false)
    private Boolean isRequired = true;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "restored_at")
    private LocalDateTime restoredAt;

    @PrePersist
    protected void onCreate() {
        if (this.isRequired == null) this.isRequired = true;
        if (this.isDeleted == null) this.isDeleted = false;
    }

    public HeaderMapping() {
    }

    public HeaderMapping(SheetConfiguration sheetConfiguration, String headerName, Integer mappedColumnIndex, Boolean isRequired) {
        this.sheetConfiguration = sheetConfiguration;
        this.headerName = headerName;
        this.mappedColumnIndex = mappedColumnIndex;
        this.isRequired = isRequired;
        this.isDeleted = false;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public SheetConfiguration getSheetConfiguration() {
        return sheetConfiguration;
    }

    public void setSheetConfiguration(SheetConfiguration sheetConfiguration) {
        this.sheetConfiguration = sheetConfiguration;
    }

    public String getHeaderName() {
        return headerName;
    }

    public void setHeaderName(String headerName) {
        this.headerName = headerName;
    }

    public Integer getMappedColumnIndex() {
        return mappedColumnIndex;
    }

    public void setMappedColumnIndex(Integer mappedColumnIndex) {
        this.mappedColumnIndex = mappedColumnIndex;
    }

    public Boolean getIsRequired() {
        return isRequired;
    }

    public void setIsRequired(Boolean isRequired) {
        this.isRequired = isRequired;
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
