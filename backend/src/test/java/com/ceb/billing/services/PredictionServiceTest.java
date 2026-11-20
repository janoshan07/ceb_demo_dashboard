package com.ceb.billing.services;

import com.ceb.billing.repositories.BillingRecordRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PredictionServiceTest {

    @Mock
    private BillingRecordRepository billingRecordRepository;

    @Mock
    private PaymentControlService paymentControlService;

    @InjectMocks
    private PredictionService predictionService;

    @Test
    @DisplayName("Should generate predictions from snapshot monthly data when repository report is empty")
    void testPredictionFallbackToSnapshots() {
        when(billingRecordRepository.getMonthlyAnalyticsReport()).thenReturn(Collections.emptyList());

        List<Map<String, Object>> mockCanonical = new ArrayList<>();
        Map<String, Object> r1 = new HashMap<>();
        r1.put("accountNo", "1001");
        r1.put("salesAmount", 10000.0);
        r1.put("kwhImport", 200.0);
        r1.put("kwhExport", 400.0);
        r1.put("billingMonth", "July 2026");
        mockCanonical.add(r1);

        Map<String, Object> r2 = new HashMap<>();
        r2.put("accountNo", "1002");
        r2.put("salesAmount", 12000.0);
        r2.put("kwhImport", 250.0);
        r2.put("kwhExport", 500.0);
        r2.put("billingMonth", "August 2026");
        mockCanonical.add(r2);

        when(paymentControlService.loadCanonicalRecords(null, null)).thenReturn(mockCanonical);

        Map<String, Object> predictions = predictionService.getDashboardPredictions();
        assertNotNull(predictions);
        assertEquals("Sep '26", predictions.get("nextMonthName"));
        assertTrue((Double) predictions.get("nextMonthRevenue") > 0);
        assertTrue((Double) predictions.get("nextMonthExports") > 0);
        assertTrue((Double) predictions.get("nextMonthImports") > 0);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> history = (List<Map<String, Object>>) predictions.get("history");
        assertNotNull(history);
        assertEquals(2, history.size());
    }
}

