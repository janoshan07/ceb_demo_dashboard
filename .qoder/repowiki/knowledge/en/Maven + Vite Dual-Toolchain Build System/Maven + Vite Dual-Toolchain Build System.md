---
kind: build_system
name: Maven + Vite Dual-Toolchain Build System
category: build_system
scope:
    - '**'
source_files:
    - backend/pom.xml
    - backend/.mvn/wrapper/maven-wrapper.properties
    - backend/mvnw
    - backend/mvnw.cmd
    - .maven/apache-maven-3.9.6/bin/mvn
    - frontend/package.json
    - frontend/vite.config.js
---

This repository uses two independent, language-native build toolchains — one per sub-project — with no top-level orchestrator (no Makefile, Dockerfile, or CI pipeline present).

**Backend (Java / Spring Boot)**
- Build tool: Maven 3.9.6 managed via the Maven Wrapper (`backend/.mvn/wrapper/maven-wrapper.properties`), invoked through `backend/mvnw` / `backend/mvnw.cmd`. A vendored copy of Maven 3.9.6 also lives under `.maven/apache-maven-3.9.6/`, likely used by IDEs or local scripts.
- Project definition: `backend/pom.xml` inherits from `spring-boot-starter-parent:3.2.4`, targets Java 21, and declares all dependencies centrally in `<properties>` (`poi.version=5.2.5`, `jwt.version=0.11.5`).
- Packaging: `spring-boot-maven-plugin` is configured to produce a single executable JAR; `maven-surefire-plugin` runs tests; `maven-compiler-plugin` pins `release=21`.
- Runtime profiles: both MySQL (`mysql-connector-j`) and H2 (`h2`) drivers are declared as `runtime` scope so the app can run against either database depending on `application.properties`.
- Typical commands:
  - `cd backend && ./mvnw package` → builds + packages an executable JAR into `backend/target/`.
  - `./mvnw spring-boot:run` → starts the embedded server.
  - `./mvnw test` → runs unit/integration tests via Surefire.

**Frontend (React / Vite)**
- Build tool: Vite 8 with the React plugin and Tailwind CSS v4 (`@tailwindcss/vite`). Configuration lives in `frontend/vite.config.js`.
- Package manager: npm (lockfile `frontend/package-lock.json`); Node ESM mode enabled via `"type": "module"`.
- Scripts in `frontend/package.json`:
  - `npm run dev` → Vite development server with hot reload.
  - `npm run build` → production build to `frontend/dist/`.
  - `npm run lint` → ESLint over the source tree.
  - `npm run preview` → serve the built output locally.
- Typical commands:
  - `cd frontend && npm install && npm run build` → produces static assets ready for any HTTP server.

**Cross-cutting conventions & gaps**
- No monorepo aggregator: each sub-project is built independently; there is no root `pom.xml`, `package.json`, or `Makefile` that coordinates both sides.
- No containerization: no `Dockerfile` or `docker-compose.yml` exists at the repo root or inside sub-projects.
- No CI/CD: the only GitHub content is `.github/modernize/java-upgrade/` automation logs/plans — no workflow YAML files are present.
- Versioning: backend uses Maven SNAPSHOT (`0.0.1-SNAPSHOT`); frontend uses a placeholder `0.0.0` with no release tagging strategy visible.