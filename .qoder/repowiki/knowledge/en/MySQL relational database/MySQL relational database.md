---
kind: external_dependency
name: MySQL relational database
slug: mysql
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

Primary persistence store is MySQL 8.x via `mysql-connector-j`, configured in `application.properties` against a local `ceb_billing_db` instance. H2 is also present as an in-memory fallback for demo runs.