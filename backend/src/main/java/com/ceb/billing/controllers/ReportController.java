package com.ceb.billing.controllers;

import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.repositories.BillingRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.LocalDate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class ReportController {

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private com.ceb.billing.services.ReportService reportService;

    @Autowired(required = false)
    private com.ceb.billing.services.PaymentControlService paymentControlService;

    // --- Officer and Admin Report Endpoints ---

    @GetMapping("/api/officer/reports/totals")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getTotals() {
        Double totalRevenue = billingRecordRepository.sumTotalAmount();
        Double totalImports = billingRecordRepository.sumTotalImports();
        Double totalExports = billingRecordRepository.sumTotalExports();

        Map<String, Double> totals = new HashMap<>();
        totals.put("totalRevenue", totalRevenue != null ? totalRevenue : 0.0);
        totals.put("totalImports", totalImports != null ? totalImports : 0.0);
        totals.put("totalExports", totalExports != null ? totalExports : 0.0);

        return ResponseEntity.ok(totals);
    }

    @GetMapping({ "/api/officer/reports/monthly", "/api/officer/reports/revenue" })
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getMonthlyRevenue() {
        List<Object[]> results = billingRecordRepository.getMonthlyRevenueReport();
        List<Map<String, Object>> reports = new ArrayList<>();

        for (Object[] row : results) {
            Map<String, Object> map = new HashMap<>();
            map.put("year", row[0]);
            map.put("month", row[1]);
            map.put("revenue", row[2]);
            map.put("imports", row[3]);
            map.put("exports", row[4]);
            reports.add(map);
        }

        return ResponseEntity.ok(reports);
    }

    @GetMapping("/api/officer/reports/top-exporters")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getTopExporters() {
        List<BillingRecord> topExporters = billingRecordRepository.findTop5ByOrderByExportUnitsDesc();
        return ResponseEntity.ok(topExporters);
    }

    @GetMapping("/api/officer/reports/top-importers")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getTopImporters() {
        List<BillingRecord> topImporters = billingRecordRepository.findTop5ByOrderByImportUnitsDesc();
        return ResponseEntity.ok(topImporters);
    }

    // --- User (Customer Self-Service) Report Endpoint ---

    @GetMapping("/api/user/reports/monthly")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> userGetOwnMonthlyRevenue() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        String accountNo = userDetails.getUsername();
        List<BillingRecord> records = billingRecordRepository.findByCustomerAccountNoOrderByFromDateDesc(accountNo);
        List<Map<String, Object>> reports = new ArrayList<>();
        if (!records.isEmpty()) {
            for (BillingRecord r : records) {
                Map<String, Object> map = new HashMap<>();
                map.put("year", r.getFromDate().getYear());
                map.put("month", r.getFromDate().getMonthValue());
                map.put("revenue", r.getTotalAmount());
                map.put("imports", r.getImportUnits());
                map.put("exports", r.getExportUnits());
                reports.add(map);
            }
        } else if (paymentControlService != null) {
            List<Map<String, Object>> canonical = paymentControlService.loadCanonicalRecords(null, null);
            for (Map<String, Object> r : canonical) {
                String acc = r.get("accountNo") != null ? r.get("accountNo").toString().trim() : "";
                if (accountNo.equalsIgnoreCase(acc)) {
                    Map<String, Object> map = new HashMap<>();
                    String bm = r.get("billingMonth") != null ? r.get("billingMonth").toString().trim() : "";
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
                            try { year = Integer.parseInt(m.group(1)); } catch (Exception ignored) {}
                        }
                    }
                    map.put("year", year);
                    map.put("month", month);
                    map.put("revenue", extractDouble(r, "salesAmount", "payment", "energyPurchase", "totalAmount"));
                    map.put("imports", extractDouble(r, "kwhImport", "importUnits", "imports"));
                    map.put("exports", extractDouble(r, "kwhExport", "exportUnits", "exports"));
                    reports.add(map);
                }
            }
        }
        return ResponseEntity.ok(reports);
    }

    private double extractDouble(Map<String, Object> r, String... keys) {
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
        return 0.0;
    }

    @GetMapping("/api/officer/reports/branches")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getDistinctBranches() {
        return ResponseEntity.ok(List.of("Ampara", "Kalmunai", "Valaichenai", "Batticaloa", "Trincomalee"));
    }

    @GetMapping("/api/officer/reports/generate")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> generateReport(
            @RequestParam("type") String type,
            @RequestParam(value = "billingMonth", required = false) String billingMonth,
            @RequestParam(value = "startDate", required = false) String startDateStr,
            @RequestParam(value = "endDate", required = false) String endDateStr,
            @RequestParam(value = "branchCode", required = false) String branchCode,
            @RequestParam(value = "division", required = false) String division) {

        LocalDate startDate = null;
        LocalDate endDate = null;

        try {
            if (startDateStr != null && !startDateStr.trim().isEmpty()) {
                startDate = LocalDate.parse(startDateStr.trim());
            }
            if (endDateStr != null && !endDateStr.trim().isEmpty()) {
                endDate = LocalDate.parse(endDateStr.trim());
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid date format. Use YYYY-MM-DD."));
        }

        String effectiveBranch = (branchCode != null && !branchCode.trim().isEmpty()) ? branchCode.trim() : (division != null ? division.trim() : null);
        if ("ALL".equalsIgnoreCase(effectiveBranch) || "All Branches".equalsIgnoreCase(effectiveBranch) || "All Divisions".equalsIgnoreCase(effectiveBranch)) {
            effectiveBranch = null;
        }

        String effectiveMonth = (billingMonth != null && !billingMonth.trim().isEmpty()) ? billingMonth.trim() : null;
        if ("ALL".equalsIgnoreCase(effectiveMonth) || "All Billing Months".equalsIgnoreCase(effectiveMonth)) {
            effectiveMonth = null;
        }

        List<Map<String, Object>> reportData;

        switch (type.toUpperCase()) {
            case "MONTHLY_REVENUE":
                reportData = reportService.getMonthlyRevenueReport(effectiveMonth, startDate, endDate, effectiveBranch);
                break;
            case "CUSTOMER_BILLING":
                reportData = reportService.getCustomerBillingReport(effectiveMonth, startDate, endDate, effectiveBranch);
                break;
            case "HIGHEST_EXPORTERS":
                reportData = reportService.getHighestExportersReport(effectiveMonth, startDate, endDate, effectiveBranch);
                break;
            case "HIGHEST_IMPORTERS":
                reportData = reportService.getHighestImportersReport(effectiveMonth, startDate, endDate, effectiveBranch);
                break;
            case "BRANCH_PERFORMANCE":
                reportData = reportService.getBranchPerformanceReport(effectiveMonth, startDate, endDate);
                break;
            case "SOLAR_TYPE":
                reportData = reportService.getSolarTypePerformanceReport(effectiveMonth, startDate, endDate, effectiveBranch);
                break;
            case "ALERT_ANOMALY":
                reportData = reportService.getAlertAnomalyReport(startDate, endDate, effectiveBranch);
                break;
            default:
                return ResponseEntity.badRequest().body(Map.of("message", "Unknown report type: " + type));
        }

        return ResponseEntity.ok(reportData);
    }

    // --- Payment Ready Report Endpoints ---

    @GetMapping("/api/officer/reports/payment-ready")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getPaymentReadyReport(
            @RequestParam(value = "billingMonth", required = false) String billingMonth,
            @RequestParam(value = "division", required = false) String division,
            @RequestParam(value = "accountNo", required = false) String accountNo,
            @RequestParam(value = "customerName", required = false) String customerName) {
        return ResponseEntity.ok(reportService.getPaymentReadyReport(billingMonth, division, accountNo, customerName));
    }

    @GetMapping("/api/officer/reports/payment-ready/excel")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<byte[]> exportPaymentReadyExcel(
            @RequestParam(value = "billingMonth", required = false) String billingMonth,
            @RequestParam(value = "division", required = false) String division,
            @RequestParam(value = "accountNo", required = false) String accountNo,
            @RequestParam(value = "customerName", required = false) String customerName) {
        try {
            byte[] excelBytes = reportService.generatePaymentReadyExcel(billingMonth, division, accountNo, customerName);
            String bMonth = (billingMonth == null || billingMonth.trim().isEmpty() || "ALL".equalsIgnoreCase(billingMonth))
                    ? "ALL_MONTHS"
                    : billingMonth.trim().replaceAll("[^a-zA-Z0-9_-]", "_");
            String div = (division == null || division.trim().isEmpty() || "ALL".equalsIgnoreCase(division))
                    ? "ALL_DIVISIONS"
                    : division.trim().replaceAll("[^a-zA-Z0-9_-]", "_");
            String filename = "Payment_Ready_Report_" + bMonth + "_" + div + ".xlsx";

            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .body(excelBytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/api/officer/reports/payment-ready/months")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getPaymentReadyMonths() {
        if (paymentControlService != null) {
            return ResponseEntity.ok(paymentControlService.getAvailableBillingMonths());
        }
        return ResponseEntity.ok(List.of("July 2026", "August 2026"));
    }
}
