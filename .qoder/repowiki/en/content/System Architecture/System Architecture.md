# System Architecture

<cite>
**Referenced Files in This Document**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [application.properties](file://backend/src/main/resources/application.properties)
- [pom.xml](file://backend/pom.xml)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [WorkbookScannerService.java](file://backend/src/main/java/com/ceb/billing/services/WorkbookScannerService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [BillingRecordRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingRecordRepository.java)
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [BillingRecord.java](file://backend/src/main/java/com/ceb/billing/entities/BillingRecord.java)
- [UploadHistoryRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UploadHistoryRepository.java)
- [UploadHistory.java](file://backend/src/main/java/com/ceb/billing/entities/UploadHistory.java)
- [App.jsx](file://frontend/src/App.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [package.json](file://frontend/package.json)
- [vite.config.js](file://frontend/vite.config.js)
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
This document describes the architecture of the CEB Billing System, a layered application with a React frontend and a Spring Boot backend. The system supports user authentication via JWT, Excel file upload and validation, staging-based processing, and persistence through JPA repositories. It also outlines API communication patterns, security design, data flow from upload to final processing, scalability considerations, deployment topology, and technology stack decisions.

## Project Structure
The repository is organized into two primary modules:
- Backend (Spring Boot): Controllers, services, entities, repositories, configuration, and utilities.
- Frontend (React + Vite): Pages, components, context providers, and build configuration.

```mermaid
graph TB
subgraph "Frontend"
FE_App["App.jsx"]
FE_AuthCtx["AuthContext.jsx"]
FE_Login["Login.jsx"]
FE_Upload["UploadPage.jsx"]
end
subgraph "Backend"
BE_App["BillingApplication.java"]
BE_Security["WebSecurityConfig.java"]
BE_Filter["AuthTokenFilter.java"]
BE_JWT["JwtUtils.java"]
BE_AuthCtrl["AuthController.java"]
BE_ExcelCtrl["ExcelImportValidationController.java"]
BE_MultiCtrl["MultiFileImportController.java"]
BE_ParseSvc["ExcelParsingService.java"]
BE_ValidSvc["ExcelValidationService.java"]
BE_HeaderSvc["HeaderValidationService.java"]
BE_SheetSvc["SheetValidationService.java"]
BE_StagingSvc["StagingMigrationService.java"]
BE_StagingRepo["BillingUploadStagingRepository.java"]
BE_RecordRepo["BillingRecordRepository.java"]
BE_HistoryRepo["UploadHistoryRepository.java"]
end
FE_App --> FE_AuthCtx
FE_App --> FE_Login
FE_App --> FE_Upload
FE_Login --> BE_AuthCtrl
FE_Upload --> BE_ExcelCtrl
FE_Upload --> BE_MultiCtrl
BE_AuthCtrl --> BE_Security
BE_AuthCtrl --> BE_Filter
BE_AuthCtrl --> BE_JWT
BE_ExcelCtrl --> BE_ParseSvc
BE_ExcelCtrl --> BE_ValidSvc
BE_ExcelCtrl --> BE_HeaderSvc
BE_ExcelCtrl --> BE_SheetSvc
BE_MultiCtrl --> BE_ParseSvc
BE_MultiCtrl --> BE_ValidSvc
BE_ParseSvc --> BE_StagingSvc
BE_ValidSvc --> BE_StagingSvc
BE_StagingSvc --> BE_StagingRepo
BE_StagingSvc --> BE_RecordRepo
BE_StagingSvc --> BE_HistoryRepo
```

**Diagram sources**
- [App.jsx](file://frontend/src/App.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [BillingRecordRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingRecordRepository.java)
- [UploadHistoryRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UploadHistoryRepository.java)

**Section sources**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [application.properties](file://backend/src/main/resources/application.properties)
- [pom.xml](file://backend/pom.xml)
- [App.jsx](file://frontend/src/App.jsx)
- [package.json](file://frontend/package.json)
- [vite.config.js](file://frontend/vite.config.js)

## Core Components
- Presentation Layer (React)
  - App shell and routing entry points.
  - Authentication context for token management.
  - Login page for credential submission.
  - Upload page for initiating Excel imports.
- Business Logic Layer (Spring Boot Services)
  - Excel parsing and validation services.
  - Staging migration service orchestrating writes to staging and final tables.
  - Header and sheet validation services ensuring schema compliance.
- Data Access Layer (JPA Repositories)
  - Repository interfaces for staging records, billing records, and upload history.
- Security Layer
  - Web security configuration, JWT filter, and utility methods for token handling.
  - User details service backed by UserRepository.

Key responsibilities:
- Controllers expose REST endpoints for authentication and file operations.
- Services encapsulate business rules for parsing, validating, and migrating data.
- Repositories provide persistence abstractions over the database.

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [BillingRecordRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingRecordRepository.java)
- [UploadHistoryRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UploadHistoryRepository.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)

## Architecture Overview
The system follows a layered architecture:
- Presentation: React SPA served by Vite; communicates with backend via HTTP.
- Application/API: Spring Boot controllers handle requests, enforce security, and delegate to services.
- Domain/Services: Business logic for Excel processing, validation, and staging migration.
- Infrastructure/Data: JPA repositories persist data to the relational database.

```mermaid
graph TB
Client["Browser (React SPA)"] --> API["Spring Boot API"]
API --> Sec["Security Filter Chain<br/>JWT Validation"]
API --> Svc["Business Services"]
Svc --> Repo["JPA Repositories"]
Repo --> DB[(Relational Database)]
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [BillingRecordRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingRecordRepository.java)

## Detailed Component Analysis

### Authentication and Authorization Flow
- The React login page submits credentials to the backend authentication controller.
- The backend validates credentials using a user details service backed by a repository.
- On success, a JWT is issued and returned to the client.
- Subsequent requests include the JWT; a security filter intercepts and validates tokens before reaching controllers.

```mermaid
sequenceDiagram
participant FE as "Frontend (Login.jsx)"
participant AuthC as "AuthController.java"
participant UDS as "UserDetailsServiceImpl.java"
participant UR as "UserRepository.java"
participant Sec as "WebSecurityConfig.java"
participant Filt as "AuthTokenFilter.java"
participant JWT as "JwtUtils.java"
FE->>AuthC : "POST /auth/login"
AuthC->>UDS : "loadUserByUsername(username)"
UDS->>UR : "findByUsername(username)"
UR-->>UDS : "User entity"
AuthC->>JWT : "generateToken(user)"
JWT-->>AuthC : "JWT string"
AuthC-->>FE : "{token}"
FE->>Sec : "GET /api/protected"
Sec->>Filt : "doFilter(request)"
Filt->>JWT : "parseAndValidate(token)"
JWT-->>Filt : "Authenticated principal"
Filt-->>Sec : "Proceed if valid"
```

**Diagram sources**
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [Login.jsx](file://frontend/src/pages/Login.jsx)

### File Upload and Validation Pipeline
- The frontend upload page triggers an import endpoint on the backend.
- A controller delegates to parsing and validation services.
- Parsed rows are validated against headers and sheet schemas.
- Validated data is persisted to staging; optional migration moves data to final tables.

```mermaid
flowchart TD
Start(["Upload Request"]) --> Parse["Parse Workbook<br/>ExcelParsingService"]
Parse --> ValidateHeaders["Validate Headers<br/>HeaderValidationService"]
ValidateHeaders --> ValidateSheet["Validate Sheet Schema<br/>SheetValidationService"]
ValidateSheet --> ValidateRows["Row-Level Validation<br/>ExcelValidationService"]
ValidateRows --> PersistStaging["Persist to Staging<br/>BillingUploadStagingRepository"]
PersistStaging --> Migrate["Migrate to Final Tables<br/>StagingMigrationService"]
Migrate --> End(["Complete"])
```

**Diagram sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)

**Section sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)

### Data Models and Persistence
- Staging model captures raw uploaded rows for review and audit.
- Final billing records represent processed and approved entries.
- Upload history tracks sessions and batches for traceability.

```mermaid
erDiagram
BILLING_UPLOAD_STAGING {
int id PK
text content
timestamp created_at
}
BILLING_RECORD {
int id PK
decimal amount
date billing_date
text customer_ref
}
UPLOAD_HISTORY {
int id PK
text filename
timestamp uploaded_at
text status
}
BILLING_UPLOAD_STAGING ||--o{ BILLING_RECORD : "migrated to"
UPLOAD_HISTORY ||--o{ BILLING_UPLOAD_STAGING : "tracks"
```

**Diagram sources**
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [BillingRecord.java](file://backend/src/main/java/com/ceb/billing/entities/BillingRecord.java)
- [UploadHistory.java](file://backend/src/main/java/com/ceb/billing/entities/UploadHistory.java)

**Section sources**
- [BillingUploadStaging.java](file://backend/src/main/java/com/ceb/billing/entities/BillingUploadStaging.java)
- [BillingRecord.java](file://backend/src/main/java/com/ceb/billing/entities/BillingRecord.java)
- [UploadHistory.java](file://backend/src/main/java/com/ceb/billing/entities/UploadHistory.java)
- [BillingUploadStagingRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingUploadStagingRepository.java)
- [BillingRecordRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/BillingRecordRepository.java)
- [UploadHistoryRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UploadHistoryRepository.java)

### Security Architecture
- JWT-based stateless authentication.
- Centralized security configuration defines protected routes and allowed origins.
- Token filter extracts and validates JWTs before request dispatch.
- User details service loads users from the database.

```mermaid
classDiagram
class WebSecurityConfig {
+configure(http) void
}
class AuthTokenFilter {
+doFilter(request, response, chain) void
}
class JwtUtils {
+generateToken(user) String
+validateToken(token) boolean
}
class UserDetailsServiceImpl {
+loadUserByUsername(username) UserDetails
}
class UserRepository {
+findByUsername(username) Optional~User~
}
WebSecurityConfig --> AuthTokenFilter : "registers"
AuthTokenFilter --> JwtUtils : "uses"
UserDetailsServiceImpl --> UserRepository : "queries"
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)

### Frontend Integration Points
- React app initializes authentication context and renders pages.
- Login page posts credentials and stores the token.
- Upload page sends files to import endpoints and displays results.

```mermaid
sequenceDiagram
participant FE_App as "App.jsx"
participant FE_Auth as "AuthContext.jsx"
participant FE_Login as "Login.jsx"
participant FE_Upload as "UploadPage.jsx"
participant BE_Auth as "AuthController.java"
participant BE_Excel as "ExcelImportValidationController.java"
FE_App->>FE_Auth : "Initialize auth state"
FE_Login->>BE_Auth : "POST /auth/login"
BE_Auth-->>FE_Login : "JWT"
FE_Auth->>FE_Auth : "Store token"
FE_Upload->>BE_Excel : "POST /api/excel/import"
BE_Excel-->>FE_Upload : "Validation results"
```

**Diagram sources**
- [App.jsx](file://frontend/src/App.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)

**Section sources**
- [App.jsx](file://frontend/src/App.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)

## Dependency Analysis
Technology stack and module dependencies:
- Backend uses Spring Boot, Spring Security, JPA/Hibernate, and likely Apache POI for Excel processing.
- Frontend uses React with Vite for development and bundling.

```mermaid
graph LR
FE["Frontend (React + Vite)"] --> |HTTP/JSON| BE["Backend (Spring Boot)"]
BE --> SEC["Spring Security + JWT"]
BE --> SVC["Services (Parsing/Validation/Migration)"]
SVC --> REPO["JPA Repositories"]
REPO --> DB["Database"]
```

**Diagram sources**
- [package.json](file://frontend/package.json)
- [vite.config.js](file://frontend/vite.config.js)
- [pom.xml](file://backend/pom.xml)
- [application.properties](file://backend/src/main/resources/application.properties)

**Section sources**
- [package.json](file://frontend/package.json)
- [vite.config.js](file://frontend/vite.config.js)
- [pom.xml](file://backend/pom.xml)
- [application.properties](file://backend/src/main/resources/application.properties)

## Performance Considerations
- Use pagination and filtering on list endpoints to reduce payload sizes.
- Batch inserts for staging and final tables to minimize round trips.
- Stream large Excel workbooks where possible to avoid high memory usage.
- Cache frequently accessed reference data (e.g., lookup codes) at the service layer.
- Enable connection pooling and tune Hibernate settings for optimal throughput.
- Consider asynchronous processing for long-running imports using background jobs.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common areas to inspect:
- Authentication failures: verify JWT generation and filter configuration.
- CORS issues: ensure allowed origins and methods are configured.
- Excel parsing errors: check header mapping and sheet schema validations.
- Staging vs final table mismatches: validate migration logic and constraints.
- Database connectivity: confirm datasource properties and credentials.

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [StagingMigrationService.java](file://backend/src/main/java/com/ceb/billing/services/StagingMigrationService.java)
- [application.properties](file://backend/src/main/resources/application.properties)

## Conclusion
The CEB Billing System employs a clear layered architecture with strong separation between presentation, business logic, and data access. JWT secures APIs, while robust validation and staging-based processing ensure data integrity. The modular design supports horizontal scaling and straightforward deployment. Future enhancements can include async job queues, caching layers, and comprehensive monitoring.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Deployment Topology
- Frontend: Static site served by a web server or CDN.
- Backend: Stateless Spring Boot service behind a reverse proxy/load balancer.
- Database: Managed relational database with connection pooling.
- Optional: Message broker for background processing of large imports.

```mermaid
graph TB
LB["Load Balancer"] --> BE1["Backend Instance 1"]
LB --> BE2["Backend Instance 2"]
BE1 --> DB[(Database)]
BE2 --> DB
FE["Frontend (CDN)"] --> LB
```

[No sources needed since this diagram shows conceptual deployment topology]