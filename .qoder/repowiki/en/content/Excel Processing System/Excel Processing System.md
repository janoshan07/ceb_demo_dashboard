# Excel Processing System

<cite>
**Referenced Files in This Document**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [pom.xml](file://backend/pom.xml)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the Excel processing system used for bulk billing data imports. It covers the multi-file upload pipeline, header mapping and validation, data type validation rules, business rule enforcement, Apache POI integration, error handling strategies, progress tracking for large files, template management for different import formats, validation rule configuration, and error reporting mechanisms. It also provides examples of supported Excel formats, validation rules, and troubleshooting guidance for common import issues.

## Project Structure
The backend is a Spring Boot application with controllers, services, entities, repositories, and models organized by feature. The Excel processing subsystem spans:
- Controllers: REST endpoints for multi-file uploads, validation, preview, and import orchestration
- Services: Parsing, validation, scanning, preview, and batch/session management
- Entities: Templates, mappings, sheet configurations, batches, sessions, staging, and audit logs
- Models: Request/response DTOs for validation errors and upload responses
- Dependencies: Apache POI for Excel parsing

```mermaid
graph TB
subgraph "Controllers"
C1["MultiFileImportController"]
C2["ExcelImportValidationController"]
C3["BillingController"]
end
subgraph "Services"
S1["MultiFileImportService"]
S2["ExcelParsingService"]
S3["ExcelValidationService"]
S4["HeaderValidationService"]
S5["SheetValidationService"]
S6["WorkbookScannerService"]
S7["PreviewService"]
end
subgraph "Entities"
E1["ExcelTemplate"]
E2["HeaderMapping"]
E3["SheetConfiguration"]
E4["ImportBatch"]
E5["ImportSession"]
E6["ImportAuditLog"]
E7["BillingUploadStaging"]
end
subgraph "Models"
M1["ExcelValidationError"]
M2["ExcelUploadResponse"]
end
C1 --> S1
C2 --> S3
C2 --> S4
C2 --> S5
C2 --> S6
C3 --> S1
S1 --> S2
S1 --> S3
S1 --> S4
S1 --> S5
S1 --> S6
S1 --> S7
S2 --> E1
S2 --> E2
S2 --> E3
S3 --> E1
S3 --> E2
S3 --> E3
S4 --> E1
S4 --> E2
S5 --> E3
S6 --> E1
S6 --> E2
S6 --> E3
S7 --> E7
S1 --> E4
S1 --> E5
S1 --> E6
S1 --> E7
C1 --> M2
C2 --> M1
```

**Diagram sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

**Section sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

## Core Components
- Multi-file upload controller: Accepts multiple Excel files, creates an import session and batch, and delegates to the import service.
- Validation controller: Provides endpoints to validate headers, sheets, and row-level data against templates and mappings.
- Import service: Orchestrates parsing, validation, staging, auditing, and progress updates across multiple files.
- Parsing service: Uses Apache POI to read workbooks, sheets, rows, and cells; maps headers to internal fields using configured mappings.
- Validation services: Validate headers, sheet presence/ordering, and row-level data types and business rules.
- Scanner service: Scans workbook structure (sheets, headers) to support preview and pre-validation.
- Preview service: Returns sample rows from staging or parsed data for user review before final commit.
- Template and mapping entities: Define supported import formats, header-to-field mappings, and sheet-specific configurations.
- Session and batch entities: Track long-running imports, progress, and results.
- Staging entity: Holds validated rows pending final persistence.
- Audit log entity: Records import lifecycle events and errors.
- Response models: Standardize upload and validation error responses.

**Section sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

## Architecture Overview
The system follows a layered architecture:
- Presentation layer: REST controllers expose endpoints for upload, validation, preview, and import status.
- Service layer: Coordinates parsing, validation, staging, auditing, and progress tracking.
- Data layer: JPA entities and repositories persist templates, mappings, sessions, batches, staging rows, and audit logs.
- External dependency: Apache POI reads .xls/.xlsx workbooks.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Ctrl as "MultiFileImportController"
participant Svc as "MultiFileImportService"
participant Parse as "ExcelParsingService"
participant Valid as "ExcelValidationService"
participant Head as "HeaderValidationService"
participant Sheet as "SheetValidationService"
participant Scan as "WorkbookScannerService"
participant Prev as "PreviewService"
participant DB as "Repositories"
Client->>Ctrl : POST /api/multi-import (files)
Ctrl->>Svc : createSessionAndBatch(files)
Svc->>DB : persist ImportSession, ImportBatch
loop For each file
Svc->>Scan : scanWorkbook(file)
Scan-->>Svc : sheet names, headers
Svc->>Head : validateHeaders(headers, templateId)
Head-->>Svc : header map or errors
alt headers valid
Svc->>Parse : parseRows(file, mapping)
Parse-->>Svc : raw records
Svc->>Valid : validateRecords(records, rules)
Valid-->>Svc : validated records + errors
Svc->>DB : persist BillingUploadStaging
Svc->>Prev : updatePreview(sessionId)
else header errors
Svc->>DB : record ImportAuditLog
end
Svc->>DB : update ImportBatch progress
end
Svc-->>Ctrl : ImportBatch summary
Ctrl-->>Client : ExcelUploadResponse
```

**Diagram sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

## Detailed Component Analysis

### Multi-file Upload Pipeline
- Entry points:
  - Multi-file upload endpoint orchestrates session creation, per-file processing, and batch completion.
  - Billing controller may provide alternative entry points for single-file or workflow-driven imports.
- Pipeline steps:
  - Create ImportSession and ImportBatch to track progress.
  - For each uploaded file:
    - Scan workbook structure (sheets, headers).
    - Validate headers against configured HeaderMapping and ExcelTemplate.
    - Parse rows using Apache POI into typed records.
    - Apply row-level validations (type checks, business rules).
    - Persist validated rows to staging and update preview.
    - Record audit events and update batch progress.
- Responses:
  - Return ExcelUploadResponse with batch status, counts, and links to preview or errors.

```mermaid
flowchart TD
Start(["Start Multi-file Import"]) --> CreateSession["Create ImportSession and ImportBatch"]
CreateSession --> LoopFiles{"For each file"}
LoopFiles --> |Yes| Scan["Scan Workbook (sheets, headers)"]
Scan --> ValidateHeaders["Validate Headers vs Template/Mappings"]
ValidateHeaders --> |Invalid| LogError["Record ImportAuditLog and continue next file"]
ValidateHeaders --> |Valid| Parse["Parse Rows via Apache POI"]
Parse --> ValidateRows["Apply Type and Business Rule Validation"]
ValidateRows --> PersistStaging["Persist to BillingUploadStaging"]
PersistStaging --> UpdatePreview["Update Preview"]
UpdatePreview --> UpdateProgress["Update ImportBatch Progress"]
UpdateProgress --> LoopFiles
LoopFiles --> |No| Complete["Complete Batch and Return Summary"]
LogError --> LoopFiles
```

**Diagram sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

**Section sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

### Header Mapping and Validation
- Header mapping:
  - ExcelTemplate defines supported import formats.
  - HeaderMapping maps source column headers to internal field names.
  - SheetConfiguration can constrain which sheets are expected and their order.
- Validation flow:
  - HeaderValidationService compares detected headers against configured mappings.
  - SheetValidationService verifies required sheets exist and optionally validates sheet ordering/naming.
  - Errors are returned as structured ExcelValidationError entries.

```mermaid
classDiagram
class ExcelTemplate {
+id
+name
+description
+version
}
class HeaderMapping {
+id
+templateId
+sourceHeader
+targetField
+required
}
class SheetConfiguration {
+id
+templateId
+sheetName
+order
+enabled
}
class HeaderValidationService {
+validateHeaders(headers, templateId) Map~String,String~
}
class SheetValidationService {
+validateSheets(sheetNames, templateId) error[]
}
ExcelTemplate <|-- HeaderMapping : "has many"
ExcelTemplate <|-- SheetConfiguration : "has many"
HeaderValidationService --> ExcelTemplate : "uses"
HeaderValidationService --> HeaderMapping : "reads"
SheetValidationService --> ExcelTemplate : "uses"
SheetValidationService --> SheetConfiguration : "reads"
```

**Diagram sources**
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

**Section sources**
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

### Data Type Validation Rules and Business Rule Enforcement
- Row-level validation:
  - ExcelValidationService applies type checks (e.g., numeric, date, enum) and business constraints (e.g., ranges, cross-field dependencies).
  - Validation failures produce ExcelValidationError entries with row/column context.
- Configuration:
  - Validation rules are driven by template and mapping metadata; additional rules may be enforced within the validation service based on template version or flags.

```mermaid
flowchart TD
RStart(["Row Input"]) --> DetectType["Detect Cell Type"]
DetectType --> TypeCheck{"Type Matches Expected?"}
TypeCheck --> |No| AddErr["Add ExcelValidationError"]
TypeCheck --> |Yes| BusinessRules["Apply Business Rules"]
BusinessRules --> RulesOk{"All Rules Pass?"}
RulesOk --> |No| AddErr
RulesOk --> |Yes| EmitRec["Emit Validated Record"]
AddErr --> REnd(["End"])
EmitRec --> REnd
```

**Diagram sources**
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)

**Section sources**
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)

### Apache POI Integration for Excel Parsing
- Parsing responsibilities:
  - ExcelParsingService uses Apache POI to open workbooks (.xls/.xlsx), iterate sheets, rows, and cells.
  - Converts cell values to typed Java objects according to HeaderMapping target fields.
- Error handling:
  - Malformed cells or unsupported formats are captured and reported via validation errors or audit logs.
- Performance:
  - Streaming-friendly reading patterns are preferred for large files to reduce memory usage.

```mermaid
sequenceDiagram
participant Parse as "ExcelParsingService"
participant POI as "Apache POI"
participant Map as "HeaderMapping"
participant Rec as "Record Builder"
Parse->>POI : Open Workbook(file)
POI-->>Parse : Workbook object
Parse->>POI : Get Sheet(index/name)
POI-->>Parse : Sheet object
Parse->>Map : Resolve target fields for headers
loop Rows
Parse->>POI : Read Row
Parse->>POI : Read Cells
Parse->>Rec : Build typed record
Rec-->>Parse : Record
end
Parse-->>Caller : List of Records
```

**Diagram sources**
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)

**Section sources**
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)

### Progress Tracking and Large File Processing
- Session and batch tracking:
  - ImportSession tracks overall import state and timestamps.
  - ImportBatch aggregates per-batch metrics (total files, processed, errors).
- Per-file progress:
  - After each file’s processing, the batch progress is updated.
- Preview updates:
  - PreviewService refreshes sample data after successful staging of rows.

```mermaid
classDiagram
class ImportSession {
+id
+status
+createdAt
+updatedAt
}
class ImportBatch {
+id
+sessionId
+totalFiles
+processedFiles
+errors
+status
}
class PreviewService {
+getPreview(sessionId) rows[]
}
class BillingUploadStaging {
+id
+batchId
+rawData
+validated
}
ImportSession ||--o{ ImportBatch : "has many"
ImportBatch ||--o{ BillingUploadStaging : "contains"
PreviewService --> BillingUploadStaging : "reads"
```

**Diagram sources**
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)

**Section sources**
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)

### Template Management for Different Import Formats
- Templates define supported formats and versions.
- HeaderMapping configures column-to-field associations and requirements.
- SheetConfiguration constrains sheet presence and order.
- These entities enable flexible, configurable imports without code changes.

```mermaid
erDiagram
EXCEL_TEMPLATE {
int id PK
string name
string description
string version
}
HEADER_MAPPING {
int id PK
int template_id FK
string source_header
string target_field
boolean required
}
SHEET_CONFIGURATION {
int id PK
int template_id FK
string sheet_name
int order
boolean enabled
}
EXCEL_TEMPLATE ||--o{ HEADER_MAPPING : "has many"
EXCEL_TEMPLATE ||--o{ SHEET_CONFIGURATION : "has many"
```

**Diagram sources**
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)

**Section sources**
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)

### Validation Rule Configuration and Error Reporting
- Validation rule configuration:
  - Driven by template and mapping metadata; additional rules applied in validation services.
- Error reporting:
  - ExcelValidationError captures row/column context and messages.
  - ImportAuditLog records lifecycle events and errors for traceability.
  - ExcelUploadResponse summarizes outcomes for clients.

```mermaid
classDiagram
class ExcelValidationError {
+rowNumber
+columnLabel
+message
+code
}
class ImportAuditLog {
+id
+batchId
+event
+details
+timestamp
}
class ExcelUploadResponse {
+batchId
+status
+summary
}
ExcelUploadResponse --> ExcelValidationError : "may contain"
ImportAuditLog --> ExcelUploadResponse : "supports"
```

**Diagram sources**
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

**Section sources**
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)

## Dependency Analysis
- External dependency:
  - Apache POI is declared in Maven dependencies for Excel parsing.
- Internal coupling:
  - Controllers depend on services; services depend on entities and repositories.
  - Validation services depend on template and mapping entities.
  - Parsing depends on Apache POI and mapping entities.
  - Preview depends on staging data.

```mermaid
graph TB
POM["pom.xml"]
POI["Apache POI"]
CTRL["Controllers"]
SVC["Services"]
ENT["Entities"]
STG["Staging"]
POM --> POI
CTRL --> SVC
SVC --> ENT
SVC --> STG
SVC --> POI
```

**Diagram sources**
- [pom.xml](file://backend/pom.xml)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)

**Section sources**
- [pom.xml](file://backend/pom.xml)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)

## Performance Considerations
- Use streaming APIs for large workbooks to minimize memory footprint.
- Process files in parallel where safe, while maintaining session/batch consistency.
- Stage validated rows incrementally to avoid long transactions.
- Index frequently queried columns in staging and audit tables.
- Limit preview size and paginate when necessary.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Unsupported file format:
  - Ensure files are .xls or .xlsx; verify Apache POI compatibility.
- Missing or mismatched headers:
  - Check HeaderMapping configuration for the selected template; correct source headers accordingly.
- Invalid data types:
  - Review ExcelValidationError details for row/column context; fix formatting (dates, numbers).
- Missing required sheets:
  - Verify SheetConfiguration expectations; add or rename sheets as required.
- Long-running imports:
  - Monitor ImportBatch progress; consider splitting large files or enabling streaming parsing.
- No preview data:
  - Confirm that rows were staged successfully; check ImportAuditLog for errors.

**Section sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)

## Conclusion
The Excel processing system provides a robust, configurable pipeline for bulk billing data imports. It leverages Apache POI for parsing, supports flexible header mapping and sheet configuration, enforces type and business rule validations, and offers comprehensive error reporting and progress tracking. Template-driven configuration enables diverse import formats without code changes, while staging and preview facilitate safe, user-in-the-loop workflows.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Supported Excel Formats
- .xls (BIFF8)
- .xlsx (Office Open XML)

[No sources needed since this section provides general guidance]

### Example Validation Rules
- Numeric fields must be within defined ranges.
- Date fields must conform to configured formats.
- Enum fields must match allowed values.
- Cross-field dependencies (e.g., amount > 0 if currency present).

[No sources needed since this section provides general guidance]