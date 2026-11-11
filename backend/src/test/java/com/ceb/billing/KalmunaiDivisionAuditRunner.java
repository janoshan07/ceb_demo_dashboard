package com.ceb.billing;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.net.URI;
import java.util.*;

public class KalmunaiDivisionAuditRunner {
    public static void main(String[] args) {
        String url;
        String user;
        String password;
        try {
            if (!"true".equalsIgnoreCase(System.getenv("CEB_ALLOW_LOCAL_DB_DIAGNOSTICS"))) throw new IllegalStateException();
            url = requireLocalTestUrl(requiredEnv("DB_URL"));
            user = requiredEnv("DB_USERNAME");
            password = requiredEnv("DB_PASSWORD");
        } catch (Exception ignored) {
            System.err.println("Audit stopped; explicit local test database authorization and configuration are required.");
            return;
        }
        ObjectMapper mapper = new ObjectMapper();

        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            System.out.println("=== KALMUNAI & DIVISION-WISE AUDIT RUNNER ===");

            // 1. Check all snapshots in monthly_directory_snapshot
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT id, dataset_name, billing_month, division, status, total_records FROM monthly_directory_snapshot ORDER BY id ASC")) {
                while (rs.next()) {
                    long id = rs.getLong("id");
                    int total = rs.getInt("total_records");
                    System.out.printf("Snapshot metadata row %d: %d records.%n", id, total);
                }
            }

            // 2. Audit all snapshots
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT id, division, total_records, final_data_json FROM monthly_directory_snapshot ORDER BY id ASC")) {
                while (rs.next()) {
                    long id = rs.getLong("id");
                    String snapDiv = rs.getString("division");
                    String json = rs.getString("final_data_json");
                    List<Map<String, Object>> records = mapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});

                    System.out.println("\n=======================================================");
                    System.out.printf("Auditing snapshot %d (%d records).%n", id, records.size());
                    System.out.println("=======================================================");

                    Map<String, Integer> detectedBranchCounts = new TreeMap<>();
                    int crossDivisionCount = 0;

                    for (Map<String, Object> r : records) {
                        String acc = r.get("accountNo") != null ? r.get("accountNo").toString().trim() : "";
                        String detected = com.ceb.billing.utils.BranchDetector.detectBranch(acc);
                        String detKey = detected != null ? detected : "UNKNOWN";
                        detectedBranchCounts.put(detKey, detectedBranchCounts.getOrDefault(detKey, 0) + 1);

                        if (detected != null && !detected.equalsIgnoreCase(snapDiv)) {
                            crossDivisionCount++;
                        }
                    }

                    System.out.println("Records breakdown by detected branch prefix:");
                    System.out.printf("Detected branch groups: %d; cross-division rows: %d.%n",
                            detectedBranchCounts.size(), crossDivisionCount);
                }
            }


        } catch (Exception ignored) {
            System.err.println("Audit failed; sensitive database details were suppressed.");
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
