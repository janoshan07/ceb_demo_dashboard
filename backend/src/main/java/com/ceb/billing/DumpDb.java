package com.ceb.billing;

import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

/** Reports metadata about the latest uploaded workbook without printing its contents. */
public class DumpDb {
    public static void main(String[] args) {
        try {
            String url = requireSafeTestDatabase();
            String user = requiredEnv("DB_USERNAME");
            String password = requiredEnv("DB_PASSWORD");
            Class.forName("com.mysql.cj.jdbc.Driver");

            try (Connection conn = DriverManager.getConnection(url, user, password);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT file_bytes FROM import_batches ORDER BY id DESC LIMIT 1")) {
                if (!rs.next()) {
                    System.out.println("No import batches found.");
                    return;
                }
                byte[] bytes = rs.getBytes("file_bytes");
                try (Workbook workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(bytes))) {
                    int rowCount = 0;
                    for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                        rowCount += workbook.getSheetAt(i).getPhysicalNumberOfRows();
                    }
                    System.out.printf("Latest uploaded workbook metadata: %d bytes, %d sheets, %d rows.%n",
                            bytes.length, workbook.getNumberOfSheets(), rowCount);
                }
            }
        } catch (Exception ignored) {
            System.err.println("Workbook metadata inspection failed; check local test database configuration.");
        }
    }

    private static String requireSafeTestDatabase() throws Exception {
        if (!"true".equalsIgnoreCase(System.getenv("CEB_ALLOW_LOCAL_DB_DIAGNOSTICS"))) {
            throw new IllegalStateException("Local diagnostics authorization is required.");
        }
        String url = requiredEnv("DB_URL");
        String prefix = "jdbc:mysql://";
        if (!url.startsWith(prefix)) throw new IllegalArgumentException("Unsupported database URL.");
        URI uri = URI.create(url.substring("jdbc:".length()));
        String host = uri.getHost();
        String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
        if (uri.getUserInfo() != null
                || !("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "::1".equals(host))
                || !database.matches("(?i).+_test(?:_[a-z0-9]+)*")) {
            throw new IllegalArgumentException("Diagnostics are restricted to a local test database.");
        }
        return url;
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException("Required environment configuration is missing.");
        return value;
    }
}
