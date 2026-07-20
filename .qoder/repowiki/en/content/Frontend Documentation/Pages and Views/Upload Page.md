# Upload Page

<cite>
**Referenced Files in This Document**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
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
This document explains the Upload page component and its end-to-end integration with the backend Excel processing pipeline. It covers multi-file upload, drag-and-drop interaction, file type and size validation, progress tracking, previewing uploaded data, handling validation errors, and managing upload sessions from initiation to completion.

## Project Structure
The Upload feature spans both frontend and backend:
- Frontend: A React page that renders the upload UI, handles user interactions (drag-and-drop, selection), validates files client-side, tracks progress, previews data, and communicates with backend APIs.
- Backend: REST controllers for multi-file uploads and validation, services for parsing, validating, scanning workbooks, and generating previews, plus models and entities for responses and session management.

```mermaid
graph TB
subgraph "Frontend"
UP["UploadPage.jsx"]
end
subgraph "Backend"
C1["MultiFileImportController.java"]
C2["ExcelImportValidationController.java"]
S1["MultiFileImportService.java"]
S2["ExcelParsingService.java"]
S3["ExcelValidationService.java"]
S4["PreviewService.java"]
S5["WorkbookScannerService.java"]
M1["ExcelUploadResponse.java"]
M2["ExcelValidationError.java"]
E1["ImportSession.java"]
E2["ImportBatch.java"]
end
UP --> C1
UP --> C2
C1 --> S1
C1 --> S2
C1 --> S3
C1 --> S4
C1 --> S5
C2 --> S3
C2 --> S4
C2 --> S5
S1 --> E1
S1 --> E2
S2 --> E1
S3 --> E1
S4 --> E1
S5 --> E1
C1 --> M1
C2 --> M2
```

**Diagram sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

**Section sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

## Core Components
- UploadPage (Frontend): Renders the upload area, supports drag-and-drop and file picker, enforces client-side constraints (types, sizes), manages local state for selected files, progress, and preview, and calls backend endpoints for upload, validation, and preview.
- MultiFileImportController (Backend): Exposes endpoints for uploading multiple files, initiating sessions, and coordinating batch processing.
- ExcelImportValidationController (Backend): Exposes endpoints for validating uploaded workbooks and returning structured validation results.
- Services:
  - MultiFileImportService: Orchestrates multi-file operations, creates and updates ImportSession and ImportBatch records, and coordinates other services.
  - ExcelParsingService: Parses Excel content into structured data for preview and further processing.
  - ExcelValidationService: Applies business rules and schema checks, producing validation errors.
  - PreviewService: Generates lightweight previews of uploaded sheets.
  - WorkbookScannerService: Scans workbook metadata (sheets, headers) to support validation and preview.
- Models and Entities:
  - ExcelUploadResponse: Represents upload outcomes and status.
  - ExcelValidationError: Encodes per-row or per-field validation issues.
  - ImportSession: Tracks an upload session lifecycle and aggregate status.
  - ImportBatch: Represents a batch of files within a session.

**Section sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

## Architecture Overview
End-to-end flow for uploading and processing Excel files:

```mermaid
sequenceDiagram
participant U as "User"
participant F as "UploadPage.jsx"
participant API as "MultiFileImportController.java"
participant SVC as "MultiFileImportService.java"
participant PARSE as "ExcelParsingService.java"
participant VALID as "ExcelValidationService.java"
participant PREV as "PreviewService.java"
participant SCAN as "WorkbookScannerService.java"
participant DB as "ImportSession.java / ImportBatch.java"
U->>F : Drag & drop or select files
F->>F : Client-side validation (type, size)
F->>API : POST multipart files
API->>SVC : Create session and batches
SVC->>DB : Persist ImportSession and ImportBatch
SVC->>PARSE : Parse workbook(s)
SVC->>VALID : Validate parsed data
SVC->>PREV : Generate preview rows
SVC->>SCAN : Scan workbook metadata
SVC-->>API : Upload result (status, session id)
API-->>F : {session, status, message}
F->>API : GET preview by session
API->>PREV : Fetch preview
PREV-->>API : Preview data
API-->>F : Preview payload
F->>API : GET validation by session
API->>VALID : Fetch validation errors
VALID-->>API : Validation results
API-->>F : Errors list
F->>F : Render progress, preview, and errors
```

**Diagram sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

## Detailed Component Analysis

### UploadPage (Frontend)
Responsibilities:
- File selection via native input and drag-and-drop.
- Client-side validation for allowed types and maximum size.
- Progress tracking during upload (per-file and overall).
- Displaying preview data and validation feedback.
- Managing upload sessions using IDs returned by the backend.

Key behaviors:
- Drag-and-drop: Listens to dragover/dragleave/drop events; prevents default behavior; highlights drop zone; aggregates dropped files with already-selected ones.
- File picker: Accepts multiple files; filters by extension; enforces max size; shows immediate error messages for invalid files.
- Upload orchestration: Sends multipart requests; updates progress; on success, stores session ID; polls or fetches preview and validation results when available.
- Preview rendering: Requests preview data by session and renders a table-like view.
- Error display: Aggregates validation errors and presents them grouped by sheet or row.

Implementation details:
- State variables include selectedFiles, progressMap, previewData, validationErrors, sessionId, and UI flags for active upload and error banners.
- Event handlers manage drag-and-drop and file input changes.
- API calls are made to upload endpoint, preview endpoint, and validation endpoint.

**Section sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)

### MultiFileImportController (Backend)
Responsibilities:
- Endpoint for receiving multiple Excel files.
- Creates ImportSession and ImportBatch records.
- Delegates parsing, validation, and preview generation to services.
- Returns standardized responses.

Key endpoints:
- Upload: Accepts multipart/form-data with multiple files; returns session information and initial status.
- Optional endpoints may be exposed for polling status, retrieving preview, and fetching validation results.

Error handling:
- Validates request format and file presence.
- Returns meaningful HTTP status codes and messages.

**Section sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)

### ExcelImportValidationController (Backend)
Responsibilities:
- Provides endpoints to retrieve validation results for a given session or batch.
- Formats validation errors into structured responses.

Key endpoints:
- Get validation by session or batch.
- Optionally filter by sheet or row.

**Section sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)

### MultiFileImportService (Backend)
Responsibilities:
- Orchestrates multi-file upload workflow.
- Initializes ImportSession and one or more ImportBatch entries.
- Coordinates parsing, validation, preview, and scanning.
- Updates session and batch statuses based on processing outcomes.

Processing logic:
- For each file: parse, validate, scan, generate preview.
- Aggregate results into session-level summary.
- Persist intermediate states for recovery and auditing.

**Section sources**
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)

### ExcelParsingService (Backend)
Responsibilities:
- Reads Excel workbooks and extracts sheet names, headers, and row data.
- Normalizes data types where possible.
- Produces structures suitable for validation and preview.

Complexity considerations:
- Streaming or chunked reading for large files to avoid memory spikes.
- Efficient header mapping and normalization.

**Section sources**
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)

### ExcelValidationService (Backend)
Responsibilities:
- Applies business rules and schema checks to parsed data.
- Collects validation errors with context (sheet, row, field).
- Supports partial success: continues processing despite non-fatal errors.

Output:
- Structured validation errors used by the frontend to inform users.

**Section sources**
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)

### PreviewService (Backend)
Responsibilities:
- Generates a lightweight preview dataset for quick inspection.
- Limits number of rows and columns to reduce payload size.

Integration:
- Consumes parsed data from ExcelParsingService.
- Returns preview payloads consumed by the frontend.

**Section sources**
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)

### WorkbookScannerService (Backend)
Responsibilities:
- Scans workbook metadata such as sheet count, header presence, and basic structure.
- Assists validation and informs preview generation.

**Section sources**
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)

### Data Models and Entities
- ExcelUploadResponse: Carries upload outcome, session identifiers, and high-level status.
- ExcelValidationError: Encodes detailed validation issues including location and message.
- ImportSession: Tracks overall upload session state, timestamps, and aggregated counts.
- ImportBatch: Represents individual file processing within a session.

**Section sources**
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

### User Interaction Flow
```mermaid
flowchart TD
Start(["Open Upload Page"]) --> DropZone["Drag files over drop zone<br/>or click to browse"]
DropZone --> ClientValidate{"Client-side validation<br/>Type and size OK?"}
ClientValidate --> |No| ShowError["Show inline error<br/>and reject file"]
ClientValidate --> |Yes| AddToQueue["Add to upload queue"]
AddToQueue --> UploadStart["Start upload"]
UploadStart --> TrackProgress["Track per-file and total progress"]
TrackProgress --> ServerResponse{"Server response"}
ServerResponse --> |Success| StoreSession["Store session ID"]
StoreSession --> FetchPreview["Fetch preview data"]
FetchPreview --> RenderPreview["Render preview table"]
ServerResponse --> |Failure| ShowServerError["Show server error"]
RenderPreview --> FetchValidation["Fetch validation errors"]
FetchValidation --> RenderErrors["Render errors grouped by sheet/row"]
RenderErrors --> End(["Ready for next action"])
ShowServerError --> End
ShowError --> End
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Dependency Analysis
Frontend-backend coupling is primarily through REST endpoints. The frontend depends on controller endpoints for upload, preview, and validation. The backend orchestrates multiple services and persists session/batch state.

```mermaid
graph LR
UP["UploadPage.jsx"] --> MFIC["MultiFileImportController.java"]
UP --> EIVC["ExcelImportValidationController.java"]
MFIC --> MFIS["MultiFileImportService.java"]
MFIC --> EPS["ExcelParsingService.java"]
MFIC --> EVS["ExcelValidationService.java"]
MFIC --> PRV["PreviewService.java"]
MFIC --> WBS["WorkbookScannerService.java"]
EIVC --> EVS
EIVC --> PRV
EIVC --> WBS
MFIS --> IS["ImportSession.java"]
MFIS --> IB["ImportBatch.java"]
MFIC --> EUR["ExcelUploadResponse.java"]
EIVC --> EVE["ExcelValidationError.java"]
```

**Diagram sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

**Section sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

## Performance Considerations
- Large files: Use streaming or chunked processing on the backend to limit memory usage.
- Preview limits: Cap preview rows/columns to keep payloads small.
- Batch processing: Process files concurrently where safe and bounded to avoid overwhelming resources.
- Client-side validation: Prevent unnecessary network calls by rejecting invalid files early.
- Progress reporting: Provide frequent but not excessive progress updates to balance responsiveness and overhead.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Invalid file type: Ensure only supported Excel formats are accepted; update client-side filters and server-side MIME/type checks.
- File too large: Enforce size limits consistently on both sides; provide clear error messages and guidance.
- Session not found: Verify session ID propagation and persistence; ensure correct endpoint parameters.
- Preview empty: Check parsing service output and preview limits; confirm workbook contains expected sheets and headers.
- Validation errors not displayed: Confirm validation endpoint returns structured errors and frontend maps them correctly.

Operational tips:
- Inspect ImportSession and ImportBatch records to trace processing state.
- Review ExcelValidationError entries for precise row and field context.
- Log parsing and validation steps to identify bottlenecks.

**Section sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)

## Conclusion
The Upload page integrates a robust multi-file upload experience with comprehensive Excel processing capabilities. Users can drag-and-drop or select files, receive immediate validation feedback, track progress, preview data, and review detailed validation errors. The backend orchestrates parsing, validation, and preview generation while maintaining session and batch state for reliability and auditability.