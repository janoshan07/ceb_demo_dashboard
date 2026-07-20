---
kind: dependency_management
name: Maven + npm Dual-Stack Dependency Management
category: dependency_management
scope:
    - '**'
source_files:
    - backend/pom.xml
    - backend/.mvn/wrapper/maven-wrapper.properties
    - frontend/package.json
    - frontend/package-lock.json
---

This repository manages dependencies for two independent subprojects using their native package managers — Maven for the Spring Boot backend and npm for the React/Vite frontend. There is no monorepo-level dependency orchestration; each side declares, versions, and resolves its own third-party libraries independently.

**Backend (Spring Boot / Maven)**
- Single-module project declared in `backend/pom.xml`, inheriting from `spring-boot-starter-parent:3.2.4` to centralize version management for all Spring ecosystem artifacts.
- Java target pinned to 21 via `<java.version>` property; compiler and surefire plugin versions are explicitly declared (`maven-compiler-plugin 3.11.0`, `maven-surefire-plugin 3.2.5`).
- Cross-cutting library versions are hoisted into a `<properties>` block (`poi.version=5.2.5`, `jwt.version=0.11.5`) so Apache POI and jjwt components stay in sync across multiple artifact declarations.
- Runtime-only dependencies (`mysql-connector-j`, `h2`, `jjwt-impl`, `jjwt-jackson`) use `<scope>runtime</scope>` to keep test/build classpaths lean.
- No custom `<repositories>` or `<pluginRepositories>` section — resolution goes straight to Maven Central via the default resolver.
- A Maven Wrapper is present at `backend/.mvn/wrapper/maven-wrapper.properties` pinning distribution URL to `apache-maven/3.9.6-bin.zip` from Maven Central, ensuring reproducible builds without a preinstalled Maven.
- No local `.m2/settings.xml` overrides or private registry configuration were found in the repo tree.

**Frontend (React / Vite / npm)**
- Dependencies declared in `frontend/package.json` under `dependencies` (runtime) and `devDependencies` (build-time tooling).
- All packages use caret (`^`) semver ranges, allowing minor/patch upgrades during install while preventing breaking major bumps.
- Lockfile `frontend/package-lock.json` is committed alongside the manifest, fixing transitive trees for deterministic installs.
- Build toolchain (Vite 8, `@vitejs/plugin-react` 6, ESLint 10) is kept in devDependencies and versioned independently of application code.
- No private npm registry, proxy, or `.npmrc` overrides are present in the repository.

**Conventions observed**
- Keep shared versions in a single properties block (Maven) or rely on lockfiles (npm) rather than vendoring jars or node_modules.
- Scope non-test/runtime-only artifacts to `runtime` to avoid leaking them into test/classpath surfaces.
- Prefer parent-bom-driven version alignment (Spring Boot parent) over ad-hoc version pins for framework-managed artifacts.