package com.ceb.billing.models;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PaymentEligibilityResult {

    private boolean eligible;
    private String paymentStatus; // READY, ON_HOLD, REVIEW
    private List<String> holdReasons = new ArrayList<>();
    private List<String> blockingIssues = new ArrayList<>();
    private List<Map<String, Object>> mismatches = new ArrayList<>();
    private Map<String, Double> financials = new HashMap<>();

    public PaymentEligibilityResult() {
    }

    public PaymentEligibilityResult(boolean eligible, String paymentStatus) {
        this.eligible = eligible;
        this.paymentStatus = paymentStatus;
    }

    public boolean isEligible() {
        return eligible;
    }

    public void setEligible(boolean eligible) {
        this.eligible = eligible;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public List<String> getHoldReasons() {
        return holdReasons;
    }

    public void setHoldReasons(List<String> holdReasons) {
        this.holdReasons = holdReasons;
    }

    public void addHoldReason(String reason) {
        if (reason != null && !this.holdReasons.contains(reason)) {
            this.holdReasons.add(reason);
        }
    }

    public List<String> getBlockingIssues() {
        return blockingIssues;
    }

    public void setBlockingIssues(List<String> blockingIssues) {
        this.blockingIssues = blockingIssues;
    }

    public void addBlockingIssue(String issue) {
        if (issue != null && !this.blockingIssues.contains(issue)) {
            this.blockingIssues.add(issue);
        }
    }

    public List<Map<String, Object>> getMismatches() {
        return mismatches;
    }

    public void setMismatches(List<Map<String, Object>> mismatches) {
        this.mismatches = mismatches;
    }

    public void addMismatch(String field, Object masterValue, Object sourceValue, String details) {
        Map<String, Object> m = new HashMap<>();
        m.put("field", field);
        m.put("masterValue", masterValue != null ? masterValue : "—");
        m.put("sourceValue", sourceValue != null ? sourceValue : "—");
        m.put("details", details != null ? details : "");
        this.mismatches.add(m);
    }

    public Map<String, Double> getFinancials() {
        return financials;
    }

    public void setFinancials(Map<String, Double> financials) {
        this.financials = financials;
    }
}
