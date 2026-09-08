package com.ceb.billing.services;

import com.ceb.billing.models.PaymentEligibilityResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class PaymentControlServiceTest {

    private PaymentControlService service;

    @BeforeEach
    public void setup() {
        service = new PaymentControlService();
    }

    private Map<String, Object> createValidCustomerRecord() {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("accountNo", "4102938475");
        r.put("customerName", "Sunil Perera");
        r.put("masterName", "Sunil Perera");
        r.put("customerAddress", "123 Galle Road, Colombo");
        r.put("mobileNo", "0771234567");
        r.put("agreementDate", "2024-01-15");
        r.put("panelCapacity", 10.0);
        r.put("bankCode", "7010");
        r.put("branchCode", "001");
        r.put("bankAccountNo", "10029384756");
        r.put("solarType", "Net Plus");
        r.put("masterNetType", "Net Plus");
        r.put("unitRate", 22.0);
        r.put("masterUnitRate", 22.0);
        r.put("nameMatch", "MATCH");
        r.put("netTypeMatch", "MATCH");
        r.put("unitRateMatch", "MATCH");
        r.put("status", "VALID");
        r.put("errors", Collections.emptyList());
        r.put("warnings", Collections.emptyList());
        r.put("kwhSales", 1000.0);
        r.put("salesAmount", 22000.0);
        r.put("billSetOff", 2000.0);
        r.put("retentionMoney", 500.0);
        r.put("outstandingBalance", 5000.0);
        r.put("paymentSettled", 20000.0);
        r.put("payment", 20000.0);
        return r;
    }

    @Test
    public void testA_FullyValidCustomer_EvaluatesToREADY() {
        Map<String, Object> rec = createValidCustomerRecord();
        PaymentEligibilityResult res = service.canPay(rec);

        assertTrue(res.isEligible(), "Customer should be eligible");
        assertEquals("READY", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().isEmpty(), "Should have no hold reasons");
        assertTrue(res.getBlockingIssues().isEmpty(), "Should have no blocking issues");
        assertEquals(20000.0, res.getFinancials().get("totalPayable"));
    }

    @Test
    public void testB_NameMismatch_EvaluatesToON_HOLD() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.put("nameMatch", "MISMATCH");
        rec.put("masterName", "Sunil Perera");
        rec.put("customerName", "S. Perera");

        PaymentEligibilityResult res = service.canPay(rec);

        assertFalse(res.isEligible());
        assertEquals("ON_HOLD", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().contains("Name Mismatch"));
        assertTrue(res.getMismatches().stream().anyMatch(m -> "Customer Name".equals(m.get("field"))));
    }

    @Test
    public void testC_MissingBankDetails_EvaluatesToON_HOLD() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.remove("bankAccountNo");
        rec.remove("masterBankAccountNo");

        PaymentEligibilityResult res = service.canPay(rec);

        assertFalse(res.isEligible());
        assertEquals("ON_HOLD", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().contains("Invalid Bank Details"));
    }

    @Test
    public void testD_InvalidBillingData_EvaluatesToON_HOLD() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.put("noBillingData", true);

        PaymentEligibilityResult res = service.canPay(rec);

        assertFalse(res.isEligible());
        assertEquals("ON_HOLD", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().contains("No Billing Data"));
    }

    @Test
    public void testE_OutstandingBalance_CorrectlyDisplayedAndHandled() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.put("salesAmount", 30000.0);
        rec.put("billSetOff", 5000.0);
        rec.put("paymentSettled", 25000.0);
        rec.put("outstandingBalance", 12000.0);

        Map<String, Double> fin = service.extractFinancials(rec);

        assertEquals(30000.0, fin.get("currentPayment"));
        assertEquals(5000.0, fin.get("billSetOff"));
        assertEquals(25000.0, fin.get("totalPayable"));
        assertEquals(12000.0, fin.get("outstandingBalance"));
    }

    @Test
    public void testF_PaymentHoldFlag_Active_EvaluatesToON_HOLD() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.put("paymentHold", true);
        rec.put("paymentHoldReason", "Account audit pending");

        PaymentEligibilityResult res = service.canPay(rec);

        assertFalse(res.isEligible());
        assertEquals("ON_HOLD", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().contains("Payment Hold Active"));
    }

    @Test
    public void testG_UnitRateMismatch_EvaluatesToON_HOLD() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.put("unitRateMatch", "MISMATCH");
        rec.put("masterUnitRate", 22.0);
        rec.put("ngenUnitRate", 34.5);

        PaymentEligibilityResult res = service.canPay(rec);

        assertFalse(res.isEligible());
        assertEquals("ON_HOLD", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().contains("Unit Rate Mismatch"));
    }

    @Test
    public void testH_NetTypeMismatch_EvaluatesToON_HOLD() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.put("netTypeMatch", "MISMATCH");
        rec.put("masterNetType", "Net Plus");
        rec.put("mainNetType", "Net Metering");

        PaymentEligibilityResult res = service.canPay(rec);

        assertFalse(res.isEligible());
        assertEquals("ON_HOLD", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().contains("Net Type Mismatch"));
    }

    @Test
    public void testJ_CorrectionResolvesMismatch_CustomerBecomesREADY() {
        Map<String, Object> rec = createValidCustomerRecord();
        rec.put("nameMatch", "MISMATCH");
        rec.put("masterName", "Sunil Perera");
        rec.put("customerName", "S. Perera");

        // Initially ON_HOLD
        PaymentEligibilityResult initialRes = service.canPay(rec);
        assertFalse(initialRes.isEligible());
        assertEquals("ON_HOLD", initialRes.getPaymentStatus());

        // Staging correction applied: Customer Name corrected to match master
        rec.put("customerName", "Sunil Perera");
        rec.put("nameMatch", "MATCH");

        // Re-evaluate eligibility
        PaymentEligibilityResult correctedRes = service.canPay(rec);
        assertTrue(correctedRes.isEligible(), "Customer should be READY after correction");
        assertEquals("READY", correctedRes.getPaymentStatus());
        assertTrue(correctedRes.getHoldReasons().isEmpty());
    }

    @Test
    public void testK_BackendDirectApiRejection_WhenCustomerIneligible() {
        Map<String, Object> invalidRec = createValidCustomerRecord();
        invalidRec.remove("bankCode"); // Missing bank details
        PaymentEligibilityResult res = service.canPay(invalidRec);

        assertFalse(res.isEligible(), "Customer missing bank code must NOT be eligible");
        assertEquals("ON_HOLD", res.getPaymentStatus());
        assertTrue(res.getHoldReasons().contains("Invalid Bank Details"));
    }

    @Test
    public void testL_MonthWiseDataIsolation_SeptemberMismatchDoesNotPolluteAugust() {
        // September record has a name mismatch
        Map<String, Object> septRecord = createValidCustomerRecord();
        septRecord.put("billingMonth", "September 2026");
        septRecord.put("nameMatch", "MISMATCH");
        septRecord.put("customerName", "S.P. Perera");
        PaymentEligibilityResult septRes = service.canPay(septRecord);

        // August record is clean and has no issues
        Map<String, Object> augRecord = createValidCustomerRecord();
        augRecord.put("billingMonth", "August 2026");
        augRecord.put("customerName", "Sunil Perera");
        augRecord.put("nameMatch", "MATCH");
        PaymentEligibilityResult augRes = service.canPay(augRecord);

        // Verify September is ON_HOLD with Name Mismatch
        assertFalse(septRes.isEligible(), "September must be blocked due to mismatch");
        assertEquals("ON_HOLD", septRes.getPaymentStatus());
        assertTrue(septRes.getHoldReasons().contains("Name Mismatch"));

        // Verify August is 100% READY and has ZERO errors from September
        assertTrue(augRes.isEligible(), "August must remain READY with strict data isolation");
        assertEquals("READY", augRes.getPaymentStatus());
        assertTrue(augRes.getHoldReasons().isEmpty(), "August must not have September's hold reasons");
        assertTrue(augRes.getBlockingIssues().isEmpty(), "August must have no blocking issues");
    }
}


