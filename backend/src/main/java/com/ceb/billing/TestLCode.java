package com.ceb.billing;

import com.ceb.billing.services.ExcelValidationService;

public class TestLCode {
    public static void main(String[] args) {
        String[][] testCases = {
            {"Net Accounting", "Net Accounting"},
            {"ACCOUNTING", "Net Accounting"},
            {"Accounting", "Net Accounting"},
            {"accounting", "Net Accounting"},
            
            {"Net Metering", "Net Metering"},
            {"METERING", "Net Metering"},
            {"Metering", "Net Metering"},
            
            {"Net Plus", "Net Plus"},
            {"PLUS", "Net Plus"},
            {"Plus", "Net Plus"},
            
            {"Net Plus Plus", "Net Plus Plus"},
            {"PLUS PLUS", "Net Plus Plus"},
            {"Plus Plus", "Net Plus Plus"},
            {"plus plus", "Net Plus Plus"},
            {"NET-PLUS-PLUS", "Net Plus Plus"}
        };

        System.out.println("=== Testing Net Type Normalization Assertions ===");
        for (String[] tc : testCases) {
            String input = tc[0];
            String expected = tc[1];
            String actual = ExcelValidationService.normalizeSolarType(input);
            System.out.println(String.format("Input: '%s' -> Expected: '%s' | Actual: '%s'", input, expected, actual));
            if (!expected.equals(actual)) {
                throw new AssertionError(String.format("Normalization failed for input: '%s'. Expected '%s', got '%s'", input, expected, actual));
            }
        }
        System.out.println("ALL NET TYPE NORMALIZATION ASSERTIONS PASSED SUCCESSFULLY!");
    }
}
