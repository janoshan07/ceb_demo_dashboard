-- Forward-only schema change for approval workflow metadata and optimistic concurrency.
-- This migration is intentionally not executed as part of the source change.
ALTER TABLE approval_requests
    ADD COLUMN division VARCHAR(50) NULL,
    ADD COLUMN billing_month VARCHAR(20) NULL,
    ADD COLUMN reviewed_by VARCHAR(100) NULL,
    ADD COLUMN reviewed_at DATETIME NULL,
    ADD COLUMN row_version BIGINT NOT NULL DEFAULT 0;

CREATE INDEX idx_approval_changed_by_created ON approval_requests (changed_by, created_at);
CREATE INDEX idx_approval_status_created ON approval_requests (status, created_at);
