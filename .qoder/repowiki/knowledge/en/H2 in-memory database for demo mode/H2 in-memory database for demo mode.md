---
kind: external_dependency
name: H2 in-memory database for demo mode
slug: h2-database
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

H2 is included at runtime scope so the app can run without MySQL installed; used for zero-config demo execution alongside the MySQL connector.