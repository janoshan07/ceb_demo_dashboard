---
kind: configuration_system
name: Spring Boot application.properties-based Configuration
category: configuration_system
scope:
    - '**'
source_files:
    - backend/src/main/resources/application.properties
    - backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java
    - backend/src/main/java/com/ceb/billing/config/JwtUtils.java
---

The repository uses a minimal Spring Boot configuration approach centered on a single `application.properties` file with no profile-based separation, YAML files, or externalized secret management.

**What system/approach is used**
- Spring Boot's default `application.properties` loader under `backend/src/main/resources/`.
- No Spring Cloud Config, `.env` files, YAML profiles (`application-dev.yml`, etc.), or environment-variable overrides are present.
- JWT secret and expiration are declared as custom properties (`ceb.billing.jwt.secret`, `ceb.billing.jwt.expiration-ms`) and consumed via `@Value` in the security config classes under `config/`.

**Key files and packages**
- `backend/src/main/resources/application.properties` — the sole runtime configuration source (server port, datasource URL/credentials, JPA/Hibernate flags, multipart upload limits, JWT secret).
- `backend/src/main/java/com/ceb/billing/config/WebSecurityConfig.java` — binds `ceb.billing.jwt.*` properties to configure `JwtUtils` and token expiration.
- `backend/src/main/java/com/ceb/billing/config/JwtUtils.java` — reads the secret and TTL via `@Value` annotations.
- `backend/src/main/java/com/ceb/billing/BillingApplication.java` — Spring Boot entry point; no programmatic `Environment` manipulation.

**Architecture and conventions**
- All configuration is flat and monolithic: database credentials, server settings, and feature toggles live side-by-side in one file.
- There is no separation between development, staging, and production environments; the same file is expected to be edited per deployment.
- Database DDL strategy is set to `update` (Hibernate auto-updates schema), which is appropriate for a demo but not for production.
- File-upload size limits are hardcoded at 10 MB each for file and request.

**Rules developers should follow**
- Keep all mutable runtime values in `application.properties`; do not hardcode them in Java classes beyond `@Value` injection of the existing `ceb.billing.jwt.*` keys.
- Do not commit secrets (e.g., `spring.datasource.password`, `ceb.billing.jwt.secret`) to version control — replace with environment variables or a secrets manager before any real deployment.
- If adding new configurable behavior, introduce it as a new `ceb.billing.*` property and inject it via `@Value` rather than scattering constants across services.