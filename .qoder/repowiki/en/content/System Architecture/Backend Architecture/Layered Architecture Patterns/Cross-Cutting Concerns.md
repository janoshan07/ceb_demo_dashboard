# Cross-Cutting Concerns

<cite>
**Referenced Files in This Document**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [application.properties](file://backend/src/main/resources/application.properties)
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
This document explains how cross-cutting concerns are implemented across the application layers, focusing on security, logging and auditing, validation, centralized error handling, interceptor patterns, configuration management, environment-specific settings, and monitoring integration. It provides concrete examples from WebSecurityConfig and AuditLogService to illustrate consistent application of these concerns throughout the system.

## Project Structure
Cross-cutting concerns are primarily implemented under:
- Security configuration and filters under config
- Auditing service and repository under services and repositories
- Validation services and controller under services and controllers
- Centralized error handling via authentication entry point and access denied handler
- Configuration properties under resources

```mermaid
graph TB
subgraph "Security"
WSC["WebSecurityConfig"]
ATF["AuthTokenFilter"]
AEP["AuthEntryPointJwt"]
ADH["AuthAccessDeniedHandler"]
UDS["UserDetailsServiceImpl"]
UDI["UserDetailsImpl"]
end
subgraph "Auditing"
ALS["AuditLogService"]
ALR["AuditLogRepository"]
ALE["AuditLog"]
end
subgraph "Validation"
EVS["ExcelValidationService"]
HVS["HeaderValidationService"]
SVS["SheetValidationService"]
EIVC["ExcelImportValidationController"]
end
subgraph "Configuration"
APP["application.properties"]
end
WSC --> ATF
ATF --> UDS
ATF --> AEP
ATF --> ADH
ALS --> ALR
ALS --> ALE
EIVC --> EVS
EVS --> HVS
EVS --> SVS
WSC -. reads .-> APP
ALS -. uses .-> APP
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [application.properties](file://backend/src/main/resources/application.properties)

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [application.properties](file://backend/src/main/resources/application.properties)

## Core Components
- Security layer: JWT-based authentication and authorization with a filter chain, custom entry point for unauthorized requests, and an access denied handler for insufficient permissions.
- Auditing layer: Centralized audit logging service that persists audit events using a dedicated entity and repository.
- Validation layer: Dedicated services for Excel header and sheet validation, orchestrated by a controller endpoint.
- Error handling: Centralized responses for authentication failures and authorization denials.
- Configuration: Environment-driven settings for security tokens, CORS, and feature toggles.

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [application.properties](file://backend/src/main/resources/application.properties)

## Architecture Overview
The request lifecycle integrates cross-cutting concerns as follows:
- Incoming HTTP requests pass through a JWT authentication filter before reaching controllers.
- On authentication or authorization failure, centralized handlers return standardized error responses.
- Controllers invoke business services; auditing is applied centrally via the audit service.
- Validation endpoints orchestrate multiple validation services to ensure data integrity.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Filter as "AuthTokenFilter"
participant SecCfg as "WebSecurityConfig"
participant Controller as "Controller"
participant Service as "Business Service"
participant Audit as "AuditLogService"
participant Repo as "AuditLogRepository"
Client->>Filter : "HTTP Request"
Filter->>SecCfg : "Validate JWT and roles"
alt "Unauthorized"
Filter-->>Client : "401 Unauthorized"
else "Forbidden"
Filter-->>Client : "403 Forbidden"
else "Authenticated"
Filter->>Controller : "Proceed"
Controller->>Service : "Invoke operation"
Service->>Audit : "Record audit event"
Audit->>Repo : "Persist audit log"
Repo-->>Audit : "Persisted"
Service-->>Controller : "Result"
Controller-->>Client : "Response"
end
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)

## Detailed Component Analysis

### Security Layer (JWT Authentication and Authorization)
- WebSecurityConfig defines the security filter chain, URL rules, and integration with the JWT filter.
- AuthTokenFilter intercepts requests, validates JWT tokens, sets the security context, and delegates to the user details service.
- AuthEntryPointJwt handles unauthorized access (e.g., missing or invalid token).
- AuthAccessDeniedHandler handles forbidden access (e.g., insufficient roles).
- UserDetailsServiceImpl loads user details and authorities from persistence.
- UserDetailsImpl represents the authenticated principal used by Spring Security.

```mermaid
classDiagram
class WebSecurityConfig {
+configure(http) void
+filterChain() FilterChain
}
class AuthTokenFilter {
+doFilterInternal(request, response, chain) void
}
class AuthEntryPointJwt {
+commence(request, response, authException) void
}
class AuthAccessDeniedHandler {
+handle(request, response, accessDeniedException) void
}
class UserDetailsServiceImpl {
+loadUserByUsername(username) UserDetails
}
class UserDetailsImpl {
+getAuthorities() Collection~GrantedAuthority~
}
WebSecurityConfig --> AuthTokenFilter : "registers"
WebSecurityConfig --> AuthEntryPointJwt : "uses"
WebSecurityConfig --> AuthAccessDeniedHandler : "uses"
AuthTokenFilter --> UserDetailsServiceImpl : "loads user"
UserDetailsServiceImpl --> UserDetailsImpl : "returns"
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)

### Auditing Layer (Centralized Logging and Persistence)
- AuditLogService encapsulates audit event creation and persistence.
- AuditLogRepository provides data access for audit records.
- AuditLog entity models the persisted audit record fields.

```mermaid
classDiagram
class AuditLogService {
+createEvent(action, actor, target, details) void
}
class AuditLogRepository {
+save(auditLog) void
}
class AuditLog {
+id
+action
+actor
+target
+details
+timestamp
}
AuditLogService --> AuditLogRepository : "persists"
AuditLogService --> AuditLog : "creates"
```

**Diagram sources**
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)

**Section sources**
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)

### Validation Layer (Excel Import Validation)
- ExcelImportValidationController exposes endpoints for validating uploaded Excel files.
- ExcelValidationService orchestrates validation logic and aggregates results.
- HeaderValidationService validates column headers against expected templates.
- SheetValidationService validates sheet-level constraints and row-level rules.

```mermaid
flowchart TD
Start(["Request to validate Excel"]) --> Controller["ExcelImportValidationController"]
Controller --> Orchestrator["ExcelValidationService"]
Orchestrator --> Headers["HeaderValidationService"]
Orchestrator --> Sheets["SheetValidationService"]
Headers --> Results["Validation Results"]
Sheets --> Results
Results --> Response["Return validation report"]
```

**Diagram sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

**Section sources**
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

### Interceptor Pattern and Aspect-Oriented Programming
- Interceptor pattern: AuthTokenFilter implements the servlet filter pattern to intercept all incoming requests, perform JWT validation, and enforce role-based access before controllers execute.
- Aspect-oriented programming: While no explicit AOP classes are present in the referenced files, the design encourages centralizing cross-cutting behavior in filters and services (e.g., AuditLogService) rather than scattering it across controllers. If future needs arise, AOP can be layered atop these services for uniform logging and metrics.

**Section sources**
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)

### Centralized Error Handling
- Unauthorized errors: AuthEntryPointJwt returns standardized 401 responses when authentication fails.
- Forbidden errors: AuthAccessDeniedHandler returns standardized 403 responses when authorization fails.
- These handlers ensure consistent error shapes and status codes across the API surface.

**Section sources**
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)

### Configuration Management and Environment-Specific Settings
- application.properties holds runtime configuration such as JWT secret, token expiration, CORS origins, and other feature flags.
- Security components read these properties to configure token verification and URL rules.
- Auditing and validation services may also consume configuration for thresholds, allowed headers, and template identifiers.

**Section sources**
- [application.properties](file://backend/src/main/resources/application.properties)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)

### Monitoring Integration Patterns
- Auditing: Persisted audit logs provide a foundation for operational monitoring and compliance reporting.
- Security: Centralized error handlers produce consistent signals for failed authentication and authorization attempts.
- Validation: Validation reports expose structured outcomes suitable for dashboards and alerts.

[No sources needed since this section provides general guidance]

## Dependency Analysis
The following diagram shows key dependencies among cross-cutting components:

```mermaid
graph LR
WSC["WebSecurityConfig"] --> ATF["AuthTokenFilter"]
ATF --> UDS["UserDetailsServiceImpl"]
ATF --> AEP["AuthEntryPointJwt"]
ATF --> ADH["AuthAccessDeniedHandler"]
CTRL["Controllers"] --> ALS["AuditLogService"]
ALS --> ALR["AuditLogRepository"]
ALS --> ALE["AuditLog"]
EIVC["ExcelImportValidationController"] --> EVS["ExcelValidationService"]
EVS --> HVS["HeaderValidationService"]
EVS --> SVS["SheetValidationService"]
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [AuditLog.java](file://backend/src/main/java/com/ceb/billing/entities/AuditLog.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [ExcelValidationService.java](file://backend/src/main/java/com/ceb/billing/services/ExcelValidationService.java)
- [HeaderValidationService.java](file://backend/src/main/java/com/ceb/billing/services/HeaderValidationService.java)
- [SheetValidationService.java](file://backend/src/main/java/com/ceb/billing/services/SheetValidationService.java)

## Performance Considerations
- JWT validation should be efficient; avoid heavy operations within the filter path.
- Batch or defer non-critical audit writes if necessary to reduce latency on hot paths.
- Cache frequently accessed validation metadata (e.g., header templates) where appropriate.
- Monitor database performance for audit log inserts and consider indexing strategies.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication failures: Check AuthEntryPointJwt for standardized 401 responses and verify JWT configuration in application.properties.
- Authorization failures: Inspect AuthAccessDeniedHandler for 403 responses and confirm role mappings in UserDetailsServiceImpl.
- Audit gaps: Ensure AuditLogService is invoked for critical operations and that AuditLogRepository connectivity is healthy.
- Validation issues: Use ExcelImportValidationController outputs to diagnose header mismatches and sheet rule violations.

**Section sources**
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuditLogService.java](file://backend/src/main/java/com/ceb/billing/services/AuditLogService.java)
- [AuditLogRepository.java](file://backend/src/main/java/com/ceb/billing/repositories/AuditLogRepository.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [application.properties](file://backend/src/main/resources/application.properties)

## Conclusion
The application consistently applies cross-cutting concerns through a well-defined security filter chain, centralized error handling, a dedicated auditing service, and modular validation services. Configuration is externalized for environment-specific tuning, and the architecture supports monitoring and observability via persistent audit logs and standardized error responses. This structure promotes maintainability, security, and compliance across all layers.