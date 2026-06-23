package com.ceb.billing.services;

import com.ceb.billing.repositories.BillingRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class PredictionService {

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    private static final String[] MONTHS = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};

    public Map<String, Object> getDashboardPredictions() {
        Map<String, Object> response = new HashMap<>();

        // Fetch monthly historical aggregates sorted chronologically
        List<Object[]> monthlyRaw = billingRecordRepository.getMonthlyAnalyticsReport();
        int n = monthlyRaw.size();

        double nextMonthRevenue = 0.0;
        double nextMonthImports = 0.0;
        double nextMonthExports = 0.0;
        String nextMonthName = "N/A";

        List<Map<String, Object>> comparisonHistory = new ArrayList<>();

        if (n == 0) {
            response.put("nextMonthRevenue", 0.0);
            response.put("nextMonthImports", 0.0);
            response.put("nextMonthExports", 0.0);
            response.put("nextMonthName", "N/A");
            response.put("history", comparisonHistory);
            return response;
        }

        // Parse actual values
        double[] actualRevenues = new double[n];
        double[] actualImports = new double[n];
        double[] actualExports = new double[n];
        int[] years = new int[n];
        int[] months = new int[n];

        for (int i = 0; i < n; i++) {
            Object[] row = monthlyRaw.get(i);
            years[i] = ((Number) row[0]).intValue();
            months[i] = ((Number) row[1]).intValue();
            actualRevenues[i] = ((Number) row[2]).doubleValue();
            actualImports[i] = ((Number) row[3]).doubleValue();
            actualExports[i] = ((Number) row[4]).doubleValue();
        }

        // Calculate next month calendar properties
        int lastYear = years[n - 1];
        int lastMonth = months[n - 1];
        int nextM = lastMonth + 1;
        int nextY = lastYear;
        if (nextM > 12) {
            nextM = 1;
            nextY++;
        }
        nextMonthName = getMonthLabel(nextY, nextM);

        if (n < 2) {
            // Fallback for extremely short series
            nextMonthRevenue = Math.max(0.0, actualRevenues[0]);
            nextMonthImports = Math.max(0.0, actualImports[0]);
            nextMonthExports = Math.max(0.0, actualExports[0]);

            Map<String, Object> item = new HashMap<>();
            item.put("label", getMonthLabel(years[0], months[0]));
            item.put("actualRevenue", actualRevenues[0]);
            item.put("predictedRevenue", actualRevenues[0]);
            item.put("actualImports", actualImports[0]);
            item.put("predictedImports", actualImports[0]);
            item.put("actualExports", actualExports[0]);
            item.put("predictedExports", actualExports[0]);
            comparisonHistory.add(item);
        } else {
            // Perform Linear Regression (y = mx + c)
            // x_i = i + 1 (1-indexed chronological identifier: 1, 2, ..., n)
            double sumX = 0.0;
            double sumX2 = 0.0;
            for (int i = 1; i <= n; i++) {
                sumX += i;
                sumX2 += (i * i);
            }

            // Fit line for Revenue
            double sumYRev = 0.0;
            double sumXYRev = 0.0;
            for (int i = 0; i < n; i++) {
                sumYRev += actualRevenues[i];
                sumXYRev += ((i + 1) * actualRevenues[i]);
            }
            double mRev = (n * sumXYRev - sumX * sumYRev) / (n * sumX2 - sumX * sumX);
            double cRev = (sumYRev - mRev * sumX) / n;

            // Fit line for Imports
            double sumYImp = 0.0;
            double sumXYImp = 0.0;
            for (int i = 0; i < n; i++) {
                sumYImp += actualImports[i];
                sumXYImp += ((i + 1) * actualImports[i]);
            }
            double mImp = (n * sumXYImp - sumX * sumYImp) / (n * sumX2 - sumX * sumX);
            double cImp = (sumYImp - mImp * sumX) / n;

            // Fit line for Exports
            double sumYExp = 0.0;
            double sumXYExp = 0.0;
            for (int i = 0; i < n; i++) {
                sumYExp += actualExports[i];
                sumXYExp += ((i + 1) * actualExports[i]);
            }
            double mExp = (n * sumXYExp - sumX * sumYExp) / (n * sumX2 - sumX * sumX);
            double cExp = (sumYExp - mExp * sumX) / n;

            // Generate prediction outputs and comparison history
            for (int i = 0; i < n; i++) {
                int x = i + 1;
                Map<String, Object> item = new HashMap<>();
                item.put("label", getMonthLabel(years[i], months[i]));
                item.put("actualRevenue", actualRevenues[i]);
                item.put("predictedRevenue", Math.max(0.0, mRev * x + cRev));
                item.put("actualImports", actualImports[i]);
                item.put("predictedImports", Math.max(0.0, mImp * x + cImp));
                item.put("actualExports", actualExports[i]);
                item.put("predictedExports", Math.max(0.0, mExp * x + cExp));
                comparisonHistory.add(item);
            }

            // Next month calculations (x = n + 1)
            nextMonthRevenue = Math.max(0.0, mRev * (n + 1) + cRev);
            nextMonthImports = Math.max(0.0, mImp * (n + 1) + cImp);
            nextMonthExports = Math.max(0.0, mExp * (n + 1) + cExp);
        }

        response.put("nextMonthRevenue", nextMonthRevenue);
        response.put("nextMonthImports", nextMonthImports);
        response.put("nextMonthExports", nextMonthExports);
        response.put("nextMonthName", nextMonthName);
        response.put("history", comparisonHistory);

        return response;
    }

    private String getMonthLabel(int year, int month) {
        if (month >= 1 && month <= 12) {
            String yrStr = String.valueOf(year);
            String yrShort = yrStr.length() >= 4 ? yrStr.substring(2) : yrStr;
            return MONTHS[month - 1] + " '" + yrShort;
        }
        return "Month " + month;
    }
}
