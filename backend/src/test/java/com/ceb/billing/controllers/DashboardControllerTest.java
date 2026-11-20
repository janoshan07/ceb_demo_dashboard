package com.ceb.billing.controllers;

import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UploadHistoryRepository;
import com.ceb.billing.services.PaymentControlService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DashboardControllerTest {

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private BillingRecordRepository billingRecordRepository;

    @Mock
    private UploadHistoryRepository uploadHistoryRepository;

    @Mock
    private ApprovalRequestRepository approvalRequestRepository;

    @Mock
    private PaymentControlService paymentControlService;

    @InjectMocks
    private DashboardController dashboardController;

    @BeforeEach
    void setUp() {
        DashboardController.invalidateCache();
    }

    @Test
    @DisplayName("Should fall back to canonical snapshot records when billing_records is empty")
    void testSummaryFallbackToCanonicalRecords() {
        when(billingRecordRepository.count()).thenReturn(0L);
        when(uploadHistoryRepository.count()).thenReturn(10L);
        when(uploadHistoryRepository.findTop5ByOrderByUploadTimeDesc()).thenReturn(Collections.emptyList());
        when(approvalRequestRepository.countByStatus("PENDING")).thenReturn(2L);

        List<Map<String, Object>> mockCanonical = new ArrayList<>();
        Map<String, Object> r1 = new HashMap<>();
        r1.put("accountNo", "1001");
        r1.put("customerName", "Customer 1");
        r1.put("salesAmount", 15000.0);
        r1.put("kwhImport", 200.0);
        r1.put("kwhExport", 500.0);
        r1.put("solarType", "Net Metering");
        r1.put("division", "Trincomalee");
        r1.put("billingMonth", "July 2026");
        mockCanonical.add(r1);

        Map<String, Object> r2 = new HashMap<>();
        r2.put("accountNo", "1002");
        r2.put("customerName", "Customer 2");
        r2.put("salesAmount", 25000.0);
        r2.put("kwhImport", 100.0);
        r2.put("kwhExport", 800.0);
        r2.put("solarType", "Net Plus");
        r2.put("division", "Ampara");
        r2.put("billingMonth", "August 2026");
        mockCanonical.add(r2);

        when(paymentControlService.loadCanonicalRecords(null, null)).thenReturn(mockCanonical);

        ResponseEntity<?> response = dashboardController.getAdminDashboardSummary();
        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());

        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) response.getBody();
        assertNotNull(summary);
        assertEquals(2L, summary.get("totalCustomers"));
        assertEquals(40000.0, (Double) summary.get("totalRevenue"));
        assertEquals(300.0, (Double) summary.get("totalImportUnits"));
        assertEquals(1300.0, (Double) summary.get("totalExportUnits"));
        assertEquals(2L, summary.get("pendingBillsCount"));
        assertEquals(10L, summary.get("uploadedFilesCount"));
        assertEquals(2L, summary.get("pendingApprovalsCount"));
    }

    @Test
    @DisplayName("Should return structured analytics and trends from canonical records")
    void testAnalyticsFallbackToCanonicalRecords() {
        when(billingRecordRepository.count()).thenReturn(0L);

        List<Map<String, Object>> mockCanonical = new ArrayList<>();
        Map<String, Object> r1 = new HashMap<>();
        r1.put("accountNo", "1001");
        r1.put("customerName", "Alice");
        r1.put("salesAmount", 12000.0);
        r1.put("kwhImport", 150.0);
        r1.put("kwhExport", 600.0);
        r1.put("solarType", "Net Accounting");
        r1.put("division", "Trincomalee");
        r1.put("billingMonth", "July 2026");
        mockCanonical.add(r1);

        Map<String, Object> r2 = new HashMap<>();
        r2.put("accountNo", "1002");
        r2.put("customerName", "Bob");
        r2.put("salesAmount", 18000.0);
        r2.put("kwhImport", 350.0);
        r2.put("kwhExport", 200.0);
        r2.put("solarType", "Net Metering");
        r2.put("division", "Trincomalee");
        r2.put("billingMonth", "August 2026");
        mockCanonical.add(r2);

        when(paymentControlService.loadCanonicalRecords(null, null)).thenReturn(mockCanonical);

        ResponseEntity<?> response = dashboardController.getAdminDashboardAnalytics();
        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());

        @SuppressWarnings("unchecked")
        Map<String, Object> analytics = (Map<String, Object>) response.getBody();
        assertNotNull(analytics);
        assertEquals(500.0, (Double) analytics.get("totalImportUnits"));
        assertEquals(800.0, (Double) analytics.get("totalExportUnits"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> trend = (List<Map<String, Object>>) analytics.get("monthlyTrend");
        assertEquals(2, trend.size());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> topExporters = (List<Map<String, Object>>) analytics.get("topExporters");
        assertFalse(topExporters.isEmpty());
        assertEquals("1001", topExporters.get(0).get("accountNo"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> topConsumers = (List<Map<String, Object>>) analytics.get("topConsumers");
        assertFalse(topConsumers.isEmpty());
        assertEquals("1002", topConsumers.get(0).get("accountNo"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> solarDist = (List<Map<String, Object>>) analytics.get("solarDistribution");
        assertEquals(2, solarDist.size());
    }
}

