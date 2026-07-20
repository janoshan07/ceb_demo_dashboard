# Layered Architecture Patterns

<cite>
**Referenced Files in This Document**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
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
This document explains the layered architecture implementation across controllers (presentation), services (business logic), and repositories (data access). It details request flow, error propagation, transaction boundaries, DTO usage, validation strategies, and cross-cutting concerns such as logging and auditing. It also highlights common anti-patterns and how to avoid them.

## Project Structure
The backend follows a conventional Spring Boot layered structure:
- Presentation layer: Controllers under controllers package
- Business logic: Services under services package
- Data access: Repositories under repositories package
- Domain models: Entities under entities package
- API contracts: DTOs under models package
- Cross-cutting: Security configuration and utilities under config package

```mermaid
graph TB
subgraph "Presentation"
AC["AuthController"]
CC["CustomerController"]
AL["AlertController"]
end
subgraph "Business Logic"
AUD["AuditLogService"]
EPS["ExcelParsingService"]
MFI["MultiFileImportService"]
end
subgraph "Data Access"
UR["UserRepository"]
AR["AlertRepository"]
CR["CustomerRepository"]
end
subgraph "Domain Models"
U["User"]
A["Alert"]
C["Customer"]
end
subgraph "API Contracts"
LR["LoginRequest"]
JR["JwtResponse"]
MR["MessageResponse"]
end
subgraph "Cross-Cutting"
SEC["WebSecurityConfig"]
F["AuthTokenFilter"]
JWT["JwtUtils"]
UDS["UserDetailsServiceImpl"]
end
AC --> UDS
AC --> UR
CC --> CR
AL --> AR
CC --> AUD
MFI --> EPS
EPS --> UR
EPS --> CR
EPS --> AR
UDS --> UR
SEC --> F
F --> JWT
```

**Diagram sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)

**Section sources**
- [BillingApplication.java](file://backend/src/main/java/com/ceb/billing/BillingApplication.java)

## Core Components
- Controllers expose HTTP endpoints and delegate business operations to services. They accept DTOs and return DTOs or standard responses.
- Services encapsulate business rules, orchestrate multiple repositories, and manage transactions where appropriate.
- Repositories abstract persistence using Spring Data interfaces over entity models.
- DTOs decouple API contracts from domain entities and enable validation at the boundary.
- Security components handle authentication and authorization via JWT.

Key responsibilities by layer:
- Presentation: route mapping, input binding, response shaping, basic validation annotations on DTOs
- Business: use cases, orchestration, audit logging, transaction demarcation
- Data: CRUD and query methods; no business logic

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)

## Architecture Overview
End-to-end request flow with security and auditing:

```mermaid
sequenceDiagram
participant Client as "Client"
participant Controller as "AuthController"
participant Service as "UserDetailsServiceImpl"
participant Repo as "UserRepository"
participant Sec as "WebSecurityConfig"
participant Filter as "AuthTokenFilter"
participant Utils as "JwtUtils"
Client->>Sec : "HTTP Request"
Sec->>Filter : "Invoke filter chain"
Filter->>Utils : "Validate token"
Utils-->>Filter : "Claims or error"
Filter->>Controller : "Proceed if valid"
Controller->>Service : "Authenticate(dto)"
Service->>Repo : "findByUsername(username)"
Repo-->>Service : "User entity"
Service-->>Controller : "Authentication result"
Controller-->>Client : "JWT Response"
```

**Diagram sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)

## Detailed Component Analysis

### Authentication Flow (Controllers → Security → Repository)
- AuthController accepts login DTO and delegates to service for user lookup and credential verification.
- WebSecurityConfig registers the JWT filter; AuthTokenFilter validates tokens and JwtUtils parses claims.
- UserRepository provides data access to User entity.

```mermaid
classDiagram
class AuthController {
+login(request)
+register(request)
}
class UserDetailsServiceImpl {
+loadUserByUsername(username)
}
class UserRepository {
+findByUsername(username)
}
class WebSecurityConfig {
+configure(http)
}
class AuthTokenFilter {
+doFilterInternal(request,response,chain)
}
class JwtUtils {
+validateToken(token)
+getUsernameFromToken(token)
}
class LoginRequest
class JwtResponse
AuthController --> UserDetailsServiceImpl : "delegates"
UserDetailsServiceImpl --> UserRepository : "queries"
WebSecurityConfig --> AuthTokenFilter : "registers"
AuthTokenFilter --> JwtUtils : "uses"
AuthController --> LoginRequest : "accepts"
AuthController --> JwtResponse : "returns"
```

**Diagram sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)

### Customer Management Flow (Controller → Service → Repository)
- CustomerController exposes endpoints and delegates to services for business operations.
- AuditLogService can be invoked by services to record actions.
- CustomerRepository persists Customer entities.

```mermaid
sequenceDiagram
participant Client as "Client"
participant CC as "CustomerController"
participant Svc as "AuditLogService"
participant Repo as "CustomerRepository"
Client->>CC : "POST /customers"
CC->>Svc : "logAction(action,user,data)"
CC->>Repo : "save(customerDto)"
Repo-->>CC : "persisted entity"
CC-->>Client : "MessageResponse"
```

**Diagram sources**
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)

**Section sources**
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)

### Alert Reporting Flow (Controller → Repository)
- AlertController interacts with AlertRepository to retrieve alert data.

```mermaid
flowchart TD
Start(["GET /alerts"]) --> CallRepo["Call AlertRepository.findAll()"]
CallRepo --> MapDTO["Map to DTOs"]
MapDTO --> Return(["Return List<AlertDTO>"])
```

**Diagram sources**
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)

**Section sources**
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)

### Excel Import Orchestration (Services → Repositories)
- MultiFileImportService orchestrates parsing and import flows.
- ExcelParsingService performs workbook scanning and row processing.
- Both coordinate with repositories to persist staging and final records.

```mermaid
sequenceDiagram
participant Client as "Client"
participant MFI as "MultiFileImportService"
participant EPS as "ExcelParsingService"
participant UR as "UserRepository"
participant CR as "CustomerRepository"
participant AR as "AlertRepository"
Client->>MFI : "upload(files)"
MFI->>EPS : "scanAndParse(files)"
EPS->>UR : "lookup users"
EPS->>CR : "lookup customers"
EPS->>AR : "create alerts"
EPS-->>MFI : "results"
MFI-->>Client : "import summary"
```

**Diagram sources**
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)

**Section sources**
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)

### DTO Pattern and Validation Strategy
- Controllers accept DTOs (e.g., LoginRequest) and return DTOs (e.g., JwtResponse, MessageResponse).
- Validation is applied at the controller boundary using DTO constraints.
- Mapping between DTOs and entities occurs in services or controllers as needed.

```mermaid
classDiagram
class LoginRequest {
+username
+password
}
class JwtResponse {
+token
+user
}
class MessageResponse {
+message
}
class User
class Customer
class Alert
LoginRequest <.. AuthController : "input"
JwtResponse ..> AuthController : "output"
MessageResponse ..> CustomerController : "output"
User <.. UserRepository : "persists"
Customer <.. CustomerRepository : "persists"
Alert <.. AlertRepository : "persists"
```

**Diagram sources**
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)

**Section sources**
- [LoginRequest.java](file://backend/src/main/java/com/ceb/billing/models/LoginRequest.java)
- [JwtResponse.java](file://backend/src/main/java/com/ceb/billing/models/JwtResponse.java)
- [MessageResponse.java](file://backend/src/main/java/com/ceb/billing/models/MessageResponse.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)

## Dependency Analysis
Layered dependencies are unidirectional:
- Controllers depend on Services and/or Repositories
- Services depend on Repositories and other Services
- Repositories depend only on Entities
- Security components depend on Utilities and Repositories

```mermaid
graph LR
Controllers["Controllers"] --> Services["Services"]
Services --> Repos["Repositories"]
Repos --> Entities["Entities"]
Security["Security Config & Filters"] --> Utils["JwtUtils"]
Security --> Repos
```

**Diagram sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)

**Section sources**
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [ExcelParsingService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelParsingService.java)
- [MultiFileImportService.java](file://backend/src/main/java/com/ceb/billing/services/MultiFileImportService.java)
- [UserRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/UserRepository.java)
- [AlertRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AlertRepository.java)
- [CustomerRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/CustomerRepository.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [Alert.java](file://backend/src/main/java/com/ceb/billing/entities/Alert.java)
- [Customer.java](file://backend/src/main/java/com/ceb/billing/entities/Customer.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)

## Performance Considerations
- Prefer repository queries that fetch only required fields to reduce payload size.
- Use pagination for list endpoints to limit memory and database load.
- Cache frequently accessed reference data (e.g., lookups) at the service layer.
- Avoid N+1 queries by using joins or batch fetching in repository methods.
- Keep DTO mappings lightweight; consider projection interfaces where applicable.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication failures:
  - Verify JWT signature and expiration handling in the filter and utils.
  - Ensure user lookup returns expected fields and credentials match.
- Validation errors:
  - Confirm DTO constraints are defined and controller endpoints trigger validation.
  - Inspect global exception handlers for consistent error responses.
- Transaction issues:
  - Ensure service methods performing writes are annotated for transactional behavior.
  - Check rollback conditions for business exceptions.
- Auditing gaps:
  - Validate that critical mutations call the audit service consistently.

**Section sources**
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)

## Conclusion
The codebase demonstrates a clear separation of concerns across presentation, business, and data layers. Controllers focus on HTTP concerns and delegation, services encapsulate orchestration and business rules, and repositories provide clean persistence abstractions. DTOs enforce stable APIs and validation at boundaries. Security is integrated via filters and utilities, while auditing is available as a reusable service. Following these patterns helps maintain testability, scalability, and clarity.

[No sources needed since this section summarizes without analyzing specific files]