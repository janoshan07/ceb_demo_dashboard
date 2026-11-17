package com.ceb.billing.services;

import com.ceb.billing.entities.Alert;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.PaymentBatchItem;
import com.ceb.billing.models.PaymentEligibilityResult;
import com.ceb.billing.repositories.PaymentBatchItemRepository;
import com.ceb.billing.utils.BranchDetector;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired(required = false)
    private PaymentControlService paymentControlService;

    @Autowired(required = false)
    private PaymentBatchItemRepository paymentBatchItemRepository;

    private final Map<String, List<Map<String, Object>>> reportCache = new java.util.concurrent.ConcurrentHashMap<>();

    public void clearReportCache() {
        reportCache.clear();
    }

    private String makeCacheKey(String reportType, String billingMonth, String branch) {
        String bm = (billingMonth != null && !billingMonth.trim().isEmpty()) ? billingMonth.trim().toUpperCase() : "ALL";
        String br = (branch != null && !branch.trim().isEmpty()) ? branch.trim().toUpperCase() : "ALL";
        return reportType + "::" + bm + "::" + br;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. MONTHLY REVENUE REPORT
    // ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getMonthlyRevenueReport(LocalDate start, LocalDate end, String branch) {
        return getMonthlyRevenueReport(null, start, end, branch);
    }

    public List<Map<String, Object>> getMonthlyRevenueReport(String billingMonth, LocalDate start, LocalDate end, String branch) {
        String cacheKey = (start == null && end == null) ? makeCacheKey("MONTHLY_REVENUE", billingMonth, branch) : null;
        if (cacheKey != null) {
            List<Map<String, Object>> cached = reportCache.get(cacheKey);
            if (cached != null) return cached;
        }

        List<Map<String, Object>> records = loadReportRecords(billingMonth, start, end, branch);
        if (records.isEmpty() && hasDatabaseBillingRecords()) {
            return getMonthlyRevenueReportFromDb(start, end, branch);
        }

        Map<Integer, Map<String, Object>> monthlyMap = new TreeMap<>(Collections.reverseOrder());
        for (Map<String, Object> r : records) {
            LocalDate d = extractRecordDate(r);
            int year = d != null ? d.getYear() : 2026;
            int month = d != null ? d.getMonthValue() : 7;

            String bm = strVal(r.get("billingMonth"));
            if (!bm.isEmpty()) {
                int[] ym = parseYearMonthFromBillingMonth(bm);
                if (ym != null) {
                    year = ym[0];
                    month = ym[1];
                }
            }

            int key = year * 100 + month;
            Map<String, Object> group = monthlyMap.computeIfAbsent(key, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("year", k / 100);
                m.put("month", k % 100);
                m.put("revenue", 0.0);
                m.put("imports", 0.0);
                m.put("exports", 0.0);
                return m;
            });

            double rev = extractRevenue(r);
            double imp = extractImports(r);
            double exp = extractExports(r);

            group.put("revenue", (Double) group.get("revenue") + rev);
            group.put("imports", (Double) group.get("imports") + imp);
            group.put("exports", (Double) group.get("exports") + exp);
        }

        // Round financial and energy values cleanly
        List<Map<String, Object>> list = new ArrayList<>(monthlyMap.values());
        for (Map<String, Object> m : list) {
            m.put("revenue", Math.round((Double) m.get("revenue") * 100.0) / 100.0);
            m.put("imports", Math.round((Double) m.get("imports") * 100.0) / 100.0);
            m.put("exports", Math.round((Double) m.get("exports") * 100.0) / 100.0);
        }

        if (cacheKey != null) {
            reportCache.put(cacheKey, list);
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getMonthlyRevenueReportFromDb(LocalDate start, LocalDate end, String branch) {
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

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. CUSTOMER BILLING LEDGER
    // ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getCustomerBillingReport(LocalDate start, LocalDate end, String branch) {
        return getCustomerBillingReport(null, start, end, branch);
    }

    public List<Map<String, Object>> getCustomerBillingReport(String billingMonth, LocalDate start, LocalDate end, String branch) {
        String cacheKey = (start == null && end == null) ? makeCacheKey("CUSTOMER_BILLING", billingMonth, branch) : null;
        if (cacheKey != null) {
            List<Map<String, Object>> cached = reportCache.get(cacheKey);
            if (cached != null) return cached;
        }

        List<Map<String, Object>> records = loadReportRecords(billingMonth, start, end, branch);
        if (records.isEmpty() && hasDatabaseBillingRecords()) {
            return getCustomerBillingReportFromDb(start, end, branch);
        }

        List<Map<String, Object>> list = new ArrayList<>(records.size());
        for (Map<String, Object> r : records) {
            Map<String, Object> map = new LinkedHashMap<>(16);
            map.put("accountNo", strVal(r.get("accountNo")));
            map.put("customerName", resolveCustomerName(r));
            map.put("branchCode", resolveDivision(r));

            String fromDate = strVal(r.get("prevReadingDate"));
            if (fromDate.isEmpty()) fromDate = strVal(r.get("fromDate"));
            if (fromDate.isEmpty()) fromDate = strVal(r.get("billingPeriodFrom"));
            if (fromDate.isEmpty()) fromDate = strVal(r.get("billingFrom"));

            String toDate = strVal(r.get("currReadingDate"));
            if (toDate.isEmpty()) toDate = strVal(r.get("toDate"));
            if (toDate.isEmpty()) toDate = strVal(r.get("billingPeriodTo"));
            if (toDate.isEmpty()) toDate = strVal(r.get("billingTo"));

            map.put("fromDate", fromDate);
            map.put("toDate", toDate);
            map.put("refNo", strVal(r.get("refNo")));

            double imp = extractImports(r);
            double exp = extractExports(r);
            map.put("imports", imp);
            map.put("exports", exp);

            Object netUnitObj = r.get("netUnit");
            if (netUnitObj == null) netUnitObj = r.get("netUnits");
            if (netUnitObj == null) netUnitObj = r.get("kwhNet");
            double netUnit = netUnitObj != null ? parseDoubleSafe(netUnitObj) : (exp - imp);
            map.put("netUnit", Math.round(netUnit * 100.0) / 100.0);

            double unitRate = extractUnitRate(r);
            map.put("unitCost", unitRate);

            double totalAmount = extractRevenue(r);
            map.put("totalAmount", Math.round(totalAmount * 100.0) / 100.0);

            list.add(map);
        }

        // Sort by toDate DESC, then accountNo ASC
        list.sort((a, b) -> {
            String tA = strVal(a.get("toDate"));
            String tB = strVal(b.get("toDate"));
            int c = tB.compareTo(tA);
            if (c != 0) return c;
            return strVal(a.get("accountNo")).compareTo(strVal(b.get("accountNo")));
        });

        if (cacheKey != null) {
            reportCache.put(cacheKey, list);
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getCustomerBillingReportFromDb(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder(
                "SELECT b.customer.accountNo, b.customer.customerName, b.customer.branchCode, " +
                "b.fromDate, b.toDate, b.refNo, b.importUnits, b.exportUnits, b.netUnit, b.unitCost, b.totalAmount " +
                "FROM BillingRecord b " +
                "WHERE 1=1 "
        );

        if (start != null) jpql.append("AND b.fromDate >= :start ");
        if (end != null) jpql.append("AND b.toDate <= :end ");
        if (branch != null && !branch.trim().isEmpty()) jpql.append("AND b.customer.branchCode = :branch ");

        jpql.append("ORDER BY b.fromDate DESC");

        jakarta.persistence.Query query = entityManager.createQuery(jpql.toString());
        if (start != null) query.setParameter("start", start);
        if (end != null) query.setParameter("end", end);
        if (branch != null && !branch.trim().isEmpty()) query.setParameter("branch", branch.trim());

        List<Object[]> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>(results.size());
        for (Object[] row : results) {
            Map<String, Object> map = new LinkedHashMap<>(16);
            map.put("accountNo", row[0]);
            map.put("customerName", row[1]);
            map.put("branchCode", row[2]);
            map.put("fromDate", row[3]);
            map.put("toDate", row[4]);
            map.put("refNo", row[5]);
            map.put("imports", row[6]);
            map.put("exports", row[7]);
            map.put("netUnit", row[8]);
            map.put("unitCost", row[9]);
            map.put("totalAmount", row[10]);
            list.add(map);
        }
        return list;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. HIGHEST SOLAR EXPORTERS
    // ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getHighestExportersReport(LocalDate start, LocalDate end, String branch) {
        return getHighestExportersReport(null, start, end, branch);
    }

    public List<Map<String, Object>> getHighestExportersReport(String billingMonth, LocalDate start, LocalDate end, String branch) {
        String cacheKey = (start == null && end == null) ? makeCacheKey("HIGHEST_EXPORTERS", billingMonth, branch) : null;
        if (cacheKey != null) {
            List<Map<String, Object>> cached = reportCache.get(cacheKey);
            if (cached != null) return cached;
        }

        List<Map<String, Object>> records = loadReportRecords(billingMonth, start, end, branch);
        if (records.isEmpty() && hasDatabaseBillingRecords()) {
            return getHighestExportersReportFromDb(start, end, branch);
        }

        Map<String, Map<String, Object>> agg = new LinkedHashMap<>();
        for (Map<String, Object> r : records) {
            String acc = strVal(r.get("accountNo"));
            if (acc.isEmpty()) continue;

            Map<String, Object> map = agg.computeIfAbsent(acc, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("accountNo", k);
                m.put("customerName", resolveCustomerName(r));
                m.put("branchCode", resolveDivision(r));
                m.put("exports", 0.0);
                m.put("revenue", 0.0);
                return m;
            });

            map.put("exports", (Double) map.get("exports") + extractExports(r));
            map.put("revenue", (Double) map.get("revenue") + extractRevenue(r));
        }

        List<Map<String, Object>> list = new ArrayList<>(agg.values());
        list.sort((a, b) -> Double.compare((Double) b.get("exports"), (Double) a.get("exports")));

        for (Map<String, Object> m : list) {
            m.put("exports", Math.round((Double) m.get("exports") * 100.0) / 100.0);
            m.put("revenue", Math.round((Double) m.get("revenue") * 100.0) / 100.0);
        }

        if (list.size() > 100) {
            list = list.subList(0, 100);
        }
        if (cacheKey != null) {
            reportCache.put(cacheKey, list);
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getHighestExportersReportFromDb(LocalDate start, LocalDate end, String branch) {
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

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. HIGHEST IMPORT CONSUMERS
    // ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getHighestImportersReport(LocalDate start, LocalDate end, String branch) {
        return getHighestImportersReport(null, start, end, branch);
    }

    public List<Map<String, Object>> getHighestImportersReport(String billingMonth, LocalDate start, LocalDate end, String branch) {
        String cacheKey = (start == null && end == null) ? makeCacheKey("HIGHEST_IMPORTERS", billingMonth, branch) : null;
        if (cacheKey != null) {
            List<Map<String, Object>> cached = reportCache.get(cacheKey);
            if (cached != null) return cached;
        }

        List<Map<String, Object>> records = loadReportRecords(billingMonth, start, end, branch);
        if (records.isEmpty() && hasDatabaseBillingRecords()) {
            return getHighestImportersReportFromDb(start, end, branch);
        }

        Map<String, Map<String, Object>> agg = new LinkedHashMap<>();
        for (Map<String, Object> r : records) {
            String acc = strVal(r.get("accountNo"));
            if (acc.isEmpty()) continue;

            Map<String, Object> map = agg.computeIfAbsent(acc, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("accountNo", k);
                m.put("customerName", resolveCustomerName(r));
                m.put("branchCode", resolveDivision(r));
                m.put("imports", 0.0);
                m.put("revenue", 0.0);
                return m;
            });

            map.put("imports", (Double) map.get("imports") + extractImports(r));
            map.put("revenue", (Double) map.get("revenue") + extractRevenue(r));
        }

        List<Map<String, Object>> list = new ArrayList<>(agg.values());
        list.sort((a, b) -> Double.compare((Double) b.get("imports"), (Double) a.get("imports")));

        for (Map<String, Object> m : list) {
            m.put("imports", Math.round((Double) m.get("imports") * 100.0) / 100.0);
            m.put("revenue", Math.round((Double) m.get("revenue") * 100.0) / 100.0);
        }

        if (list.size() > 100) {
            list = list.subList(0, 100);
        }
        if (cacheKey != null) {
            reportCache.put(cacheKey, list);
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getHighestImportersReportFromDb(LocalDate start, LocalDate end, String branch) {
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

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. BRANCH PERFORMANCE SUMMARY
    // ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getBranchPerformanceReport(LocalDate start, LocalDate end) {
        return getBranchPerformanceReport(null, start, end);
    }

    public List<Map<String, Object>> getBranchPerformanceReport(String billingMonth, LocalDate start, LocalDate end) {
        String cacheKey = (start == null && end == null) ? makeCacheKey("BRANCH_PERFORMANCE", billingMonth, "ALL") : null;
        if (cacheKey != null) {
            List<Map<String, Object>> cached = reportCache.get(cacheKey);
            if (cached != null) return cached;
        }

        List<Map<String, Object>> records = loadReportRecords(billingMonth, start, end, null);
        if (records.isEmpty() && hasDatabaseBillingRecords()) {
            return getBranchPerformanceReportFromDb(start, end);
        }

        List<String> canonicalDivisions = List.of("Ampara", "Batticaloa", "Kalmunai", "Trincomalee", "Valaichenai");
        Map<String, Map<String, Object>> branchMap = new LinkedHashMap<>();
        for (String div : canonicalDivisions) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("branchCode", div);
            m.put("customerCount", 0L);
            m.put("imports", 0.0);
            m.put("exports", 0.0);
            m.put("revenue", 0.0);
            branchMap.put(div, m);
        }

        Map<String, Set<String>> customersPerBranch = new HashMap<>();
        for (String div : canonicalDivisions) {
            customersPerBranch.put(div, new HashSet<>());
        }

        for (Map<String, Object> r : records) {
            String div = resolveDivision(r);
            String canon = BranchDetector.canonicalDivision(div);
            if (canon.isEmpty()) canon = div;

            Map<String, Object> m = branchMap.computeIfAbsent(canon, k -> {
                Map<String, Object> nm = new LinkedHashMap<>();
                nm.put("branchCode", k);
                nm.put("customerCount", 0L);
                nm.put("imports", 0.0);
                nm.put("exports", 0.0);
                nm.put("revenue", 0.0);
                return nm;
            });

            String acc = strVal(r.get("accountNo"));
            if (!acc.isEmpty()) {
                customersPerBranch.computeIfAbsent(canon, k -> new HashSet<>()).add(acc);
            }

            m.put("imports", (Double) m.get("imports") + extractImports(r));
            m.put("exports", (Double) m.get("exports") + extractExports(r));
            m.put("revenue", (Double) m.get("revenue") + extractRevenue(r));
        }

        for (Map.Entry<String, Map<String, Object>> e : branchMap.entrySet()) {
            Set<String> set = customersPerBranch.get(e.getKey());
            e.getValue().put("customerCount", (long) (set != null ? set.size() : 0));
            e.getValue().put("imports", Math.round((Double) e.getValue().get("imports") * 100.0) / 100.0);
            e.getValue().put("exports", Math.round((Double) e.getValue().get("exports") * 100.0) / 100.0);
            e.getValue().put("revenue", Math.round((Double) e.getValue().get("revenue") * 100.0) / 100.0);
        }

        List<Map<String, Object>> list = new ArrayList<>(branchMap.values());
        list.sort((a, b) -> Double.compare((Double) b.get("revenue"), (Double) a.get("revenue")));
        if (cacheKey != null) {
            reportCache.put(cacheKey, list);
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getBranchPerformanceReportFromDb(LocalDate start, LocalDate end) {
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

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. SOLAR CONNECTION DISTRIBUTION
    // ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getSolarTypePerformanceReport(LocalDate start, LocalDate end, String branch) {
        return getSolarTypePerformanceReport(null, start, end, branch);
    }

    public List<Map<String, Object>> getSolarTypePerformanceReport(String billingMonth, LocalDate start, LocalDate end, String branch) {
        String cacheKey = (start == null && end == null) ? makeCacheKey("SOLAR_TYPE", billingMonth, branch) : null;
        if (cacheKey != null) {
            List<Map<String, Object>> cached = reportCache.get(cacheKey);
            if (cached != null) return cached;
        }

        List<Map<String, Object>> records = loadReportRecords(billingMonth, start, end, branch);
        if (records.isEmpty() && hasDatabaseBillingRecords()) {
            return getSolarTypePerformanceReportFromDb(start, end, branch);
        }

        Map<String, Map<String, Object>> solarMap = new LinkedHashMap<>();
        Map<String, Set<String>> customersPerType = new HashMap<>();

        for (Map<String, Object> r : records) {
            String st = resolveSolarType(r);
            Map<String, Object> m = solarMap.computeIfAbsent(st, k -> {
                Map<String, Object> nm = new LinkedHashMap<>();
                nm.put("solarType", k);
                nm.put("customerCount", 0L);
                nm.put("imports", 0.0);
                nm.put("exports", 0.0);
                nm.put("revenue", 0.0);
                return nm;
            });

            String acc = strVal(r.get("accountNo"));
            if (!acc.isEmpty()) {
                customersPerType.computeIfAbsent(st, k -> new HashSet<>()).add(acc);
            }

            m.put("imports", (Double) m.get("imports") + extractImports(r));
            m.put("exports", (Double) m.get("exports") + extractExports(r));
            m.put("revenue", (Double) m.get("revenue") + extractRevenue(r));
        }

        for (Map.Entry<String, Map<String, Object>> e : solarMap.entrySet()) {
            Set<String> set = customersPerType.get(e.getKey());
            e.getValue().put("customerCount", (long) (set != null ? set.size() : 0));
            e.getValue().put("imports", Math.round((Double) e.getValue().get("imports") * 100.0) / 100.0);
            e.getValue().put("exports", Math.round((Double) e.getValue().get("exports") * 100.0) / 100.0);
            e.getValue().put("revenue", Math.round((Double) e.getValue().get("revenue") * 100.0) / 100.0);
        }

        List<Map<String, Object>> list = new ArrayList<>(solarMap.values());
        list.sort((a, b) -> Long.compare((Long) b.get("customerCount"), (Long) a.get("customerCount")));
        if (cacheKey != null) {
            reportCache.put(cacheKey, list);
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getSolarTypePerformanceReportFromDb(LocalDate start, LocalDate end, String branch) {
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

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. ALERT ANOMALY AUDIT LOG
    // ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getAlertAnomalyReport(LocalDate start, LocalDate end, String branch) {
        StringBuilder jpql = new StringBuilder("SELECT a FROM Alert a WHERE 1=1 ");

        LocalDateTime startLdt = start != null ? start.atStartOfDay() : null;
        LocalDateTime endLdt = end != null ? end.atTime(LocalTime.MAX) : null;

        if (startLdt != null) jpql.append("AND a.createdAt >= :startLdt ");
        if (endLdt != null) jpql.append("AND a.createdAt <= :endLdt ");

        String canonBranch = (branch != null && !branch.trim().isEmpty() && !"ALL".equalsIgnoreCase(branch.trim()))
                ? BranchDetector.canonicalDivision(branch) : "";

        // If division/branch is specified, filter by account prefix directly
        String branchPrefix = canonBranch.isEmpty() ? null : BranchDetector.BRANCH_TO_PREFIX.get(canonBranch);
        if (branchPrefix != null) {
            jpql.append("AND a.accountNo LIKE :branchPattern ");
        }

        jpql.append("ORDER BY a.createdAt DESC");

        TypedQuery<Alert> query = entityManager.createQuery(jpql.toString(), Alert.class);
        if (startLdt != null) query.setParameter("startLdt", startLdt);
        if (endLdt != null) query.setParameter("endLdt", endLdt);
        if (branchPrefix != null) query.setParameter("branchPattern", branchPrefix + "%");

        List<Alert> results = query.getResultList();
        List<Map<String, Object>> list = new ArrayList<>(results.size());
        for (Alert alert : results) {
            // Verify branch detection if branch filter was supplied
            if (!canonBranch.isEmpty()) {
                String accBranch = BranchDetector.detectBranch(alert.getAccountNo());
                if (accBranch != null && !canonBranch.equalsIgnoreCase(accBranch)) {
                    continue;
                }
            }
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("alertId", alert.getAlertId());
            map.put("accountNo", alert.getAccountNo());
            map.put("alertType", alert.getAlertType() != null ? alert.getAlertType() : "");
            map.put("severity", alert.getSeverity() != null ? alert.getSeverity() : "INFO");
            map.put("message", alert.getMessage() != null ? alert.getMessage() : "");
            map.put("status", alert.getStatus() != null ? alert.getStatus() : "UNREAD");
            map.put("createdAt", alert.getCreatedAt());
            list.add(map);
        }
        return list;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // HELPER METHODS FOR REPORT GENERATION & DATA NORMALIZATION
    // ─────────────────────────────────────────────────────────────────────────────

    private List<Map<String, Object>> loadReportRecords(String billingMonth, LocalDate start, LocalDate end, String branch) {
        if (paymentControlService == null) {
            return Collections.emptyList();
        }

        String bm = billingMonth != null ? billingMonth.trim() : "";
        if ("ALL".equalsIgnoreCase(bm) || "All Billing Months".equalsIgnoreCase(bm)) {
            bm = "";
        }

        String div = branch != null ? branch.trim() : "";
        if ("ALL".equalsIgnoreCase(div) || "All Branches".equalsIgnoreCase(div) || "All Divisions".equalsIgnoreCase(div)) {
            div = "";
        }

        List<Map<String, Object>> all = paymentControlService.loadCanonicalRecords(bm, div);
        if (all == null || all.isEmpty()) {
            return Collections.emptyList();
        }

        if (start != null || end != null) {
            List<Map<String, Object>> filtered = new ArrayList<>(all.size());
            for (Map<String, Object> r : all) {
                if (matchesDateFilter(r, start, end)) {
                    filtered.add(r);
                }
            }
            return filtered;
        }

        return all;
    }

    private boolean hasDatabaseBillingRecords() {
        try {
            if (entityManager == null) return false;
            Long count = entityManager.createQuery("SELECT COUNT(b) FROM BillingRecord b", Long.class).getSingleResult();
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean matchesDateFilter(Map<String, Object> r, LocalDate start, LocalDate end) {
        if (start == null && end == null) return true;
        LocalDate recDate = extractRecordDate(r);
        if (recDate == null) return true;
        if (start != null && recDate.isBefore(start)) return false;
        if (end != null && recDate.isAfter(end)) return false;
        return true;
    }

    private LocalDate extractRecordDate(Map<String, Object> r) {
        LocalDate d = parseDateSafe(r.get("currReadingDate"));
        if (d == null) d = parseDateSafe(r.get("toDate"));
        if (d == null) d = parseDateSafe(r.get("billingPeriodTo"));
        if (d == null) d = parseDateSafe(r.get("billingTo"));
        if (d == null) d = parseDateSafe(r.get("prevReadingDate"));
        if (d == null) d = parseDateSafe(r.get("fromDate"));
        if (d == null) d = parseDateSafe(r.get("billingPeriodFrom"));
        if (d == null) d = parseDateSafe(r.get("billingFrom"));
        if (d == null) {
            String bm = strVal(r.get("billingMonth"));
            int[] ym = parseYearMonthFromBillingMonth(bm);
            if (ym != null) {
                d = LocalDate.of(ym[0], ym[1], 1);
            }
        }
        return d;
    }

    private int[] parseYearMonthFromBillingMonth(String bm) {
        if (bm == null || bm.trim().isEmpty()) return null;
        String clean = bm.trim().toLowerCase();
        int month = 7;
        if (clean.contains("jan")) month = 1;
        else if (clean.contains("feb")) month = 2;
        else if (clean.contains("mar")) month = 3;
        else if (clean.contains("apr")) month = 4;
        else if (clean.contains("may")) month = 5;
        else if (clean.contains("jun")) month = 6;
        else if (clean.contains("jul")) month = 7;
        else if (clean.contains("aug")) month = 8;
        else if (clean.contains("sep")) month = 9;
        else if (clean.contains("oct")) month = 10;
        else if (clean.contains("nov")) month = 11;
        else if (clean.contains("dec")) month = 12;

        int year = 2026;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(20\\d\\d)").matcher(bm);
        if (m.find()) {
            try {
                year = Integer.parseInt(m.group(1));
            } catch (Exception ignored) {}
        }
        return new int[]{year, month};
    }

    private LocalDate parseDateSafe(Object obj) {
        if (obj == null) return null;
        if (obj instanceof LocalDate) return (LocalDate) obj;
        if (obj instanceof java.sql.Date) return ((java.sql.Date) obj).toLocalDate();
        String s = obj.toString().trim();
        if (s.isEmpty()) return null;
        try {
            if (s.length() >= 10) {
                return LocalDate.parse(s.substring(0, 10));
            }
        } catch (Exception ignored) {}
        return null;
    }

    private double extractRevenue(Map<String, Object> r) {
        Double val = parseDouble(r.get("salesAmount"));
        if (val != null && val > 0) return val;
        val = parseDouble(r.get("energyPurchase"));
        if (val != null && val > 0) return val;
        val = parseDouble(r.get("totalAmount"));
        if (val != null && val > 0) return val;
        val = parseDouble(r.get("paymentSettled"));
        if (val != null && val > 0) return val;
        val = parseDouble(r.get("payment"));
        if (val != null && val > 0) return val;
        return val != null ? val : 0.0;
    }

    private double extractImports(Map<String, Object> r) {
        Double val = parseDouble(r.get("kwhImport"));
        if (val != null) return val;
        val = parseDouble(r.get("importUnits"));
        if (val != null) return val;
        val = parseDouble(r.get("imports"));
        if (val != null) return val;
        return 0.0;
    }

    private double extractExports(Map<String, Object> r) {
        Double val = parseDouble(r.get("kwhExport"));
        if (val != null) return val;
        val = parseDouble(r.get("exportUnits"));
        if (val != null) return val;
        val = parseDouble(r.get("exports"));
        if (val != null) return val;
        return 0.0;
    }

    private double extractUnitRate(Map<String, Object> r) {
        Double val = parseDouble(r.get("unitRate"));
        if (val != null && val > 0) return val;
        val = parseDouble(r.get("ngenUnitRate"));
        if (val != null && val > 0) return val;
        val = parseDouble(r.get("masterUnitRate"));
        if (val != null && val > 0) return val;
        val = parseDouble(r.get("unitCost"));
        if (val != null && val > 0) return val;
        return 0.0;
    }

    private String resolveDivision(Map<String, Object> rec) {
        String div = strVal(rec.get("division"));
        if (div.isEmpty()) div = strVal(rec.get("snapshotDivision"));
        if (div.isEmpty()) div = strVal(rec.get("branchCode"));
        if (div.isEmpty()) div = strVal(rec.get("location"));
        String canon = BranchDetector.canonicalDivision(div);
        if (!canon.isEmpty()) return canon;
        String acc = strVal(rec.get("accountNo"));
        String detected = BranchDetector.detectBranch(acc);
        if (detected != null && !detected.isEmpty()) return detected;
        return div.isEmpty() ? "Eastern Province" : div;
    }

    private String resolveSolarType(Map<String, Object> rec) {
        String st = strVal(rec.get("solarType"));
        if (st.isEmpty()) st = strVal(rec.get("masterNetType"));
        if (st.isEmpty()) st = strVal(rec.get("ngenNetType"));
        if (st.isEmpty()) st = strVal(rec.get("npayNetType"));
        if (st.isEmpty()) return "Net Accounting";
        String lower = st.toLowerCase();
        if (lower.contains("plus plus") || lower.contains("++") || lower.contains("net++")) return "Net Plus Plus";
        if (lower.contains("plus") || lower.contains("net+")) return "Net Plus";
        if (lower.contains("metering")) return "Net Metering";
        if (lower.contains("accounting")) return "Net Accounting";
        return st;
    }

    private double parseDoubleSafe(Object obj) {
        Double d = parseDouble(obj);
        return d != null ? d : 0.0;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PAYMENT READY REPORT IMPLEMENTATION
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Retrieves strictly PAYMENT READY billing records according to the enterprise
     * rules enforced by PaymentControlService.canPay(record).
     */
    public Map<String, Object> getPaymentReadyReport(String billingMonth, String division,
                                                    String accountNo, String customerName) {
        Map<String, Object> response = new LinkedHashMap<>();

        if (paymentControlService == null) {
            response.put("summary", buildReportSummary(billingMonth, division, 0, 0.0, 0.0, 0.0, 0.0));
            response.put("records", Collections.emptyList());
            return response;
        }

        long t0 = System.currentTimeMillis();

        // 1. Load canonical records strictly adhering to billing period and division isolation
        List<Map<String, Object>> allRecords = paymentControlService.loadCanonicalRecords(billingMonth, division);

        long t1 = System.currentTimeMillis();

        // 2. Pre-fetch batch items to ensure settled/processed records are excluded
        Map<String, PaymentBatchItem> batchItemMap = new HashMap<>();
        if (paymentBatchItemRepository != null) {
            try {
                List<PaymentBatchItem> allBatchItems = paymentBatchItemRepository.findAll();
                for (PaymentBatchItem bi : allBatchItems) {
                    if (bi.getBatch() != null && bi.getBatch().getBillingPeriod() != null && bi.getAccountNo() != null) {
                        String k = bi.getAccountNo().trim().toLowerCase() + "::"
                                + bi.getBatch().getBillingPeriod().trim().toLowerCase();
                        batchItemMap.put(k, bi);
                    }
                }
            } catch (Exception ignored) {
            }
        }

        List<Map<String, Object>> recordsList = new ArrayList<>();
        double totalAmountSum = 0.0;
        double totalBillSetOffSum = 0.0;
        double totalStampDutySum = 0.0;
        double totalAmountPayableSum = 0.0;
        int sNo = 1;

        // ── OPTIMISATION: Pre-lower-case the filter strings once ──────────────
        final String accFilter  = accountNo    != null ? accountNo.trim().toLowerCase()    : "";
        final String nameFilter = customerName != null ? customerName.trim().toLowerCase() : "";

        for (Map<String, Object> rec : allRecords) {

            // ── CHEAP FILTERS FIRST (skip expensive canPay() when possible) ──

            // Account number cheap filter
            String acc = strVal(rec.get("accountNo"));
            if (acc.isEmpty()) continue;
            if (!accFilter.isEmpty() && !acc.toLowerCase().contains(accFilter)) continue;

            // Customer name cheap filter
            String resolvedName = resolveCustomerName(rec);
            if (!nameFilter.isEmpty() && !resolvedName.toLowerCase().contains(nameFilter)) continue;

            // ── EXPENSIVE ENTERPRISE ELIGIBILITY CHECK ────────────────────────
            PaymentEligibilityResult elig = paymentControlService.canPay(rec);
            if (elig == null || !elig.isEligible()) {
                continue;
            }

            String status = elig.getPaymentStatus();
            if (!"READY".equalsIgnoreCase(status)) {
                continue;
            }

            String bMonth = strVal(rec.get("billingMonth"));
            if (bMonth.isEmpty()) {
                bMonth = strVal(rec.get("billingPeriod"));
            }

            // Exclude already settled / paid batch items
            PaymentBatchItem bItem = !bMonth.isEmpty()
                    ? batchItemMap.get(acc.trim().toLowerCase() + "::" + bMonth.trim().toLowerCase())
                    : null;
            if (bItem != null && bItem.getBatch() != null) {
                String biStatus = strVal(bItem.getPaymentStatus());
                String bStatus  = strVal(bItem.getBatch().getStatus());
                if ("PAID".equalsIgnoreCase(biStatus) || "PAID".equalsIgnoreCase(bStatus)
                        || "PAYMENT_PROCESSED".equalsIgnoreCase(bStatus) || "APPROVED".equalsIgnoreCase(bStatus)) {
                    continue;
                }
            }

            // Extract accurate financial values
            Map<String, Double> fin = elig.getFinancials();
            double currentPayment  = fin.getOrDefault("currentPayment", 0.0);
            double billSetOff      = fin.getOrDefault("billSetOff",     0.0);
            double stampDuty       = fin.getOrDefault("stampDuty",      0.0);
            double amountPayable   = fin.getOrDefault("amountPayable",  fin.getOrDefault("totalPayable", 0.0));

            // Extract dates
            String fromDate = strVal(rec.get("fromDate"));
            if (fromDate.isEmpty()) fromDate = strVal(rec.get("prevReadingDate"));
            if (fromDate.isEmpty()) fromDate = strVal(rec.get("billingFrom"));
            if (fromDate.isEmpty()) fromDate = strVal(rec.get("periodFrom"));

            String toDate = strVal(rec.get("toDate"));
            if (toDate.isEmpty()) toDate = strVal(rec.get("currReadingDate"));
            if (toDate.isEmpty()) toDate = strVal(rec.get("billingTo"));
            if (toDate.isEmpty()) toDate = strVal(rec.get("periodTo"));

            // Extract units
            Double impUnits = parseDouble(rec.get("kwhImport"));
            if (impUnits == null) impUnits = parseDouble(rec.get("importUnits"));
            if (impUnits == null) impUnits = parseDouble(rec.get("imports"));
            if (impUnits == null) impUnits = 0.0;

            Double expUnits = parseDouble(rec.get("kwhExport"));
            if (expUnits == null) expUnits = parseDouble(rec.get("exportUnits"));
            if (expUnits == null) expUnits = parseDouble(rec.get("exports"));
            if (expUnits == null) expUnits = 0.0;

            Double netUnits = parseDouble(rec.get("kwhNet"));
            if (netUnits == null) netUnits = parseDouble(rec.get("netUnits"));
            if (netUnits == null) netUnits = parseDouble(rec.get("kwhSales"));
            if (netUnits == null) netUnits = expUnits - impUnits;

            // Unit rate / cost
            Double unitCost = parseDouble(rec.get("unitRate"));
            if (unitCost == null) unitCost = parseDouble(rec.get("unitCost"));
            if (unitCost == null) unitCost = parseDouble(rec.get("ngenUnitRate"));
            if (unitCost == null) unitCost = parseDouble(rec.get("masterUnitRate"));
            if (unitCost == null) unitCost = 0.0;

            // Expense code (L-Code)
            String expCode = strVal(rec.get("expenseCode"));
            if (expCode.isEmpty()) expCode = strVal(rec.get("expCode"));
            if (expCode.isEmpty()) expCode = strVal(rec.get("lCode"));
            if (expCode.isEmpty()) {
                String solarType  = strVal(rec.get("solarType"));
                if (solarType.isEmpty()) solarType = strVal(rec.get("masterNetType"));
                String tariffType = strVal(rec.get("tariffType"));
                if (tariffType.isEmpty()) tariffType = strVal(rec.get("masterTariffType"));
                if (!solarType.isEmpty()) {
                    expCode = ExcelValidationService.deriveLCode(solarType, !tariffType.isEmpty() ? tariffType : "FIXED");
                }
            }
            if (expCode.isEmpty()) {
                expCode = "L5001";
            }

            // Bank details
            String bankCode = strVal(rec.get("bankCode"));
            if (bankCode.isEmpty()) bankCode = strVal(rec.get("masterBankCode"));

            String branchCode = strVal(rec.get("branchCode"));
            if (branchCode.isEmpty()) branchCode = strVal(rec.get("masterBranchCode"));

            String bankAccountNo = strVal(rec.get("bankAccountNo"));
            if (bankAccountNo.isEmpty()) bankAccountNo = strVal(rec.get("masterBankAccountNo"));

            String refNo = strVal(rec.get("refNo"));
            if (refNo.isEmpty()) refNo = strVal(rec.get("masterRefNo"));

            String recDivision = strVal(rec.get("division"));
            if (recDivision.isEmpty()) recDivision = strVal(rec.get("snapshotDivision"));
            if (recDivision.isEmpty()) recDivision = strVal(rec.get("location"));

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("sNo", sNo++);
            row.put("accountNo", acc);
            row.put("customerName", resolvedName);
            row.put("refNo", refNo);
            row.put("billingPeriodFrom", fromDate);
            row.put("billingPeriodTo", toDate);
            row.put("importUnits", Math.round(impUnits));
            row.put("exportUnits", Math.round(expUnits));
            row.put("netUnits", Math.round(netUnits));
            row.put("unitCost", unitCost);
            row.put("expCode", expCode);
            row.put("bankCode", bankCode);
            row.put("branchCode", branchCode);
            row.put("bankAccountNo", bankAccountNo);
            row.put("totalAmount", Math.round(currentPayment * 100.0) / 100.0);
            row.put("billSetOff", Math.round(billSetOff * 100.0) / 100.0);
            row.put("stampDuty", Math.round(stampDuty * 100.0) / 100.0);
            row.put("amountPayable", Math.round(amountPayable * 100.0) / 100.0);
            row.put("billingMonth", bMonth);
            row.put("division", recDivision);
            row.put("paymentStatus", "READY");

            recordsList.add(row);

            totalAmountSum      += currentPayment;
            totalBillSetOffSum  += billSetOff;
            totalStampDutySum   += stampDuty;
            totalAmountPayableSum += amountPayable;
        }

        long t2 = System.currentTimeMillis();
        log.info("PERF [PaymentReadyReport] load={}ms eval={}ms total={}ms records={}",
                t1 - t0, t2 - t1, t2 - t0, recordsList.size());

        response.put("summary", buildReportSummary(billingMonth, division, recordsList.size(),
                totalAmountSum, totalBillSetOffSum, totalStampDutySum, totalAmountPayableSum));
        response.put("records", recordsList);

        return response;
    }

    private Map<String, Object> buildReportSummary(String billingMonth, String division, int totalCustomers,
                                                  double totalAmount, double totalBillSetOff,
                                                  double totalStampDuty, double totalAmountPayable) {
        Map<String, Object> summary = new LinkedHashMap<>();
        String bMonthStr = (billingMonth == null || billingMonth.trim().isEmpty() || "ALL".equalsIgnoreCase(billingMonth))
                ? "ALL BILLING MONTHS"
                : billingMonth.trim().toUpperCase();

        String divStr = (division == null || division.trim().isEmpty() || "ALL".equalsIgnoreCase(division))
                ? "ALL DIVISIONS"
                : division.trim().toUpperCase();

        summary.put("reportTitle", "SLIP TRANSACTION LISTING - PAYMENT OF NET ACCOUNTING / NET PLUS / NET PLUS PLUS");
        summary.put("selectedBillingMonth", bMonthStr);
        summary.put("selectedDivision", divStr);
        summary.put("costCentre", "EASTERN PROVINCE / " + divStr);
        summary.put("paymentDate", LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy.MM.dd")));
        summary.put("totalPaymentReadyCustomers", totalCustomers);
        summary.put("totalAmountSum", Math.round(totalAmount * 100.0) / 100.0);
        summary.put("totalBillSetOffSum", Math.round(totalBillSetOff * 100.0) / 100.0);
        summary.put("totalStampDutySum", Math.round(totalStampDuty * 100.0) / 100.0);
        summary.put("totalAmountPayableSum", Math.round(totalAmountPayable * 100.0) / 100.0);
        summary.put("reportGeneratedDate", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        return summary;
    }

    private String resolveCustomerName(Map<String, Object> rec) {
        String name = strVal(rec.get("customerName"));
        if (name.isEmpty()) name = strVal(rec.get("masterName"));
        if (name.isEmpty()) name = strVal(rec.get("npayName"));
        if (name.isEmpty()) name = strVal(rec.get("ngenName"));
        return name;
    }

    /**
     * Generates an Excel workbook (.xlsx) matching the Slip Transaction Listing layout.
     */
    public byte[] generatePaymentReadyExcel(String billingMonth, String division,
                                           String accountNo, String customerName) throws IOException {
        long tExcel0 = System.currentTimeMillis();

        @SuppressWarnings("unchecked")
        Map<String, Object> report = getPaymentReadyReport(billingMonth, division, accountNo, customerName);
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) report.get("summary");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) report.get("records");

        // ── OPTIMISATION: Pre-size the output stream to avoid repeated array resizes ──
        // Approximate: ~350 bytes per data row + 8 KB overhead for styles/headers
        int estimatedSize = records.size() * 350 + 8192;

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream(estimatedSize)) {
            XSSFSheet sheet = workbook.createSheet("Payment Ready Slip Listing");
            sheet.setDisplayGridlines(true);

            // Palette colors: pastel pink header (#FADBD8)
            byte[] headerRgb = new byte[]{(byte) 250, (byte) 219, (byte) 216};
            XSSFColor headerPink = new XSSFColor(headerRgb, null);

            // Cell Styles
            XSSFFont titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 12);
            titleFont.setFontName("Arial");

            XSSFCellStyle titleStyle = workbook.createCellStyle();
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFFont metaFont = workbook.createFont();
            metaFont.setBold(true);
            metaFont.setFontHeightInPoints((short) 9);
            metaFont.setFontName("Arial");

            XSSFCellStyle metaLeftStyle = workbook.createCellStyle();
            metaLeftStyle.setFont(metaFont);
            metaLeftStyle.setAlignment(HorizontalAlignment.LEFT);

            XSSFCellStyle metaRightStyle = workbook.createCellStyle();
            metaRightStyle.setFont(metaFont);
            metaRightStyle.setAlignment(HorizontalAlignment.RIGHT);

            XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 8);
            headerFont.setFontName("Arial");

            XSSFCellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(headerPink);
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setWrapText(true);
            setThinBorders(headerStyle);

            XSSFFont dataFont = workbook.createFont();
            dataFont.setFontHeightInPoints((short) 8);
            dataFont.setFontName("Arial");

            XSSFCellStyle dataLeft = workbook.createCellStyle();
            dataLeft.setFont(dataFont);
            dataLeft.setAlignment(HorizontalAlignment.LEFT);
            dataLeft.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorders(dataLeft);

            XSSFCellStyle dataCenter = workbook.createCellStyle();
            dataCenter.setFont(dataFont);
            dataCenter.setAlignment(HorizontalAlignment.CENTER);
            dataCenter.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorders(dataCenter);

            DataFormat df = workbook.createDataFormat();

            XSSFCellStyle dataInt = workbook.createCellStyle();
            dataInt.setFont(dataFont);
            dataInt.setAlignment(HorizontalAlignment.RIGHT);
            dataInt.setVerticalAlignment(VerticalAlignment.CENTER);
            dataInt.setDataFormat(df.getFormat("#,##0"));
            setThinBorders(dataInt);

            XSSFCellStyle dataCurrency = workbook.createCellStyle();
            dataCurrency.setFont(dataFont);
            dataCurrency.setAlignment(HorizontalAlignment.RIGHT);
            dataCurrency.setVerticalAlignment(VerticalAlignment.CENTER);
            dataCurrency.setDataFormat(df.getFormat("#,##0.00"));
            setThinBorders(dataCurrency);

            XSSFCellStyle dataRate = workbook.createCellStyle();
            dataRate.setFont(dataFont);
            dataRate.setAlignment(HorizontalAlignment.RIGHT);
            dataRate.setVerticalAlignment(VerticalAlignment.CENTER);
            dataRate.setDataFormat(df.getFormat("0.00"));
            setThinBorders(dataRate);

            // Total Row Style
            XSSFFont totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalFont.setFontHeightInPoints((short) 9);
            totalFont.setFontName("Arial");

            XSSFCellStyle totalLabel = workbook.createCellStyle();
            totalLabel.setFont(totalFont);
            totalLabel.setAlignment(HorizontalAlignment.RIGHT);
            totalLabel.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorders(totalLabel);

            XSSFCellStyle totalCurrency = workbook.createCellStyle();
            totalCurrency.setFont(totalFont);
            totalCurrency.setAlignment(HorizontalAlignment.RIGHT);
            totalCurrency.setVerticalAlignment(VerticalAlignment.CENTER);
            totalCurrency.setDataFormat(df.getFormat("#,##0.00"));
            setThinBorders(totalCurrency);

            // Row 0: Title
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(24);
            Cell titleCell = titleRow.createCell(0);
            String titleText = "SLIP TRANSACTION LISTING - PAYMENT OF NET ACCOUNTING / NET PLUS / NET PLUS PLUS FOR THE MONTH OF "
                    + summary.get("selectedBillingMonth");
            titleCell.setCellValue(titleText);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 16));

            // Row 1: Cost Centre & Pay Slip No
            Row meta1 = sheet.createRow(1);
            meta1.setHeightInPoints(18);
            Cell ccCell = meta1.createCell(0);
            ccCell.setCellValue(strVal(summary.get("costCentre")));
            ccCell.setCellStyle(metaLeftStyle);

            Cell slipCell = meta1.createCell(13);
            slipCell.setCellValue("PAY SLIP NO :");
            slipCell.setCellStyle(metaRightStyle);

            // Row 2: Payment Date & Cheque No
            Row meta2 = sheet.createRow(2);
            meta2.setHeightInPoints(18);
            Cell pdCell = meta2.createCell(0);
            pdCell.setCellValue("PAYMENT DATE - " + summary.get("paymentDate"));
            pdCell.setCellStyle(metaLeftStyle);

            Cell chqCell = meta2.createCell(13);
            chqCell.setCellValue("CHEQUE NO :");
            chqCell.setCellStyle(metaRightStyle);

            // Row 4 & 5: Two-tier table headers
            Row hRow1 = sheet.createRow(4);
            Row hRow2 = sheet.createRow(5);
            hRow1.setHeightInPoints(20);
            hRow2.setHeightInPoints(20);

            // Initialize cells for 17 columns (0 to 16)
            for (int c = 0; c <= 16; c++) {
                hRow1.createCell(c).setCellStyle(headerStyle);
                hRow2.createCell(c).setCellStyle(headerStyle);
            }

            // Single merged columns
            setMergedHeader(sheet, hRow1, 0, "S.No");
            setMergedHeader(sheet, hRow1, 1, "Account No:");
            setMergedHeader(sheet, hRow1, 2, "Customer Name");
            setMergedHeader(sheet, hRow1, 3, "Ref No:");

            // Group: Bill Period (Cols 4-5)
            hRow1.getCell(4).setCellValue("Bill Period");
            sheet.addMergedRegion(new CellRangeAddress(4, 4, 4, 5));
            hRow2.getCell(4).setCellValue("From");
            hRow2.getCell(5).setCellValue("To");

            // Group: Units (KWh) (Cols 6-8)
            hRow1.getCell(6).setCellValue("Units (KWh)");
            sheet.addMergedRegion(new CellRangeAddress(4, 4, 6, 8));
            hRow2.getCell(6).setCellValue("Imports");
            hRow2.getCell(7).setCellValue("Exports");
            hRow2.getCell(8).setCellValue("Net");

            // Remaining columns
            setMergedHeader(sheet, hRow1, 9, "Unit Cost");
            setMergedHeader(sheet, hRow1, 10, "Exp. Code");
            setMergedHeader(sheet, hRow1, 11, "Bank Code");
            setMergedHeader(sheet, hRow1, 12, "Branch Code");
            setMergedHeader(sheet, hRow1, 13, "Account No:");
            setMergedHeader(sheet, hRow1, 14, "Total Amount");
            setMergedHeader(sheet, hRow1, 15, "Bill Set off");
            setMergedHeader(sheet, hRow1, 16, "Stamp Duty\nL5229");
            
            // Add column 17 for Amount Payable L9001
            hRow1.createCell(17).setCellStyle(headerStyle);
            hRow2.createCell(17).setCellStyle(headerStyle);
            setMergedHeader(sheet, hRow1, 17, "Amount Payable\nL9001");

            int rowIndex = 6;
            for (Map<String, Object> r : records) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(18);

                // S.No
                Cell c0 = row.createCell(0);
                c0.setCellValue(((Number) r.get("sNo")).intValue());
                c0.setCellStyle(dataCenter);

                // Account No
                Cell c1 = row.createCell(1);
                c1.setCellValue(strVal(r.get("accountNo")));
                c1.setCellStyle(dataCenter);

                // Customer Name
                Cell c2 = row.createCell(2);
                c2.setCellValue(strVal(r.get("customerName")));
                c2.setCellStyle(dataLeft);

                // Ref No
                Cell c3 = row.createCell(3);
                c3.setCellValue(strVal(r.get("refNo")));
                c3.setCellStyle(dataCenter);

                // Bill Period From & To
                Cell c4 = row.createCell(4);
                c4.setCellValue(strVal(r.get("billingPeriodFrom")));
                c4.setCellStyle(dataCenter);

                Cell c5 = row.createCell(5);
                c5.setCellValue(strVal(r.get("billingPeriodTo")));
                c5.setCellStyle(dataCenter);

                // Imports, Exports, Net Units
                Cell c6 = row.createCell(6);
                c6.setCellValue(((Number) r.get("importUnits")).doubleValue());
                c6.setCellStyle(dataInt);

                Cell c7 = row.createCell(7);
                c7.setCellValue(((Number) r.get("exportUnits")).doubleValue());
                c7.setCellStyle(dataInt);

                Cell c8 = row.createCell(8);
                c8.setCellValue(((Number) r.get("netUnits")).doubleValue());
                c8.setCellStyle(dataInt);

                // Unit Cost
                Cell c9 = row.createCell(9);
                c9.setCellValue(((Number) r.get("unitCost")).doubleValue());
                c9.setCellStyle(dataRate);

                // Exp Code
                Cell c10 = row.createCell(10);
                c10.setCellValue(strVal(r.get("expCode")));
                c10.setCellStyle(dataCenter);

                // Bank Code
                Cell c11 = row.createCell(11);
                c11.setCellValue(strVal(r.get("bankCode")));
                c11.setCellStyle(dataCenter);

                // Branch Code
                Cell c12 = row.createCell(12);
                c12.setCellValue(strVal(r.get("branchCode")));
                c12.setCellStyle(dataCenter);

                // Bank Account No
                Cell c13 = row.createCell(13);
                c13.setCellValue(strVal(r.get("bankAccountNo")));
                c13.setCellStyle(dataCenter);

                // Total Amount
                Cell c14 = row.createCell(14);
                c14.setCellValue(((Number) r.get("totalAmount")).doubleValue());
                c14.setCellStyle(dataCurrency);

                // Bill Set off
                Cell c15 = row.createCell(15);
                double bso = ((Number) r.get("billSetOff")).doubleValue();
                if (bso > 0) {
                    c15.setCellValue(bso);
                    c15.setCellStyle(dataCurrency);
                } else {
                    c15.setCellValue("-");
                    c15.setCellStyle(dataCenter);
                }

                // Stamp Duty L5229
                Cell c16 = row.createCell(16);
                double sd = ((Number) r.get("stampDuty")).doubleValue();
                if (sd > 0) {
                    c16.setCellValue(sd);
                    c16.setCellStyle(dataCurrency);
                } else {
                    c16.setCellValue("-");
                    c16.setCellStyle(dataCenter);
                }

                // Amount Payable L9001
                Cell c17 = row.createCell(17);
                c17.setCellValue(((Number) r.get("amountPayable")).doubleValue());
                c17.setCellStyle(dataCurrency);
            }

            // Summary Totals Row
            Row totRow = sheet.createRow(rowIndex);
            totRow.setHeightInPoints(22);
            for (int c = 0; c <= 17; c++) {
                totRow.createCell(c).setCellStyle(totalLabel);
            }
            Cell totLabel = totRow.getCell(0);
            totLabel.setCellValue("TOTAL (" + records.size() + " CUSTOMERS)");
            sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, 13));

            Cell totAmt = totRow.getCell(14);
            totAmt.setCellValue(((Number) summary.get("totalAmountSum")).doubleValue());
            totAmt.setCellStyle(totalCurrency);

            Cell totBso = totRow.getCell(15);
            totBso.setCellValue(((Number) summary.get("totalBillSetOffSum")).doubleValue());
            totBso.setCellStyle(totalCurrency);

            Cell totSd = totRow.getCell(16);
            totSd.setCellValue(((Number) summary.get("totalStampDutySum")).doubleValue());
            totSd.setCellStyle(totalCurrency);

            Cell totPay = totRow.getCell(17);
            totPay.setCellValue(((Number) summary.get("totalAmountPayableSum")).doubleValue());
            totPay.setCellStyle(totalCurrency);

            // ── OPTIMISATION: Fixed column widths instead of autoSizeColumn()
            // autoSizeColumn() is O(n*cols) — extremely slow for 7000+ row reports.
            // Values are in units of 1/256th of a character width.
            // Col: S.No, AccNo, CustName, RefNo, From, To, Imp, Exp, Net, UnitCost,
            //      ExpCode, BankCode, BranchCode, BankAccNo, TotAmt, SetOff, StampDuty, AmtPayable
            int[] colWidths = { 1800, 3600, 7000, 3200, 3400, 3400, 2200, 2200, 2200,
                                2400, 2400, 2400, 2800, 4800, 3800, 3200, 3000, 3800 };
            for (int c = 0; c <= 17; c++) {
                sheet.setColumnWidth(c, colWidths[c]);
            }

            workbook.write(out);
            byte[] result = out.toByteArray();

            long tExcel1 = System.currentTimeMillis();
            log.info("PERF [Excel] records={} estimatedBytes={} actualBytes={} excelMs={}",
                    records.size(), estimatedSize, result.length, tExcel1 - tExcel0);

            return result;
        }
    }

    private void setMergedHeader(XSSFSheet sheet, Row hRow1, int col, String label) {
        hRow1.getCell(col).setCellValue(label);
        sheet.addMergedRegion(new CellRangeAddress(4, 5, col, col));
    }

    private void setThinBorders(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
    }

    private String strVal(Object obj) {
        return obj != null ? obj.toString().trim() : "";
    }

    private Double parseDouble(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Number) return ((Number) obj).doubleValue();
        try {
            String s = obj.toString().replaceAll("[,\\s]", "");
            if (s.isEmpty()) return null;
            return Double.parseDouble(s);
        } catch (Exception e) {
            return null;
        }
    }
}
