---
kind: logging_system
name: No Centralized Logging System
category: logging_system
scope:
    - '**'
source_files:
    - backend/src/main/java/com/ceb/billing/config/AuthAccessDeniedHandler.java
    - backend/src/main/java/com/ceb/billing/config/AuthEntryPointJwt.java
    - backend/src/main/java/com/ceb/billing/config/AuthTokenFilter.java
    - backend/src/main/java/com/ceb/billing/config/JwtUtils.java
    - backend/src/main/java/com/ceb/billing/controllers/CustomerController.java
---

This repository does not implement a centralized logging system. The backend (Spring Boot) has no dedicated logging configuration files (no logback.xml, log4j2.xml, or application.yml logging properties), and the only logging-related dependency is the default SLF4J API transitively pulled in by Spring Boot starters — there is no explicit Logback/Log4j2 binding declared in pom.xml.

Usage is inconsistent across modules:
- Security/config classes (AuthAccessDeniedHandler, AuthEntryPointJwt, AuthTokenFilter, JwtUtils) use SLF4J (`org.slf4j.Logger` / `LoggerFactory`) with `logger.error(...)` calls.
- CustomerController uses the legacy JDK logger (`java.util.logging.Logger`) with `log.warning(...)` and `log.severe(...)` calls.
- No structured fields, MDC context, correlation IDs, or common log layout are defined anywhere.
- No file/console appenders are configured; logs go to stdout via Spring Boot's default console logging.
- Frontend (React/Vite) has no logging framework — it relies on browser `console.*` calls implicitly through React tooling.

Because there is no unified framework, level strategy, or output routing, this category does not apply.