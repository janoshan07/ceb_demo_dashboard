# Backend Architecture

<cite>
**Referenced Files in This Document**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [application.properties](file://backend/src/main/resources/application.properties)
- [pom.xml](file://backend/pom.xml)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [HomeController.java](file://backend/src/main/java/com/ceb/billing/controllers/HomeController.java)
- [AlertService.java](file://backend/src/main/java/com/ceb/billing/services/AlertService.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ReportService.java](file://backend/src/main/java/com/ceb/billing/services/ReportService.java)
- [PredictionService.java](file://backend/src/main/java/com/ceb/billing/services/PredictionService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [DatabaseSeeder.java](file://backend/src/main/java/com/ceb/billing/services/DatabaseSeeder.java)
- [ImportTemplateSeedService.java](file://backend/src/main/java/com/ceb/billing/services/ImportTemplateSeedService.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)
- [ApprovalRequestRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ApprovalRequestRepository.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [BillingRecordRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingRecordRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [CostCodeRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CostCodeRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [ExcelTemplateRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ExcelTemplateRepository.java)
- [ExpenseCodeRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ExpenseCodeRepository.java)
- [HeaderMappingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/HeaderMappingRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [NetTypeRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/NetTypeRepository.java)
- [SheetConfigurationRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/SheetConfigurationRepository.java)
- [StagingChangeLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/StagingChangeLogRepository.java)
- [UploadHistoryRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UploadHistoryRepository.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)
- [BillingRecord.java](file://backend/src/main/java/com/ceb/billing/entities/BillingRecord.java)
- [ApprovalRequest.java](file://backend/src/main/java/com/ceb/billing/entities/ApprovalRequest.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [CostCode.java](file://backend/src/main/java/com/ceb/billing/entities/CostCode.java)
- [ExpenseCode.java](file://backend/src/main/java/com/ceb/billing/entities/ExpenseCode.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [NetType.java](file://backend/src/main/java/com/ceb/billing/entities/NetType.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [StagingChangeLog.java](file://backend/src/main/java/com/ceb/billing/entities/StagingChangeLog.java)
- [UploadHistory.java](file://backend/src/main/java/com/ceb/billing/entities/UploadHistory.java)
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [ExcelUploadResponse.java](file://backend/src/main/java/com/ceb/billing/models/ExcelUploadResponse.java)
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
This document describes the backend architecture of a Spring Boot application organized with a layered pattern: controllers (presentation), services (business logic), and repositories (data access). It explains dependency injection, RESTful API design principles, service orchestration, bootstrap process, configuration management, error handling strategies, scalability considerations, performance optimizations, and integration patterns with external systems. The goal is to provide both high-level understanding and code-level traceability for developers and maintainers.

## Project Structure
The backend follows a conventional package layout:
- Controllers under controllers handle HTTP endpoints and request/response mapping.
- Services under services encapsulate business logic and orchestrate repository calls.
- Repositories under repositories extend Spring Data interfaces for data access.
- Entities under entities represent domain models mapped to database tables.
- Models under models define DTOs used at the API boundary.
- Config under config holds security, JWT utilities, and application initialization.
- Resources under resources contain runtime configuration such as application properties.

```mermaid
graph TB
subgraph "Presentation Layer"
C1["Controllers"]
end
subgraph "Business Logic Layer"
S1["Services"]
end
subgraph "Data Access Layer"
R1["Repositories"]
end
subgraph "Domain"
E1["Entities"]
end
subgraph "API Contracts"
M1["Models (DTOs)"]
end
subgraph "Infrastructure"
CFG["Config (Security, JWT, Init)"]
RES["Resources (application.properties)"]
end
C1 --> S1
S1 --> R1
R1 --> E1
C1 --> M1
S1 --> M1
CFG --> C1
CFG --> S1
RES --> CFG
```

**Diagram sources**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [application.properties](file://backend/src/main/resources/application.properties)

**Section sources**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [application.properties](file://backend/src/main/resources/application.properties)

## Core Components
- Presentation layer: Controllers expose REST endpoints, validate inputs via DTOs, and delegate to services. Examples include authentication, customer management, alerts, approvals, billing, dashboard, reports, Excel import validation, multi-file imports, predictions, lookups, staging changes, admin user operations, and home.
- Business logic layer: Services implement use cases, coordinate multiple repositories, enforce rules, and return DTOs or domain objects. Notable services cover alerting, audit logging, Excel parsing/validation, header/sheet validation, workbook scanning, preview generation, reporting, prediction, multi-file import orchestration, staging migration, database seeding, and template seeding.
- Data access layer: Repositories extend Spring Data JPA interfaces to provide CRUD and custom queries against entities.
- Domain models: Entities represent persistent structures; DTOs model API payloads.
- Configuration and security: Security configuration, JWT filter, token utilities, and user details service manage authentication and authorization. Application properties configure runtime behavior.

Key responsibilities by layer:
- Controllers: route requests, map DTOs, apply basic validation, and return standardized responses.
- Services: implement business rules, orchestrate transactions, aggregate data from multiple repositories, and handle cross-cutting concerns like auditing.
- Repositories: abstract persistence using Spring Data JPA, exposing query methods and derived queries.

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [HomeController.java](file://backend/src/main/java/com/ceb/billing/controllers/HomeController.java)
- [AlertService.java](file://backend/src/main/java/com/ceb/billing/services/AlertService.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)
- [ReportService.java](file://backend/src/main/java/com/ceb/billing/services/ReportService.java)
- [PredictionService.java](file://backend/src/main/java/com/ceb/billing/services/PredictionService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [DatabaseSeeder.java](file://backend/src/main/java/com/ceb/billing/services/DatabaseSeeder.java)
- [ImportTemplateSeedService.java](file://backend/src/main/java/com/ceb/billing/services/ImportTemplateSeedService.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)
- [BillingRecordRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingRecordRepository.java)
- [ApprovalRequestRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ApprovalRequestRepository.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [CostCodeRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CostCodeRepository.java)
- [ExpenseCodeRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ExpenseCodeRepository.java)
- [HeaderMappingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/HeaderMappingRepository.java)
- [ImportAuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportAuditLogRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [NetTypeRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/NetTypeRepository.java)
- [SheetConfigurationRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/SheetConfigurationRepository.java)
- [StagingChangeLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/StagingChangeLogRepository.java)
- [UploadHistoryRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UploadHistoryRepository.java)
- [ExcelTemplateRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ExcelTemplateRepository.java)

## Architecture Overview
The system implements a layered architecture with clear separation of concerns:
- Controllers receive HTTP requests, parse DTOs, and call services.
- Services implement business logic, orchestrate repository interactions, and may coordinate multiple repositories.
- Repositories provide data access through Spring Data JPA.
- Security is enforced via a JWT-based filter chain configured centrally.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Controller as "Controller"
participant Service as "Service"
participant Repo as "Repository"
participant DB as "Database"
Client->>Controller : "HTTP Request"
Controller->>Controller : "Validate DTOs"
Controller->>Service : "Invoke business method"
Service->>Repo : "Query/Update data"
Repo->>DB : "Execute SQL"
DB-->>Repo : "Result set"
Repo-->>Service : "Entity/DTO"
Service-->>Controller : "Business result"
Controller-->>Client : "HTTP Response"
```

**Diagram sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [AlertService.java](file://backend/src/main/java/com/ceb/billing/services/AlertService.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)

## Detailed Component Analysis

### Authentication and Authorization Flow
Authentication uses JWT tokens validated by a filter that integrates with Spring Security. The flow includes login, token issuance, and protected endpoint access.

```mermaid
sequenceDiagram
participant Client as "Client"
participant AuthCtrl as "AuthController"
participant UserSvc as "UserDetailsServiceImpl"
participant JwtUtil as "JwtUtils"
participant SecFilter as "AuthTokenFilter"
participant SecCfg as "WebSecurityConfig"
Client->>AuthCtrl : "POST /auth/login"
AuthCtrl->>UserSvc : "Load user by username"
UserSvc-->>AuthCtrl : "UserDetails"
AuthCtrl->>JwtUtil : "Generate JWT"
JwtUtil-->>AuthCtrl : "Token"
AuthCtrl-->>Client : "JwtResponse(token)"
Client->>SecFilter : "Protected request with Authorization header"
SecFilter->>JwtUtil : "Parse and validate token"
JwtUtil-->>SecFilter : "Claims"
SecFilter->>UserSvc : "Load UserDetails"
UserSvc-->>SecFilter : "UserDetails"
SecFilter-->>SecCfg : "Set SecurityContext"
SecCfg-->>Client : "Proceed to controller"
```

**Diagram sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)

### Customer Management Flow
A typical CRUD operation demonstrates controller-to-service-to-repository delegation.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Ctrl as "CustomerController"
participant Svc as "AlertService"
participant Repo as "AlertRepository"
participant DB as "Database"
Client->>Ctrl : "GET /customers/{id}"
Ctrl->>Svc : "findById(id)"
Svc->>Repo : "getById(id)"
Repo->>DB : "SELECT ..."
DB-->>Repo : "Row(s)"
Repo-->>Svc : "Entity"
Svc-->>Ctrl : "DTO"
Ctrl-->>Client : "200 OK + JSON"
```

**Diagram sources**
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertService.java](file://backend/src/main/java/com/ceb/billing/services/AlertService.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)

**Section sources**
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertService.java](file://backend/src/main/java/com/ceb/billing/services/AlertService.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)

### Excel Import Validation Flow
Excel import involves parsing, header validation, sheet validation, and workbook scanning orchestrated by services.

```mermaid
flowchart TD
Start(["Start Import"]) --> Parse["Parse Workbook<br/>ExcelParsingService"]
Parse --> ValidateHeaders["Validate Headers<br/>HeaderValidationService"]
ValidateHeaders --> ValidateSheets["Validate Sheets<br/>SheetValidationService"]
ValidateSheets --> Scan["Scan Workbook<br/>WorkbookScannerService"]
Scan --> ValidateRows["Row Validation<br/>ExcelValidationService"]
ValidateRows --> Preview["Generate Preview<br/>PreviewService"]
Preview --> End(["Return Results"])
```

**Diagram sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)

**Section sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [PreviewService.java](file://backend/src/main/java/com/ceb/billing/services/PreviewService.java)

### Multi-File Import Orchestration
Multi-file import coordinates sessions, batches, and staging records across multiple repositories.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Ctrl as "MultiFileImportController"
participant Svc as "MultiFileImportService"
participant SessionRepo as "ImportSessionRepository"
participant BatchRepo as "ImportBatchRepository"
participant StagingRepo as "BillingUploadStagingRepository"
Client->>Ctrl : "POST /imports/multi"
Ctrl->>Svc : "startImport(files)"
Svc->>SessionRepo : "create session"
loop For each file
Svc->>BatchRepo : "create batch"
Svc->>StagingRepo : "persist staged rows"
end
Svc-->>Ctrl : "session and batch IDs"
Ctrl-->>Client : "202 Accepted"
```

**Diagram sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)

**Section sources**
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ImportSessionRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportSessionRepository.java)
- [ImportBatchRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/ImportBatchRepository.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)

### Reporting and Prediction Integration
Reporting aggregates data across entities and exposes summaries; prediction service may integrate with external ML components.

```mermaid
sequenceDiagram
participant Client as "Client"
participant ReportCtrl as "ReportController"
participant ReportSvc as "ReportService"
participant PredCtrl as "PredictionController"
participant PredSvc as "PredictionService"
participant Repo as "Multiple Repositories"
Client->>ReportCtrl : "GET /reports/summary"
ReportCtrl->>ReportSvc : "buildSummary()"
ReportSvc->>Repo : "aggregate queries"
Repo-->>ReportSvc : "aggregated data"
ReportSvc-->>ReportCtrl : "report DTO"
ReportCtrl-->>Client : "200 OK + JSON"
Client->>PredCtrl : "POST /predictions/run"
PredCtrl->>PredSvc : "runPrediction(input)"
PredSvc-->>PredCtrl : "prediction result"
PredCtrl-->>Client : "200 OK + JSON"
```

**Diagram sources**
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [ReportService.java](file://backend/src/main/java/com/ceb/billing/services/ReportService.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [PredictionService.java](file://backend/src/main/java/com/ceb/billing/services/PredictionService.java)

**Section sources**
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [ReportService.java](file://backend/src/main/java/com/ceb/billing/services/ReportService.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [PredictionService.java](file://backend/src/main/java/com/ceb/billing/services/PredictionService.java)

### Domain Model Relationships
Entities capture core domain concepts and relationships relevant to billing, customers, alerts, approvals, audits, and import workflows.

```mermaid
erDiagram
USER {
uuid id PK
string username UK
string email UK
timestamp created_at
boolean active
}
CUSTOMER {
uuid id PK
string name
string code UK
timestamp created_at
}
ALERT {
uuid id PK
string message
enum severity
timestamp triggered_at
}
BILLING_RECORD {
uuid id PK
decimal amount
date billing_date
uuid customer_id FK
}
APPROVAL_REQUEST {
uuid id PK
enum status
text reason
timestamp requested_at
}
AUDIT_LOG {
uuid id PK
string action
uuid actor_id FK
timestamp occurred_at
}
BILLING_UPLOAD_STAGING {
uuid id PK
json payload
uuid batch_id FK
}
IMPORT_SESSION {
uuid id PK
enum state
timestamp started_at
}
IMPORT_BATCH {
uuid id PK
uuid session_id FK
int file_count
}
UPLOAD_HISTORY {
uuid id PK
uuid session_id FK
timestamp uploaded_at
}
STAGING_CHANGE_LOG {
uuid id PK
uuid staging_id FK
string change_type
timestamp changed_at
}
HEADER_MAPPING {
uuid id PK
string source_header
string target_field
}
SHEET_CONFIGURATION {
uuid id PK
string sheet_name
json settings
}
EXCEL_TEMPLATE {
uuid id PK
string template_name
json schema
}
COST_CODE {
uuid id PK
string code
string description
}
EXPENSE_CODE {
uuid id PK
string code
string description
}
NET_TYPE {
uuid id PK
string type_code
string label
}
IMPORT_AUDIT_LOG {
uuid id PK
uuid batch_id FK
string event
timestamp logged_at
}
USER ||--o{ AUDIT_LOG : "creates"
CUSTOMER ||--o{ BILLING_RECORD : "has"
IMPORT_SESSION ||--o{ IMPORT_BATCH : "contains"
IMPORT_BATCH ||--o{ BILLING_UPLOAD_STAGING : "stages"
IMPORT_BATCH ||--o{ IMPORT_AUDIT_LOG : "audits"
UPLOAD_HISTORY ||--|| IMPORT_SESSION : "belongs_to"
STAGING_CHANGE_LOG ||--|| BILLING_UPLOAD_STAGING : "tracks"
HEADER_MAPPING ||--o{ SHEET_CONFIGURATION : "used_by"
EXCEL_TEMPLATE ||--o{ SHEET_CONFIGURATION : "defines"
COST_CODE ||--o{ BILLING_RECORD : "categorizes"
EXPENSE_CODE ||--o{ BILLING_RECORD : "classifies"
NET_TYPE ||--o{ BILLING_RECORD : "types"
```

**Diagram sources**
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)
- [BillingRecord.java](file://backend/src/main/java/com/ceb/billing/entities/BillingRecord.java)
- [ApprovalRequest.java](file://backend/src/main/java/com/ceb/billing/entities/ApprovalRequest.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [CostCode.java](file://backend/src/main/java/com/ceb/billing/entities/CostCode.java)
- [ExpenseCode.java](file://backend/src/main/java/com/ceb/billing/entities/ExpenseCode.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [NetType.java](file://backend/src/main/java/com/ceb/billing/entities/NetType.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [StagingChangeLog.java](file://backend/src/main/java/com/ceb/billing/entities/StagingChangeLog.java)
- [UploadHistory.java](file://backend/src/main/java/com/ceb/billing/entities/UploadHistory.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)

**Section sources**
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)
- [BillingRecord.java](file://backend/src/main/java/com/ceb/billing/entities/BillingRecord.java)
- [ApprovalRequest.java](file://backend/src/main/java/com/ceb/billing/entities/ApprovalRequest.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [CostCode.java](file://backend/src/main/java/com/ceb/billing/entities/CostCode.java)
- [ExpenseCode.java](file://backend/src/main/java/com/ceb/billing/entities/ExpenseCode.java)
- [HeaderMapping.java](file://backend/src/main/java/com/ceb/billing/entities/HeaderMapping.java)
- [ImportAuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/ImportAuditLog.java)
- [ImportBatch.java](file://backend/src/main/java/com/ceb/billing/entities/ImportBatch.java)
- [ImportSession.java](file://backend/src/main/java/com/ceb/billing/entities/ImportSession.java)
- [NetType.java](file://backend/src/main/java/com/ceb/billing/entities/NetType.java)
- [SheetConfiguration.java](file://backend/src/main/java/com/ceb/billing/entities/SheetConfiguration.java)
- [StagingChangeLog.java](file://backend/src/main/java/com/ceb/billing/entities/StagingChangeLog.java)
- [UploadHistory.java](file://backend/src/main/java/com/ceb/billing/entities/UploadHistory.java)
- [ExcelTemplate.java](file://backend/src/main/java/com/ceb/billing/entities/ExcelTemplate.java)

## Dependency Analysis
The application relies on Spring Boot starters for web, security, JPA, and validation. Controllers depend on services; services depend on repositories and other services; repositories depend on Spring Data JPA and entity mappings.

```mermaid
graph LR
A["Controllers"] --> B["Services"]
B --> C["Repositories"]
C --> D["Entities"]
E["Config (Security, JWT)"] --> A
F["Models (DTOs)"] --> A
F --> B
```

**Diagram sources**
- [pom.xml](file://backend/pom.xml)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)

**Section sources**
- [pom.xml](file://backend/pom.xml)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)

## Performance Considerations
- Database indexing: Ensure indexes on frequently queried columns (e.g., foreign keys, filters).
- Pagination and projections: Use page-based APIs and DTO projections to reduce payload size.
- Connection pooling: Tune HikariCP parameters for throughput and latency.
- Caching: Apply caching for read-heavy endpoints (e.g., lookups, templates).
- Asynchronous processing: Offload heavy tasks (e.g., large Excel imports, report generation) to background workers.
- Query optimization: Avoid N+1 selects by using joins or fetch profiles; prefer batched writes for imports.
- File I/O: Stream large files and limit memory footprint during parsing.
- Concurrency: Use thread pools judiciously and avoid blocking operations in request threads.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common areas to inspect:
- Authentication failures: Verify JWT configuration, token validity, and filter chain order.
- Authorization errors: Check role-based access rules and entry point handlers.
- Validation errors: Review DTO constraints and Excel validation messages.
- Import issues: Inspect staging logs, batch states, and session progress.
- Repository errors: Examine generated SQL, transaction boundaries, and constraint violations.

Operational checks:
- Confirm application properties for datasource, JPA, and security settings.
- Validate seed data and initial configurations.
- Monitor logs for exceptions and slow queries.

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [application.properties](file://backend/src/main/resources/application.properties)
- [DatabaseSeeder.java](file://backend/src/main/java/com/ceb/billing/services/DatabaseSeeder.java)
- [ImportTemplateSeedService.java](file://backend/src/main/java/com/ceb/billing/services/ImportTemplateSeedService.java)

## Conclusion
The backend follows a clean layered architecture with explicit separation between presentation, business logic, and data access. Dependency injection enables modular composition, while JWT-based security secures endpoints. The design supports scalable growth through asynchronous processing, caching, and optimized queries. Clear DTO contracts and comprehensive services facilitate maintainability and testability.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Bootstrap Process
- Application class initializes the Spring Boot context.
- Security configuration registers JWT filter and defines access rules.
- User details service loads users for authentication.
- Seed services initialize reference data and templates.

**Section sources**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [DatabaseSeeder.java](file://backend/src/main/java/com/ceb/billing/services/DatabaseSeeder.java)
- [ImportTemplateSeedService.java](file://backend/src/main/java/com/ceb/billing/services/ImportTemplateSeedService.java)

### Configuration Management
- Runtime configuration resides in application properties.
- Security settings include JWT secret, expiration, and path exclusions.
- DataSource and JPA settings control database connectivity and schema behavior.

**Section sources**
- [application.properties](file://backend/src/main/resources/application.properties)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)

### Error Handling Strategies
- Centralized exception handling returns consistent error responses.
- Validation errors are captured in structured DTOs for clients.
- Security exceptions are handled by dedicated entry points and access denied handlers.

**Section sources**
- [ExcelValidationError.java](file://backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)

### API Design Principles
- RESTful resource naming and HTTP verbs.
- Stateless interactions with JWT bearer tokens.
- Consistent response envelopes and error formats.
- Versioning strategy for future evolution.

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)

### Integration Patterns
- External ML or analytics services can be integrated via HTTP clients within prediction/report services.
- Background jobs for long-running imports and report generation.
- Event-driven updates using application events or messaging for audit and notifications.

**Section sources**
- [PredictionService.java](file://backend/src/main/java/com/ceb/billing/services/PredictionService.java)
- [ReportService.java](file://backend/src/main/java/com/ceb/billing/services/ReportService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)