---
kind: error_handling
name: Ad-hoc Controller-Level Error Handling with Security Entry Points
category: error_handling
scope:
    - '**'
source_files:
    - backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java
    - backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java
    - backend/src/main/java/com/ceb/billing/models/MessageResponse.java
    - backend/src/main/java/com/ceb/billing/models/ExcelValidationError.java
    - backend/src/main/java/com/ceb/billing/controllers/BillingController.java
    - backend/src/main/java/com/ceb/billing/controllers/AdminUserController.java
    - frontend/src/context/ToastContext.jsx
---

The codebase has no centralized error-handling framework. Errors are handled in two disjoint ways:

**Backend (Spring Boot)**
- No `@ControllerAdvice` / `@ExceptionHandler`, no custom exception hierarchy, and no global error mapper exists.
- Each controller method wraps its body in a local `try/catch (Exception e)` block and returns an ad-hoc `ResponseEntity` — typically `500 Internal Server Error` with a `MessageResponse` whose `message` field is set to a string like `"Failed to ...: " + e.getMessage()`. Examples: `BillingController.parseExcel`, `AdminUserController.migrateStagingBatch`, `ApprovalController.rejectStagingBatch`, etc.
- Validation failures return `400 Bad Request` with the same `MessageResponse` wrapper (e.g., empty file upload).
- Not-found cases return `404 Not Found` via `ResponseEntity.notFound().build()`.
- Transactional methods that fail mark rollback explicitly through `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()` before returning the error response.
- Spring Security errors are intercepted by dedicated components rather than controllers:
  - `AuthEntryPointJwt` handles `AuthenticationException` (unauthenticated requests) → writes JSON `{status: 401, error: "Unauthorized", message, path}`.
  - `AuthAccessDeniedHandler` handles `AccessDeniedException` (insufficient roles) → writes JSON `{status: 403, error: "Forbidden", message, path}`.
- JWT parsing exceptions (`MalformedJwtException`, `ExpiredJwtException`, `UnsupportedJwtException`, `IllegalArgumentException`) are caught inside `JwtUtils` and logged; they do not propagate as typed domain errors.
- The only structured error model for business validation is `ExcelValidationError` (sheetName, rowNum, field, errorMessage, warning), used to report per-row Excel import issues.
- Logging uses SLF4J `logger.error(...)` at the security entry points; most controller catch blocks do not log before responding.

**Frontend (React/Vite)**
- There is no HTTP interceptor or global error handler. Every page/component catches fetch/axios errors locally with `try/catch(err)` and surfaces them via the shared `ToastContext` (`showToast(message, 'error')`).
- `ToastContext` provides a uniform toast/notification UI with types `success | error | warning | info` and a `showConfirm` promise-based confirmation dialog, which is the primary user-facing error/warning presentation mechanism.
- Some calls swallow errors silently (empty `catch(Exception e){}` blocks in `AdminUserController` parameter parsing).