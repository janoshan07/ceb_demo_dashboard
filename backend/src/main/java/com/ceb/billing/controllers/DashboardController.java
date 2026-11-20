package com.ceb.billing.controllers;

import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.ImportSession;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.ImportSessionRepository;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.services.PaymentControlService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping
public class DashboardController {

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private ApprovalRequestRepository approvalRequestRepository;

    @Autowired(required = false)
    private PaymentControlService paymentControlService;

    @Autowired(required = false)
    private MonthlyDirectorySnapshotRepository monthlyDirectorySnapshotRepository;

    @Autowired(required = false)
    private ImportSessionRepository importSessionRepository;

    private static class CacheEntry<T> {
        final T data;
        final long expiresAt;
        CacheEntry(T data, long ttlMillis) {
            this.data = data;
            this.expiresAt = System.currentTimeMillis() + ttlMillis;
        }
        boolean isValid() {
            return System.currentTimeMillis() < expiresAt;
        }
    }

    private static volatile CacheEntry<Map<String, Object>> adminSummaryCache;
    private static volatile CacheEntry<Map<String, Object>> officerSummaryCache;
    private static volatile CacheEntry<Map<String, Object>> analyticsCache;
    private static final long CACHE_TTL_MS = 20_000L; // 20 seconds

    public static void invalidateCache() {
        adminSummaryCache = null;
        officerSummaryCache = null;
        analyticsCache = null;
    }

    // --- Admin Dashboard Endpoint ---

    @GetMapping("/api/admin/dashboard/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAdminDashboardSummary() {
        if (adminSummaryCache != null && adminSummaryCache.isValid()) {
            return ResponseEntity.ok(adminSummaryCache.data);
        }
        Map<String, Object> summary = buildSummary(true);
        adminSummaryCache = new CacheEntry<>(summary, CACHE_TTL_MS);
        return ResponseEntity.ok(summary);
    }

    // --- Officer Dashboard Endpoint ---

    @GetMapping("/api/officer/dashboard/summary")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerDashboardSummary() {
        if (officerSummaryCache != null && officerSummaryCache.isValid()) {
            return ResponseEntity.ok(officerSummaryCache.data);
        }
        Map<String, Object> summary = buildSummary(false);
        officerSummaryCache = new CacheEntry<>(summary, CACHE_TTL_MS);
        return ResponseEntity.ok(summary);
    }

    private Map<String, Object> buildSummary(boolean isAdmin) {
        Map<String, Object> summary = new HashMap<>();

        long uploadedFiles = uploadHistoryRepository.count();
        List<UploadHistory> recentUploads = uploadHistoryRepository.findTop5ByOrderByUploadTimeDesc();
        if (monthlyDirectorySnapshotRepository != null) {
            for (UploadHistory uh : recentUploads) {
                if ((uh.getRowsProcessed() == null || uh.getRowsProcessed() == 0) &&
                    (uh.getBillingInserted() == null || uh.getBillingInserted() == 0)) {
                    String fn = uh.getFilename();
                    if (fn != null && fn.contains("Session ")) {
                        try {
                            String sidStr = fn.substring(fn.indexOf("Session ") + 8).replaceAll("[^0-9]", "");
                            if (!sidStr.isEmpty()) {
                                Long sid = Long.parseLong(sidStr);
                                List<MonthlyDirectorySnapshot> snaps = monthlyDirectorySnapshotRepository.findBySessionId(sid);
                                if (snaps != null && !snaps.isEmpty()) {
                                    int totalRecs = snaps.stream().mapToInt(s -> s.getTotalRecords() != null ? s.getTotalRecords() : 0).sum();
                                    if (totalRecs > 0) {
                                        uh.setRowsProcessed(totalRecs);
                                        uh.setBillingInserted(totalRecs);
                                    }
                                }
                            }
                        } catch (Exception ignored) {
                        }
                    }
                }
            }
        }
        long pendingApprovals = approvalRequestRepository.countByStatus("PENDING");

        summary.put("uploadedFilesCount", uploadedFiles);
        summary.put("recentUploads", recentUploads);
        summary.put("pendingApprovalsCount", pendingApprovals);
        try {
            List<com.ceb.billing.entities.ApprovalRequest> latestPending = approvalRequestRepository.findTop3ByStatusOrderByCreatedAtDesc("PENDING");
            summary.put("latestPendingApprovals", latestPending);
        } catch (Exception ignored) {
            summary.put("latestPendingApprovals", Collections.emptyList());
        }
        summary.put("dataQuality", buildDataQuality());

        if (billingRecordRepository.count() > 0) {
            long totalCustomers = customerRepository.count();
            Double totalRevenue = billingRecordRepository.sumTotalAmount();
            long totalBills = billingRecordRepository.count();
            Double totalImports = billingRecordRepository.sumTotalImports();
            Double totalExports = billingRecordRepository.sumTotalExports();

            summary.put("totalCustomers", totalCustomers);
            summary.put("totalRevenue", totalRevenue != null ? totalRevenue : 0.0);
            summary.put("pendingBillsCount", totalBills);
            summary.put("totalImportUnits", totalImports != null ? totalImports : 0.0);
            summary.put("totalExportUnits", totalExports != null ? totalExports : 0.0);
        } else if (paymentControlService != null) {
            Map<String, Object> canonicalSummary = null;
            try {
                canonicalSummary = paymentControlService.getCanonicalSummary(null, null);
            } catch (Exception ignored) {
            }

            if (canonicalSummary != null && !canonicalSummary.isEmpty() && canonicalSummary.containsKey("netStatementTotal")) {
                summary.put("totalCustomers", ((Number) canonicalSummary.getOrDefault("totalCustomers", 0)).longValue());
                summary.put("totalRevenue", canonicalSummary.getOrDefault("netStatementTotal", 0.0));
                summary.put("netStatementTotal", canonicalSummary.getOrDefault("netStatementTotal", 0.0));
                summary.put("totalPayable", canonicalSummary.getOrDefault("totalPayable", 0.0));
                summary.put("totalOnHold", canonicalSummary.getOrDefault("totalOnHold", 0.0));
                summary.put("totalDeductions", canonicalSummary.getOrDefault("totalDeductions", 0.0));
                summary.put("totalBillSetOff", canonicalSummary.getOrDefault("totalBillSetOff", 0.0));
                summary.put("totalStampDuty", canonicalSummary.getOrDefault("totalStampDuty", 0.0));
                summary.put("paymentReadyCount", canonicalSummary.getOrDefault("paymentReadyCount", 0));
                summary.put("onHoldCount", canonicalSummary.getOrDefault("onHoldCount", 0));
                summary.put("pendingBillsCount", ((Number) canonicalSummary.getOrDefault("totalPaymentRecords", 0)).longValue());
                summary.put("totalImportUnits", canonicalSummary.getOrDefault("totalImportUnits", 0.0));
                summary.put("totalExportUnits", canonicalSummary.getOrDefault("totalExportUnits", 0.0));
                if (canonicalSummary.containsKey("holdReasonsBreakdown")) {
                    summary.put("holdReasonsBreakdown", canonicalSummary.get("holdReasonsBreakdown"));
                }
            } else {
                List<Map<String, Object>> canonical = paymentControlService.loadCanonicalRecords(null, null);
                Set<String> uniqueCustomers = new HashSet<>();
                double totalRevenue = 0.0;
                double totalImports = 0.0;
                double totalExports = 0.0;

                for (Map<String, Object> r : canonical) {
                    String acc = strVal(r.get("accountNo"));
                    if (!acc.isEmpty()) {
                        uniqueCustomers.add(acc.toLowerCase());
                    }
                    totalRevenue += extractRevenue(r);
                    totalImports += extractImports(r);
                    totalExports += extractExports(r);
                }

                summary.put("totalCustomers", (long) uniqueCustomers.size());
                summary.put("totalRevenue", totalRevenue);
                summary.put("netStatementTotal", totalRevenue);
                summary.put("pendingBillsCount", (long) canonical.size());
                summary.put("totalImportUnits", totalImports);
                summary.put("totalExportUnits", totalExports);
            }
        } else {
            summary.put("totalCustomers", 0L);
            summary.put("totalRevenue", 0.0);
            summary.put("pendingBillsCount", 0L);
            summary.put("totalImportUnits", 0.0);
            summary.put("totalExportUnits", 0.0);
        }

        return summary;
    }

    // --- User (Customer Self-Service) Dashboard Endpoint ---

    @GetMapping("/api/user/dashboard/summary")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> getUserDashboardSummary() {
        Map<String, Object> summary = new HashMap<>();
        
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        String accountNo = userDetails.getUsername();
        List<BillingRecord> records = billingRecordRepository.findByCustomerAccountNoOrderByFromDateDesc(accountNo);
        
        double userRevenue = 0.0;
        double userImports = 0.0;
        double userExports = 0.0;
        int count = 0;

        if (!records.isEmpty()) {
            for (BillingRecord r : records) {
                userRevenue += r.getTotalAmount();
                userImports += r.getImportUnits();
                userExports += r.getExportUnits();
            }
            count = records.size();
        } else if (paymentControlService != null) {
            List<Map<String, Object>> canonical = paymentControlService.loadCanonicalRecords(null, null);
            for (Map<String, Object> r : canonical) {
                String acc = strVal(r.get("accountNo"));
                if (accountNo.equalsIgnoreCase(acc)) {
                    userRevenue += extractRevenue(r);
                    userImports += extractImports(r);
                    userExports += extractExports(r);
                    count++;
                }
            }
        }
        
        summary.put("totalCustomers", 1L);
        summary.put("totalRevenue", userRevenue);
        summary.put("pendingBillsCount", (long) count);
        summary.put("uploadedFilesCount", 0L);
        summary.put("pendingApprovalsCount", 0L);
        summary.put("totalImportUnits", userImports);
        summary.put("totalExportUnits", userExports);
        summary.put("recentUploads", List.of());
        
        return ResponseEntity.ok(summary);
    }

    // --- Admin/Officer Advanced Analytics Dashboard Endpoint ---

    @GetMapping("/api/admin/dashboard/analytics")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> getAdminDashboardAnalytics() {
        if (analyticsCache != null && analyticsCache.isValid()) {
            return ResponseEntity.ok(analyticsCache.data);
        }
        Map<String, Object> response = new HashMap<>();

        if (billingRecordRepository.count() > 0) {
            // 1. Totals
            Double totalImports = billingRecordRepository.sumTotalImports();
            Double totalExports = billingRecordRepository.sumTotalExports();
            response.put("totalImportUnits", totalImports != null ? totalImports : 0.0);
            response.put("totalExportUnits", totalExports != null ? totalExports : 0.0);

            // 2. Monthly Trend (Revenue and Net Units)
            List<Object[]> monthlyRaw = billingRecordRepository.getMonthlyAnalyticsReport();
            List<Map<String, Object>> monthlyTrend = new ArrayList<>();
            for (Object[] row : monthlyRaw) {
                Map<String, Object> map = new HashMap<>();
                map.put("year", row[0]);
                map.put("month", row[1]);
                map.put("revenue", row[2]);
                map.put("imports", row[3]);
                map.put("exports", row[4]);
                map.put("netUnits", row[5]);
                monthlyTrend.add(map);
            }
            response.put("monthlyTrend", monthlyTrend);

            // 3. Top 10 Solar Exporters
            List<Object[]> exportersRaw = billingRecordRepository.getTop10SolarExporters();
            List<Map<String, Object>> topExporters = new ArrayList<>();
            for (Object[] row : exportersRaw) {
                Map<String, Object> map = new HashMap<>();
                map.put("accountNo", row[0]);
                map.put("customerName", row[1]);
                map.put("totalExport", row[2]);
                topExporters.add(map);
            }
            response.put("topExporters", topExporters);

            // 4. Top 10 Import Consumers
            List<Object[]> consumersRaw = billingRecordRepository.getTop10ImportConsumers();
            List<Map<String, Object>> topConsumers = new ArrayList<>();
            for (Object[] row : consumersRaw) {
                Map<String, Object> map = new HashMap<>();
                map.put("accountNo", row[0]);
                map.put("customerName", row[1]);
                map.put("totalImport", row[2]);
                topConsumers.add(map);
            }
            response.put("topConsumers", topConsumers);

            // 5. Branch-wise Analytics
            List<Object[]> branchRaw = billingRecordRepository.getBranchWiseAnalytics();
            List<Map<String, Object>> branchAnalytics = new ArrayList<>();
            for (Object[] row : branchRaw) {
                Map<String, Object> map = new HashMap<>();
                map.put("branchCode", row[0] != null ? row[0] : "UNKNOWN");
                map.put("customerCount", row[1]);
                map.put("totalImports", row[2]);
                map.put("totalExports", row[3]);
                map.put("totalRevenue", row[4]);
                branchAnalytics.add(map);
            }
            response.put("branchAnalytics", branchAnalytics);

            // 6. Solar Type Distribution
            List<Object[]> solarRaw = customerRepository.getSolarTypeDistribution();
            List<Map<String, Object>> solarDistribution = new ArrayList<>();
            for (Object[] row : solarRaw) {
                Map<String, Object> map = new HashMap<>();
                String solarType = (String) row[0];
                map.put("solarType", solarType != null ? solarType : "Unknown");
                map.put("count", row[1]);
                solarDistribution.add(map);
            }
            response.put("solarDistribution", solarDistribution);
        } else if (paymentControlService != null) {
            List<Map<String, Object>> canonical = paymentControlService.loadCanonicalRecords(null, null);

            double totalImports = 0.0;
            double totalExports = 0.0;

            // Monthly trend: year*100 + month -> [revenue, imports, exports]
            Map<Integer, double[]> monthMap = new TreeMap<>();

            // Account aggregates
            Map<String, String> accNames = new HashMap<>();
            Map<String, Double> accExports = new HashMap<>();
            Map<String, Double> accImports = new HashMap<>();

            // Branch aggregates: branch -> [Set<accountNo>, imports, exports, revenue]
            Map<String, Set<String>> branchAccounts = new LinkedHashMap<>();
            Map<String, Double> branchImports = new LinkedHashMap<>();
            Map<String, Double> branchExports = new LinkedHashMap<>();
            Map<String, Double> branchRevenue = new LinkedHashMap<>();

            // Solar type distribution: customer -> definitive solarType (latest approved month wins)
            Map<String, String> customerSolarType = new HashMap<>();
            Map<String, Integer> customerLatestMonth = new HashMap<>();

            for (Map<String, Object> r : canonical) {
                String acc = strVal(r.get("accountNo"));
                if (acc.isEmpty()) continue;
                String accKey = acc.toLowerCase();

                double rev = extractRevenue(r);
                double imp = extractImports(r);
                double exp = extractExports(r);

                totalImports += imp;
                totalExports += exp;

                // Month bucket
                int[] ym = parseYearMonth(r);
                int yk = ym[0] * 100 + ym[1];
                double[] mBucket = monthMap.computeIfAbsent(yk, k -> new double[4]);
                mBucket[0] += rev;
                mBucket[1] += imp;
                mBucket[2] += exp;
                mBucket[3] += 1.0; // record count

                // Customer names & totals
                String name = strVal(r.get("customerName"));
                if (name.isEmpty()) name = strVal(r.get("cebName"));
                if (name.isEmpty()) name = strVal(r.get("masterName"));
                if (name.isEmpty()) name = strVal(r.get("npayName"));
                if (!name.isEmpty() && !accNames.containsKey(accKey)) {
                    accNames.put(accKey, name);
                }

                accExports.put(accKey, accExports.getOrDefault(accKey, 0.0) + exp);
                accImports.put(accKey, accImports.getOrDefault(accKey, 0.0) + imp);

                // Branch division
                String branch = strVal(r.get("division"));
                if (branch.isEmpty()) branch = strVal(r.get("snapshotDivision"));
                if (branch.isEmpty()) branch = strVal(r.get("branchCode"));
                if (branch.isEmpty()) branch = "Other";

                branchAccounts.computeIfAbsent(branch, k -> new HashSet<>()).add(accKey);
                branchImports.put(branch, branchImports.getOrDefault(branch, 0.0) + imp);
                branchExports.put(branch, branchExports.getOrDefault(branch, 0.0) + exp);
                branchRevenue.put(branch, branchRevenue.getOrDefault(branch, 0.0) + rev);

                // Solar type
                String st = strVal(r.get("solarType"));
                if (st.isEmpty()) st = strVal(r.get("masterNetType"));
                if (st.isEmpty()) st = strVal(r.get("mainNetType"));
                boolean isExplicit = !st.isEmpty();
                if (!isExplicit) st = "Net Metering";
                String stClean = st.toLowerCase();
                if (stClean.contains("plus plus") || stClean.contains("plusplus")) st = "Net Plus Plus";
                else if (stClean.contains("plus")) st = "Net Plus";
                else if (stClean.contains("accounting")) st = "Net Accounting";
                else if (stClean.contains("metering")) st = "Net Metering";

                // Latest approved billing month strictly defines the customer's active solar tariff
                Integer prevYk = customerLatestMonth.get(accKey);
                if (prevYk == null || yk >= prevYk) {
                    customerLatestMonth.put(accKey, yk);
                    customerSolarType.put(accKey, st);
                }
            }

            response.put("totalImportUnits", totalImports);
            response.put("totalExportUnits", totalExports);

            // 1. Monthly Trend
            List<Map<String, Object>> monthlyTrend = new ArrayList<>();
            for (Map.Entry<Integer, double[]> entry : monthMap.entrySet()) {
                int yk = entry.getKey();
                int yr = yk / 100;
                int mo = yk % 100;
                double[] vals = entry.getValue();
                Map<String, Object> map = new HashMap<>();
                map.put("year", yr);
                map.put("month", mo);
                map.put("revenue", vals[0]);
                map.put("imports", vals[1]);
                map.put("exports", vals[2]);
                map.put("netUnits", vals[2] - vals[1]);
                map.put("recordCount", (long) vals[3]);
                monthlyTrend.add(map);
            }
            response.put("monthlyTrend", monthlyTrend);

            // 2. Top 10 Solar Exporters
            List<Map.Entry<String, Double>> expSorted = new ArrayList<>(accExports.entrySet());
            expSorted.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));
            List<Map<String, Object>> topExporters = new ArrayList<>();
            for (int i = 0; i < Math.min(10, expSorted.size()); i++) {
                Map.Entry<String, Double> e = expSorted.get(i);
                Map<String, Object> map = new HashMap<>();
                map.put("accountNo", e.getKey());
                map.put("customerName", accNames.getOrDefault(e.getKey(), e.getKey()));
                map.put("totalExport", e.getValue());
                topExporters.add(map);
            }
            response.put("topExporters", topExporters);

            // 3. Top 10 Import Consumers
            List<Map.Entry<String, Double>> impSorted = new ArrayList<>(accImports.entrySet());
            impSorted.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));
            List<Map<String, Object>> topConsumers = new ArrayList<>();
            for (int i = 0; i < Math.min(10, impSorted.size()); i++) {
                Map.Entry<String, Double> e = impSorted.get(i);
                Map<String, Object> map = new HashMap<>();
                map.put("accountNo", e.getKey());
                map.put("customerName", accNames.getOrDefault(e.getKey(), e.getKey()));
                map.put("totalImport", e.getValue());
                topConsumers.add(map);
            }
            response.put("topConsumers", topConsumers);

            // 4. Branch Analytics
            List<Map<String, Object>> branchAnalytics = new ArrayList<>();
            for (String b : branchAccounts.keySet()) {
                Map<String, Object> map = new HashMap<>();
                map.put("branchCode", b);
                map.put("customerCount", branchAccounts.get(b).size());
                map.put("totalImports", branchImports.getOrDefault(b, 0.0));
                map.put("totalExports", branchExports.getOrDefault(b, 0.0));
                map.put("totalRevenue", branchRevenue.getOrDefault(b, 0.0));
                branchAnalytics.add(map);
            }
            branchAnalytics.sort((a, b) -> Double.compare((Double) b.get("totalRevenue"), (Double) a.get("totalRevenue")));
            response.put("branchAnalytics", branchAnalytics);

            // 5. Solar Type Distribution (Each customer account mapped to exactly one primary solar tariff)
            Map<String, Integer> solarCounts = new LinkedHashMap<>();
            solarCounts.put("Net Plus", 0);
            solarCounts.put("Net Accounting", 0);
            solarCounts.put("Net Metering", 0);
            solarCounts.put("Net Plus Plus", 0);

            for (String type : customerSolarType.values()) {
                solarCounts.put(type, solarCounts.getOrDefault(type, 0) + 1);
            }

            List<Map<String, Object>> solarDistribution = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : solarCounts.entrySet()) {
                if (entry.getValue() > 0) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("solarType", entry.getKey());
                    map.put("count", entry.getValue());
                    solarDistribution.add(map);
                }
            }
            solarDistribution.sort((a, b) -> Integer.compare((Integer) b.get("count"), (Integer) a.get("count")));
            response.put("solarDistribution", solarDistribution);

            if (paymentControlService != null) {
                try {
                    Map<String, Object> canonicalSummary = paymentControlService.getCanonicalSummary(null, null);
                    if (canonicalSummary != null && canonicalSummary.containsKey("holdReasonsBreakdown")) {
                        response.put("holdReasons", canonicalSummary.get("holdReasonsBreakdown"));
                    }
                } catch (Exception ignored) {
                }
            }
        } else {
            response.put("totalImportUnits", 0.0);
            response.put("totalExportUnits", 0.0);
            response.put("monthlyTrend", Collections.emptyList());
            response.put("topExporters", Collections.emptyList());
            response.put("topConsumers", Collections.emptyList());
            response.put("branchAnalytics", Collections.emptyList());
            response.put("solarDistribution", Collections.emptyList());
            response.put("holdReasons", Collections.emptyList());
        }

        analyticsCache = new CacheEntry<>(response, CACHE_TTL_MS);
        return ResponseEntity.ok(response);
    }

    private String strVal(Object obj) {
        return obj == null ? "" : obj.toString().trim();
    }

    private double extractRevenue(Map<String, Object> r) {
        Double val = parseDoubleFirst(r, "energyPurchase", "salesAmount", "kwhSalesAmount", "totalAmount", "paymentSettled", "payment");
        return val != null ? val : 0.0;
    }

    private double extractImports(Map<String, Object> r) {
        Double val = parseDoubleFirst(r, "kwhImport", "importUnits", "imports");
        return val != null ? val : 0.0;
    }

    private double extractExports(Map<String, Object> r) {
        Double val = parseDoubleFirst(r, "kwhExport", "exportUnits", "exports");
        return val != null ? val : 0.0;
    }

    private Double parseDoubleFirst(Map<String, Object> r, String... keys) {
        for (String k : keys) {
            Object o = r.get(k);
            if (o instanceof Number) {
                double d = ((Number) o).doubleValue();
                if (d > 0) return d;
            } else if (o != null) {
                try {
                    String s = o.toString().trim().replace(",", "");
                    if (!s.isEmpty()) {
                        double d = Double.parseDouble(s);
                        if (d > 0) return d;
                    }
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private int[] parseYearMonth(Map<String, Object> r) {
        String bm = strVal(r.get("billingMonth"));
        if (bm.isEmpty()) bm = strVal(r.get("datasetName"));
        int year = 2026;
        int month = 7;
        if (!bm.isEmpty()) {
            String clean = bm.toLowerCase();
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

            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(20\\d\\d)").matcher(bm);
            if (m.find()) {
                try {
                    year = Integer.parseInt(m.group(1));
                } catch (Exception ignored) {}
            }
        }
        return new int[]{year, month};
    }

    private Map<String, Object> buildDataQuality() {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> areas = new ArrayList<>();
        String maxMismatchArea = null;
        int maxMismatches = -1;
        int totalAllRecords = 0;
        int totalAcceptedRecords = 0;
        int totalValidRecords = 0;
        int totalWarningsCount = 0;
        int totalRateMismatchesCount = 0;

        if (monthlyDirectorySnapshotRepository != null) {
            try {
                List<MonthlyDirectorySnapshot> snapshots = monthlyDirectorySnapshotRepository.findByStatusOrderByCreatedDateDesc("APPROVED");
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

                for (MonthlyDirectorySnapshot s : snapshots) {
                    String div = s.getDivision();
                    if (div == null || div.isBlank()) continue;

                    String valSummary = s.getValidationSummary();
                    if (valSummary != null && !valSummary.isBlank()) {
                        Map<String, Object> map = mapper.readValue(valSummary, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});

                        // Session link check
                        Long sessionId = s.getSessionId();
                        ImportSession session = null;
                        if (sessionId != null && importSessionRepository != null) {
                            session = importSessionRepository.findById(sessionId).orElse(null);
                        }

                        // Upload total: ceb_assist_count via snapshot's session link. Null if no session link.
                        Integer uploadTotal = null;
                        if (session != null && session.getCebAssistCount() != null && session.getCebAssistCount() > 0) {
                            uploadTotal = session.getCebAssistCount();
                        } else if (sessionId != null && map.get("totalRecords") != null) {
                            uploadTotal = ((Number) map.get("totalRecords")).intValue();
                        }

                        int acceptedTotal = s.getTotalRecords() != null ? s.getTotalRecords() : 0;
                        Integer rejectedTotal = uploadTotal != null ? Math.max(0, uploadTotal - acceptedTotal) : null;

                        // Master only (no billing): from validation_summary. Shows "-" (null) for snapshots without it.
                        Integer masterOnlyCount = null;
                        if (map.get("masterOnlyCount") != null) {
                            masterOnlyCount = ((Number) map.get("masterOnlyCount")).intValue();
                        }

                        int valid = ((Number) map.getOrDefault("validCount", 0)).intValue();
                        int warnings = ((Number) map.getOrDefault("warningCount", 0)).intValue();
                        int errors = ((Number) map.getOrDefault("errorCount", 0)).intValue();
                        int unitRateMismatches = ((Number) map.getOrDefault("unitRateMismatchCount", 0)).intValue();
                        int nameMismatches = ((Number) map.getOrDefault("nameMismatchCount", 0)).intValue();
                        int netTypeMismatches = ((Number) map.getOrDefault("netTypeMismatchCount", 0)).intValue();
                        int totalMismatches = unitRateMismatches + nameMismatches + netTypeMismatches;

                        if (uploadTotal != null) {
                            totalAllRecords += uploadTotal;
                        }
                        totalAcceptedRecords += acceptedTotal;
                        totalValidRecords += valid;
                        totalWarningsCount += warnings;
                        totalRateMismatchesCount += unitRateMismatches;

                        double validPct = acceptedTotal > 0 ? Math.round((valid * 100.0 / acceptedTotal) * 10.0) / 10.0 : 0.0;
                        Double acceptedPct = (uploadTotal != null && uploadTotal > 0)
                                ? Math.round((acceptedTotal * 100.0 / uploadTotal) * 10.0) / 10.0
                                : null;

                        Map<String, Object> areaData = new LinkedHashMap<>();
                        areaData.put("snapshotId", s.getId());
                        areaData.put("division", div);
                        areaData.put("billingMonth", s.getBillingMonth() != null ? s.getBillingMonth() : "Current");
                        areaData.put("hasSessionLink", sessionId != null);
                        areaData.put("uploadTotal", uploadTotal);
                        areaData.put("acceptedTotal", acceptedTotal);
                        areaData.put("rejectedTotal", rejectedTotal);
                        areaData.put("masterOnlyCount", masterOnlyCount);
                        areaData.put("totalRecords", uploadTotal != null ? uploadTotal : acceptedTotal);
                        areaData.put("validCount", valid);
                        areaData.put("validPercentage", validPct);
                        areaData.put("acceptedPercentage", acceptedPct);
                        areaData.put("warnings", warnings);
                        areaData.put("errors", errors);
                        areaData.put("unitRateMismatches", unitRateMismatches);
                        areaData.put("totalMismatches", totalMismatches);
                        areas.add(areaData);

                        if (unitRateMismatches > maxMismatches) {
                            maxMismatches = unitRateMismatches;
                            maxMismatchArea = div + (s.getBillingMonth() != null ? " (" + s.getBillingMonth() + ")" : "");
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }
        double overallCleanPct = totalAcceptedRecords > 0 
            ? Math.round((totalValidRecords * 100.0 / totalAcceptedRecords) * 10.0) / 10.0 
            : 100.0;
        double overallAcceptedPct = totalAllRecords > 0
            ? Math.round((totalAcceptedRecords * 100.0 / totalAllRecords) * 10.0) / 10.0
            : 100.0;

        result.put("areas", areas);
        result.put("cleanRecordsPercentage", overallCleanPct);
        result.put("acceptedPercentage", overallAcceptedPct);
        result.put("totalAcceptedRecords", totalAcceptedRecords);
        result.put("totalValidRecords", totalValidRecords);
        result.put("totalUploadRecords", totalAllRecords);
        result.put("tariffRateMismatches", totalRateMismatchesCount);
        result.put("validationWarnings", totalWarningsCount);
        result.put("maxMismatchArea", maxMismatchArea != null ? (maxMismatchArea + ": " + maxMismatches + " mismatches") : "None");
        result.put("maxMismatches", Math.max(0, maxMismatches));
        return result;
    }
}
