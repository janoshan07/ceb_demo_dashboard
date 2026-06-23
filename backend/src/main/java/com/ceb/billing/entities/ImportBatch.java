package com.ceb.billing.entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "import_batches")
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(name = "uploaded_by", nullable = false, length = 100)
    private String uploadedBy;

    @Column(name = "upload_time", nullable = false)
    private LocalDateTime uploadTime;

    @Column(nullable = false, length = 50)
    private String status; // UPLOADED, SCANNED, VALIDATED, APPROVED, REJECTED, COMPLETED

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "template_id")
    private ExcelTemplate excelTemplate;

    @Column(name = "sheet_validation_status", length = 20)
    private String sheetValidationStatus; // PASS, FAIL

    @Column(name = "header_validation_status", length = 20)
    private String headerValidationStatus; // PASS, FAIL

    @Lob
    @Column(name = "file_data", columnDefinition = "LONGBLOB")
    private byte[] fileData;

    @Column(name = "validation_details", columnDefinition = "LONGTEXT")
    private String validationDetails; // JSON string of errors/warnings list

    @Column(name = "total_sheets")
    private Integer totalSheets;

    @Column(name = "sheet_info", columnDefinition = "LONGTEXT")
    private String sheetInfo; // JSON summary of sheets

    @Column(name = "is_approved", nullable = false)
    private Boolean isApproved = false;

    @Column(name = "approved_by", length = 100)
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @PrePersist
    protected void onCreate() {
        this.uploadTime = LocalDateTime.now();
        if (this.isApproved == null) this.isApproved = false;
        if (this.status == null) this.status = "UPLOADED";
    }

    public ImportBatch() {
    }

    public ImportBatch(String filename, String uploadedBy, byte[] fileData) {
        this.filename = filename;
        this.uploadedBy = uploadedBy;
        this.fileData = fileData;
        this.status = "UPLOADED";
        this.isApproved = false;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(String uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public LocalDateTime getUploadTime() {
        return uploadTime;
    }

    public void setUploadTime(LocalDateTime uploadTime) {
        this.uploadTime = uploadTime;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public ExcelTemplate getExcelTemplate() {
        return excelTemplate;
    }

    public void setExcelTemplate(ExcelTemplate excelTemplate) {
        this.excelTemplate = excelTemplate;
    }

    public String getSheetValidationStatus() {
        return sheetValidationStatus;
    }

    public void setSheetValidationStatus(String sheetValidationStatus) {
        this.sheetValidationStatus = sheetValidationStatus;
    }

    public String getHeaderValidationStatus() {
        return headerValidationStatus;
    }

    public void setHeaderValidationStatus(String headerValidationStatus) {
        this.headerValidationStatus = headerValidationStatus;
    }

    public byte[] getFileData() {
        return fileData;
    }

    public void setFileData(byte[] fileData) {
        this.fileData = fileData;
    }

    public String getValidationDetails() {
        return validationDetails;
    }

    public void setValidationDetails(String validationDetails) {
        this.validationDetails = validationDetails;
    }

    public Integer getTotalSheets() {
        return totalSheets;
    }

    public void setTotalSheets(Integer totalSheets) {
        this.totalSheets = totalSheets;
    }

    public String getSheetInfo() {
        return sheetInfo;
    }

    public void setSheetInfo(String sheetInfo) {
        this.sheetInfo = sheetInfo;
    }

    public Boolean getIsApproved() {
        return isApproved;
    }

    public void setIsApproved(Boolean isApproved) {
        this.isApproved = isApproved;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }
}
