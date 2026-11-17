package com.ceb.billing.services;

import com.ceb.billing.entities.Alert;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.PaymentBatchItem;
import com.ceb.billing.models.PaymentEligibilityResult;
import com.ceb.billing.repositories.PaymentBatchItemRepository;
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

    @SuppressWarnings("unchecked")
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

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getCustomerBillingReport(LocalDate start, LocalDate end, String branch) {
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

    @SuppressWarnings("unchecked")
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

    @SuppressWarnings("unchecked")
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

    @SuppressWarnings("unchecked")
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

    @SuppressWarnings("unchecked")
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
