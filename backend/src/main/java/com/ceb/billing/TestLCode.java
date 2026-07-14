package com.ceb.billing;

import com.ceb.billing.services.ExcelValidationService;

public class TestLCode {
    public static void main(String[] args) {
        String solar = "Net Accounting";
        String tariff = "FIX";
        String normSolar = ExcelValidationService.normalizeSolarType(solar);
        String lcode = ExcelValidationService.deriveLCode(normSolar, tariff);
        System.out.println("Solar: " + solar);
        System.out.println("Normalized Solar: " + normSolar);
        System.out.println("Tariff: " + tariff);
        System.out.println("Derived L-Code: " + lcode);
    }
}
