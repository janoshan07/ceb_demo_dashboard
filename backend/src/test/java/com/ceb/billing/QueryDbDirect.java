package com.ceb.billing;

import java.sql.*;

public class QueryDbDirect {
    public static void main(String[] args) {
        String url = "jdbc:mysql://localhost:3306/ceb_billing_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
        String user = "root";
        String password = "Mj@251677";
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            System.out.println("Connected to MySQL database!");
            
            // Query 1: Total records count in billing_records
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM billing_records")) {
                if (rs.next()) {
                    System.out.println("Total Billing Records in billing_records: " + rs.getInt(1));
                }
            }
            
            // Query 1b: Total records count in upload_history
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM upload_history")) {
                System.out.println("Upload History rows:");
                while (rs.next()) {
                    System.out.println(String.format("  ID: %d, FileName: %s, Status: %s, Processed: %d, NewCust: %d, BillingIns: %d, Errors: %d",
                            rs.getLong("id"), rs.getString("filename"), rs.getString("status"),
                            rs.getInt("rows_processed"), rs.getInt("new_customers"), rs.getInt("billing_inserted"), rs.getInt("errors_count")));
                }
            }
            
            // Query 1c: Print STAGING_APPROVED audit logs
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 5")) {
                System.out.println("Audit Log messages:");
                while (rs.next()) {
                    System.out.println(String.format("  ID: %d, Action: %s, Message: %s",
                            rs.getLong("id"), rs.getString("action"), rs.getString("details")));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
