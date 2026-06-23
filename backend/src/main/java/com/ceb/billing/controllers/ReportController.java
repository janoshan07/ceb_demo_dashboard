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
    private com.ceb.billing.repositories.CustomerRepository customerRepository;

    @Autowired
    private com.ceb.billing.services.ReportService reportService;

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
        for (BillingRecord r : records) {
            Map<String, Object> map = new HashMap<>();
            map.put("year", r.getFromDate().getYear());
            map.put("month", r.getFromDate().getMonthValue());
            map.put("revenue", r.getTotalAmount());
            map.put("imports", r.getImportUnits());
            map.put("exports", r.getExportUnits());
            reports.add(map);
        }
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/api/officer/reports/branches")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getDistinctBranches() {
        List<String> branches = customerRepository.findDistinctBranchCodes();
        return ResponseEntity.ok(branches);
    }

    @GetMapping("/api/officer/reports/generate")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> generateReport(
            @RequestParam("type") String type,
            @RequestParam(value = "startDate", required = false) String startDateStr,
            @RequestParam(value = "endDate", required = false) String endDateStr,
            @RequestParam(value = "branchCode", required = false) String branchCode) {

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

        List<Map<String, Object>> reportData;

        switch (type.toUpperCase()) {
            case "MONTHLY_REVENUE":
                reportData = reportService.getMonthlyRevenueReport(startDate, endDate, branchCode);
                break;
            case "CUSTOMER_BILLING":
                reportData = reportService.getCustomerBillingReport(startDate, endDate, branchCode);
                break;
            case "HIGHEST_EXPORTERS":
                reportData = reportService.getHighestExportersReport(startDate, endDate, branchCode);
                break;
            case "HIGHEST_IMPORTERS":
                reportData = reportService.getHighestImportersReport(startDate, endDate, branchCode);
                break;
            case "BRANCH_PERFORMANCE":
                reportData = reportService.getBranchPerformanceReport(startDate, endDate);
                break;
            case "SOLAR_TYPE":
                reportData = reportService.getSolarTypePerformanceReport(startDate, endDate, branchCode);
                break;
            case "ALERT_ANOMALY":
                reportData = reportService.getAlertAnomalyReport(startDate, endDate, branchCode);
                break;
            default:
                return ResponseEntity.badRequest().body(Map.of("message", "Unknown report type: " + type));
        }

        return ResponseEntity.ok(reportData);
    }
}
