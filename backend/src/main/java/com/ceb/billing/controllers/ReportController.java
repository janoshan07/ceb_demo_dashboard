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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class ReportController {

    @Autowired
    private BillingRecordRepository billingRecordRepository;

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
}
