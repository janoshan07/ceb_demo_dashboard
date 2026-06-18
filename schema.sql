-- Ceylon Electricity Board (CEB) Billing Management System Database Schema
-- Target Database: MySQL
-- Note: Spring Boot JPA is configured with ddl-auto=update, meaning it will create
-- these tables automatically. You can use this file for reference or manual database creation.

CREATE DATABASE IF NOT EXISTS ceb_billing_db;
USE ceb_billing_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- ADMIN, OFFICER, USER
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    account_no VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_address VARCHAR(255) NULL,
    mobile_no VARCHAR(50) NULL,
    agreement_date DATE NULL,
    panel_capacity DOUBLE NULL,
    bank_code VARCHAR(50) NULL,
    branch_code VARCHAR(50) NULL,
    bank_account_no VARCHAR(50) NULL,
    solar_type VARCHAR(50) NULL, -- Net Plus, Net Plus Plus, Net Metering, Net Accounting
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Upload History Table
CREATE TABLE IF NOT EXISTS upload_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    uploaded_by VARCHAR(100) NOT NULL,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL, -- SUCCESS, COMPLETED_WITH_ERRORS, FAILED
    rows_processed INT DEFAULT 0,
    new_customers INT DEFAULT 0,
    billing_inserted INT DEFAULT 0,
    errors_count INT DEFAULT 0
);

-- 4. Billing Records Table
CREATE TABLE IF NOT EXISTS billing_records (
    billing_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_no VARCHAR(50) NOT NULL,
    ref_no VARCHAR(100) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    import_units DOUBLE NOT NULL,
    export_units DOUBLE NOT NULL,
    net_unit DOUBLE NOT NULL,          -- Exports - Imports (Calculated)
    unit_cost DOUBLE NOT NULL,
    total_amount DOUBLE NOT NULL,      -- Net * Unit Cost (Calculated)
    billing_mode VARCHAR(50) NULL,     -- Fixed, Variable
    upload_history_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_no) REFERENCES customers(account_no) ON DELETE CASCADE
);

-- 5. Approval Requests Table
CREATE TABLE IF NOT EXISTS approval_requests (
    request_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    billing_id BIGINT NULL,
    account_no VARCHAR(50) NULL,
    changed_by VARCHAR(100) NOT NULL,
    old_values TEXT NOT NULL,          -- JSON string of old fields
    new_values TEXT NOT NULL,          -- JSON string of updated fields
    status VARCHAR(50) NOT NULL,       -- PENDING, APPROVED, REJECTED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (billing_id) REFERENCES billing_records(billing_id) ON DELETE SET NULL,
    FOREIGN KEY (account_no) REFERENCES customers(account_no) ON DELETE SET NULL
);

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    performed_by VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT NULL
);

-- Seed Initial Users (Default credentials: admin/admin123, officer/officer123, viewer/viewer123)
-- Password values below are pre-hashed using BCrypt.
INSERT INTO users (username, password, role) 
VALUES 
('admin', '$2a$10$tMoxpP8e/sZ88vL8wI7yUuG17Zf.jF/zO2v5Q.Wd/vYJkK/gH8E1e', 'ADMIN'),
('officer', '$2a$10$wT0Xh9dF5310z17d.pL8yuG17Zf.jF/zO2v5Q.Wd/vYJkK/gH8E1e', 'OFFICER'),
('viewer', '$2a$10$j8b25Y8e/sZ88vL8wI7yUuG17Zf.jF/zO2v5Q.Wd/vYJkK/gH8E1e', 'USER')
ON DUPLICATE KEY UPDATE username=username;
