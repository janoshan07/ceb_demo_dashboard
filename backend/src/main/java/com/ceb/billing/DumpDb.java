package com.ceb.billing;

import java.io.ByteArrayInputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import org.apache.poi.ss.usermodel.*;

public class DumpDb {
    public static void main(String[] args) {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            Connection conn = DriverManager.getConnection(
                "jdbc:mysql://localhost:3306/ceb_billing_db?useSSL=false&allowPublicKeyRetrieval=true",
                "root",
                "Mj@251677"
            );
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery("SELECT filename, file_bytes FROM import_batches ORDER BY id DESC LIMIT 1");
            if (rs.next()) {
                String filename = rs.getString("filename");
                byte[] bytes = rs.getBytes("file_bytes");
                System.out.println("Last uploaded file: " + filename + " (" + bytes.length + " bytes)");
                
                try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                    for (int i = 0; i < wb.getNumberOfSheets(); i++) {
                        Sheet sheet = wb.getSheetAt(i);
                        System.out.println("Sheet: " + sheet.getSheetName());
                        for (int r = 0; r <= Math.min(5, sheet.getLastRowNum()); r++) {
                            Row row = sheet.getRow(r);
                            if (row == null) continue;
                            System.out.print("  Row " + r + ": ");
                            for (int c = 0; c < row.getLastCellNum(); c++) {
                                Cell cell = row.getCell(c);
                                System.out.print("[" + (cell == null ? "null" : cell.toString()) + "] ");
                            }
                            System.out.println();
                        }
                    }
                }
            } else {
                System.out.println("No import batches found.");
            }
            conn.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
