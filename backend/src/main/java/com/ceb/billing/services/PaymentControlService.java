package com.ceb.billing.services;

import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.entities.PaymentBatch;
import com.ceb.billing.entities.PaymentBatchItem;
import com.ceb.billing.models.PaymentEligibilityResult;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.ceb.billing.repositories.PaymentBatchItemRepository;
import com.ceb.billing.repositories.PaymentBatchRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.logging.Logger;

@SuppressWarnings("null")
@Service
public class PaymentControlService {

    private static final Logger log = Logger.getLogger(PaymentControlService.class.getName());

    @Autowired
    private MonthlyDirectorySnapshotRepository monthlyDirectorySnapshotRepository;

    @Autowired
    private PaymentBatchRepository paymentBatchRepository;

    @Autowired
    private PaymentBatchItemRepository paymentBatchItemRepository;

    @Autowired
    private MultiFileImportService multiFileImportService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired(required = false)
    private com.ceb.billing.repositories.CustomerRepository customerRepository;

    private static final TypeReference<List<Map<String, Object>>> LIST_MAP_TYPE = new TypeReference<>() {};

    /**
     * Core Backend Security Check: canPay(customerRecord).
     * Enforces all 11 enterprise payment-eligibility rules.
     */
    public PaymentEligibilityResult canPay(Map<String, Object> record) {
        PaymentEligibilityResult result = new PaymentEligibilityResult();
        if (record == null) {
            result.setEligible(false);
            result.setPaymentStatus("ON_HOLD");
            result.addHoldReason("Missing Information");
            result.addBlockingIssue("Record is null");
            return result;
        }

        // Financials extraction
        Map<String, Double> fin = extractFinancials(record);
        result.setFinancials(fin);

        String accountNo = strVal(record.get("accountNo"));
        String customerName = strVal(record.get("customerName"));
        if (customerName.isEmpty()) customerName = strVal(record.get("masterName"));
        if (customerName.isEmpty()) customerName = strVal(record.get("npayName"));
        if (customerName.isEmpty()) customerName = strVal(record.get("ngenName"));

        String address = strVal(record.get("customerAddress"));
        if (address.isEmpty()) address = strVal(record.get("masterAddress"));
        if (address.isEmpty()) address = strVal(record.get("address"));

        String mobileNo = strVal(record.get("mobileNo"));
        if (mobileNo.isEmpty()) mobileNo = strVal(record.get("masterMobile"));
        if (mobileNo.isEmpty()) mobileNo = strVal(record.get("phone"));

        String agreementDate = strVal(record.get("agreementDate"));
        if (agreementDate.isEmpty()) agreementDate = strVal(record.get("masterAgreementDate"));

        Double panelCapacity = parseDouble(record.get("panelCapacity"));
        if (panelCapacity == null) panelCapacity = parseDouble(record.get("masterPanelCapacity"));

        String bankCode = strVal(record.get("bankCode"));
        if (bankCode.isEmpty()) bankCode = strVal(record.get("masterBankCode"));

        String branchCode = strVal(record.get("branchCode"));
        if (branchCode.isEmpty()) branchCode = strVal(record.get("masterBranchCode"));

        String bankAccountNo = strVal(record.get("bankAccountNo"));
        if (bankAccountNo.isEmpty()) bankAccountNo = strVal(record.get("masterBankAccountNo"));

        String solarType = strVal(record.get("solarType"));
        if (solarType.isEmpty()) solarType = strVal(record.get("masterNetType"));
        if (solarType.isEmpty()) solarType = strVal(record.get("ngenNetType"));
        if (solarType.isEmpty()) solarType = strVal(record.get("npayNetType"));

        Double unitRate = parseDouble(record.get("unitRate"));
        if (unitRate == null) unitRate = parseDouble(record.get("masterUnitRate"));
        if (unitRate == null) unitRate = parseDouble(record.get("ngenUnitRate"));

        // 1. Account Number validity
        if (accountNo.isEmpty() || "—".equals(accountNo)) {
            result.addHoldReason("Missing Information");
            result.addBlockingIssue("Account number is missing or invalid");
        }

        // 2. Customer identity / Name validation check
        String nameMatch = strVal(record.get("nameMatch"));
        boolean isNameApproved = Boolean.TRUE.equals(record.get("nameApproved"));
        if ("MISMATCH".equalsIgnoreCase(nameMatch) && !isNameApproved) {
            result.addHoldReason("Name Mismatch");
            result.addBlockingIssue("Customer identity/name mismatch between Master Data and billing source");
            result.addMismatch("Customer Name", record.get("masterName"), record.get("npayName") != null ? record.get("npayName") : record.get("ngenName"), "Name mismatch requires verification or approval");
        }

        // 3. Required customer details complete
        if (customerName.isEmpty() || "—".equals(customerName)) {
            result.addHoldReason("Missing Information");
            result.addBlockingIssue("Customer Name is missing");
        }
        if (address.isEmpty() || "—".equals(address)) {
            result.addHoldReason("Missing Information");
            result.addBlockingIssue("Customer Address is missing");
        }
        if (mobileNo.isEmpty() || "—".equals(mobileNo)) {
            result.addHoldReason("Missing Information");
            result.addBlockingIssue("Mobile Number is missing");
        }
        if (panelCapacity == null || panelCapacity <= 0) {
            result.addHoldReason("Missing Information");
            result.addBlockingIssue("Panel capacity is missing or invalid");
        }

        // 4. Required bank / payment details valid
        if (bankCode.isEmpty() || "—".equals(bankCode)
                || branchCode.isEmpty() || "—".equals(branchCode)
                || bankAccountNo.isEmpty() || "—".equals(bankAccountNo)) {
            result.addHoldReason("Invalid Bank Details");
            result.addBlockingIssue("Bank code, branch code, or bank account number is missing");
        }

        // 5. Net Type is valid
        String netTypeMatch = strVal(record.get("netTypeMatch"));
        boolean isNetTypeApproved = Boolean.TRUE.equals(record.get("netTypeApproved"));
        if ("MISMATCH".equalsIgnoreCase(netTypeMatch) && !isNetTypeApproved) {
            result.addHoldReason("Net Type Mismatch");
            result.addBlockingIssue("Net Type mismatch between Master and Billing data");
            result.addMismatch("Net Type", record.get("masterNetType"), record.get("mainNetType") != null ? record.get("mainNetType") : record.get("ngenNetType"), "Net Type mismatch requires resolution");
        }
        if (solarType.isEmpty() || "—".equals(solarType)) {
            result.addHoldReason("Missing Information");
            result.addBlockingIssue("Net Type / Solar Type is missing");
        }

        // 6. Required billing information is available
        boolean isNoBill = Boolean.TRUE.equals(record.get("masterOnly")) || Boolean.TRUE.equals(record.get("noBillingData"));
        if (isNoBill) {
            result.addHoldReason("No Billing Data");
            result.addBlockingIssue("No billing data uploaded for this billing period");
        }

        // 7. Unit rate / calculation validation passes
        String unitRateMatch = strVal(record.get("unitRateMatch"));
        boolean isUnitRateApproved = Boolean.TRUE.equals(record.get("unitRateApproved"));
        if ("MISMATCH".equalsIgnoreCase(unitRateMatch) && !isUnitRateApproved) {
            result.addHoldReason("Unit Rate Mismatch");
            result.addBlockingIssue("Unit Rate mismatch between Master Data and NGEN dataset");
            result.addMismatch("Unit Rate", record.get("masterUnitRate"), record.get("mainUnitRate") != null ? record.get("mainUnitRate") : record.get("ngenUnitRate"), "Unit Rate difference exceeds threshold");
        }
        if (unitRate == null || unitRate <= 0) {
            result.addHoldReason("Unit Rate Mismatch");
            result.addBlockingIssue("Unit Rate is missing or zero");
        }

        // 8. No unresolved blocking mismatches exists (payment, energy purchase, etc.)
        Object pMap = record.get("mergedPayment");
        if (pMap instanceof Map && Boolean.TRUE.equals(((Map<?, ?>) pMap).get("mismatch"))) {
            result.addHoldReason("Payment Mismatch");
            result.addBlockingIssue("Payment mismatch between NGEN settlement and NPAY payment");
            result.addMismatch("Payment", ((Map<?, ?>) pMap).get("ngen"), ((Map<?, ?>) pMap).get("npay"), "Payment calculation mismatch across billing sources");
        }

        Object epMap = record.get("mergedEnergyPurchase");
        if (epMap instanceof Map && Boolean.TRUE.equals(((Map<?, ?>) epMap).get("mismatch"))) {
            result.addHoldReason("Other Blocking Issue");
            result.addBlockingIssue("Energy purchase calculation mismatch between NGEN and NPAY");
            result.addMismatch("Energy Purchase", ((Map<?, ?>) epMap).get("ngen"), ((Map<?, ?>) epMap).get("npay"), "Sales amount does not match energy purchase");
        }

        // 9. No unresolved validation errors exist
        List<?> errors = record.get("errors") instanceof List ? (List<?>) record.get("errors") : Collections.emptyList();
        String primaryStatus = strVal(record.get("status"));
        boolean isRejected = "REJECTED".equalsIgnoreCase(primaryStatus) || Boolean.TRUE.equals(record.get("rejected"));
        if (isRejected) {
            result.addHoldReason("Validation Error");
            result.addBlockingIssue("Record was marked as REJECTED during validation");
        } else if (!errors.isEmpty()) {
            result.addHoldReason("Validation Error");
            for (Object err : errors) {
                if (err != null) result.addBlockingIssue(err.toString());
            }
        }

        // 10. Customer is not on payment hold
        if (Boolean.TRUE.equals(record.get("paymentHold"))) {
            result.addHoldReason("Payment Hold Active");
            String holdNote = strVal(record.get("paymentHoldReason"));
            result.addBlockingIssue("Customer is marked with active Payment Hold" + (holdNote.isEmpty() ? "" : ": " + holdNote));
        }

        // 11. Billing / payment calculation successfully completed
        Double totalPayable = fin.get("totalPayable");
        if (totalPayable == null) {
            result.addHoldReason("Other Blocking Issue");
            result.addBlockingIssue("Billing/payment calculation could not be computed");
        }

        // Decision Logic
        if (result.getBlockingIssues().isEmpty() && result.getHoldReasons().isEmpty()) {
            result.setEligible(true);
            result.setPaymentStatus("READY");
        } else {
            result.setEligible(false);
            if ("REVIEW".equalsIgnoreCase(strVal(record.get("paymentStatus")))) {
                result.setPaymentStatus("REVIEW");
            } else {
                result.setPaymentStatus("ON_HOLD");
            }
        }

        return result;
    }

    /**
     * Financial Formula Extraction adhering strictly to existing backend rules:
     * - Current payment = kWh Sales Amount or NPAY Energy Purchase (or payment before set-off)
     * - Bill Set-Off = Bill Outstanding Set Off
     * - Retention = Retention Money
     * - Outstanding Balance = Outstanding balance carried forward
     * - Total Payable = Payment Settled (or NPAY payment)
     */
    public Map<String, Double> extractFinancials(Map<String, Object> record) {
        Map<String, Double> fin = new LinkedHashMap<>();

        Double billSetOff = parseDouble(record.get("billSetOff"));
        if (billSetOff == null) billSetOff = parseDouble(record.get("ngenBillSetOff"));
        if (billSetOff == null) billSetOff = parseDouble(record.get("npayBillSetOff"));
        if (billSetOff == null) billSetOff = 0.0;

        Double retention = parseDouble(record.get("retentionMoney"));
        if (retention == null) retention = parseDouble(record.get("ngenRetentionMoney"));
        if (retention == null) retention = parseDouble(record.get("npayRetentionMoney"));
        if (retention == null) retention = 0.0;

        Double outstanding = parseDouble(record.get("outstandingBalance"));
        if (outstanding == null) outstanding = 0.0;

        Double paymentSettled = parseDouble(record.get("paymentSettled"));
        Double npayPayment = parseDouble(record.get("npayPayment"));
        Double payment = parseDouble(record.get("payment"));
        Double currentPayment = parseDouble(record.get("energyPurchase"));
        if (currentPayment == null) currentPayment = parseDouble(record.get("salesAmount"));
        if (currentPayment == null) currentPayment = parseDouble(record.get("kwhSalesAmount"));

        Double totalPayable = paymentSettled != null ? paymentSettled : (npayPayment != null ? npayPayment : payment);
        if (totalPayable == null) {
            if (currentPayment != null) {
                totalPayable = Math.max(0.0, currentPayment - billSetOff);
            } else {
                totalPayable = 0.0;
            }
        }
        if (currentPayment == null) {
            currentPayment = totalPayable + billSetOff;
        }

        fin.put("currentPayment", Math.round(currentPayment * 100.0) / 100.0);
        fin.put("billSetOff", Math.round(billSetOff * 100.0) / 100.0);
        fin.put("retentionMoney", Math.round(retention * 100.0) / 100.0);
        fin.put("outstandingBalance", Math.round(outstanding * 100.0) / 100.0);
        fin.put("totalPayable", Math.round(totalPayable * 100.0) / 100.0);

        return fin;
    }

    /**
     * Canonical Summary calculation.
     * Guaranteed to use the full canonical dataset for the specified period and division,
     * invariant under user searches, filters, or pagination.
     */
    public Map<String, Object> getCanonicalSummary(String billingPeriod, String division) {
        List<Map<String, Object>> records = loadCanonicalRecords(billingPeriod, division);

        int paymentReadyCount = 0;
        int onHoldCount = 0;
        int reviewCount = 0;
        double totalPayable = 0.0;
        double totalOnHold = 0.0;
        Set<String> distinctCustomers = new HashSet<>();

        // Pre-fetch all batch items to reflect settlement state per month
        List<PaymentBatchItem> allBatchItems = Collections.emptyList();
        if (paymentBatchItemRepository != null) {
            try {
                allBatchItems = paymentBatchItemRepository.findAll();
            } catch (Exception ignored) {}
        }
        Map<String, PaymentBatchItem> batchItemMap = new HashMap<>();
        for (PaymentBatchItem bi : allBatchItems) {
            if (bi.getBatch() != null && bi.getBatch().getBillingPeriod() != null) {
                String k = bi.getAccountNo().trim().toLowerCase() + "::" + bi.getBatch().getBillingPeriod().trim().toLowerCase();
                batchItemMap.put(k, bi);
            }
        }

        for (Map<String, Object> r : records) {
            String acc = strVal(r.get("accountNo"));
            if (!acc.isEmpty()) {
                distinctCustomers.add(acc);
            }
            PaymentEligibilityResult elig = canPay(r);
            Map<String, Double> fin = elig.getFinancials();
            double payable = fin.getOrDefault("totalPayable", 0.0);

            String status = elig.getPaymentStatus();
            String bMonth = strVal(r.get("billingMonth"));
            PaymentBatchItem bItem = !bMonth.isEmpty() ? batchItemMap.get(acc.trim().toLowerCase() + "::" + bMonth.trim().toLowerCase()) : null;
            if (bItem != null && bItem.getBatch() != null) {
                String biStatus = strVal(bItem.getPaymentStatus());
                String bStatus = strVal(bItem.getBatch().getStatus());
                if ("PAID".equalsIgnoreCase(biStatus) || "PAID".equalsIgnoreCase(bStatus)) {
                    status = "PAID";
                } else if ("PAYMENT_PROCESSED".equalsIgnoreCase(bStatus)) {
                    status = "PROCESSING";
                } else if ("APPROVED".equalsIgnoreCase(bStatus)) {
                    status = "APPROVED";
                } else if ("REJECTED".equalsIgnoreCase(bStatus)) {
                    status = "REJECTED";
                } else if ("SUBMITTED".equalsIgnoreCase(bStatus) || "UNDER_REVIEW".equalsIgnoreCase(bStatus)) {
                    status = "REVIEW";
                }
            }

            if ("READY".equals(status)) {
                paymentReadyCount++;
                totalPayable += payable;
            } else if ("REVIEW".equals(status)) {
                reviewCount++;
                totalOnHold += payable;
            } else if ("PAID".equals(status) || "PROCESSING".equals(status) || "APPROVED".equals(status)) {
                // Batch-processed/paid items: do not count in Ready or On Hold
            } else {
                onHoldCount++;
                totalOnHold += payable;
            }
        }

        int multiPaymentCount = 0;
        int multiPaymentCustomersCount = 0;
        Map<String, Integer> custPaymentCounts = new HashMap<>();
        for (Map<String, Object> r : records) {
            String acc = strVal(r.get("accountNo")).toLowerCase();
            if (!acc.isEmpty()) {
                custPaymentCounts.put(acc, custPaymentCounts.getOrDefault(acc, 0) + 1);
            }
        }
        for (int cnt : custPaymentCounts.values()) {
            if (cnt > 1) {
                multiPaymentCustomersCount++;
                multiPaymentCount += cnt;
            }
        }

        double totalPending = totalPayable + totalOnHold;
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalCustomers", distinctCustomers.size());
        summary.put("customerCount", distinctCustomers.size());
        summary.put("totalPaymentRecords", records.size());
        summary.put("multiPaymentCount", multiPaymentCount);
        summary.put("multiPaymentCustomersCount", multiPaymentCustomersCount);
        summary.put("paymentReadyCount", paymentReadyCount);
        summary.put("onHoldCount", onHoldCount);
        summary.put("reviewCount", reviewCount);
        summary.put("totalPayable", Math.round(totalPayable * 100.0) / 100.0);
        summary.put("totalOnHold", Math.round(totalOnHold * 100.0) / 100.0);
        summary.put("totalPendingAmount", Math.round(totalPending * 100.0) / 100.0);
        summary.put("totalReadyAmount", Math.round(totalPayable * 100.0) / 100.0);
        summary.put("totalOnHoldAmount", Math.round(totalOnHold * 100.0) / 100.0);
        summary.put("readyAmount", Math.round(totalPayable * 100.0) / 100.0);
        summary.put("onHoldAmount", Math.round(totalOnHold * 100.0) / 100.0);
        summary.put("billingPeriod", billingPeriod != null ? billingPeriod : "ALL");
        summary.put("division", division != null ? division : "ALL");

        return summary;
    }

    /**
     * Retrieves evaluated customer list with server-side filtering, search, and pagination.
     * Groups multiple records under their customer with calculated aggregates and expandable payment details.
     */
    public Map<String, Object> getPaymentCustomers(String billingPeriod, String division, String category,
                                                  String search, String holdReasonFilter,
                                                  String validationStatusFilter, String netTypeFilter,
                                                  Boolean multiPaymentOnly,
                                                  int page, int size) {
        List<Map<String, Object>> allRecords = loadCanonicalRecords(billingPeriod, division);
        List<Map<String, Object>> processed = new ArrayList<>();

        String q = search != null ? search.trim().toLowerCase() : "";
        String cat = category != null ? category.trim().toUpperCase() : "ALL";
        String hrFilter = holdReasonFilter != null ? holdReasonFilter.trim().toUpperCase() : "ALL";

        // Pre-fetch all batch items to reflect settlement state per month
        List<PaymentBatchItem> allBatchItems = Collections.emptyList();
        if (paymentBatchItemRepository != null) {
            try {
                allBatchItems = paymentBatchItemRepository.findAll();
            } catch (Exception ignored) {}
        }
        Map<String, PaymentBatchItem> batchItemMap = new HashMap<>();
        for (PaymentBatchItem bi : allBatchItems) {
            if (bi.getBatch() != null && bi.getBatch().getBillingPeriod() != null) {
                String k = bi.getAccountNo().trim().toLowerCase() + "::" + bi.getBatch().getBillingPeriod().trim().toLowerCase();
                batchItemMap.put(k, bi);
            }
        }

        for (Map<String, Object> rec : allRecords) {
            PaymentEligibilityResult elig = canPay(rec);
            String status = elig.getPaymentStatus();
            String acc = strVal(rec.get("accountNo"));
            String bMonth = strVal(rec.get("billingMonth"));

            // Check if there is a batch item for this account & billing month
            PaymentBatchItem bItem = !bMonth.isEmpty() ? batchItemMap.get(acc.trim().toLowerCase() + "::" + bMonth.trim().toLowerCase()) : null;
            if (bItem != null && bItem.getBatch() != null) {
                String biStatus = strVal(bItem.getPaymentStatus());
                String bStatus = strVal(bItem.getBatch().getStatus());
                if ("PAID".equalsIgnoreCase(biStatus) || "PAID".equalsIgnoreCase(bStatus)) {
                    status = "PAID";
                } else if ("PAYMENT_PROCESSED".equalsIgnoreCase(bStatus)) {
                    status = "PROCESSING";
                } else if ("APPROVED".equalsIgnoreCase(bStatus)) {
                    status = "APPROVED";
                } else if ("REJECTED".equalsIgnoreCase(bStatus)) {
                    status = "REJECTED";
                } else if ("SUBMITTED".equalsIgnoreCase(bStatus) || "UNDER_REVIEW".equalsIgnoreCase(bStatus)) {
                    status = "REVIEW";
                }
            }

            // Filter multi-payment only
            if (Boolean.TRUE.equals(multiPaymentOnly)) {
                boolean isMulti = Boolean.TRUE.equals(rec.get("hasMultiplePayments"));
                if (!isMulti) continue;
            }

            // Filter by category: READY vs ON_HOLD vs REVIEW vs PAID vs ALL
            if (!"ALL".equals(cat)) {
                if ("ON_HOLD".equalsIgnoreCase(cat)) {
                    if (!"ON_HOLD".equalsIgnoreCase(status) && !"REVIEW".equalsIgnoreCase(status)) continue;
                } else if ("READY".equalsIgnoreCase(cat)) {
                    if (!"READY".equalsIgnoreCase(status)) continue;
                } else if (!cat.equalsIgnoreCase(status)) {
                    continue;
                }
            }

            // Filter by hold reason
            if (!"ALL".equals(hrFilter)) {
                boolean hasReason = elig.getHoldReasons().stream().anyMatch(hr -> hr.equalsIgnoreCase(hrFilter));
                if (!hasReason) continue;
            }

            // Validation status filter
            if (validationStatusFilter != null && !"ALL".equalsIgnoreCase(validationStatusFilter.trim())) {
                String vs = strVal(rec.get("validationStatus"));
                if (vs.isEmpty()) vs = "VALID";
                if (!vs.equalsIgnoreCase(validationStatusFilter.trim())) continue;
            }

            // Net type filter
            if (netTypeFilter != null && !"ALL".equalsIgnoreCase(netTypeFilter.trim())) {
                String nt = strVal(rec.get("solarType"));
                if (nt.isEmpty()) nt = strVal(rec.get("masterNetType"));
                if (!nt.equalsIgnoreCase(netTypeFilter.trim())) continue;
            }

            // Search query (Account No, Customer Name)
            String accLower = acc.toLowerCase();
            String nameLower = strVal(rec.get("customerName")).toLowerCase();
            if (nameLower.isEmpty()) nameLower = strVal(rec.get("masterName")).toLowerCase();
            if (!q.isEmpty() && !accLower.contains(q) && !nameLower.contains(q)) {
                continue;
            }

            // Formulate human-readable Hold Status
            String holdStatus;
            if ("PAID".equalsIgnoreCase(status)) {
                holdStatus = "Settled (PAID)";
            } else if ("PROCESSING".equalsIgnoreCase(status)) {
                holdStatus = "Processing Payment";
            } else if ("APPROVED".equalsIgnoreCase(status)) {
                holdStatus = "Approved in Batch";
            } else if ("READY".equalsIgnoreCase(status)) {
                holdStatus = "READY (Eligible)";
            } else if ("REVIEW".equalsIgnoreCase(status)) {
                holdStatus = "Requires Review";
            } else {
                List<String> reasons = elig.getHoldReasons();
                holdStatus = reasons.isEmpty() ? "ON HOLD" : "ON HOLD: " + reasons.get(0);
            }

            Map<String, Object> item = new LinkedHashMap<>(rec);
            item.put("eligibility", elig);
            item.put("paymentStatus", status);
            item.put("paymentEligibility", elig.isEligible() ? "READY" : ("REVIEW".equals(status) ? "REVIEW" : "ON HOLD"));
            String vStatus = strVal(rec.get("validationStatus"));
            if (vStatus.isEmpty()) {
                vStatus = elig.isEligible() ? "VALID" : (elig.getHoldReasons().contains("Validation Error") ? "ERROR" : "WARNING");
            }
            item.put("validationStatus", vStatus);
            item.put("billingMonth", !bMonth.isEmpty() ? bMonth : strVal(rec.get("billingPeriod")));
            item.put("billingPeriod", rec.get("billingPeriod") != null ? rec.get("billingPeriod") : bMonth);
            item.put("holdStatus", holdStatus);
            item.put("isEligible", "READY".equalsIgnoreCase(status));
            item.put("holdReasons", elig.getHoldReasons());
            item.put("blockingIssues", elig.getBlockingIssues());
            item.put("financials", elig.getFinancials());
            item.put("mismatches", elig.getMismatches());
            item.put("categorizedIssues", categorizeIssues(rec, elig));
            item.put("missingFields", extractMissingFields(rec));
            item.put("currentPayment", elig.getFinancials().get("currentPayment"));
            item.put("outstandingBalance", elig.getFinancials().get("outstandingBalance"));
            item.put("totalPayable", elig.getFinancials().get("totalPayable"));
            item.put("billSetOff", elig.getFinancials().get("billSetOff"));
            item.put("retentionMoney", elig.getFinancials().get("retentionMoney"));
            if (bItem != null && bItem.getBatch() != null) {
                item.put("batchNumber", bItem.getBatch().getBatchNumber());
                item.put("batchId", bItem.getBatch().getId());
            }

            processed.add(item);
        }

        // Group evaluated records by customer Account Number to construct Customer-Level Summaries
        Map<String, List<Map<String, Object>>> groupsByAccount = new LinkedHashMap<>();
        for (Map<String, Object> item : processed) {
            String acc = strVal(item.get("accountNo"));
            if (acc.isEmpty()) acc = "UNKNOWN";
            groupsByAccount.computeIfAbsent(acc, k -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> customerGroups = new ArrayList<>();
        int totalPaymentRecordsAll = 0;

        for (Map.Entry<String, List<Map<String, Object>>> entry : groupsByAccount.entrySet()) {
            String acc = entry.getKey();
            List<Map<String, Object>> pList = entry.getValue();
            totalPaymentRecordsAll += pList.size();

            Map<String, Object> first = pList.get(0);
            Map<String, Object> group = new LinkedHashMap<>(first);

            double totalPending = 0.0;
            double readyAmt = 0.0;
            double onHoldAmt = 0.0;
            double totalPayableSum = 0.0;
            int readyCount = 0;
            int onHoldCount = 0;
            int paidCount = 0;
            int processingCount = 0;
            int reviewCount = 0;

            Set<String> allHoldReasons = new LinkedHashSet<>();
            Set<String> allBlockingIssues = new LinkedHashSet<>();

            for (Map<String, Object> p : pList) {
                String pStatus = strVal(p.get("paymentStatus"));
                double payable = p.get("totalPayable") instanceof Number ? ((Number) p.get("totalPayable")).doubleValue() : 0.0;
                totalPayableSum += payable;

                @SuppressWarnings("unchecked")
                List<String> hr = (List<String>) p.get("holdReasons");
                if (hr != null) allHoldReasons.addAll(hr);

                @SuppressWarnings("unchecked")
                List<String> bi = (List<String>) p.get("blockingIssues");
                if (bi != null) allBlockingIssues.addAll(bi);

                if ("PAID".equalsIgnoreCase(pStatus)) {
                    paidCount++;
                } else if ("PROCESSING".equalsIgnoreCase(pStatus)) {
                    processingCount++;
                    totalPending += payable;
                } else if ("READY".equalsIgnoreCase(pStatus)) {
                    readyCount++;
                    readyAmt += payable;
                    totalPending += payable;
                } else if ("REVIEW".equalsIgnoreCase(pStatus)) {
                    reviewCount++;
                    onHoldAmt += payable;
                    totalPending += payable;
                } else {
                    onHoldCount++;
                    onHoldAmt += payable;
                    totalPending += payable;
                }
            }

            // Customer Aggregate Payment Status:
            // - PAID: all records are PAID
            // - PROCESSING: any record is in PROCESSING
            // - READY FOR PAYMENT: all unpaid records are READY (and readyCount > 0)
            // - PARTIALLY READY: some unpaid are READY and some are ON_HOLD or REVIEW
            // - ON HOLD: all unpaid records are ON_HOLD or REVIEW
            String custStatus;
            if (paidCount == pList.size() && !pList.isEmpty()) {
                custStatus = "PAID";
            } else if (processingCount > 0) {
                custStatus = "PROCESSING";
            } else if (readyCount > 0 && onHoldCount == 0 && reviewCount == 0) {
                custStatus = "READY FOR PAYMENT";
            } else if (readyCount > 0 && (onHoldCount > 0 || reviewCount > 0)) {
                custStatus = "PARTIALLY READY";
            } else {
                custStatus = "ON HOLD";
            }

            group.put("accountNo", acc);
            group.put("customerPaymentStatus", custStatus);
            group.put("paymentStatus", custStatus);
            group.put("paymentRecordsCount", pList.size());
            group.put("totalPaymentsForCustomer", pList.size());
            group.put("hasMultiplePayments", pList.size() > 1);
            group.put("totalPendingAmount", Math.round(totalPending * 100.0) / 100.0);
            group.put("totalReadyAmount", Math.round(readyAmt * 100.0) / 100.0);
            group.put("readyAmount", Math.round(readyAmt * 100.0) / 100.0);
            group.put("totalOnHoldAmount", Math.round(onHoldAmt * 100.0) / 100.0);
            group.put("onHoldAmount", Math.round(onHoldAmt * 100.0) / 100.0);
            group.put("totalPayableAmount", Math.round(totalPayableSum * 100.0) / 100.0);
            group.put("totalPayable", Math.round(totalPayableSum * 100.0) / 100.0);
            group.put("cumulativeCustomerPayable", Math.round(totalPayableSum * 100.0) / 100.0);
            group.put("readyRecordsCount", readyCount);
            group.put("onHoldRecordsCount", onHoldCount + reviewCount);
            group.put("paidRecordsCount", paidCount);
            group.put("isEligible", "READY FOR PAYMENT".equalsIgnoreCase(custStatus));
            group.put("allHoldReasons", new ArrayList<>(allHoldReasons));
            group.put("allBlockingIssues", new ArrayList<>(allBlockingIssues));
            group.put("payments", pList);
            group.put("paymentRecords", pList);

            customerGroups.add(group);
        }

        int totalCount = customerGroups.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) totalCount / size) : 1;
        int fromIndex = Math.min(page * size, totalCount);
        int toIndex = Math.min(fromIndex + size, totalCount);
        List<Map<String, Object>> pagedList = customerGroups.subList(fromIndex, toIndex);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", pagedList);
        result.put("totalElements", totalCount);
        result.put("totalCustomers", totalCount);
        result.put("totalPaymentRecords", totalPaymentRecordsAll);
        result.put("totalPages", totalPages);
        result.put("currentPage", page);
        result.put("pageSize", size);

        return result;
    }

    public Map<String, Object> getPaymentCustomers(String billingPeriod, String division, String category,
                                                  String search, String holdReasonFilter,
                                                  int page, int size) {
        return getPaymentCustomers(billingPeriod, division, category, search, holdReasonFilter, null, null, null, page, size);
    }

    /**
     * Detailed Customer 360 & Issue View.
     * Side-by-side MASTER VALUE vs UPLOADED/SOURCE VALUE.
     */
    public Map<String, Object> getCustomerIssueDetails(String accountNo, String billingPeriod) {
        return getCustomerIssueDetails(accountNo, billingPeriod, null);
    }

    public Map<String, Object> getCustomerIssueDetails(String accountNo, String billingPeriod, String recordKey) {
        if (accountNo == null || accountNo.trim().isEmpty()) {
            throw new IllegalArgumentException("Account number is required.");
        }
        List<Map<String, Object>> records = loadCanonicalRecords(billingPeriod, null);
        Map<String, Object> target = null;
        List<Map<String, Object>> allCustomerPayments = new ArrayList<>();

        // Also fetch all records across all months for this customer
        List<Map<String, Object>> allMonthsRecords = loadCanonicalRecords(null, null);
        for (Map<String, Object> r : allMonthsRecords) {
            if (accountNo.trim().equalsIgnoreCase(strVal(r.get("accountNo")))) {
                allCustomerPayments.add(r);
            }
        }

        if (recordKey != null && !recordKey.trim().isEmpty()) {
            for (Map<String, Object> r : allMonthsRecords) {
                if (recordKey.trim().equalsIgnoreCase(strVal(r.get("recordKey")))) {
                    target = r;
                    break;
                }
            }
        }

        if (target == null) {
            for (Map<String, Object> r : records) {
                if (accountNo.trim().equalsIgnoreCase(strVal(r.get("accountNo")))) {
                    if (billingPeriod != null && !billingPeriod.trim().isEmpty() && !"ALL".equalsIgnoreCase(billingPeriod.trim())) {
                        String bMonth = strVal(r.get("billingMonth"));
                        if (billingPeriod.trim().equalsIgnoreCase(bMonth)) {
                            target = r;
                            break;
                        }
                    }
                    if (target == null) {
                        target = r;
                    }
                }
            }
        }

        if (target == null && !allCustomerPayments.isEmpty()) {
            target = allCustomerPayments.get(0);
        }

        if (target == null) {
            try {
                Map<String, Object> dossier = getCustomerMonthWisePaymentDossier(accountNo);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> months = (List<Map<String, Object>>) dossier.get("months");
                if (months != null && !months.isEmpty()) {
                    if (billingPeriod != null && !billingPeriod.trim().isEmpty() && !"ALL".equalsIgnoreCase(billingPeriod.trim())) {
                        for (Map<String, Object> m : months) {
                            if (billingPeriod.trim().equalsIgnoreCase(strVal(m.get("billingMonth")))) {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> rec = (Map<String, Object>) m.get("record");
                                if (rec != null) { target = rec; break; }
                            }
                        }
                    }
                    if (target == null) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> rec = (Map<String, Object>) months.get(0).get("record");
                        if (rec != null) target = rec;
                    }
                }
            } catch (Exception ignored) {}
        }
        if (target == null) {
            throw new IllegalArgumentException("Customer record not found for account: " + accountNo);
        }

        PaymentEligibilityResult elig = canPay(target);

        // Build Master vs Uploaded comparison map
        List<Map<String, Object>> comparisons = buildSideBySideComparisons(target);

        // Build Required Fields Checklist
        List<Map<String, Object>> checklist = buildRequiredFieldChecklist(target);

        // Check if there is batch info for this record
        String bMonth = target.get("billingMonth") != null ? strVal(target.get("billingMonth")) : (billingPeriod != null ? billingPeriod : "");
        String paymentStatus = elig.getPaymentStatus();
        Map<String, Object> batchInfo = null;

        if (paymentBatchItemRepository != null && !bMonth.isEmpty()) {
            List<PaymentBatchItem> bItems = paymentBatchItemRepository.findByAccountNo(accountNo.trim());
            for (PaymentBatchItem it : bItems) {
                if (it.getBatch() != null && bMonth.equalsIgnoreCase(it.getBatch().getBillingPeriod())) {
                    batchInfo = new LinkedHashMap<>();
                    batchInfo.put("batchId", it.getBatch().getId());
                    batchInfo.put("batchNumber", it.getBatch().getBatchNumber());
                    batchInfo.put("batchStatus", it.getBatch().getStatus());
                    batchInfo.put("itemStatus", it.getPaymentStatus());

                    String biStatus = strVal(it.getPaymentStatus());
                    String bStatus = strVal(it.getBatch().getStatus());
                    if ("PAID".equalsIgnoreCase(biStatus) || "PAID".equalsIgnoreCase(bStatus)) {
                        paymentStatus = "PAID";
                    } else if ("PAYMENT_PROCESSED".equalsIgnoreCase(bStatus)) {
                        paymentStatus = "PROCESSING";
                    } else if ("APPROVED".equalsIgnoreCase(bStatus)) {
                        paymentStatus = "APPROVED";
                    } else if ("REJECTED".equalsIgnoreCase(bStatus)) {
                        paymentStatus = "REJECTED";
                    } else if ("SUBMITTED".equalsIgnoreCase(bStatus) || "UNDER_REVIEW".equalsIgnoreCase(bStatus)) {
                        paymentStatus = "REVIEW";
                    }
                    break;
                }
            }
        }

        // Customer Info
        Map<String, Object> customerInfo = new LinkedHashMap<>();
        customerInfo.put("accountNumber", accountNo.trim());
        String cName = strVal(target.get("customerName"));
        if (cName.isEmpty()) cName = strVal(target.get("masterName"));
        if (cName.isEmpty()) cName = strVal(target.get("npayName"));
        customerInfo.put("customerName", cName.isEmpty() ? "—" : cName);
        String sType = strVal(target.get("solarType"));
        if (sType.isEmpty()) sType = strVal(target.get("masterNetType"));
        customerInfo.put("netType", sType.isEmpty() ? "—" : sType);
        customerInfo.put("customerAddress", strVal(target.get("customerAddress")).isEmpty() ? strVal(target.get("masterAddress")) : strVal(target.get("customerAddress")));
        customerInfo.put("mobileNo", strVal(target.get("mobileNo")).isEmpty() ? strVal(target.get("masterMobile")) : strVal(target.get("mobileNo")));
        customerInfo.put("bankCode", strVal(target.get("bankCode")).isEmpty() ? strVal(target.get("masterBankCode")) : strVal(target.get("bankCode")));
        customerInfo.put("branchCode", strVal(target.get("branchCode")).isEmpty() ? strVal(target.get("masterBranchCode")) : strVal(target.get("branchCode")));
        customerInfo.put("bankAccountNo", strVal(target.get("bankAccountNo")).isEmpty() ? strVal(target.get("masterBankAccountNo")) : strVal(target.get("bankAccountNo")));

        // Billing Info
        Map<String, Object> billingInfo = new LinkedHashMap<>();
        billingInfo.put("billingMonth", bMonth.isEmpty() ? "Current Billing Period" : bMonth);
        billingInfo.put("fromDate", target.get("fromDate") != null ? target.get("fromDate") : (target.get("billingFrom") != null ? target.get("billingFrom") : target.get("periodFrom")));
        billingInfo.put("toDate", target.get("toDate") != null ? target.get("toDate") : (target.get("billingTo") != null ? target.get("billingTo") : target.get("periodTo")));
        billingInfo.put("importUnits", target.get("importUnits") != null ? target.get("importUnits") : (target.get("kwhImport") != null ? target.get("kwhImport") : target.get("kwhPurchased")));
        billingInfo.put("exportUnits", target.get("exportUnits") != null ? target.get("exportUnits") : (target.get("kwhExport") != null ? target.get("kwhExport") : target.get("kwhSales")));
        billingInfo.put("unitRate", target.get("unitRate") != null ? target.get("unitRate") : target.get("masterUnitRate"));
        billingInfo.put("currentPayment", elig.getFinancials().get("currentPayment"));

        // Payment Info
        Map<String, Object> paymentInfo = new LinkedHashMap<>();
        paymentInfo.put("outstandingBalance", elig.getFinancials().get("outstandingBalance"));
        paymentInfo.put("totalPayable", elig.getFinancials().get("totalPayable"));
        paymentInfo.put("currentPayment", elig.getFinancials().get("currentPayment"));
        paymentInfo.put("billSetOff", elig.getFinancials().get("billSetOff"));
        paymentInfo.put("retentionMoney", elig.getFinancials().get("retentionMoney"));
        paymentInfo.put("paymentStatus", paymentStatus);
        paymentInfo.put("paymentEligibility", elig.isEligible() ? "READY" : ("REVIEW".equals(paymentStatus) ? "REVIEW" : "ON HOLD"));
        paymentInfo.put("isEligible", elig.isEligible());

        // Validation Info
        Map<String, Object> validationInfo = new LinkedHashMap<>();
        validationInfo.put("validationStatus", strVal(target.get("validationStatus")).isEmpty() ? "VALID" : strVal(target.get("validationStatus")));
        validationInfo.put("mismatches", comparisons.stream().filter(c -> Boolean.TRUE.equals(c.get("isMismatch"))).toList());
        validationInfo.put("missingDetails", extractMissingFields(target));
        validationInfo.put("validationErrors", target.get("validationErrors") != null ? target.get("validationErrors") : Collections.emptyList());
        validationInfo.put("holdReasons", elig.getHoldReasons());
        validationInfo.put("blockingIssues", elig.getBlockingIssues());
        validationInfo.put("categorizedIssues", categorizeIssues(target, elig));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("record", target);
        details.put("recordKey", target.get("recordKey"));
        details.put("paymentRecordId", target.get("paymentRecordId"));
        details.put("snapshotId", target.get("snapshotId"));
        details.put("snapshotIndex", target.get("snapshotIndex"));
        details.put("hasMultiplePayments", allCustomerPayments.size() > 1);
        details.put("totalPaymentsForCustomer", allCustomerPayments.size());
        details.put("allCustomerPayments", allCustomerPayments);
        details.put("eligibility", elig);
        details.put("customerInfo", customerInfo);
        details.put("billingInfo", billingInfo);
        details.put("paymentInfo", paymentInfo);
        details.put("validationInfo", validationInfo);
        details.put("comparisons", comparisons);
        details.put("requiredFieldChecklist", checklist);
        details.put("missingFields", extractMissingFields(target));
        details.put("categorizedIssues", categorizeIssues(target, elig));
        details.put("financials", elig.getFinancials());
        details.put("holdReasons", elig.getHoldReasons());
        details.put("blockingIssues", elig.getBlockingIssues());
        if (batchInfo != null) details.put("batchInfo", batchInfo);

        return details;
    }

    private Map<String, Object> createComparison(String field, Object masterVal, Object sourceVal, boolean isMismatch) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("field", field);
        c.put("masterValue", masterVal != null && !masterVal.toString().trim().isEmpty() ? masterVal : "—");
        c.put("sourceValue", sourceVal != null && !sourceVal.toString().trim().isEmpty() ? sourceVal : "—");
        c.put("isMismatch", isMismatch);
        c.put("result", isMismatch ? "MISMATCH" : "MATCHED");
        return c;
    }

    private List<Map<String, Object>> buildRequiredFieldChecklist(Map<String, Object> r) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (r == null) return list;

        addFieldCheck(list, "Account Number", strVal(r.get("accountNo")), !strVal(r.get("accountNo")).isEmpty());
        String name = strVal(r.get("customerName")).isEmpty() ? strVal(r.get("masterName")) : strVal(r.get("customerName"));
        addFieldCheck(list, "Customer Name", name, !name.isEmpty());
        String bAcc = strVal(r.get("bankAccountNo")).isEmpty() ? strVal(r.get("masterBankAccountNo")) : strVal(r.get("bankAccountNo"));
        addFieldCheck(list, "Bank Account Number", bAcc, !bAcc.isEmpty());
        String bCode = strVal(r.get("bankCode")).isEmpty() ? strVal(r.get("masterBankCode")) : strVal(r.get("bankCode"));
        addFieldCheck(list, "Bank Code", bCode, !bCode.isEmpty());
        String brCode = strVal(r.get("branchCode")).isEmpty() ? strVal(r.get("masterBranchCode")) : strVal(r.get("branchCode"));
        addFieldCheck(list, "Branch Code", brCode, !brCode.isEmpty());
        String solar = strVal(r.get("solarType")).isEmpty() ? strVal(r.get("masterNetType")) : strVal(r.get("solarType"));
        addFieldCheck(list, "Solar / Net Type", solar, !solar.isEmpty());
        Double urate = parseDouble(r.get("unitRate"));
        if (urate == null) urate = parseDouble(r.get("masterUnitRate"));
        addFieldCheck(list, "Unit Rate (LKR)", urate != null ? String.valueOf(urate) : "", urate != null && urate > 0);
        String addr = strVal(r.get("customerAddress")).isEmpty() ? strVal(r.get("masterAddress")) : strVal(r.get("customerAddress"));
        addFieldCheck(list, "Customer Address", addr, !addr.isEmpty());
        String mob = strVal(r.get("mobileNo")).isEmpty() ? strVal(r.get("masterMobile")) : strVal(r.get("mobileNo"));
        addFieldCheck(list, "Mobile Number", mob, !mob.isEmpty());
        Double cap = parseDouble(r.get("panelCapacity"));
        if (cap == null) cap = parseDouble(r.get("masterPanelCapacity"));
        addFieldCheck(list, "Panel Capacity (kW)", cap != null ? String.valueOf(cap) : "", cap != null && cap > 0);

        return list;
    }

    private void addFieldCheck(List<Map<String, Object>> list, String fieldName, String value, boolean isPresent) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("fieldName", fieldName);
        item.put("value", isPresent ? value : "—");
        item.put("isPresent", isPresent);
        item.put("status", isPresent ? "PRESENT" : "MISSING");
        list.add(item);
    }

    /**
     * Customer 360: Month-Wise Payment Dossier.
     * Evaluates payment status, diagnostics, and side-by-side comparisons strictly per billing month snapshot.
     * Guarantees 100% data isolation between months and supports multiple payments per customer.
     */
    public Map<String, Object> getCustomerMonthWisePaymentDossier(String accountNo) {
        if (accountNo == null || accountNo.trim().isEmpty()) {
            throw new IllegalArgumentException("Account number is required.");
        }
        String cleanAcc = accountNo.trim();

        // 1. Fetch batch items for payment settlement states (PAID, PROCESSED, APPROVED, etc.)
        List<PaymentBatchItem> batchItems = Collections.emptyList();
        if (paymentBatchItemRepository != null) {
            try {
                batchItems = paymentBatchItemRepository.findByAccountNo(cleanAcc);
            } catch (Exception ignored) {}
        }
        Map<String, PaymentBatchItem> batchMap = new HashMap<>();
        for (PaymentBatchItem it : batchItems) {
            if (it.getBatch() != null && it.getBatch().getBillingPeriod() != null) {
                batchMap.put(it.getBatch().getBillingPeriod().trim().toLowerCase(), it);
            }
        }

        // 2. Fetch all monthly directory snapshots (newest first)
        List<MonthlyDirectorySnapshot> snapshots = Collections.emptyList();
        if (monthlyDirectorySnapshotRepository != null) {
            try {
                snapshots = monthlyDirectorySnapshotRepository.findAllByOrderByCreatedDateDesc();
            } catch (Exception ignored) {}
        }

        List<Map<String, Object>> monthDossiers = new ArrayList<>();
        Map<String, Object> latestRecord = null;
        PaymentEligibilityResult latestElig = null;
        String latestMonth = null;
        String latestDivision = null;

        for (MonthlyDirectorySnapshot snap : snapshots) {
            String json = snap.getFinalDataJson();
            if (json == null || json.trim().isEmpty() || !json.contains(cleanAcc)) {
                continue;
            }

            try {
                List<Map<String, Object>> list = objectMapper.readValue(json, LIST_MAP_TYPE);
                List<Map<String, Object>> matchingRecords = new ArrayList<>();
                for (int i = 0; i < list.size(); i++) {
                    Map<String, Object> rec = list.get(i);
                    if (cleanAcc.equalsIgnoreCase(strVal(rec.get("accountNo")))) {
                        rec.put("snapshotId", snap.getId());
                        rec.put("snapshotIndex", i);
                        rec.put("recordKey", "snap_" + snap.getId() + "_" + i + "_" + cleanAcc.replaceAll("[^a-zA-Z0-9_-]", ""));
                        matchingRecords.add(rec);
                    }
                }

                for (int mIdx = 0; mIdx < matchingRecords.size(); mIdx++) {
                    Map<String, Object> match = matchingRecords.get(mIdx);
                    String bMonth = snap.getBillingMonth() != null ? snap.getBillingMonth() : strVal(match.get("billingMonth"));
                    String div = snap.getDivision() != null ? snap.getDivision() : strVal(match.get("division"));
                    if (!match.containsKey("billingMonth")) match.put("billingMonth", bMonth);
                    if (!match.containsKey("division")) match.put("division", div);

                    // Evaluate payment eligibility strictly for this month's record
                    PaymentEligibilityResult elig = canPay(match);

                    // Check batch settlement state
                    PaymentBatchItem bItem = bMonth != null ? batchMap.get(bMonth.trim().toLowerCase()) : null;
                    String finalStatus = elig.getPaymentStatus();
                    Map<String, Object> batchInfo = null;

                    if (bItem != null && bItem.getBatch() != null) {
                        PaymentBatch b = bItem.getBatch();
                        batchInfo = new LinkedHashMap<>();
                        batchInfo.put("batchId", b.getId());
                        batchInfo.put("batchNumber", b.getBatchNumber());
                        batchInfo.put("batchStatus", b.getStatus());
                        batchInfo.put("itemStatus", bItem.getPaymentStatus());
                        batchInfo.put("totalPayable", bItem.getTotalPayable());
                        batchInfo.put("createdDate", b.getCreatedDate());
                        batchInfo.put("processedAt", b.getProcessedAt());

                        String itemStatus = strVal(bItem.getPaymentStatus());
                        String bStatus = strVal(b.getStatus());

                        if ("PAID".equalsIgnoreCase(itemStatus) || "PAID".equalsIgnoreCase(bStatus)) {
                            finalStatus = "PAID";
                        } else if ("PROCESSED".equalsIgnoreCase(itemStatus) || "PAYMENT_PROCESSED".equalsIgnoreCase(bStatus)) {
                            finalStatus = "PROCESSING";
                        } else if ("APPROVED".equalsIgnoreCase(bStatus)) {
                            finalStatus = "APPROVED";
                        } else if ("SUBMITTED".equalsIgnoreCase(bStatus) || "UNDER_REVIEW".equalsIgnoreCase(bStatus)) {
                            finalStatus = "REVIEW";
                        } else if ("REJECTED".equalsIgnoreCase(bStatus)) {
                            finalStatus = "REJECTED";
                        }
                    }

                    // Categorize issues
                    Map<String, List<String>> categorized = categorizeIssues(match, elig);

                    // Side-by-side mismatch comparisons
                    List<Map<String, Object>> comparisons = buildSideBySideComparisons(match);

                    // Missing fields list
                    List<String> missingFields = extractMissingFields(match);

                    Map<String, Object> dossier = new LinkedHashMap<>();
                    dossier.put("snapshotId", snap.getId());
                    dossier.put("snapshotIndex", match.get("snapshotIndex"));
                    dossier.put("recordKey", match.get("recordKey"));
                    dossier.put("datasetName", snap.getDatasetName());
                    dossier.put("billingMonth", bMonth);
                    dossier.put("paymentNumber", mIdx + 1);
                    dossier.put("totalPaymentsInMonth", matchingRecords.size());
                    dossier.put("paymentLabel", matchingRecords.size() > 1 ? "Payment " + (mIdx + 1) + " of " + matchingRecords.size() : bMonth);
                    dossier.put("division", div);
                    dossier.put("approvalDate", snap.getApprovalDate());
                    dossier.put("paymentStatus", finalStatus);
                    dossier.put("isEligible", elig.isEligible());
                    dossier.put("financials", elig.getFinancials());
                    dossier.put("holdReasons", elig.getHoldReasons());
                    dossier.put("blockingIssues", elig.getBlockingIssues());
                    dossier.put("categorizedIssues", categorized);
                    dossier.put("comparisons", comparisons);
                    dossier.put("missingFields", missingFields);
                    dossier.put("record", match);
                    dossier.put("batchInfo", batchInfo);

                    monthDossiers.add(dossier);

                    if (latestRecord == null) {
                        latestRecord = match;
                        latestElig = elig;
                        latestMonth = bMonth;
                        latestDivision = div;
                    }
                }
            } catch (Exception e) {
                log.warning("Failed parsing snapshot " + snap.getId() + " for account " + cleanAcc + ": " + e.getMessage());
            }
        }

        // Summary Header construction
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accountNo", cleanAcc);
        result.put("totalPayments", monthDossiers.size());
        result.put("hasMultiplePayments", monthDossiers.size() > 1);

        if (latestRecord != null) {
            String cName = strVal(latestRecord.get("customerName"));
            if (cName.isEmpty()) cName = strVal(latestRecord.get("masterName"));
            if (cName.isEmpty()) cName = strVal(latestRecord.get("npayName"));
            if (cName.isEmpty()) cName = strVal(latestRecord.get("ngenName"));

            result.put("customerName", cName);
            result.put("solarType", strVal(latestRecord.get("solarType")));
            result.put("tariffType", strVal(latestRecord.get("tariffType")));
            result.put("division", latestDivision);
            result.put("latestBillingMonth", latestMonth);
            result.put("latestPaymentStatus", monthDossiers.isEmpty() ? "ON_HOLD" : monthDossiers.get(0).get("paymentStatus"));
            result.put("isPaymentEligible", latestElig != null && latestElig.isEligible());
            if (latestElig != null && latestElig.getFinancials() != null) {
                result.put("currentPayment", latestElig.getFinancials().get("currentPayment"));
                result.put("totalPayable", latestElig.getFinancials().get("totalPayable"));
                result.put("outstandingBalance", latestElig.getFinancials().get("outstandingBalance"));
                result.put("billSetOff", latestElig.getFinancials().get("billSetOff"));
                result.put("retentionMoney", latestElig.getFinancials().get("retentionMoney"));
            }
        } else {
            // Customer fallback from master customer repository if no snapshots contain billing data yet
            String fallbackName = cleanAcc;
            String fallbackSolar = "—";
            String fallbackDiv = "—";
            if (customerRepository != null) {
                try {
                    Optional<Customer> optCust = customerRepository.findById(cleanAcc);
                    if (optCust.isPresent()) {
                        var c = optCust.get();
                        if (c.getCustomerName() != null && !c.getCustomerName().trim().isEmpty()) fallbackName = c.getCustomerName();
                        if (c.getSolarType() != null && !c.getSolarType().trim().isEmpty()) fallbackSolar = c.getSolarType();
                        if (c.getBranchCode() != null && !c.getBranchCode().trim().isEmpty()) fallbackDiv = c.getBranchCode();
                    }
                } catch (Exception ignored) {}
            }
            result.put("customerName", fallbackName);
            result.put("solarType", fallbackSolar);
            result.put("tariffType", "—");
            result.put("division", fallbackDiv);
            result.put("latestBillingMonth", "No Active Billing Month");
            result.put("latestPaymentStatus", "ON_HOLD");
            result.put("isPaymentEligible", false);
            result.put("currentPayment", 0.0);
            result.put("totalPayable", 0.0);
            result.put("outstandingBalance", 0.0);
            result.put("billSetOff", 0.0);
            result.put("retentionMoney", 0.0);
        }

        result.put("months", monthDossiers);

        // Historical batch items list
        List<Map<String, Object>> batchHistory = new ArrayList<>();
        for (PaymentBatchItem it : batchItems) {
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("itemId", it.getId());
            h.put("batchId", it.getBatch() != null ? it.getBatch().getId() : null);
            h.put("batchNumber", it.getBatch() != null ? it.getBatch().getBatchNumber() : "—");
            h.put("billingPeriod", it.getBatch() != null ? it.getBatch().getBillingPeriod() : "—");
            h.put("paymentStatus", it.getPaymentStatus());
            h.put("totalPayable", it.getTotalPayable());
            h.put("createdAt", it.getCreatedAt());
            batchHistory.add(h);
        }
        result.put("batchHistory", batchHistory);

        return result;
    }

    private Map<String, List<String>> categorizeIssues(Map<String, Object> record, PaymentEligibilityResult elig) {
        Map<String, List<String>> categorized = new LinkedHashMap<>();
        categorized.put("mismatches", new ArrayList<>());
        categorized.put("missingDetails", new ArrayList<>());
        categorized.put("validationErrors", new ArrayList<>());
        categorized.put("holds", new ArrayList<>());
        categorized.put("outstanding", new ArrayList<>());

        if (elig == null) return categorized;

        for (String issue : elig.getBlockingIssues()) {
            String lower = issue.toLowerCase();
            if (lower.contains("mismatch") || lower.contains("identity") || lower.contains("master data")) {
                categorized.get("mismatches").add(issue);
            } else if (lower.contains("missing") || lower.contains("incomplete") || lower.contains("required")) {
                categorized.get("missingDetails").add(issue);
            } else if (lower.contains("upload") || lower.contains("net plus") || lower.contains("staging") || lower.contains("validation error")) {
                categorized.get("validationErrors").add(issue);
            } else if (lower.contains("hold")) {
                categorized.get("holds").add(issue);
            } else if (lower.contains("negative") || lower.contains("zero") || lower.contains("dispute") || lower.contains("outstanding")) {
                categorized.get("outstanding").add(issue);
            } else {
                categorized.get("validationErrors").add(issue);
            }
        }

        if (elig.getBlockingIssues().isEmpty()) {
            for (String reason : elig.getHoldReasons()) {
                String lower = reason.toLowerCase();
                if (lower.contains("mismatch")) {
                    categorized.get("mismatches").add(reason);
                } else if (lower.contains("missing")) {
                    categorized.get("missingDetails").add(reason);
                } else if (lower.contains("hold")) {
                    categorized.get("holds").add(reason);
                } else {
                    categorized.get("validationErrors").add(reason);
                }
            }
        }

        return categorized;
    }

    private List<Map<String, Object>> buildSideBySideComparisons(Map<String, Object> target) {
        List<Map<String, Object>> comparisons = new ArrayList<>();
        if (target == null) return comparisons;

        // 1. Customer Name
        comparisons.add(createComparison("Customer Name",
                target.get("masterName"),
                target.get("npayName") != null ? target.get("npayName") : target.get("ngenName"),
                "MISMATCH".equalsIgnoreCase(strVal(target.get("nameMatch")))));

        // 2. Net Type
        comparisons.add(createComparison("Net Type",
                target.get("masterNetType"),
                target.get("mainNetType") != null ? target.get("mainNetType") : target.get("ngenNetType"),
                "MISMATCH".equalsIgnoreCase(strVal(target.get("netTypeMatch")))));

        // 3. Unit Rate
        comparisons.add(createComparison("Unit Rate (LKR)",
                target.get("masterUnitRate"),
                target.get("mainUnitRate") != null ? target.get("mainUnitRate") : target.get("ngenUnitRate"),
                "MISMATCH".equalsIgnoreCase(strVal(target.get("unitRateMatch")))));

        // 4. Payment Amount
        Object pMap = target.get("mergedPayment");
        Double ngenPay = pMap instanceof Map ? parseDouble(((Map<?, ?>) pMap).get("ngen")) : parseDouble(target.get("paymentSettled"));
        Double npayPay = pMap instanceof Map ? parseDouble(((Map<?, ?>) pMap).get("npay")) : parseDouble(target.get("npayPayment"));
        boolean pMismatch = pMap instanceof Map && Boolean.TRUE.equals(((Map<?, ?>) pMap).get("mismatch"));
        comparisons.add(createComparison("Payment Amount (LKR)", ngenPay, npayPay, pMismatch));

        // 5. Bank Account No
        String masterBAcc = strVal(target.get("masterBankAccountNo"));
        String bAcc = strVal(target.get("bankAccountNo"));
        boolean bAccMismatch = !masterBAcc.isEmpty() && !bAcc.isEmpty() && !masterBAcc.equalsIgnoreCase(bAcc);
        comparisons.add(createComparison("Bank Account No", masterBAcc, bAcc, bAccMismatch));

        return comparisons;
    }

    private List<String> extractMissingFields(Map<String, Object> r) {
        List<String> missing = new ArrayList<>();
        if (r == null) return missing;

        String name = strVal(r.get("customerName"));
        if (name.isEmpty()) name = strVal(r.get("masterName"));
        if (name.isEmpty()) missing.add("Customer Name");

        String addr = strVal(r.get("customerAddress"));
        if (addr.isEmpty()) addr = strVal(r.get("masterAddress"));
        if (addr.isEmpty()) missing.add("Customer Address");

        String mob = strVal(r.get("mobileNo"));
        if (mob.isEmpty()) mob = strVal(r.get("masterMobile"));
        if (mob.isEmpty()) missing.add("Mobile No");

        String agr = strVal(r.get("agreementDate"));
        if (agr.isEmpty()) agr = strVal(r.get("masterAgreementDate"));
        if (agr.isEmpty()) missing.add("Agreement Date");

        Double cap = parseDouble(r.get("panelCapacity"));
        if (cap == null) cap = parseDouble(r.get("masterPanelCapacity"));
        if (cap == null || cap <= 0) missing.add("Panel Capacity");

        String bcode = strVal(r.get("bankCode"));
        if (bcode.isEmpty()) bcode = strVal(r.get("masterBankCode"));
        if (bcode.isEmpty()) missing.add("Bank Code");

        String bbranch = strVal(r.get("branchCode"));
        if (bbranch.isEmpty()) bbranch = strVal(r.get("masterBranchCode"));
        if (bbranch.isEmpty()) missing.add("Branch Code");

        String bacc = strVal(r.get("bankAccountNo"));
        if (bacc.isEmpty()) bacc = strVal(r.get("masterBankAccountNo"));
        if (bacc.isEmpty()) missing.add("Bank Account No");

        String solar = strVal(r.get("solarType"));
        if (solar.isEmpty()) solar = strVal(r.get("masterNetType"));
        if (solar.isEmpty()) missing.add("Solar System Type");

        Double urate = parseDouble(r.get("unitRate"));
        if (urate == null) urate = parseDouble(r.get("masterUnitRate"));
        if (urate == null) missing.add("Unit Rate");

        return missing;
    }

    /**
     * Staging Correction:
     * Saves correction, re-validates via multiFileImportService, recalculates payment eligibility,
     * and automatically moves customer from ON_HOLD to READY if all issues are resolved.
     */
    @Transactional
    public Map<String, Object> correctCustomerAndRevalidate(String accountNo, String billingPeriod,
                                                           Map<String, Object> corrections, String username) throws Exception {
        if (accountNo == null || corrections == null) {
            throw new IllegalArgumentException("Account number and corrections are required.");
        }

        Long snapshotId = null;
        if (corrections.containsKey("snapshotId")) {
            Object sId = corrections.get("snapshotId");
            if (sId != null && !sId.toString().trim().isEmpty()) {
                try {
                    snapshotId = Long.parseLong(sId.toString().trim());
                } catch (Exception ignored) {}
            }
        }

        Integer snapshotIndex = null;
        if (corrections.containsKey("snapshotIndex")) {
            Object sIdx = corrections.get("snapshotIndex");
            if (sIdx != null && !sIdx.toString().trim().isEmpty()) {
                try {
                    snapshotIndex = Integer.parseInt(sIdx.toString().trim());
                } catch (Exception ignored) {}
            }
        }

        String recordKey = strVal(corrections.get("recordKey"));

        MonthlyDirectorySnapshot targetSnapshot = null;
        List<Map<String, Object>> snapshotData = null;
        int targetIndex = -1;

        if (snapshotId != null && monthlyDirectorySnapshotRepository != null) {
            Optional<MonthlyDirectorySnapshot> optSnap = monthlyDirectorySnapshotRepository.findById(snapshotId);
            if (optSnap.isPresent() && optSnap.get().getFinalDataJson() != null) {
                targetSnapshot = optSnap.get();
                List<Map<String, Object>> list = objectMapper.readValue(targetSnapshot.getFinalDataJson(), LIST_MAP_TYPE);
                if (snapshotIndex != null && snapshotIndex >= 0 && snapshotIndex < list.size()) {
                    if (accountNo.trim().equalsIgnoreCase(strVal(list.get(snapshotIndex).get("accountNo")))) {
                        snapshotData = list;
                        targetIndex = snapshotIndex;
                    }
                }
                if (targetIndex == -1 && !recordKey.isEmpty()) {
                    for (int i = 0; i < list.size(); i++) {
                        String rKey = "snap_" + targetSnapshot.getId() + "_" + i + "_" + accountNo.trim().replaceAll("[^a-zA-Z0-9_-]", "");
                        if (recordKey.equalsIgnoreCase(rKey) || recordKey.equalsIgnoreCase(strVal(list.get(i).get("recordKey")))) {
                            snapshotData = list;
                            targetIndex = i;
                            break;
                        }
                    }
                }
                if (targetIndex == -1) {
                    for (int i = 0; i < list.size(); i++) {
                        if (accountNo.trim().equalsIgnoreCase(strVal(list.get(i).get("accountNo")))) {
                            snapshotData = list;
                            targetIndex = i;
                            break;
                        }
                    }
                }
            }
        }

        if (targetSnapshot == null || targetIndex == -1 || snapshotData == null) {
            // Find the snapshot containing this customer
            List<MonthlyDirectorySnapshot> snapshots = getSnapshots(billingPeriod, null);
            for (MonthlyDirectorySnapshot snap : snapshots) {
                if (snap.getFinalDataJson() != null && !snap.getFinalDataJson().trim().isEmpty()) {
                    List<Map<String, Object>> list = objectMapper.readValue(snap.getFinalDataJson(), LIST_MAP_TYPE);
                    for (int i = 0; i < list.size(); i++) {
                        String rKey = "snap_" + snap.getId() + "_" + i + "_" + accountNo.trim().replaceAll("[^a-zA-Z0-9_-]", "");
                        boolean matchesKey = !recordKey.isEmpty() && (recordKey.equalsIgnoreCase(rKey) || recordKey.equalsIgnoreCase(strVal(list.get(i).get("recordKey"))));
                        boolean matchesAcc = recordKey.isEmpty() && accountNo.trim().equalsIgnoreCase(strVal(list.get(i).get("accountNo")));
                        if (matchesKey || matchesAcc) {
                            targetSnapshot = snap;
                            snapshotData = list;
                            targetIndex = i;
                            break;
                        }
                    }
                }
                if (targetSnapshot != null) break;
            }
        }

        if (targetSnapshot == null || targetIndex == -1 || snapshotData == null) {
            throw new IllegalArgumentException("Customer record not found in active snapshots for account: " + accountNo);
        }

        Map<String, Object> record = snapshotData.get(targetIndex);

        // Apply edits to record
        corrections.forEach((k, v) -> {
            if ("snapshotId".equalsIgnoreCase(k) || "snapshotIndex".equalsIgnoreCase(k) || "recordKey".equalsIgnoreCase(k)) return;
            if (v != null && !v.toString().trim().isEmpty() && !"—".equals(v.toString().trim())) {
                record.put(k, v);
                if ("customerName".equalsIgnoreCase(k)) record.put("masterName", v);
                if ("solarType".equalsIgnoreCase(k) || "netType".equalsIgnoreCase(k)) record.put("masterNetType", v);
                if ("unitRate".equalsIgnoreCase(k)) record.put("masterUnitRate", v);
                if ("bankCode".equalsIgnoreCase(k)) record.put("masterBankCode", v);
                if ("branchCode".equalsIgnoreCase(k)) record.put("masterBranchCode", v);
                if ("bankAccountNo".equalsIgnoreCase(k)) record.put("masterBankAccountNo", v);
            }
        });

        // Revalidate record in-place reusing existing business/validation rules
        multiFileImportService.revalidateDirectoryRecord(record);

        // Re-evaluate payment eligibility
        PaymentEligibilityResult elig = canPay(record);
        record.put("paymentStatus", elig.getPaymentStatus());

        // Update snapshot JSON & save
        snapshotData.set(targetIndex, record);
        targetSnapshot.setFinalDataJson(objectMapper.writeValueAsString(snapshotData));
        monthlyDirectorySnapshotRepository.save(targetSnapshot);

        // Synchronize master customer record if present
        if (customerRepository != null) {
            try {
                customerRepository.findById(accountNo.trim()).ifPresent(cust -> {
                    if (corrections.containsKey("customerName")) cust.setCustomerName(strVal(corrections.get("customerName")));
                    if (corrections.containsKey("bankCode")) cust.setBankCode(strVal(corrections.get("bankCode")));
                    if (corrections.containsKey("branchCode")) cust.setBranchCode(strVal(corrections.get("branchCode")));
                    if (corrections.containsKey("bankAccountNo")) cust.setBankAccountNo(strVal(corrections.get("bankAccountNo")));
                    if (corrections.containsKey("unitRate")) {
                        Double ur = parseDouble(corrections.get("unitRate"));
                        if (ur != null) cust.setUnitRate(ur);
                    }
                    customerRepository.save(cust);
                });
            } catch (Exception ignored) {}
        }

        auditLogService.log("PAYMENT_RECORD_CORRECTION", "User " + username + " corrected record "
                + accountNo + ". New eligibility: " + elig.getPaymentStatus());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("accountNo", accountNo);
        response.put("eligibility", elig);
        response.put("newStatus", elig.getPaymentStatus());
        response.put("message", elig.isEligible()
                ? "Correction successful. All blocking issues resolved — Customer is now PAYMENT READY."
                : "Correction saved. Remaining issues: " + String.join(", ", elig.getHoldReasons()));
        return response;
    }

    /**
     * Explicit Payment Hold / Release Toggle.
     */
    @Transactional
    public Map<String, Object> togglePaymentHold(String accountNo, String billingPeriod, boolean hold,
                                                String reason, String username) throws Exception {
        if (accountNo == null || accountNo.trim().isEmpty()) {
            throw new IllegalArgumentException("Account number is required.");
        }
        String cleanAcc = accountNo.trim();
        List<MonthlyDirectorySnapshot> snapshots = getSnapshots(billingPeriod, null);
        if (snapshots.isEmpty() && billingPeriod != null && !"ALL".equalsIgnoreCase(billingPeriod)) {
            snapshots = getSnapshots(null, null);
        }

        for (MonthlyDirectorySnapshot snap : snapshots) {
            if (snap.getFinalDataJson() != null) {
                List<Map<String, Object>> list = objectMapper.readValue(snap.getFinalDataJson(), LIST_MAP_TYPE);
                for (int i = 0; i < list.size(); i++) {
                    Map<String, Object> rec = list.get(i);
                    if (cleanAcc.equalsIgnoreCase(strVal(rec.get("accountNo")))) {
                        rec.put("paymentHold", hold);
                        rec.put("manualHold", hold);
                        rec.put("isHold", hold);
                        rec.put("paymentHoldReason", hold ? (reason != null ? reason : "Manual Hold by " + username) : null);
                        if (!hold) {
                            rec.remove("paymentHoldReason");
                            rec.remove("holdReason");
                        }
                        PaymentEligibilityResult elig = canPay(rec);
                        rec.put("paymentStatus", elig.getPaymentStatus());
                        rec.put("isEligible", elig.isEligible());
                        list.set(i, rec);

                        snap.setFinalDataJson(objectMapper.writeValueAsString(list));
                        monthlyDirectorySnapshotRepository.save(snap);

                        if (auditLogService != null) {
                            try {
                                auditLogService.log(hold ? "PAYMENT_HOLD_APPLIED" : "PAYMENT_HOLD_RELEASED",
                                        "User " + username + (hold ? " placed hold on " : " released hold for ")
                                                + cleanAcc + ". Reason: " + reason);
                            } catch (Exception ex) {
                                log.warning("Failed to log audit action: " + ex.getMessage());
                            }
                        }

                        Map<String, Object> resp = new LinkedHashMap<>();
                        resp.put("success", true);
                        resp.put("accountNo", cleanAcc);
                        resp.put("paymentStatus", elig.getPaymentStatus());
                        resp.put("isEligible", elig.isEligible());
                        resp.put("holdReasons", elig.getHoldReasons() != null ? elig.getHoldReasons() : Collections.emptyList());
                        return resp;
                    }
                }
            }
        }
        throw new IllegalArgumentException("Customer record not found for account: " + cleanAcc);
    }

    /**
     * Customer-Level Payment Release:
     * When customer-level issues are resolved, releases holds and re-evaluates all accumulated unpaid payments,
     * transitioning eligible records to READY while preserving individual payment records, months, and history.
     */
    @Transactional
    public Map<String, Object> releaseCustomerPayments(String accountNo, String username) throws Exception {
        if (accountNo == null || accountNo.trim().isEmpty()) {
            throw new IllegalArgumentException("Account number is required.");
        }
        String cleanAcc = accountNo.trim();

        Customer cust = customerRepository != null ? customerRepository.findById(cleanAcc).orElse(null) : null;
        List<MonthlyDirectorySnapshot> snapshots = monthlyDirectorySnapshotRepository != null
                ? monthlyDirectorySnapshotRepository.findAll() : Collections.emptyList();

        int updatedRecordsCount = 0;
        int releasedToReadyCount = 0;
        double totalReleasedAmount = 0.0;
        List<String> releasedMonths = new ArrayList<>();

        for (MonthlyDirectorySnapshot snap : snapshots) {
            String json = snap.getFinalDataJson();
            if (json == null || json.trim().isEmpty() || !json.contains(cleanAcc)) {
                continue;
            }
            try {
                List<Map<String, Object>> list = objectMapper.readValue(json, LIST_MAP_TYPE);
                boolean snapModified = false;

                for (int i = 0; i < list.size(); i++) {
                    Map<String, Object> rec = list.get(i);
                    if (cleanAcc.equalsIgnoreCase(strVal(rec.get("accountNo")))) {
                        // Clear payment hold flags
                        rec.put("paymentHold", false);
                        rec.put("manualHold", false);
                        rec.put("isHold", false);
                        rec.remove("paymentHoldReason");
                        rec.remove("holdReason");

                        // Synchronize customer profile fields if customer entity exists
                        if (cust != null) {
                            if (cust.getCustomerName() != null && !cust.getCustomerName().trim().isEmpty()) {
                                rec.put("customerName", cust.getCustomerName());
                                rec.put("masterName", cust.getCustomerName());
                            }
                            if (cust.getCustomerAddress() != null && !cust.getCustomerAddress().trim().isEmpty()) {
                                rec.put("customerAddress", cust.getCustomerAddress());
                                rec.put("masterAddress", cust.getCustomerAddress());
                            }
                            if (cust.getMobileNo() != null && !cust.getMobileNo().trim().isEmpty()) {
                                rec.put("mobileNo", cust.getMobileNo());
                                rec.put("masterMobile", cust.getMobileNo());
                            }
                            if (cust.getBankCode() != null && !cust.getBankCode().trim().isEmpty()) {
                                rec.put("bankCode", cust.getBankCode());
                                rec.put("masterBankCode", cust.getBankCode());
                            }
                            if (cust.getBranchCode() != null && !cust.getBranchCode().trim().isEmpty()) {
                                rec.put("branchCode", cust.getBranchCode());
                                rec.put("masterBranchCode", cust.getBranchCode());
                            }
                            if (cust.getBankAccountNo() != null && !cust.getBankAccountNo().trim().isEmpty()) {
                                rec.put("bankAccountNo", cust.getBankAccountNo());
                                rec.put("masterBankAccountNo", cust.getBankAccountNo());
                            }
                            if (cust.getSolarType() != null && !cust.getSolarType().trim().isEmpty()) {
                                rec.put("solarType", cust.getSolarType());
                                rec.put("masterNetType", cust.getSolarType());
                            }
                            if (cust.getUnitRate() != null && cust.getUnitRate() > 0) {
                                rec.put("unitRate", cust.getUnitRate());
                                rec.put("masterUnitRate", cust.getUnitRate());
                            }
                            if (cust.getPanelCapacity() != null && cust.getPanelCapacity() > 0) {
                                rec.put("panelCapacity", cust.getPanelCapacity());
                                rec.put("masterPanelCapacity", cust.getPanelCapacity());
                            }
                        }

                        // Revalidate record in-place
                        if (multiFileImportService != null) {
                            try {
                                multiFileImportService.revalidateDirectoryRecord(rec);
                            } catch (Exception ex) {
                                log.warning("revalidateDirectoryRecord failed for " + cleanAcc + ": " + ex.getMessage());
                            }
                        }

                        // Re-evaluate payment eligibility
                        PaymentEligibilityResult elig = canPay(rec);
                        rec.put("paymentStatus", elig.getPaymentStatus());
                        rec.put("isEligible", elig.isEligible());

                        if (elig.isEligible()) {
                            releasedToReadyCount++;
                            double payable = (elig.getFinancials() != null)
                                    ? elig.getFinancials().getOrDefault("totalPayable", 0.0) : 0.0;
                            totalReleasedAmount += payable;
                            String bMonth = snap.getBillingMonth() != null ? snap.getBillingMonth() : strVal(rec.get("billingMonth"));
                            if (bMonth.isEmpty()) bMonth = "Record " + (i + 1);
                            releasedMonths.add(bMonth);
                        }

                        list.set(i, rec);
                        snapModified = true;
                        updatedRecordsCount++;
                    }
                }

                if (snapModified) {
                    snap.setFinalDataJson(objectMapper.writeValueAsString(list));
                    monthlyDirectorySnapshotRepository.save(snap);
                }
            } catch (Exception e) {
                log.warning("Failed releasing payments in snapshot " + snap.getId() + ": " + e.getMessage());
            }
        }

        if (auditLogService != null) {
            try {
                auditLogService.log("CUSTOMER_PAYMENT_RELEASE", "User " + username + " released accumulated payments for customer "
                        + cleanAcc + ". Released records: " + releasedToReadyCount + " of " + updatedRecordsCount + " (Total: LKR " + totalReleasedAmount + ")");
            } catch (Exception ex) {
                log.warning("Failed to log audit action: " + ex.getMessage());
            }
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("accountNo", cleanAcc);
        resp.put("updatedRecordsCount", updatedRecordsCount);
        resp.put("releasedToReadyCount", releasedToReadyCount);
        resp.put("totalReleasedAmount", Math.round(totalReleasedAmount * 100.0) / 100.0);
        resp.put("releasedMonths", releasedMonths);
        resp.put("message", "Customer payment release processed. " + releasedToReadyCount + " payment records are now READY FOR PAYMENT.");
        return resp;
    }

    /**
     * Seeds Test Case for Account 12345:
     * Payment 1: January 2026, LKR 10,000, ON HOLD (Missing Details)
     * Payment 2: February 2026, LKR 12,000, ON HOLD (Name Mismatch)
     * Payment 3: March 2026, LKR 15,000, READY
     * Total Pending = LKR 37,000 | On Hold = LKR 22,000 | Ready = LKR 15,000
     */
    @Transactional
    public Map<String, Object> seedTestCase12345() throws Exception {
        String testAcc = "12345";
        String div = "Batticaloa";

        // Seed customer in repository
        if (customerRepository != null) {
            Customer c = customerRepository.findById(testAcc).orElse(new Customer());
            c.setAccountNo(testAcc);
            c.setCustomerName("ABC Company");
            c.setCustomerAddress("123 Solar Street, Batticaloa");
            c.setMobileNo("0771234567");
            c.setBankCode("7010");
            c.setBranchCode("001");
            c.setBankAccountNo("1234567890");
            c.setSolarType("Net Plus");
            c.setUnitRate(34.50);
            c.setPanelCapacity(10.0);
            c.setDivision(div);
            c.setAgreementDate(java.time.LocalDate.of(2024, 1, 1));
            customerRepository.save(c);
        }

        // Payment 1: January 2026, LKR 10,000, ON HOLD (Reason: Missing Details)
        Map<String, Object> janRec = new LinkedHashMap<>();
        janRec.put("accountNo", testAcc);
        janRec.put("customerName", "ABC Company");
        janRec.put("customerAddress", ""); // Missing Address triggers Missing Details
        janRec.put("mobileNo", "0771234567");
        janRec.put("bankCode", "7010");
        janRec.put("branchCode", "001");
        janRec.put("bankAccountNo", "1234567890");
        janRec.put("solarType", "Net Plus");
        janRec.put("unitRate", 34.50);
        janRec.put("panelCapacity", 10.0);
        janRec.put("division", div);
        janRec.put("billingMonth", "January 2026");
        janRec.put("billingPeriod", "2026-01-01 to 2026-01-31");
        janRec.put("currentPayment", 10000.0);
        janRec.put("energyPurchase", 10000.0);
        janRec.put("salesAmount", 10000.0);
        janRec.put("payment", 10000.0);
        janRec.put("paymentSettled", 10000.0);
        janRec.put("totalPayable", 10000.0);
        janRec.put("billSetOff", 0.0);
        janRec.put("retentionMoney", 0.0);
        janRec.put("outstandingBalance", 0.0);
        janRec.put("status", "WARNING");

        // Payment 2: February 2026, LKR 12,000, ON HOLD (Reason: Name Mismatch)
        Map<String, Object> febRec = new LinkedHashMap<>();
        febRec.put("accountNo", testAcc);
        febRec.put("customerName", "ABC Company");
        febRec.put("masterName", "ABC Company Ltd");
        febRec.put("npayName", "ABC Enterprises");
        febRec.put("nameMatch", "MISMATCH");
        febRec.put("nameApproved", false);
        febRec.put("customerAddress", "123 Solar Street, Batticaloa");
        febRec.put("mobileNo", "0771234567");
        febRec.put("bankCode", "7010");
        febRec.put("branchCode", "001");
        febRec.put("bankAccountNo", "1234567890");
        febRec.put("solarType", "Net Plus");
        febRec.put("unitRate", 34.50);
        febRec.put("panelCapacity", 10.0);
        febRec.put("division", div);
        febRec.put("billingMonth", "February 2026");
        febRec.put("billingPeriod", "2026-02-01 to 2026-02-28");
        febRec.put("currentPayment", 12000.0);
        febRec.put("energyPurchase", 12000.0);
        febRec.put("salesAmount", 12000.0);
        febRec.put("payment", 12000.0);
        febRec.put("paymentSettled", 12000.0);
        febRec.put("totalPayable", 12000.0);
        febRec.put("billSetOff", 0.0);
        febRec.put("retentionMoney", 0.0);
        febRec.put("outstandingBalance", 0.0);
        febRec.put("status", "WARNING");

        // Payment 3: March 2026, LKR 15,000, READY
        Map<String, Object> marRec = new LinkedHashMap<>();
        marRec.put("accountNo", testAcc);
        marRec.put("customerName", "ABC Company");
        marRec.put("masterName", "ABC Company");
        marRec.put("npayName", "ABC Company");
        marRec.put("nameMatch", "MATCH");
        marRec.put("nameApproved", true);
        marRec.put("customerAddress", "123 Solar Street, Batticaloa");
        marRec.put("mobileNo", "0771234567");
        marRec.put("bankCode", "7010");
        marRec.put("branchCode", "001");
        marRec.put("bankAccountNo", "1234567890");
        marRec.put("solarType", "Net Plus");
        marRec.put("unitRate", 34.50);
        marRec.put("panelCapacity", 10.0);
        marRec.put("division", div);
        marRec.put("billingMonth", "March 2026");
        marRec.put("billingPeriod", "2026-03-01 to 2026-03-31");
        marRec.put("currentPayment", 15000.0);
        marRec.put("energyPurchase", 15000.0);
        marRec.put("salesAmount", 15000.0);
        marRec.put("payment", 15000.0);
        marRec.put("paymentSettled", 15000.0);
        marRec.put("totalPayable", 15000.0);
        marRec.put("billSetOff", 0.0);
        marRec.put("retentionMoney", 0.0);
        marRec.put("outstandingBalance", 0.0);
        marRec.put("status", "VALID");

        upsertSnapshotWithRecord("January 2026", div, janRec);
        upsertSnapshotWithRecord("February 2026", div, febRec);
        upsertSnapshotWithRecord("March 2026", div, marRec);

        return Map.of(
            "success", true,
            "accountNo", testAcc,
            "message", "Account 12345 seeded with 3 payments: Jan (LKR 10,000 ON HOLD), Feb (LKR 12,000 ON HOLD), Mar (LKR 15,000 READY)"
        );
    }

    private void upsertSnapshotWithRecord(String billingMonth, String division, Map<String, Object> rec) throws Exception {
        if (monthlyDirectorySnapshotRepository == null) return;
        List<MonthlyDirectorySnapshot> existing = monthlyDirectorySnapshotRepository
                .findByBillingMonthIgnoreCaseAndDivisionIgnoreCase(billingMonth, division);
        MonthlyDirectorySnapshot snap;
        List<Map<String, Object>> list = new ArrayList<>();
        if (!existing.isEmpty()) {
            snap = existing.get(0);
            if (snap.getFinalDataJson() != null && !snap.getFinalDataJson().trim().isEmpty()) {
                list = objectMapper.readValue(snap.getFinalDataJson(), LIST_MAP_TYPE);
            }
        } else {
            snap = new MonthlyDirectorySnapshot();
            snap.setBillingMonth(billingMonth);
            snap.setDivision(division);
            snap.setDatasetName(billingMonth + " Billing - " + division);
            snap.setApprovedBy("system");
            snap.setApprovalDate(LocalDateTime.now());
            snap.setStatus("APPROVED");
        }

        String acc = strVal(rec.get("accountNo"));
        list.removeIf(r -> acc.equalsIgnoreCase(strVal(r.get("accountNo"))));
        list.add(rec);

        snap.setFinalDataJson(objectMapper.writeValueAsString(list));
        snap.setTotalRecords(list.size());
        monthlyDirectorySnapshotRepository.save(snap);
    }

    /**
     * Create a Payment Batch.
     * STRICT BACKEND ENFORCEMENT: Only eligible READY customers can enter a payment batch!
     * Direct API calls attempting to batch ON_HOLD / ineligible customers are rejected.
     */
    @Transactional
    public PaymentBatch createPaymentBatch(String billingPeriod, String division,
                                          List<String> selectedAccountNos, String username) throws Exception {
        return createPaymentBatch(billingPeriod, division, selectedAccountNos, null, username);
    }

    @Transactional
    public PaymentBatch createPaymentBatch(String billingPeriod, String division,
                                          List<String> selectedAccountNos, List<String> selectedRecordKeys, String username) throws Exception {
        if (billingPeriod == null || billingPeriod.trim().isEmpty()) {
            throw new IllegalArgumentException("Billing period is required to create a payment batch.");
        }

        List<Map<String, Object>> allRecords = loadCanonicalRecords(billingPeriod, division);
        Map<String, Map<String, Object>> recordByKey = new HashMap<>();
        Map<String, List<Map<String, Object>>> recordsByAccount = new HashMap<>();
        for (Map<String, Object> r : allRecords) {
            String acc = strVal(r.get("accountNo"));
            String rKey = strVal(r.get("recordKey"));
            if (!rKey.isEmpty()) recordByKey.put(rKey, r);
            if (!acc.isEmpty()) {
                recordsByAccount.computeIfAbsent(acc.toLowerCase(), k -> new ArrayList<>()).add(r);
                recordByKey.put(acc, r);
            }
        }

        List<Map<String, Object>> candidateRecords = new ArrayList<>();
        if (selectedRecordKeys != null && !selectedRecordKeys.isEmpty()) {
            for (String key : selectedRecordKeys) {
                Map<String, Object> r = recordByKey.get(key);
                if (r != null && !candidateRecords.contains(r)) candidateRecords.add(r);
            }
        } else if (selectedAccountNos != null && !selectedAccountNos.isEmpty()) {
            for (String acc : selectedAccountNos) {
                Map<String, Object> byKey = recordByKey.get(acc);
                if (byKey != null && !candidateRecords.contains(byKey)) {
                    candidateRecords.add(byKey);
                } else {
                    List<Map<String, Object>> forAcc = recordsByAccount.get(acc.toLowerCase());
                    if (forAcc != null) {
                        for (Map<String, Object> r : forAcc) {
                            if (!candidateRecords.contains(r)) candidateRecords.add(r);
                        }
                    }
                }
            }
        } else {
            // Batch all ready customers
            candidateRecords.addAll(allRecords);
        }

        if (candidateRecords.isEmpty()) {
            throw new IllegalArgumentException("No eligible customers found to create payment batch.");
        }

        // BACKEND VERIFICATION: Enforce canPay for each customer
        List<Map<String, Object>> eligibleRecords = new ArrayList<>();
        List<String> rejectedIneligible = new ArrayList<>();
        int onHoldCount = 0;
        double onHoldAmount = 0.0;

        for (Map<String, Object> rec : candidateRecords) {
            PaymentEligibilityResult elig = canPay(rec);
            String acc = strVal(rec.get("accountNo"));
            if (elig.isEligible() && "READY".equalsIgnoreCase(elig.getPaymentStatus())) {
                eligibleRecords.add(rec);
            } else {
                rejectedIneligible.add(acc + " (" + String.join(", ", elig.getHoldReasons()) + ")");
                onHoldCount++;
                onHoldAmount += elig.getFinancials().getOrDefault("totalPayable", 0.0);
            }
        }

        // If specific customers were selected and any are ineligible, strictly REJECT the request!
        if ((selectedRecordKeys != null && !selectedRecordKeys.isEmpty() || selectedAccountNos != null && !selectedAccountNos.isEmpty())
                && !rejectedIneligible.isEmpty()) {
            throw new IllegalArgumentException("Server Security Violation: The following customers are NOT PAYMENT READY and cannot enter a payment batch: "
                    + String.join("; ", rejectedIneligible));
        }

        if (eligibleRecords.isEmpty()) {
            throw new IllegalArgumentException("Cannot create batch: Zero customers satisfied payment eligibility checks.");
        }

        // Build Batch
        String batchNum = "PAY-" + billingPeriod.replaceAll("[^a-zA-Z0-9]", "").toUpperCase()
                + "-" + System.currentTimeMillis() % 10000;

        PaymentBatch batch = new PaymentBatch();
        batch.setBatchNumber(batchNum);
        batch.setBillingPeriod(billingPeriod);
        batch.setDivision(division != null ? division : "ALL");
        batch.setCreatedBy(username);
        batch.setStatus("READY");
        batch.setCustomerCount(eligibleRecords.size());
        batch.setOnHoldCustomerCount(onHoldCount);
        batch.setOnHoldAmount(Math.round(onHoldAmount * 100.0) / 100.0);

        double totalPayable = 0.0;
        for (Map<String, Object> rec : eligibleRecords) {
            Map<String, Double> fin = extractFinancials(rec);
            double payable = fin.getOrDefault("totalPayable", 0.0);
            totalPayable += payable;

            PaymentBatchItem item = new PaymentBatchItem();
            item.setAccountNo(strVal(rec.get("accountNo")));
            item.setCustomerName(strVal(rec.get("customerName")));
            item.setSolarType(strVal(rec.get("solarType")));
            item.setCurrentPayment(fin.getOrDefault("currentPayment", 0.0));
            item.setBillSetOff(fin.getOrDefault("billSetOff", 0.0));
            item.setRetentionMoney(fin.getOrDefault("retentionMoney", 0.0));
            item.setOutstandingBalance(fin.getOrDefault("outstandingBalance", 0.0));
            item.setTotalPayable(payable);
            item.setBankCode(strVal(rec.get("bankCode")));
            item.setBranchCode(strVal(rec.get("branchCode")));
            item.setBankAccountNo(strVal(rec.get("bankAccountNo")));
            item.setPaymentStatus("READY");

            batch.addItem(item);
        }

        batch.setTotalPayableAmount(Math.round(totalPayable * 100.0) / 100.0);
        batch.setApprovedAmount(0.0);

        PaymentBatch saved = paymentBatchRepository.save(batch);
        auditLogService.log("PAYMENT_BATCH_CREATED", "Officer " + username + " created batch "
                + batchNum + " with " + eligibleRecords.size() + " customers. Total: LKR " + totalPayable);

        return saved;
    }

    /**
     * Batch Lifecycle Transition:
     * READY -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> PAYMENT_PROCESSED -> PAID
     * (or UNDER_REVIEW -> REJECTED -> CORRECTION -> RE_VALIDATE -> READY)
     */
    @Transactional
    public PaymentBatch transitionBatchStatus(Long batchId, String targetAction, String reason, String username) {
        if (batchId == null) {
            throw new IllegalArgumentException("batchId must not be null");
        }
        PaymentBatch batch = paymentBatchRepository.findById(Objects.requireNonNull(batchId))
                .orElseThrow(() -> new IllegalArgumentException("Payment batch not found: " + batchId));

        String currentStatus = batch.getStatus();

        switch (targetAction.toUpperCase()) {
            case "SUBMIT":
                if (!"READY".equals(currentStatus) && !"CORRECTION".equals(currentStatus)) {
                    throw new IllegalStateException("Only batches in READY or CORRECTION status can be submitted.");
                }
                batch.setStatus("SUBMITTED");
                break;

            case "REVIEW":
                if (!"SUBMITTED".equals(currentStatus)) {
                    throw new IllegalStateException("Only SUBMITTED batches can enter UNDER_REVIEW.");
                }
                batch.setStatus("UNDER_REVIEW");
                batch.setReviewedBy(username);
                batch.setReviewedAt(LocalDateTime.now());
                break;

            case "APPROVE":
                if (!"SUBMITTED".equals(currentStatus) && !"UNDER_REVIEW".equals(currentStatus)) {
                    throw new IllegalStateException("Batch must be SUBMITTED or UNDER_REVIEW for approval.");
                }
                batch.setStatus("APPROVED");
                batch.setApprovedBy(username);
                batch.setApprovedAt(LocalDateTime.now());
                batch.setApprovedAmount(batch.getTotalPayableAmount());
                for (PaymentBatchItem item : batch.getItems()) {
                    item.setPaymentStatus("APPROVED");
                }
                break;

            case "REJECT":
                if (!"SUBMITTED".equals(currentStatus) && !"UNDER_REVIEW".equals(currentStatus)) {
                    throw new IllegalStateException("Only batches under review can be rejected.");
                }
                batch.setStatus("REJECTED");
                batch.setRejectionReason(reason != null ? reason : "Rejected by supervisor " + username);
                for (PaymentBatchItem item : batch.getItems()) {
                    item.setPaymentStatus("REJECTED");
                }
                break;

            case "CORRECT":
                if (!"REJECTED".equals(currentStatus)) {
                    throw new IllegalStateException("Only REJECTED batches can move to CORRECTION.");
                }
                batch.setStatus("CORRECTION");
                break;

            case "PROCESS":
                if (!"APPROVED".equals(currentStatus)) {
                    throw new IllegalStateException("Only APPROVED batches can be processed for payment.");
                }
                batch.setStatus("PAYMENT_PROCESSED");
                batch.setProcessedBy(username);
                batch.setProcessedAt(LocalDateTime.now());
                for (PaymentBatchItem item : batch.getItems()) {
                    item.setPaymentStatus("PROCESSED");
                }
                break;

            case "COMPLETE":
            case "PAID":
                if (!"PAYMENT_PROCESSED".equals(currentStatus) && !"APPROVED".equals(currentStatus)) {
                    throw new IllegalStateException("Only processed batches can be marked as PAID.");
                }
                batch.setStatus("PAID");
                for (PaymentBatchItem item : batch.getItems()) {
                    item.setPaymentStatus("PAID");
                }
                break;

            default:
                throw new IllegalArgumentException("Unknown batch action: " + targetAction);
        }

        PaymentBatch saved = paymentBatchRepository.save(batch);
        auditLogService.log("PAYMENT_BATCH_STATUS", "User " + username + " transitioned batch "
                + batch.getBatchNumber() + " from " + currentStatus + " to " + batch.getStatus());
        return saved;
    }

    public List<PaymentBatch> getAllBatches() {
        return paymentBatchRepository.findAllByOrderByCreatedDateDesc();
    }

    public PaymentBatch getBatchById(Long batchId) {
        if (batchId == null) {
            throw new IllegalArgumentException("batchId must not be null");
        }
        return paymentBatchRepository.findById(Objects.requireNonNull(batchId))
                .orElseThrow(() -> new IllegalArgumentException("Batch not found: " + batchId));
    }

    public List<PaymentBatchItem> getBatchItems(Long batchId) {
        return paymentBatchItemRepository.findByBatchId(batchId);
    }

    public List<PaymentBatchItem> getPaymentHistory() {
        return paymentBatchItemRepository.findByPaymentStatusIgnoreCase("PAID");
    }

    // ── Canonical Data Loader ─────────────────────────────────────────────
    public List<Map<String, Object>> loadCanonicalRecords(String billingPeriod, String division) {
        String bp = billingPeriod != null ? billingPeriod.trim() : "";
        String divFilter = division != null ? division.trim() : "";
        boolean hasBp = !bp.isEmpty() && !"ALL".equalsIgnoreCase(bp);
        boolean hasDiv = !divFilter.isEmpty() && !"ALL".equalsIgnoreCase(divFilter);
        String canonDivFilter = hasDiv ? com.ceb.billing.utils.BranchDetector.canonicalDivision(divFilter) : "";
        if (canonDivFilter.isEmpty() && hasDiv) canonDivFilter = divFilter;

        List<MonthlyDirectorySnapshot> snapshots = getSnapshots(bp, divFilter);
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> seenSnapshotItems = new HashSet<>();
        Set<String> seenAccountsInSnapshots = new HashSet<>();

        // 1. Process month-wise directory snapshots
        for (MonthlyDirectorySnapshot snap : snapshots) {
            if (snap.getFinalDataJson() != null && !snap.getFinalDataJson().trim().isEmpty()) {
                try {
                    List<Map<String, Object>> list = objectMapper.readValue(snap.getFinalDataJson(), LIST_MAP_TYPE);
                    for (int i = 0; i < list.size(); i++) {
                        Map<String, Object> rec = list.get(i);
                        String acc = strVal(rec.get("accountNo"));
                        if (acc.isEmpty()) continue;
                        String bMonth = snap.getBillingMonth() != null && !snap.getBillingMonth().trim().isEmpty()
                                ? snap.getBillingMonth().trim() : strVal(rec.get("billingMonth"));
                        if (bMonth.isEmpty()) {
                            bMonth = snap.getDatasetName() != null && !snap.getDatasetName().trim().isEmpty() ? snap.getDatasetName().trim() : "CURRENT";
                        }
                        String snapDiv = snap.getDivision() != null && !snap.getDivision().trim().isEmpty()
                                ? snap.getDivision().trim() : strVal(rec.get("snapshotDivision"));
                        if (snapDiv.isEmpty()) {
                            snapDiv = strVal(rec.get("division"));
                        }
                        if (snapDiv.isEmpty()) {
                            snapDiv = strVal(rec.get("location"));
                        }

                        // Filter by billingPeriod if specified
                        if (hasBp && !bp.equalsIgnoreCase(bMonth) && !com.ceb.billing.controllers.CustomerController.isSameMonth(bp, bMonth)) {
                            continue;
                        }
                        // Filter by division if specified
                        if (hasDiv) {
                            String recCanonDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(snapDiv);
                            if (recCanonDiv.isEmpty() && !snapDiv.isEmpty()) recCanonDiv = snapDiv.trim();
                            if (recCanonDiv.isEmpty() || !canonDivFilter.equalsIgnoreCase(recCanonDiv)) {
                                continue;
                            }
                        }

                        Long sId = snap.getId() != null ? snap.getId() : 0L;
                        String itemKey = sId + "::" + i + "::" + acc;
                        if (seenSnapshotItems.contains(itemKey)) continue;
                        seenSnapshotItems.add(itemKey);
                        seenAccountsInSnapshots.add(acc.toLowerCase());

                        String recordKey = "snap_" + sId + "_" + i + "_" + acc.replaceAll("[^a-zA-Z0-9_-]", "");
                        rec.put("recordKey", recordKey);
                        rec.put("paymentRecordId", recordKey);
                        rec.put("snapshotId", sId);
                        rec.put("snapshotIndex", i);
                        rec.put("billingMonth", bMonth);
                        if (!snapDiv.isEmpty()) {
                            rec.put("division", snapDiv);
                        }
                        if (snap.getDatasetName() != null) {
                            rec.put("datasetName", snap.getDatasetName());
                        }
                        if (!rec.containsKey("billingPeriod") || strVal(rec.get("billingPeriod")).isEmpty()) {
                            Object bFrom = rec.get("fromDate") != null ? rec.get("fromDate") : (rec.get("billingFrom") != null ? rec.get("billingFrom") : rec.get("periodFrom"));
                            Object bTo = rec.get("toDate") != null ? rec.get("toDate") : (rec.get("billingTo") != null ? rec.get("billingTo") : rec.get("periodTo"));
                            if (bFrom != null && bTo != null) {
                                rec.put("billingPeriod", bFrom + " to " + bTo);
                            } else {
                                rec.put("billingPeriod", bMonth);
                            }
                        }
                        result.add(rec);
                    }
                } catch (Exception e) {
                    log.warning("Could not read snapshot data for ID " + snap.getId() + ": " + e.getMessage());
                }
            }
        }

        // 2. Process customerRepository (Customer 360 source of truth) for any directory records not present in snapshots
        if (customerRepository != null) {
            try {
                List<Customer> allCusts = customerRepository.findAll();
                for (Customer c : allCusts) {
                    if (c.getDirectoryJson() != null && !c.getDirectoryJson().trim().isEmpty()) {
                        try {
                            Map<String, Object> dirRec = objectMapper.readValue(c.getDirectoryJson(), new TypeReference<Map<String, Object>>() {});
                            String acc = strVal(dirRec.get("accountNo"));
                            if (acc.isEmpty()) acc = c.getAccountNo();
                            if (acc.isEmpty()) continue;

                            // If this account was already loaded from snapshots, skip fallback
                            if (seenAccountsInSnapshots.contains(acc.toLowerCase())) {
                                continue;
                            }

                            String bMonth = strVal(dirRec.get("billingMonth"));
                            if (bMonth.isEmpty()) {
                                bMonth = "February 2026";
                            }

                            // Filter by billingPeriod if specified
                            if (hasBp && !bp.equalsIgnoreCase(bMonth) && !com.ceb.billing.controllers.CustomerController.isSameMonth(bp, bMonth)) {
                                continue;
                            }

                            // Strictly check uploaded division data (NOT bank branch code or auto-derived branch code)
                            String div = strVal(dirRec.get("snapshotDivision"));
                            if (div.isEmpty()) {
                                div = strVal(dirRec.get("division"));
                            }
                            if (div.isEmpty()) {
                                div = c.getDivision() != null && !c.getDivision().trim().isEmpty() ? c.getDivision().trim() : "";
                            }
                            if (div.isEmpty()) {
                                div = strVal(dirRec.get("location"));
                            }

                            // Filter by division if specified
                            if (hasDiv) {
                                String custCanonDiv = com.ceb.billing.utils.BranchDetector.canonicalDivision(div);
                                if (custCanonDiv.isEmpty() && !div.isEmpty()) custCanonDiv = div.trim();
                                if (custCanonDiv.isEmpty() || !canonDivFilter.equalsIgnoreCase(custCanonDiv)) {
                                    continue;
                                }
                            }

                            String recordKey = "cust_" + acc.replaceAll("[^a-zA-Z0-9_-]", "") + "_" + bMonth.replaceAll("[^a-zA-Z0-9_-]", "");
                            dirRec.put("recordKey", recordKey);
                            dirRec.put("paymentRecordId", recordKey);
                            dirRec.put("accountNo", acc);
                            dirRec.put("billingMonth", bMonth);
                            if (!div.isEmpty()) {
                                dirRec.put("division", div);
                            }
                            if (!dirRec.containsKey("customerName") || strVal(dirRec.get("customerName")).isEmpty()) {
                                if (c.getCustomerName() != null) dirRec.put("customerName", c.getCustomerName());
                            }
                            if (!dirRec.containsKey("customerAddress") || strVal(dirRec.get("customerAddress")).isEmpty()) {
                                if (c.getCustomerAddress() != null) dirRec.put("customerAddress", c.getCustomerAddress());
                            }
                            if (!dirRec.containsKey("mobileNo") || strVal(dirRec.get("mobileNo")).isEmpty()) {
                                if (c.getMobileNo() != null) dirRec.put("mobileNo", c.getMobileNo());
                            }
                            if (!dirRec.containsKey("bankCode") || strVal(dirRec.get("bankCode")).isEmpty()) {
                                if (c.getBankCode() != null) dirRec.put("bankCode", c.getBankCode());
                            }
                            if (!dirRec.containsKey("branchCode") || strVal(dirRec.get("branchCode")).isEmpty()) {
                                if (c.getBranchCode() != null) dirRec.put("branchCode", c.getBranchCode());
                            }
                            if (!dirRec.containsKey("bankAccountNo") || strVal(dirRec.get("bankAccountNo")).isEmpty()) {
                                if (c.getBankAccountNo() != null) dirRec.put("bankAccountNo", c.getBankAccountNo());
                            }
                            if (!dirRec.containsKey("solarType") || strVal(dirRec.get("solarType")).isEmpty()) {
                                if (c.getSolarType() != null) dirRec.put("solarType", c.getSolarType());
                            }
                            if (!dirRec.containsKey("unitRate") || dirRec.get("unitRate") == null) {
                                if (c.getUnitRate() != null) dirRec.put("unitRate", c.getUnitRate());
                            }
                            if (!dirRec.containsKey("panelCapacity") || dirRec.get("panelCapacity") == null) {
                                if (c.getPanelCapacity() != null) dirRec.put("panelCapacity", c.getPanelCapacity());
                            }
                            if (!dirRec.containsKey("billingPeriod") || strVal(dirRec.get("billingPeriod")).isEmpty()) {
                                Object bFrom = dirRec.get("fromDate") != null ? dirRec.get("fromDate") : (dirRec.get("billingFrom") != null ? dirRec.get("billingFrom") : dirRec.get("periodFrom"));
                                Object bTo = dirRec.get("toDate") != null ? dirRec.get("toDate") : (dirRec.get("billingTo") != null ? dirRec.get("billingTo") : dirRec.get("periodTo"));
                                if (bFrom != null && bTo != null) {
                                    dirRec.put("billingPeriod", bFrom + " to " + bTo);
                                } else {
                                    dirRec.put("billingPeriod", bMonth);
                                }
                            }
                            result.add(dirRec);
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception ignored) {}
        }

        // Group by account to count payments, calculate cumulative payable, and assign visual styling tokens
        Map<String, List<Map<String, Object>>> byAccount = new LinkedHashMap<>();
        for (Map<String, Object> r : result) {
            String acc = strVal(r.get("accountNo")).toLowerCase();
            byAccount.computeIfAbsent(acc, k -> new ArrayList<>()).add(r);
        }

        String[] PALETTE_COLORS = new String[] {
            "#818cf8", // Indigo / Purple
            "#38bdf8", // Sky / Cyan
            "#fbbf24", // Amber / Warm Yellow
            "#f472b6", // Pink / Rose
            "#60a5fa", // Blue
            "#34d399", // Emerald
            "#2dd4bf", // Teal
            "#fb923c"  // Orange
        };

        for (List<Map<String, Object>> accountRecords : byAccount.values()) {
            int totalPayments = accountRecords.size();
            double cumulativePayable = 0.0;
            int readyCount = 0;
            int holdCount = 0;

            for (Map<String, Object> r : accountRecords) {
                PaymentEligibilityResult elig = canPay(r);
                double amt = elig.getFinancials().getOrDefault("totalPayable", 0.0);
                cumulativePayable += amt;
                if (elig.isEligible()) readyCount++;
                else holdCount++;
            }

            for (int pIdx = 0; pIdx < totalPayments; pIdx++) {
                Map<String, Object> r = accountRecords.get(pIdx);
                String acc = strVal(r.get("accountNo"));
                int colorIdx = Math.abs(acc.hashCode()) % PALETTE_COLORS.length;
                String groupColor = PALETTE_COLORS[colorIdx];

                r.put("totalPaymentsForCustomer", totalPayments);
                r.put("hasMultiplePayments", totalPayments > 1);
                r.put("paymentIndex", pIdx + 1);
                r.put("paymentSequence", pIdx + 1);
                r.put("customerGroupKey", acc);
                r.put("customerGroupColor", groupColor);
                r.put("cumulativeCustomerPayable", Math.round(cumulativePayable * 100.0) / 100.0);
                r.put("customerReadyPaymentsCount", readyCount);
                r.put("customerHoldPaymentsCount", holdCount);

                if (totalPayments > 1) {
                    boolean isHold = Boolean.TRUE.equals(r.get("paymentHold")) || !canPay(r).isEligible();
                    String tag = isHold ? "Hold Payment" : (pIdx == 0 ? "Previous / Backlog" : "Current Cycle");
                    r.put("paymentLabel", "Payment " + (pIdx + 1) + " of " + totalPayments);
                    r.put("paymentTag", tag);
                }
            }
        }

        return result;
    }

    private List<MonthlyDirectorySnapshot> getSnapshots(String billingPeriod, String division) {
        if (monthlyDirectorySnapshotRepository == null) return Collections.emptyList();
        String bp = billingPeriod != null ? billingPeriod.trim() : "";
        String div = division != null ? division.trim() : "";
        boolean hasBp = !bp.isEmpty() && !"ALL".equalsIgnoreCase(bp);
        boolean hasDiv = !div.isEmpty() && !"ALL".equalsIgnoreCase(div);
        String canonDiv = hasDiv ? com.ceb.billing.utils.BranchDetector.canonicalDivision(div) : "";
        if (canonDiv.isEmpty() && hasDiv) canonDiv = div;

        List<MonthlyDirectorySnapshot> raw = new ArrayList<>();
        if (hasBp && hasDiv) {
            raw.addAll(monthlyDirectorySnapshotRepository.findByBillingMonthIgnoreCaseAndDivisionIgnoreCase(bp, div));
            if (!canonDiv.equalsIgnoreCase(div)) {
                raw.addAll(monthlyDirectorySnapshotRepository.findByBillingMonthIgnoreCaseAndDivisionIgnoreCase(bp, canonDiv));
            }
            if (raw.isEmpty()) {
                raw.addAll(monthlyDirectorySnapshotRepository.findByBillingMonthIgnoreCaseAndDivisionIgnoreCaseAndStatus(bp, div, "APPROVED"));
                if (!canonDiv.equalsIgnoreCase(div)) {
                    raw.addAll(monthlyDirectorySnapshotRepository.findByBillingMonthIgnoreCaseAndDivisionIgnoreCaseAndStatus(bp, canonDiv, "APPROVED"));
                }
            }
        } else if (hasBp) {
            raw.addAll(monthlyDirectorySnapshotRepository.findByBillingMonthIgnoreCase(bp));
            if (raw.isEmpty()) {
                raw.addAll(monthlyDirectorySnapshotRepository.findByBillingMonthIgnoreCaseAndStatus(bp, "APPROVED"));
            }
        } else if (hasDiv) {
            raw.addAll(monthlyDirectorySnapshotRepository.findByDivisionIgnoreCase(div));
            if (!canonDiv.equalsIgnoreCase(div)) {
                raw.addAll(monthlyDirectorySnapshotRepository.findByDivisionIgnoreCase(canonDiv));
            }
            if (raw.isEmpty()) {
                raw.addAll(monthlyDirectorySnapshotRepository.findByDivisionIgnoreCaseAndStatus(div, "APPROVED"));
                if (!canonDiv.equalsIgnoreCase(div)) {
                    raw.addAll(monthlyDirectorySnapshotRepository.findByDivisionIgnoreCaseAndStatus(canonDiv, "APPROVED"));
                }
            }
        } else {
            raw.addAll(monthlyDirectorySnapshotRepository.findAllByOrderByCreatedDateDesc());
        }

        Map<Long, MonthlyDirectorySnapshot> uniqueMap = new LinkedHashMap<>();
        for (MonthlyDirectorySnapshot s : raw) {
            if (s.getId() != null) {
                uniqueMap.putIfAbsent(s.getId(), s);
            }
        }
        List<MonthlyDirectorySnapshot> snapshots = new ArrayList<>(uniqueMap.values());
        snapshots.sort((a, b) -> {
            java.time.LocalDateTime tA = a.getCreatedDate() != null ? a.getCreatedDate() : java.time.LocalDateTime.MIN;
            java.time.LocalDateTime tB = b.getCreatedDate() != null ? b.getCreatedDate() : java.time.LocalDateTime.MIN;
            int cmp = tB.compareTo(tA);
            if (cmp != 0) return cmp;
            Long idA = a.getId() != null ? a.getId() : 0L;
            Long idB = b.getId() != null ? b.getId() : 0L;
            return idB.compareTo(idA);
        });

        Map<String, MonthlyDirectorySnapshot> byMonthAndDiv = new LinkedHashMap<>();
        List<MonthlyDirectorySnapshot> unassigned = new ArrayList<>();
        for (MonthlyDirectorySnapshot s : snapshots) {
            String m = s.getBillingMonth() != null ? s.getBillingMonth().trim() : "";
            if (m.isEmpty() && s.getDatasetName() != null) m = s.getDatasetName().trim();
            String d = s.getDivision() != null ? s.getDivision().trim() : "";
            String dCanon = com.ceb.billing.utils.BranchDetector.canonicalDivision(d);
            if (dCanon.isEmpty() && !d.isEmpty()) dCanon = d;

            if (hasDiv) {
                if (!dCanon.isEmpty() && !canonDiv.equalsIgnoreCase(dCanon) && !canonDiv.equalsIgnoreCase(d)) {
                    continue;
                }
            }
            if (hasBp) {
                if (!m.isEmpty() && !bp.equalsIgnoreCase(m) && !com.ceb.billing.controllers.CustomerController.isSameMonth(bp, m)) {
                    continue;
                }
            }

            String key = m.toLowerCase() + "::" + dCanon.toLowerCase();
            if (!key.equals("::")) {
                byMonthAndDiv.putIfAbsent(key, s);
            } else {
                unassigned.add(s);
            }
        }

        List<MonthlyDirectorySnapshot> result = new ArrayList<>(byMonthAndDiv.values());
        result.addAll(unassigned);
        return result;
    }

    public List<String> getAvailableBillingMonths() {
        Set<String> months = new LinkedHashSet<>();
        if (monthlyDirectorySnapshotRepository != null) {
            try {
                List<MonthlyDirectorySnapshot> snaps = monthlyDirectorySnapshotRepository.findAllByOrderByCreatedDateDesc();
                for (MonthlyDirectorySnapshot s : snaps) {
                    if (s.getBillingMonth() != null && !s.getBillingMonth().trim().isEmpty()) {
                        months.add(s.getBillingMonth().trim());
                    } else if (s.getDatasetName() != null && !s.getDatasetName().trim().isEmpty()) {
                        months.add(s.getDatasetName().trim());
                    }
                }
            } catch (Exception ignored) {}
        }
        if (customerRepository != null) {
            try {
                List<Customer> customers = customerRepository.findAll();
                for (Customer c : customers) {
                    if (c.getDirectoryJson() != null && !c.getDirectoryJson().trim().isEmpty()) {
                        try {
                            Map<String, Object> map = objectMapper.readValue(c.getDirectoryJson(), new TypeReference<Map<String, Object>>() {});
                            String bm = strVal(map.get("billingMonth"));
                            if (!bm.isEmpty()) months.add(bm);
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception ignored) {}
        }
        if (months.isEmpty()) {
            months.add("February 2026");
        }
        return new ArrayList<>(months);
    }

    private String strVal(Object o) {
        if (o == null) return "";
        String s = o.toString().trim();
        return "null".equalsIgnoreCase(s) ? "" : s;
    }

    private Double parseDouble(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).doubleValue();
        try {
            String s = o.toString().trim().replace(",", "");
            if (s.isEmpty() || "—".equals(s)) return null;
            return Double.parseDouble(s);
        } catch (Exception ignored) {
            return null;
        }
    }
}
