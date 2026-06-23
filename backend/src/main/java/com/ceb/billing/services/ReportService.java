package com.ceb.billing.services;

import com.ceb.billing.entities.Alert;
import com.ceb.billing.entities.BillingRecord;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
public class ReportService {

    @PersistenceContext
    private EntityManager entityManager;

    public List<Map<String, Object>> getMonthlyRevenueReport(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder(
                "SELECT YEAR(b.fromDate) as yr, MONTH(b.fromDate) as mo, " +
                "COALESCE(SUM(b.totalAmount), 0.0) as rev, " +
                "COALESCE(SUM(b.importUnits), 0.0) as imp, " +
                "COALESCE(SUM(b.exportUnits), 0.0) as exp " +
                "FROM BillingRecord b " +
                "WHERE 1=1 "
        );

        if (start != null) jpql.append("AND b.fromDate >= :start ");
        if (end != null) jpql.append("AND b.toDate <= :end ");
        if (branch != null && !branch.trim().isEmpty()) jpql.append("AND b.customer.branchCode = :branch ");

        jpql.append("GROUP BY YEAR(b.fromDate), MONTH(b.fromDate) ORDER BY yr DESC, mo DESC");

        jakarta.persistence.Query query = entityManager.createQuery(jpql.toString());
        if (start != null) query.setParameter("start", start);
        if (end != null) query.setParameter("end", end);
        if (branch != null && !branch.trim().isEmpty()) query.setParameter("branch", branch.trim());

        List<Object[]> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("year", row[0]);
            map.put("month", row[1]);
            map.put("revenue", row[2]);
            map.put("imports", row[3]);
            map.put("exports", row[4]);
            list.add(map);
        }
        return list;
    }

    public List<Map<String, Object>> getCustomerBillingReport(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder("SELECT b FROM BillingRecord b WHERE 1=1 ");

        if (start != null) jpql.append("AND b.fromDate >= :start ");
        if (end != null) jpql.append("AND b.toDate <= :end ");
        if (branch != null && !branch.trim().isEmpty()) jpql.append("AND b.customer.branchCode = :branch ");

        jpql.append("ORDER BY b.fromDate DESC");

        TypedQuery<BillingRecord> query = entityManager.createQuery(jpql.toString(), BillingRecord.class);
        if (start != null) query.setParameter("start", start);
        if (end != null) query.setParameter("end", end);
        if (branch != null && !branch.trim().isEmpty()) query.setParameter("branch", branch.trim());

        List<BillingRecord> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (BillingRecord record : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("accountNo", record.getCustomer().getAccountNo());
            map.put("customerName", record.getCustomer().getCustomerName());
            map.put("branchCode", record.getCustomer().getBranchCode());
            map.put("fromDate", record.getFromDate());
            map.put("toDate", record.getToDate());
            map.put("refNo", record.getRefNo());
            map.put("imports", record.getImportUnits());
            map.put("exports", record.getExportUnits());
            map.put("netUnit", record.getNetUnit());
            map.put("unitCost", record.getUnitCost());
            map.put("totalAmount", record.getTotalAmount());
            list.add(map);
        }
        return list;
    }

    public List<Map<String, Object>> getHighestExportersReport(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder(
                "SELECT b.customer.accountNo, b.customer.customerName, b.customer.branchCode, " +
                "SUM(b.exportUnits) as totalExport, SUM(b.totalAmount) as totalRevenue " +
                "FROM BillingRecord b " +
                "WHERE 1=1 "
        );

        if (start != null) jpql.append("AND b.fromDate >= :start ");
        if (end != null) jpql.append("AND b.toDate <= :end ");
        if (branch != null && !branch.trim().isEmpty()) jpql.append("AND b.customer.branchCode = :branch ");

        jpql.append("GROUP BY b.customer.accountNo, b.customer.customerName, b.customer.branchCode ORDER BY totalExport DESC");

        jakarta.persistence.Query query = entityManager.createQuery(jpql.toString());
        if (start != null) query.setParameter("start", start);
        if (end != null) query.setParameter("end", end);
        if (branch != null && !branch.trim().isEmpty()) query.setParameter("branch", branch.trim());

        List<Object[]> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("accountNo", row[0]);
            map.put("customerName", row[1]);
            map.put("branchCode", row[2]);
            map.put("exports", row[3]);
            map.put("revenue", row[4]);
            list.add(map);
        }
        return list;
    }

    public List<Map<String, Object>> getHighestImportersReport(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder(
                "SELECT b.customer.accountNo, b.customer.customerName, b.customer.branchCode, " +
                "SUM(b.importUnits) as totalImport, SUM(b.totalAmount) as totalRevenue " +
                "FROM BillingRecord b " +
                "WHERE 1=1 "
        );

        if (start != null) jpql.append("AND b.fromDate >= :start ");
        if (end != null) jpql.append("AND b.toDate <= :end ");
        if (branch != null && !branch.trim().isEmpty()) jpql.append("AND b.customer.branchCode = :branch ");

        jpql.append("GROUP BY b.customer.accountNo, b.customer.customerName, b.customer.branchCode ORDER BY totalImport DESC");

        jakarta.persistence.Query query = entityManager.createQuery(jpql.toString());
        if (start != null) query.setParameter("start", start);
        if (end != null) query.setParameter("end", end);
        if (branch != null && !branch.trim().isEmpty()) query.setParameter("branch", branch.trim());

        List<Object[]> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("accountNo", row[0]);
            map.put("customerName", row[1]);
            map.put("branchCode", row[2]);
            map.put("imports", row[3]);
            map.put("revenue", row[4]);
            list.add(map);
        }
        return list;
    }

    public List<Map<String, Object>> getBranchPerformanceReport(LocalDate start, LocalDate end) {
        StringBuilder jpql = new StringBuilder(
                "SELECT c.branchCode, COUNT(DISTINCT c.accountNo), " +
                "COALESCE(SUM(b.importUnits), 0.0), COALESCE(SUM(b.exportUnits), 0.0), " +
                "COALESCE(SUM(b.totalAmount), 0.0) " +
                "FROM Customer c " +
                "LEFT JOIN BillingRecord b ON c.accountNo = b.customer.accountNo " +
                "WHERE 1=1 "
        );

        if (start != null) jpql.append("AND (b.fromDate IS NULL OR b.fromDate >= :start) ");
        if (end != null) jpql.append("AND (b.toDate IS NULL OR b.toDate <= :end) ");

        jpql.append("GROUP BY c.branchCode ORDER BY c.branchCode ASC");

        jakarta.persistence.Query query = entityManager.createQuery(jpql.toString());
        if (start != null) query.setParameter("start", start);
        if (end != null) query.setParameter("end", end);

        List<Object[]> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("branchCode", row[0]);
            map.put("customerCount", row[1]);
            map.put("imports", row[2]);
            map.put("exports", row[3]);
            map.put("revenue", row[4]);
            list.add(map);
        }
        return list;
    }

    public List<Map<String, Object>> getSolarTypePerformanceReport(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder(
                "SELECT c.solarType, COUNT(DISTINCT c.accountNo), " +
                "COALESCE(SUM(b.importUnits), 0.0), COALESCE(SUM(b.exportUnits), 0.0), " +
                "COALESCE(SUM(b.totalAmount), 0.0) " +
                "FROM Customer c " +
                "LEFT JOIN BillingRecord b ON c.accountNo = b.customer.accountNo " +
                "WHERE 1=1 "
        );

        if (start != null) jpql.append("AND (b.fromDate IS NULL OR b.fromDate >= :start) ");
        if (end != null) jpql.append("AND (b.toDate IS NULL OR b.toDate <= :end) ");
        if (branch != null && !branch.trim().isEmpty()) jpql.append("AND c.branchCode = :branch ");

        jpql.append("GROUP BY c.solarType ORDER BY c.solarType ASC");

        jakarta.persistence.Query query = entityManager.createQuery(jpql.toString());
        if (start != null) query.setParameter("start", start);
        if (end != null) query.setParameter("end", end);
        if (branch != null && !branch.trim().isEmpty()) query.setParameter("branch", branch.trim());

        List<Object[]> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("solarType", row[0] != null ? row[0] : "None / Traditional");
            map.put("customerCount", row[1]);
            map.put("imports", row[2]);
            map.put("exports", row[3]);
            map.put("revenue", row[4]);
            list.add(map);
        }
        return list;
    }

    public List<Map<String, Object>> getAlertAnomalyReport(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder("SELECT a FROM Alert a WHERE 1=1 ");

        LocalDateTime startLdt = start != null ? start.atStartOfDay() : null;
        LocalDateTime endLdt = end != null ? end.atTime(LocalTime.MAX) : null;

        if (startLdt != null) jpql.append("AND a.createdAt >= :startLdt ");
        if (endLdt != null) jpql.append("AND a.createdAt <= :endLdt ");
        if (branch != null && !branch.trim().isEmpty()) {
            jpql.append("AND EXISTS (SELECT c FROM Customer c WHERE c.accountNo = a.accountNo AND c.branchCode = :branch) ");
        }

        jpql.append("ORDER BY a.createdAt DESC");

        TypedQuery<Alert> query = entityManager.createQuery(jpql.toString(), Alert.class);
        if (startLdt != null) query.setParameter("startLdt", startLdt);
        if (endLdt != null) query.setParameter("endLdt", endLdt);
        if (branch != null && !branch.trim().isEmpty()) query.setParameter("branch", branch.trim());

        List<Alert> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Alert alert : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("alertId", alert.getAlertId());
            map.put("accountNo", alert.getAccountNo());
            map.put("alertType", alert.getAlertType());
            map.put("severity", alert.getSeverity());
            map.put("message", alert.getMessage());
            map.put("status", alert.getStatus());
            map.put("createdAt", alert.getCreatedAt());
            list.add(map);
        }
        return list;
    }
}
