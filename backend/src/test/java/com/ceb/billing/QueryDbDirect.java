package com.ceb.billing;

import java.net.URI;
import java.sql.*;

/** Read-only aggregate diagnostics for an explicitly authorized local test database. */
public class QueryDbDirect {
    public static void main(String[] args) {
        try {
            if (!"true".equalsIgnoreCase(System.getenv("CEB_ALLOW_LOCAL_DB_DIAGNOSTICS"))) {
                throw new IllegalStateException();
            }
            String url = requireLocalTestUrl(requiredEnv("DB_URL"));
            try (Connection conn = DriverManager.getConnection(url, requiredEnv("DB_USERNAME"), requiredEnv("DB_PASSWORD"))) {
                conn.setReadOnly(true);
                System.out.println("Connected to authorized local test database.");
                printCount(conn, "billing_records", "Billing records");
                printCount(conn, "upload_history", "Upload history entries");
                printCount(conn, "audit_logs", "Audit log entries");
            }
        } catch (Exception ignored) {
            System.err.println("Database diagnostics stopped; verify local test database authorization and configuration.");
        }
    }

    private static void printCount(Connection conn, String table, String label) throws SQLException {
        try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + table)) {
            if (rs.next()) System.out.printf("%s: %d%n", label, rs.getLong(1));
        }
    }

    private static String requireLocalTestUrl(String url) {
        String prefix = "jdbc:mysql://";
        if (!url.startsWith(prefix)) throw new IllegalArgumentException();
        URI uri = URI.create(url.substring("jdbc:".length()));
        String host = uri.getHost();
        String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
        if (uri.getUserInfo() != null
                || !("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "::1".equals(host))
                || !database.matches("(?i).+_test(?:_[a-z0-9]+)*")) throw new IllegalArgumentException();
        return url;
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException();
        return value;
    }
}
