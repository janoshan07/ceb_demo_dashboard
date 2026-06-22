package com.ceb.billing.controllers;

import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.UploadHistory;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
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
public class DashboardController {

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private UploadHistoryRepository uploadHistoryRepository;

    @Autowired
    private ApprovalRequestRepository approvalRequestRepository;

    // --- Admin Dashboard Endpoint ---

    @GetMapping("/api/admin/dashboard/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAdminDashboardSummary() {
        Map<String, Object> summary = new HashMap<>();
        
        long totalCustomers = customerRepository.count();
        Double totalRevenue = billingRecordRepository.sumTotalAmount();
        long totalBills = billingRecordRepository.count();
        long uploadedFiles = uploadHistoryRepository.count();
        List<UploadHistory> recentUploads = uploadHistoryRepository.findTop5ByOrderByUploadTimeDesc();
        
        long pendingApprovals = approvalRequestRepository.countByStatus("PENDING");
        Double totalImports = billingRecordRepository.sumTotalImports();
        Double totalExports = billingRecordRepository.sumTotalExports();

        summary.put("totalCustomers", totalCustomers);
        summary.put("totalRevenue", totalRevenue != null ? totalRevenue : 0.0);
        summary.put("pendingBillsCount", totalBills);
        summary.put("uploadedFilesCount", uploadedFiles);
        summary.put("recentUploads", recentUploads);
        summary.put("pendingApprovalsCount", pendingApprovals);
        summary.put("totalImportUnits", totalImports != null ? totalImports : 0.0);
        summary.put("totalExportUnits", totalExports != null ? totalExports : 0.0);

        return ResponseEntity.ok(summary);
    }

    // --- Officer Dashboard Endpoint ---

    @GetMapping("/api/officer/dashboard/summary")
    @PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
    public ResponseEntity<?> getOfficerDashboardSummary() {
        Map<String, Object> summary = new HashMap<>();
        
        long totalCustomers = customerRepository.count();
        Double totalRevenue = billingRecordRepository.sumTotalAmount();
        long totalBills = billingRecordRepository.count();
        long uploadedFiles = uploadHistoryRepository.count();
        List<UploadHistory> recentUploads = uploadHistoryRepository.findTop5ByOrderByUploadTimeDesc();
        
        Double totalImports = billingRecordRepository.sumTotalImports();
        Double totalExports = billingRecordRepository.sumTotalExports();

        summary.put("totalCustomers", totalCustomers);
        summary.put("totalRevenue", totalRevenue != null ? totalRevenue : 0.0);
        summary.put("pendingBillsCount", totalBills);
        summary.put("uploadedFilesCount", uploadedFiles);
        summary.put("recentUploads", recentUploads);
        summary.put("totalImportUnits", totalImports != null ? totalImports : 0.0);
        summary.put("totalExportUnits", totalExports != null ? totalExports : 0.0);

        return ResponseEntity.ok(summary);
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
        for (BillingRecord r : records) {
            userRevenue += r.getTotalAmount();
            userImports += r.getImportUnits();
            userExports += r.getExportUnits();
        }
        
        summary.put("totalCustomers", 1);
        summary.put("totalRevenue", userRevenue);
        summary.put("pendingBillsCount", records.size());
        summary.put("uploadedFilesCount", 0);
        summary.put("pendingApprovalsCount", 0);
        summary.put("totalImportUnits", userImports);
        summary.put("totalExportUnits", userExports);
        summary.put("recentUploads", List.of());
        
        return ResponseEntity.ok(summary);
    }

    // --- Admin/Officer Advanced Analytics Dashboard Endpoint ---

    @GetMapping("/api/admin/dashboard/analytics")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> getAdminDashboardAnalytics() {
        Map<String, Object> response = new HashMap<>();

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

        return ResponseEntity.ok(response);
    }
}
