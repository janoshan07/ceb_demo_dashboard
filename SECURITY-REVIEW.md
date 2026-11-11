# Security Review

**Date:** 2026-11-09
**Scope:** Authentication and Officer-authorized record mutations
**Status:** Officer mutation finding remediated in the working tree. OTP login protection was disabled per user request.

## Summary

The review identified two high-severity issues. Backend-enforced Admin-password step-up remains applied to Officer record mutations. Login now issues a JWT after password authentication without OTP, as requested; this restores the documented risk of password-only login. Admin authorization behavior for record mutations is unchanged.

## Findings

### 1. Login can bypass OTP verification

**Status:** OTP disabled per user request; password-only login risk remains.

- **Severity:** High
- **Confidence:** 9/10
- **Location:** [`AuthController.java`](backend/src/main/java/com/ceb/billing/controllers/AuthController.java), lines 41-56
- **Evidence:** `POST /api/auth/login` authenticates the submitted username and password, then immediately generates and returns a JWT. It does not create an OTP challenge before issuing the token.
- **Impact:** A user who obtains valid credentials can receive an authenticated session without completing the intended second-factor flow.
- **Recommended remediation:** Require a second factor before issuing authenticated tokens.
- **Current behavior:** Per user request, `/api/auth/login` issues a JWT immediately after successful username/password authentication. OTP challenge, verify, and resend endpoints have been removed from the login controller and UI. Password-only authentication is less resistant to credential theft.

### 2. Officer mutations lack Admin-password verification

**Status:** Remediated.

- **Severity:** High
- **Confidence:** 9/10
- **Locations:**
  - [`PaymentControlController.java`](backend/src/main/java/com/ceb/billing/controllers/PaymentControlController.java), lines 127-173
  - [`MonthlyDirectoryController.java`](backend/src/main/java/com/ceb/billing/controllers/MonthlyDirectoryController.java), lines 139-160
- **Evidence:** Payment correction, payment hold changes, and payment releases are authorized for either `OFFICER` or `ADMIN` without Admin-password step-up verification. The monthly-directory record update is also available to both roles and accepts request-controlled `approve` and `revalidate` flags without such verification.
- **Impact:** An Officer JWT can invoke these APIs directly to change existing payment or directory records without the additional Admin authorization requested for sensitive edits.
- **Recommended remediation:** Enforce Admin-password verification in the backend for every applicable Officer edit, update, and delete operation. Rate-limit verification attempts, never log or persist the submitted password, and audit the Officer, action, record ID, and timestamp. Keep existing Admin permissions unchanged.
- **Implemented:** A backend MVC interceptor requires an Admin password for Officer-authorized record changes, including customer, billing, payment, monthly-directory, import, staging-proposal, and alert mutations. It verifies with the configured password encoder, returns explicit missing/invalid/rate-limited responses, and does not store or log the submitted password. Five failed attempts within 15 minutes are rate-limited using persisted audit events. Successful mutations are audited with Officer ID, action, record ID, and timestamp. Admins bypass the additional check.

## Review limitations

The backend tests and frontend validation are rerun for this change. Backend validation uses the installed JDK 21 with the Maven compiler release overridden to 21 because the project's declared JDK 25 is unavailable. The frontend build reports the existing large-chunk advisory. SMS/OTP and production deployment behavior are no longer part of login.
