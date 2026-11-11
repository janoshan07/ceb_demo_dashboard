package com.ceb.billing;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.net.URI;
import java.util.*;

public class DivisionDataCorrectionRunner {
    public static void main(String[] args) {
        if (!java.util.Arrays.asList(args).contains("--apply")
                || !"true".equalsIgnoreCase(System.getenv("CEB_ALLOW_TEST_DATA_CORRECTION"))) {
            System.err.println("Stopped: pass --apply and explicitly authorize a local test database correction.");
            return;
        }
        String url;
        String user;
        String password;
        try {
            url = requireLocalTestUrl(requiredEnv("DB_URL"));
            user = requiredEnv("DB_USERNAME");
            password = requiredEnv("DB_PASSWORD");
        } catch (Exception ignored) {
            System.err.println("Stopped: local test database configuration is missing or unsafe.");
            return;
        }
        ObjectMapper mapper = new ObjectMapper();

        System.out.println("=== EXECUTING EXPLICITLY AUTHORIZED LOCAL TEST DATA CORRECTION ===");

        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            conn.setAutoCommit(false);

            // 1. Audit and Correct MonthlyDirectorySnapshot rows
            String query = "SELECT id, dataset_name, billing_month, division, final_data_json FROM monthly_directory_snapshot ORDER BY id ASC";
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(query)) {

                List<Long> snapshotIds = new ArrayList<>();
                Map<Long, String> snapDivMap = new HashMap<>();
                Map<Long, String> snapMonthMap = new HashMap<>();
                Map<Long, String> snapJsonMap = new HashMap<>();

                while (rs.next()) {
                    long id = rs.getLong("id");
                    snapshotIds.add(id);
                    snapDivMap.put(id, rs.getString("division"));
                    snapMonthMap.put(id, rs.getString("billing_month"));
                    snapJsonMap.put(id, rs.getString("final_data_json"));
                }

                String updateSql = "UPDATE monthly_directory_snapshot SET final_data_json = ? WHERE id = ?";
                try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                    for (Long snapId : snapshotIds) {
                        String snapDiv = snapDivMap.get(snapId);
                        String snapMonth = snapMonthMap.get(snapId);
                        String rawJson = snapJsonMap.get(snapId);

                        if (rawJson == null || rawJson.trim().isEmpty() || snapDiv == null) {
                            continue;
                        }

                        List<Map<String, Object>> records = mapper.readValue(rawJson, new TypeReference<List<Map<String, Object>>>() {});
                        int correctedInSnap = 0;

                        for (Map<String, Object> r : records) {
                            String curDiv = r.get("division") != null ? r.get("division").toString().trim() : "";
                            String curSnapDiv = r.get("snapshotDivision") != null ? r.get("snapshotDivision").toString().trim() : "";

                            if (!snapDiv.equalsIgnoreCase(curDiv) || !snapDiv.equalsIgnoreCase(curSnapDiv)) {
                                r.put("division", snapDiv);
                                r.put("snapshotDivision", snapDiv);
                                if (snapMonth != null && !snapMonth.isEmpty()) {
                                    r.put("billingMonth", snapMonth);
                                }
                                correctedInSnap++;
                            }
                        }

                        if (correctedInSnap > 0) {
                            String newJson = mapper.writeValueAsString(records);
                            updateStmt.setString(1, newJson);
                            updateStmt.setLong(2, snapId);
                            updateStmt.executeUpdate();
                            System.out.println(String.format("A snapshot required correction for %d records.", correctedInSnap));
                        } else {
                            System.out.println(String.format("A snapshot was already correctly stamped (%d records checked).", records.size()));
                        }
                    }
                }
            }

            // 2. Audit and Correct customers table
            // For every record in Kalmunai snapshots, ensure customers table has division = 'Kalmunai'
            try (PreparedStatement pstmt = conn.prepareStatement("SELECT id, final_data_json, division FROM monthly_directory_snapshot WHERE division = 'Kalmunai'")) {
                try (ResultSet rs = pstmt.executeQuery()) {
                    while (rs.next()) {
                        String json = rs.getString("final_data_json");
                        String snapDiv = rs.getString("division");
                        List<Map<String, Object>> records = mapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});

                        String checkSql = "SELECT account_no, division, directory_json FROM customers WHERE account_no = ?";
                        String updateCustSql = "UPDATE customers SET division = ?, branch_code = ?, directory_json = ? WHERE account_no = ?";

                        int custFixed = 0;
                        try (PreparedStatement checkStmt = conn.prepareStatement(checkSql);
                             PreparedStatement updateCustStmt = conn.prepareStatement(updateCustSql)) {

                            for (Map<String, Object> r : records) {
                                String acc = r.get("accountNo") != null ? r.get("accountNo").toString().trim() : "";
                                if (acc.isEmpty()) continue;

                                checkStmt.setString(1, acc);
                                try (ResultSet cRs = checkStmt.executeQuery()) {
                                    if (cRs.next()) {
                                        String existingDiv = cRs.getString("division");
                                        String dirJson = cRs.getString("directory_json");

                                        if (existingDiv == null || !snapDiv.equalsIgnoreCase(existingDiv.trim())) {
                                            Map<String, Object> dirMap = new LinkedHashMap<>();
                                            if (dirJson != null && !dirJson.trim().isEmpty()) {
                                                try {
                                                    dirMap.putAll(mapper.readValue(dirJson, new TypeReference<Map<String, Object>>() {}));
                                                } catch (Exception ignored) {}
                                            }
                                            dirMap.put("division", snapDiv);
                                            dirMap.put("snapshotDivision", snapDiv);
                                            String newDirJson = mapper.writeValueAsString(dirMap);

                                            updateCustStmt.setString(1, snapDiv);
                                            updateCustStmt.setString(2, snapDiv);
                                            updateCustStmt.setString(3, newDirJson);
                                            updateCustStmt.setString(4, acc);
                                            updateCustStmt.executeUpdate();

                                            custFixed++;
                                            System.out.println("Corrected one customer directory entry.");
                                        }
                                    }
                                }
                            }
                        }
                        System.out.println(String.format("Customer directory entries corrected for a snapshot: %d", custFixed));
                    }
                }
            }

            conn.commit();
            System.out.println("Database migration successfully committed!");

            // 3. Post-verification of Kalmunai snapshot records and resolution
            try (PreparedStatement pstmt = conn.prepareStatement("SELECT id, final_data_json, division FROM monthly_directory_snapshot WHERE division = 'Kalmunai'")) {
                try (ResultSet rs = pstmt.executeQuery()) {
                    while (rs.next()) {
                        String json = rs.getString("final_data_json");
                        List<Map<String, Object>> records = mapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});

                        int kalmunaiCount = 0;
                        int batticaloaCount = 0;
                        int amparaCount = 0;

                        for (Map<String, Object> r : records) {
                            String resolved = com.ceb.billing.controllers.CustomerController.resolveLocation(r);
                            if ("Kalmunai".equalsIgnoreCase(resolved)) {
                                kalmunaiCount++;
                            } else if ("Batticaloa".equalsIgnoreCase(resolved)) {
                                batticaloaCount++;
                            } else if ("Ampara".equalsIgnoreCase(resolved)) {
                                amparaCount++;
                            }
                        }

                        System.out.println(String.format("Post-correction division audit: %d rows checked; Kalmunai=%d, Batticaloa=%d, Ampara=%d.",
                                records.size(), kalmunaiCount, batticaloaCount, amparaCount));

                        if (kalmunaiCount == records.size() && batticaloaCount == 0 && amparaCount == 0) {
                            System.out.println("SUCCESS: 100% strict division isolation verified! Zero cross-division leakage.");
                        } else {
                            System.err.println("FAILURE: Cross-division leakage remains!");
                        }
                    }
                }
            }

        } catch (Exception ignored) {
            System.err.println("Data correction stopped due to an error; sensitive database details were suppressed.");
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
