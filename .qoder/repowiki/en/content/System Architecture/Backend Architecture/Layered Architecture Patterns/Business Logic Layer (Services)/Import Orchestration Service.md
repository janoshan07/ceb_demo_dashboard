# Import Orchestration Service

<cite>
**Referenced Files in This Document**
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)
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

## Introduction
This document explains the import orchestration services that coordinate batch imports from multiple Excel workbooks. It focuses on:
- MultiFileImportService for orchestrating batch processing across files
- WorkbookScannerService for discovering sheets and extracting metadata
- StagingMigrationService for staging data and migrating it into target tables
It also covers transaction management, error recovery, progress tracking, rollback strategies, configuration patterns, and integration with validation services.

## Project Structure
The import orchestration spans controllers, services, entities, and repositories under the backend module. The key orchestration components are:
- Controller layer exposes endpoints to start batch imports and query status
- Services implement discovery, validation, staging, migration, and orchestration
- Entities model sessions, batches, staged rows, and audit logs
- Repositories provide persistence access for session/batch/staging/audit state

```mermaid
graph TB
subgraph "Controllers"
C1["MultiFileImportController"]
end
subgraph "Services"
S1["MultiFileImportService"]
S2["WorkbookScannerService"]
S3["StagingMigrationService"]
V1["ExcelValidationService"]
V2["HeaderValidationService"]
V3["SheetValidationService"]
end
subgraph "Entities"
E1["ImportSession"]
E2["ImportBatch"]
E3["BillingUploadStaging"]
E4["ImportAuditLog"]
end
subgraph "Repositories"
R1["ImportSessionRepository"]
R2["ImportBatchRepository"]
R3["BillingUploadStagingRepository"]
R4["ImportAuditLogRepository"]
end
C1 --> S1
S1 --> S2
S1 --> S3
S1 --> V1
S1 --> V2
S1 --> V3
S3 --> R3
S1 --> R1
S1 --> R2
S1 --> R4
```

**Diagram sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)

**Section sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)

## Core Components
- MultiFileImportService coordinates a multi-file import job by creating an ImportSession, enumerating files, scanning each workbook, validating headers/sheets, staging rows, and migrating staged data. It manages per-batch transactions and overall progress reporting.
- WorkbookScannerService inspects uploaded workbooks to discover available sheets, extract header mappings, and produce scan metadata used by validation and staging.
- StagingMigrationService persists validated rows into BillingUploadStaging within transactions and performs subsequent migration steps (e.g., moving staged rows to final tables), handling partial failures and rollbacks at the batch level.

Key responsibilities:
- Batch lifecycle: create session, create batches, process files, finalize session
- Transaction boundaries: per-file or per-batch transactions to ensure consistency
- Error recovery: capture row-level errors, continue processing where possible, mark batches as failed when necessary
- Progress tracking: update counts and statuses in ImportSession and ImportBatch
- Auditability: record ImportAuditLog entries for important events

**Section sources**
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)

## Architecture Overview
The orchestration follows a layered architecture with clear separation between controller, service, and persistence layers. Validation is integrated early to fail fast on structural issues before staging.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Controller as "MultiFileImportController"
participant Orchestrator as "MultiFileImportService"
participant Scanner as "WorkbookScannerService"
participant Validator as "ExcelValidationService<br/>HeaderValidationService<br/>SheetValidationService"
participant Migrator as "StagingMigrationService"
participant RepoSess as "ImportSessionRepository"
participant RepoBatch as "ImportBatchRepository"
participant RepoStg as "BillingUploadStagingRepository"
participant RepoAudit as "ImportAuditLogRepository"
Client->>Controller : "Start batch import"
Controller->>Orchestrator : "initiate(files, config)"
Orchestrator->>RepoSess : "create ImportSession"
Orchestrator->>Orchestrator : "for each file"
Orchestrator->>Scanner : "scan workbook"
Scanner-->>Orchestrator : "sheet metadata"
Orchestrator->>Validator : "validate headers/sheets"
Validator-->>Orchestrator : "validation results"
Orchestrator->>Migrator : "stage rows (transactional)"
Migrator->>RepoStg : "persist staged rows"
Migrator-->>Orchestrator : "batch result"
Orchestrator->>RepoBatch : "update ImportBatch"
Orchestrator->>RepoAudit : "log event"
Orchestrator->>RepoSess : "finalize session"
Orchestrator-->>Controller : "session summary"
Controller-->>Client : "import status"
```

**Diagram sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)

## Detailed Component Analysis

### MultiFileImportService
Responsibilities:
- Create and manage ImportSession and ImportBatch entities
- Iterate over input files and delegate scanning, validation, staging, and migration
- Enforce transaction boundaries per batch/file
- Track progress and aggregate results
- Record audit events and handle exceptions with rollback semantics

Processing flow:
- Initialize session and first batch
- For each file:
  - Scan workbook via WorkbookScannerService
  - Validate structure via validation services
  - Stage rows via StagingMigrationService within a transaction
  - Update batch counters and status
- Finalize session and publish summary

Error handling and rollback:
- Per-batch transactions ensure that if staging fails, changes are rolled back
- Row-level validation errors are captured without aborting entire batches when possible
- Session-level failures are recorded and session marked accordingly

Progress tracking:
- Increment processed/failed counts in ImportBatch
- Update ImportSession totals and timestamps

Integration points:
- Depends on WorkbookScannerService for sheet discovery
- Integrates with ExcelValidationService, HeaderValidationService, SheetValidationService
- Persists state through ImportSessionRepository, ImportBatchRepository, ImportAuditLogRepository

```mermaid
flowchart TD
Start(["Start Batch"]) --> CreateSession["Create ImportSession"]
CreateSession --> LoopFiles{"More files?"}
LoopFiles --> |Yes| Scan["Scan workbook"]
Scan --> Validate["Validate headers/sheets"]
Validate --> Valid{"Valid?"}
Valid --> |No| MarkFail["Mark batch/session as failed"]
Valid --> |Yes| Stage["Stage rows (transaction)"]
Stage --> UpdateBatch["Update ImportBatch counters"]
UpdateBatch --> LoopFiles
LoopFiles --> |No| Finalize["Finalize ImportSession"]
Finalize --> End(["Done"])
MarkFail --> End
```

**Diagram sources**
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)

**Section sources**
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)

### WorkbookScannerService
Responsibilities:
- Open uploaded workbooks and enumerate sheets
- Extract header information and basic metadata (sheet names, column positions)
- Provide structured scan results consumed by validation and staging

Design considerations:
- Resource-safe reading of large workbooks
- Early detection of missing or misnamed sheets
- Normalization of header names for downstream validation

```mermaid
classDiagram
class WorkbookScannerService {
+scan(file) WorkbookMetadata
+getSheets() String[]
+extractHeaders(sheetName) String[]
}
class WorkbookMetadata {
+String[] sheetNames
+Map~String,String[]~ sheetHeaders
}
WorkbookScannerService --> WorkbookMetadata : "produces"
```

**Diagram sources**
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)

**Section sources**
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)

### StagingMigrationService
Responsibilities:
- Persist validated rows into BillingUploadStaging within a transaction boundary
- Perform subsequent migration steps (e.g., moving staged rows to final tables) after successful staging
- Handle partial failures and rollback behavior at the batch level
- Emit audit logs for staging/migration outcomes

Transaction strategy:
- Each batch’s staging runs in a single transaction; on failure, all staged rows for that batch are rolled back
- Migration phase can be separate and idempotent, allowing retries without duplication

Data model interactions:
- Writes BillingUploadStaging records keyed by session/batch identifiers
- Updates ImportBatch counters and statuses
- Records ImportAuditLog entries for success/failure

```mermaid
sequenceDiagram
participant Orchestrator as "MultiFileImportService"
participant Migrator as "StagingMigrationService"
participant RepoStg as "BillingUploadStagingRepository"
participant RepoBatch as "ImportBatchRepository"
participant RepoAudit as "ImportAuditLogRepository"
Orchestrator->>Migrator : "stageRows(batchId, rows)"
Migrator->>RepoStg : "begin transaction"
Migrator->>RepoStg : "insert staged rows"
Migrator->>RepoStg : "commit"
Migrator->>RepoBatch : "update batch counters"
Migrator->>RepoAudit : "log staging success"
Migrator-->>Orchestrator : "result"
```

**Diagram sources**
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)

**Section sources**
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)

### Validation Integration
Validation services integrate early in the pipeline to prevent invalid data from entering staging:
- ExcelValidationService: validates workbook structure and constraints
- HeaderValidationService: validates presence and correctness of required headers
- SheetValidationService: validates expected sheets and their order/content

These services return structured results consumed by MultiFileImportService to decide whether to proceed with staging or mark the batch as failed.

```mermaid
classDiagram
class ExcelValidationService {
+validate(file) ValidationResult
}
class HeaderValidationService {
+validateHeaders(sheets) ValidationResult
}
class SheetValidationService {
+validateSheets(metadata) ValidationResult
}
class ValidationResult {
+boolean ok
+String[] errors
}
ExcelValidationService --> ValidationResult
HeaderValidationService --> ValidationResult
SheetValidationService --> ValidationResult
```

**Diagram sources**
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

**Section sources**
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

## Dependency Analysis
High-level dependencies among orchestration components:

```mermaid
graph LR
A["MultiFileImportController"] --> B["MultiFileImportService"]
B --> C["WorkbookScannerService"]
B --> D["StagingMigrationService"]
B --> E["ExcelValidationService"]
B --> F["HeaderValidationService"]
B --> G["SheetValidationService"]
D --> H["BillingUploadStagingRepository"]
B --> I["ImportSessionRepository"]
B --> J["ImportBatchRepository"]
B --> K["ImportAuditLogRepository"]
```

**Diagram sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)

**Section sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)

## Performance Considerations
- Stream large workbooks to avoid loading entire files into memory
- Use batched inserts for staging to reduce round-trips
- Keep transactions scoped to individual batches to minimize lock contention
- Defer heavy computations until after validation passes
- Cache static validation rules and header mappings where appropriate

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and remedies:
- Missing or renamed sheets: check scan metadata and validate against expected sheet names
- Header mismatches: review header validation results and correct source templates
- Partial failures: inspect ImportBatch and ImportAuditLog for error details; re-run failed batches
- Rollback verification: confirm no partial staged rows remain after failures; rely on transactional boundaries

Operational checks:
- Verify ImportSession status and timestamps
- Inspect ImportBatch counters for processed vs failed rows
- Review ImportAuditLog for detailed events and error messages

**Section sources**
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)

## Conclusion
The import orchestration leverages a clear separation of concerns:
- MultiFileImportService coordinates the end-to-end workflow with robust transaction and error handling
- WorkbookScannerService enables reliable discovery and metadata extraction
- StagingMigrationService ensures consistent staging and migration with rollback guarantees
- Validation services integrate early to prevent invalid data from progressing
Together, these components deliver scalable, observable, and recoverable batch imports.

[No sources needed since this section summarizes without analyzing specific files]