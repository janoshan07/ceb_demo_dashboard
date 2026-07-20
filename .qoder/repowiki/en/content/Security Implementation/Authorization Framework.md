# Authorization Framework

<cite>
**Referenced Files in This Document**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [HomeController.java](file://backend/src/main/java/com/ceb/billing/controllers/HomeController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
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
This document describes the role-based access control (RBAC) authorization framework for the CEB Billing System. It explains how Spring Security is configured, how JWT-based authentication and authorization are implemented, and how URL-based and method-level security rules are enforced. It also covers request interception via a custom filter, error handling for unauthorized and forbidden access, role hierarchy, permission checking patterns, and integration points with controllers.

## Project Structure
The authorization framework spans configuration classes, a custom security filter, JWT utilities, user details implementation, and controller endpoints that enforce roles and permissions.

```mermaid
graph TB
subgraph "Security Configuration"
WSC["WebSecurityConfig"]
F["AuthTokenFilter"]
E["AuthEntryPointJwt"]
D["AuthAccessDeniedHandler"]
J["JwtUtils"]
UDI["UserDetailsImpl"]
UDS["UserDetailsServiceImpl"]
end
subgraph "Controllers"
AC["AuthController"]
ADM["AdminUserController"]
BI["BillingController"]
CU["CustomerController"]
DA["DashboardController"]
RP["ReportController"]
AL["AlertController"]
AP["ApprovalController"]
HC["HomeController"]
LU["LookupController"]
PR["PredictionController"]
SC["StagingChangeController"]
EV["ExcelImportValidationController"]
MI["MultiFileImportController"]
end
WSC --> F
F --> J
F --> UDS
WSC --> E
WSC --> D
UDS --> UDI
AC --> J
ADM --> WSC
BI --> WSC
CU --> WSC
DA --> WSC
RP --> WSC
AL --> WSC
AP --> WSC
HC --> WSC
LU --> WSC
PR --> WSC
SC --> WSC
EV --> WSC
MI --> WSC
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [HomeController.java](file://backend/src/main/java/com/ceb/billing/controllers/HomeController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [HomeController.java](file://backend/src/main/java/com/ceb/billing/controllers/HomeController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)

## Core Components
- WebSecurityConfig: Configures the Spring Security filter chain, URL-based authorization rules, exception handlers, and method-level security enablement.
- AuthTokenFilter: Intercepts HTTP requests, extracts and validates the JWT, and populates the SecurityContext with authenticated authorities.
- JwtUtils: Provides JWT creation, parsing, and validation utilities used by the filter and authentication controller.
- UserDetailsImpl and UserDetailsServiceImpl: Implement Spring’s UserDetailsService to load user details and roles from the database.
- AuthEntryPointJwt: Handles unauthenticated access attempts (e.g., missing or invalid token).
- AuthAccessDeniedHandler: Handles insufficient privileges when an authenticated user lacks required roles/permissions.

Key responsibilities:
- Authentication flow: Login endpoint issues a JWT; subsequent requests carry the token.
- Authorization flow: Filter validates token and sets authorities; URL and method-level rules enforce RBAC.
- Error handling: Consistent JSON responses for 401 and 403 scenarios.

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)

## Architecture Overview
The authorization architecture integrates Spring Security with a stateless JWT-based approach. Requests pass through a custom filter that validates tokens and establishes the SecurityContext. Controllers then rely on URL-based and method-level annotations to enforce RBAC.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Sec as "Spring Security"
participant Filter as "AuthTokenFilter"
participant Utils as "JwtUtils"
participant Svc as "UserDetailsServiceImpl"
participant Controller as "Controller Method"
Client->>Sec : "HTTP Request with Authorization header"
Sec->>Filter : "Invoke filter chain"
Filter->>Utils : "Parse and validate JWT"
Utils-->>Filter : "Claims / Subject"
Filter->>Svc : "Load user by username"
Svc-->>Filter : "UserDetails with roles"
Filter->>Sec : "Set Authentication in SecurityContext"
Sec->>Controller : "Dispatch to handler"
Controller-->>Client : "Response (success or secured)"
```

**Diagram sources**
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)

## Detailed Component Analysis

### WebSecurityConfig
Responsibilities:
- Defines the security filter chain including the custom JWT filter.
- Configures URL-based authorization rules (permitting public endpoints and securing others).
- Registers exception handlers for unauthenticated and forbidden access.
- Enables method-level security annotations.

Typical configuration elements:
- Permitting login and possibly static resources.
- Adding the custom JWT filter before standard authentication filters.
- Setting access denied handler and entry point.
- Enabling @PreAuthorize/@PostAuthorize/@Secured/@RolesAllowed support.

Example protected endpoints (by controller):
- Admin operations: AdminUserController
- Billing management: BillingController
- Customer management: CustomerController
- Dashboard and reports: DashboardController, ReportController
- Alerts and approvals: AlertController, ApprovalController
- Lookup and predictions: LookupController, PredictionController
- Staging and imports: StagingChangeController, ExcelImportValidationController, MultiFileImportController

Note: Public endpoints typically include authentication endpoints exposed by AuthController.

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)

### AuthTokenFilter
Responsibilities:
- Intercepts incoming requests.
- Extracts the JWT from the Authorization header.
- Validates the token using JwtUtils.
- Loads user details and sets the SecurityContext if valid.
- Continues the filter chain for authorized requests.

Processing logic:
```mermaid
flowchart TD
Start(["Request enters filter"]) --> CheckHeader["Check Authorization header"]
CheckHeader --> HasToken{"JWT present?"}
HasToken --> |No| Continue["Continue chain without auth"]
HasToken --> |Yes| Validate["Validate token with JwtUtils"]
Validate --> Valid{"Valid token?"}
Valid --> |No| Deny["Reject with 401 via entry point"]
Valid --> |Yes| LoadUser["Load UserDetails via UserDetailsService"]
LoadUser --> SetCtx["Set Authentication in SecurityContext"]
SetCtx --> Continue
Continue --> End(["Proceed to controller"])
```

**Diagram sources**
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)

**Section sources**
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)

### JwtUtils
Responsibilities:
- Generates signed JWTs containing subject (username) and claims (roles/authorities).
- Parses and validates tokens, including expiration checks.
- Exposes helper methods for extracting claims and usernames.

Integration points:
- Used by AuthTokenFilter to validate incoming tokens.
- Used by authentication endpoints to issue tokens upon successful login.

**Section sources**
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)

### UserDetailsImpl and UserDetailsServiceImpl
Responsibilities:
- UserDetailsImpl represents the authenticated principal with username and authorities.
- UserDetailsServiceImpl loads user data and roles from the database and maps them to Spring authorities.

Data model relationship:
```mermaid
classDiagram
class User {
+id
+username
+password
+roles
}
class UserDetailsImpl {
+username
+authorities
}
class UserDetailsServiceImpl {
+loadUserByUsername(username) UserDetails
}
UserDetailsServiceImpl --> User : "loads"
UserDetailsImpl <.. UserDetailsServiceImpl : "creates"
```

**Diagram sources**
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)

**Section sources**
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [User.java](file://backend/src/main/java/com/ceb/billing/entities/User.java)

### AuthEntryPointJwt and AuthAccessDeniedHandler
Responsibilities:
- AuthEntryPointJwt: Responds with appropriate errors (e.g., 401) when authentication is missing or invalid.
- AuthAccessDeniedHandler: Responds with appropriate errors (e.g., 403) when an authenticated user lacks required roles/permissions.

Error handling flow:
```mermaid
sequenceDiagram
participant Client as "Client"
participant Sec as "Spring Security"
participant Entry as "AuthEntryPointJwt"
participant Denied as "AuthAccessDeniedHandler"
Client->>Sec : "Unauthenticated request"
Sec->>Entry : "Trigger entry point"
Entry-->>Client : "401 Unauthorized"
Client->>Sec : "Authenticated but insufficient roles"
Sec->>Denied : "Trigger access denied handler"
Denied-->>Client : "403 Forbidden"
```

**Diagram sources**
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)

**Section sources**
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)

### Role Hierarchy and Permission Checking Patterns
Role hierarchy:
- Define hierarchical roles so that higher-level roles inherit lower-level permissions (for example, ADMIN inherits MANAGER, which inherits USER).
- Configure the role hierarchy bean in WebSecurityConfig and ensure it is applied to the security context.

Permission checking patterns:
- URL-based rules: Use antMatchers/regexMatchers with hasRole/hasAuthority checks in WebSecurityConfig.
- Method-level annotations:
  - @PreAuthorize("hasRole('ADMIN')") or SpEL expressions like hasAnyRole('ADMIN','MANAGER').
  - @PostAuthorize for post-execution checks.
  - @Secured and @RolesAllowed for declarative role checks.
- Custom security expressions:
  - Register custom evaluators in WebSecurityConfig for domain-specific checks (e.g., resource ownership).
  - Reference beans or utility methods within SpEL expressions.

Examples of protected endpoints (by controller):
- Admin-only: AdminUserController
- Billing operations: BillingController
- Customer management: CustomerController
- Reports and dashboards: ReportController, DashboardController
- Alerts and approvals: AlertController, ApprovalController
- Lookups and predictions: LookupController, PredictionController
- Staging and import controls: StagingChangeController, ExcelImportValidationController, MultiFileImportController

Public endpoints:
- Authentication endpoints in AuthController (login, refresh) should be permitted without authentication.

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)

## Dependency Analysis
The following diagram shows key dependencies among security components and controllers.

```mermaid
graph LR
WSC["WebSecurityConfig"] --> F["AuthTokenFilter"]
F --> J["JwtUtils"]
F --> UDS["UserDetailsServiceImpl"]
UDS --> UDI["UserDetailsImpl"]
WSC --> E["AuthEntryPointJwt"]
WSC --> D["AuthAccessDeniedHandler"]
AC["AuthController"] --> J
ADM["AdminUserController"] --> WSC
BI["BillingController"] --> WSC
CU["CustomerController"] --> WSC
DA["DashboardController"] --> WSC
RP["ReportController"] --> WSC
AL["AlertController"] --> WSC
AP["ApprovalController"] --> WSC
HC["HomeController"] --> WSC
LU["LookupController"] --> WSC
PR["PredictionController"] --> WSC
SC["StagingChangeController"] --> WSC
EV["ExcelImportValidationController"] --> WSC
MI["MultiFileImportController"] --> WSC
```

**Diagram sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [HomeController.java](file://backend/src/main/java/com/ceb/billing/controllers/HomeController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)

**Section sources**
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)
- [AuthTokenFilter.java](file://backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java)
- [JwtUtils.java](file://backend/src/main/java/com/ceb/billing/config/JwtUtils.java)
- [UserDetailsServiceImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsServiceImpl.java)
- [UserDetailsImpl.java](file://backend/src/main/java/com/ceb/billing/config/UserDetailsImpl.java)
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [HomeController.java](file://backend/src/main/java/com/ceb/billing/controllers/HomeController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)

## Performance Considerations
- Token validation cost: Keep JwtUtils validations efficient; avoid heavy computations per request.
- Database lookups: Cache frequently accessed user roles where appropriate to reduce DB pressure.
- Filter ordering: Ensure the JWT filter is placed correctly in the chain to minimize unnecessary processing.
- Stateless design: Avoid storing session state; leverage JWT claims for minimal overhead.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Missing or malformed Authorization header: The entry point returns 401; verify client headers and token format.
- Expired or invalid token: Re-authenticate to obtain a new token; check token signing and expiration settings.
- Insufficient roles: Access denied handler returns 403; confirm user roles and URL/method-level rules.
- Role hierarchy not applied: Ensure the role hierarchy bean is registered and enabled in WebSecurityConfig.
- Method-level annotations not working: Confirm that method security is enabled and annotations are correctly applied.

**Section sources**
- [AuthEntryPointJwt.java](file://backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java)
- [AuthAccessDeniedHandler.java](file://backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java)
- [WebSecurityConfig.java](file://backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java)

## Conclusion
The CEB Billing System implements a robust RBAC framework using Spring Security and JWT. WebSecurityConfig centralizes URL-based rules and exception handling, while AuthTokenFilter ensures secure request processing. Role hierarchy and method-level annotations provide flexible, fine-grained access control. Proper configuration and consistent use of security annotations across controllers ensure predictable and maintainable authorization behavior.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Example Protected Endpoints (by controller)
- Admin operations: AdminUserController
- Billing management: BillingController
- Customer management: CustomerController
- Dashboard and reports: DashboardController, ReportController
- Alerts and approvals: AlertController, ApprovalController
- Lookup and predictions: LookupController, PredictionController
- Staging and imports: StagingChangeController, ExcelImportValidationController, MultiFileImportController
- Public endpoints: AuthController (login, refresh)

**Section sources**
- [AdminUserController.java](file://backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java)
- [BillingController.java](file://backend/src/main/java/com/ceb/billing/controllers/BillingController.java)
- [CustomerController.java](file://backend/src/main/java/com/ceb/billing/controllers/CustomerController.java)
- [DashboardController.java](file://backend/src/main/java/com/ceb/billing/controllers/DashboardController.java)
- [ReportController.java](file://backend/src/main/java/com/ceb/billing/controllers/ReportController.java)
- [AlertController.java](file://backend/src/main/java/com/ceb/billing/controllers/AlertController.java)
- [ApprovalController.java](file://backend/src/main/java/com/ceb/billing/controllers/ApprovalController.java)
- [LookupController.java](file://backend/src/main/java/com/ceb/billing/controllers/LookupController.java)
- [PredictionController.java](file://backend/src/main/java/com/ceb/billing/controllers/PredictionController.java)
- [StagingChangeController.java](file://backend/src/main/java/com/ceb/billing/controllers/StagingChangeController.java)
- [ExcelImportValidationController.java](file://backend/src/main/java/com/ceb/billing/controllers/ExcelImportValidationController.java)
- [MultiFileImportController.java](file://backend/src/main/java/com/ceb/billing/controllers/MultiFileImportController.java)
- [AuthController.java](file://backend/src/main/java/com/ceb/billing/controllers/AuthController.java)