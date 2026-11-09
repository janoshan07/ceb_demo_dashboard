# Security Review

**Date:** 2026-11-09
**Scope:** Authentication and Officer-authorized record mutations
**Status:** Findings documented; no remediation was performed as part of this review.

## Summary

The review identified two high-severity issues. The login endpoint issues a JWT immediately after credential authentication without requiring the separate OTP verification flow. Separately, Officer-authorized mutation endpoints can change payment and monthly-directory records without Admin-password step-up verification. These findings were reported with high confidence.

## Findings

### 1. Login can bypass OTP verification

- **Severity:** High
- **Confidence:** 9/10
- **Location:** [`AuthController.java`](backend/src/main/java/com/ceb/billing/controllers/AuthController.java), lines 41-56
- **Evidence:** `POST /api/auth/login` authenticates the submitted username and password, then immediately generates and returns a JWT. It does not create an OTP challenge or require successful completion of `POST /api/auth/verify-otp` before issuing the token. The frontend accepts and stores a returned JWT directly when the login response does not request OTP.
- **Impact:** A user who obtains valid credentials can receive an authenticated session without completing the intended second-factor flow.
- **Recommended remediation:** Return only an OTP challenge after password authentication, and issue the authenticated JWT only after successful OTP verification. Apply appropriate attempt limits to OTP verification.

### 2. Officer mutations lack Admin-password verification

- **Severity:** High
- **Confidence:** 9/10
- **Locations:**
  - [`PaymentControlController.java`](backend/src/main/java/com/ceb/billing/controllers/PaymentControlController.java), lines 127-173
  - [`MonthlyDirectoryController.java`](backend/src/main/java/com/ceb/billing/controllers/MonthlyDirectoryController.java), lines 139-160
- **Evidence:** Payment correction, payment hold changes, and payment releases are authorized for either `OFFICER` or `ADMIN` without Admin-password step-up verification. The monthly-directory record update is also available to both roles and accepts request-controlled `approve` and `revalidate` flags without such verification.
- **Impact:** An Officer JWT can invoke these APIs directly to change existing payment or directory records without the additional Admin authorization requested for sensitive edits.
- **Recommended remediation:** Enforce Admin-password verification in the backend for every applicable Officer edit, update, and delete operation. Rate-limit verification attempts, never log or persist the submitted password, and audit the Officer, action, record ID, and timestamp. Keep existing Admin permissions unchanged.

## Review limitations

This report documents the findings identified in the security review. It does not claim that every application endpoint or mutation path has been exhaustively tested.
