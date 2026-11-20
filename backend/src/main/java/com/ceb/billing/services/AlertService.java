package com.ceb.billing.services;

import com.ceb.billing.entities.Alert;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.repositories.AlertRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.lang.NonNull;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AlertService {

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository snapshotRepository;

    @Autowired(required = false)
    private com.ceb.billing.services.MonthlyDirectoryHashService monthlyDirectoryHashService;

    @Autowired
    private AuditLogService auditLogService;

    private static final List<String> MANAGED_ALERT_TYPES = List.of(
            "IMPOSSIBLE_VALUE", "DUPLICATE_BILL", "EXPORT_DROP", "IMPORT_SPIKE", "MISSING_BILL", "NET_IMPORT");

    /**
     * Incrementally runs the anomaly detection engine for a set of impacted customer accounts.
     * Uses in-memory Hash Maps and batch DB queries for high performance (O(1) lookups).
     */
    @Transactional
    @SuppressWarnings("null")
    public void generateAlertsForAccounts(Set<String> accountNos) {
        if (accountNos == null || accountNos.isEmpty()) {
            return;
        }

        // Determine reference date for "latest bill older than 45 days" check.
        // We look up the maximum toDate across all billing records in the DB to support older static demo files.
        LocalDate referenceDate = LocalDate.now();
        LocalDate maxToDate = null;
        try {
            // Find max toDate dynamically in a single query
            maxToDate = billingRecordRepository.findMaxToDate();
        } catch (Exception e) {
            // Fallback to today
        }

        if (maxToDate != null && maxToDate.isBefore(referenceDate)) {
            if (ChronoUnit.DAYS.between(maxToDate, referenceDate) > 45) {
                referenceDate = maxToDate;
            }
        }

        List<String> accList = new ArrayList<>(accountNos);
        List<Alert> alertsToSave = new ArrayList<>();

        // Process in chunks of 500 accounts to optimize DB parameter limits and memory
        int chunkSize = 500;
        for (int i = 0; i < accList.size(); i += chunkSize) {
            List<String> chunk = accList.subList(i, Math.min(i + chunkSize, accList.size()));

            // 1. Bulk delete old unread alerts in ONE query instead of 5 individual deletes per account
            try {
                alertRepository.deleteByAccountNoInAndAlertTypeInAndStatus(chunk, MANAGED_ALERT_TYPES, "UNREAD");
            } catch (Exception e) {
                for (String acc : chunk) {
                    for (String type : MANAGED_ALERT_TYPES) {
                        try {
                            alertRepository.deleteByAccountNoAndAlertTypeAndStatus(acc, type, "UNREAD");
                        } catch (Exception ignored) {}
                    }
                }
            }

            // 2. Pre-load customers into an in-memory Hash Map [O(1) Access]
            Map<String, Customer> customerHash = new HashMap<>();
            customerRepository.findAllById(chunk).forEach(c -> {
                if (c.getAccountNo() != null) {
                    customerHash.put(c.getAccountNo().trim(), c);
                }
            });

            // 3. Pre-load all chronological billing records into an Account -> List Hash Map [O(1) Access]
            Map<String, List<BillingRecord>> billsByAccountHash = new HashMap<>();
            List<BillingRecord> billsChunk = billingRecordRepository.findByCustomerAccountNoInOrderByFromDateAsc(chunk);
            for (BillingRecord br : billsChunk) {
                if (br.getCustomer() != null && br.getCustomer().getAccountNo() != null) {
                    billsByAccountHash.computeIfAbsent(br.getCustomer().getAccountNo().trim(), k -> new ArrayList<>()).add(br);
                }
            }

            // 4. In-Memory Anomaly Detection using fast Hash lookups
            for (String accountNo : chunk) {
                Customer customer = customerHash.get(accountNo);
                if (customer == null) {
                    continue;
                }

                List<BillingRecord> bills = billsByAccountHash.get(accountNo);
                if (bills == null || bills.isEmpty()) {
                    continue;
                }

                // 1. Negative / Impossible Unit Values & Duplicate Bills checking
                Map<String, List<BillingRecord>> cycleGroups = new HashMap<>();

                for (BillingRecord bill : bills) {
                    Double importUnits = bill.getImportUnits();
                    Double exportUnits = bill.getExportUnits();
                    Double unitCost = bill.getUnitCost();

                    // Physical quantities (meter readings, tariff rates) cannot be negative.
                    // Note: totalAmount < 0 occurs normally whenever grid import exceeds solar export and is not a physical defect.
                    boolean negImport = importUnits != null && importUnits < 0;
                    boolean negExport = exportUnits != null && exportUnits < 0;
                    boolean negCost = unitCost != null && unitCost < 0;

                    if (negImport || negExport || negCost) {
                        StringBuilder offending = new StringBuilder();
                        if (negImport) offending.append("Import=").append(importUnits).append(" kWh ");
                        if (negExport) offending.append("Export=").append(exportUnits).append(" kWh ");
                        if (negCost) offending.append("Cost=").append(unitCost).append(" LKR ");
                        String msg = String.format("Negative physical value found in bill Ref %s: %s(physical quantities cannot be negative).",
                                bill.getRefNo(), offending.toString().trim());
                        alertsToSave.add(new Alert(accountNo, "IMPOSSIBLE_VALUE", "CRITICAL", msg, "UNREAD"));
                    } else if (importUnits != null && exportUnits != null && importUnits > exportUnits) {
                        double netUnit = exportUnits - importUnits;
                        String msg = String.format(java.util.Locale.US, "Net grid import in bill Ref %s: Import=%.1f kWh, Export=%.1f kWh, Net=%.1f kWh.",
                                bill.getRefNo(), importUnits, exportUnits, netUnit);
                        alertsToSave.add(new Alert(accountNo, "NET_IMPORT", "INFO", msg, "UNREAD"));
                    } else if (customer.getPanelCapacity() != null && customer.getPanelCapacity() > 0
                            && exportUnits != null && exportUnits > 1000.0 * customer.getPanelCapacity()) {
                        String msg = String.format("Solar export of %s kWh in bill Ref %s exceeds safety yield limit for panel capacity %s kW (max 1000 kWh/kW).",
                                exportUnits, bill.getRefNo(), customer.getPanelCapacity());
                        alertsToSave.add(new Alert(accountNo, "IMPOSSIBLE_VALUE", "CRITICAL", msg, "UNREAD"));
                    }

                    // Group by year and month to check for duplicates
                    if (bill.getFromDate() != null) {
                        String key = bill.getFromDate().getYear() + "-" + bill.getFromDate().getMonthValue();
                        cycleGroups.computeIfAbsent(key, k -> new ArrayList<>()).add(bill);
                    }
                }

                // 2. Duplicate bills verification
                for (Map.Entry<String, List<BillingRecord>> entry : cycleGroups.entrySet()) {
                    if (entry.getValue().size() > 1) {
                        String key = entry.getKey();
                        String msg = String.format("Duplicate billing cycles detected: %d records found for account cycle starting %s.",
                                entry.getValue().size(), key);
                        alertsToSave.add(new Alert(accountNo, "DUPLICATE_BILL", "CRITICAL", msg, "UNREAD"));
                    }
                }

                // 3. Chronological checks: Export drops, Import spikes, and Missing monthly bills
                for (int j = 1; j < bills.size(); j++) {
                    BillingRecord prev = bills.get(j - 1);
                    BillingRecord curr = bills.get(j);

                    Double prevExp = prev.getExportUnits() != null ? prev.getExportUnits() : 0.0;
                    Double currExp = curr.getExportUnits() != null ? curr.getExportUnits() : 0.0;
                    if (prevExp > 50.0 && currExp < 0.5 * prevExp) {
                        String msg = String.format("Export units dropped by %.1f%% MoM (from %.1f kWh in Ref %s to %.1f kWh in Ref %s).",
                                ((prevExp - currExp) / prevExp) * 100.0,
                                prevExp, prev.getRefNo(), currExp, curr.getRefNo());
                        alertsToSave.add(new Alert(accountNo, "EXPORT_DROP", "WARNING", msg, "UNREAD"));
                    }

                    Double prevImp = prev.getImportUnits() != null ? prev.getImportUnits() : 0.0;
                    Double currImp = curr.getImportUnits() != null ? curr.getImportUnits() : 0.0;
                    if (prevImp > 0 && currImp >= 2.0 * prevImp && (currImp - prevImp) >= 100.0) {
                        String msg = String.format("Import units spiked by %.1f%% MoM (from %.1f kWh in Ref %s to %.1f kWh in Ref %s).",
                                ((currImp - prevImp) / prevImp) * 100.0,
                                prevImp, prev.getRefNo(), currImp, curr.getRefNo());
                        alertsToSave.add(new Alert(accountNo, "IMPORT_SPIKE", "WARNING", msg, "UNREAD"));
                    }

                    if (prev.getToDate() != null && curr.getFromDate() != null) {
                        long gapDays = ChronoUnit.DAYS.between(prev.getToDate(), curr.getFromDate());
                        if (gapDays > 35) {
                            String msg = String.format("Billing records gap of %d days detected between cycle end %s (Ref %s) and cycle start %s (Ref %s).",
                                    gapDays, prev.getToDate(), prev.getRefNo(), curr.getFromDate(), curr.getRefNo());
                            alertsToSave.add(new Alert(accountNo, "MISSING_BILL", "WARNING", msg, "UNREAD"));
                        }
                    }
                }

                // 4. Latest bill older than 45 days check
                BillingRecord latestBill = bills.get(bills.size() - 1);
                if (latestBill.getToDate() != null) {
                    long daysSinceLatestBill = ChronoUnit.DAYS.between(latestBill.getToDate(), referenceDate);
                    if (daysSinceLatestBill > 45) {
                        String msg = String.format("Latest billing statement is overdue. Last billing cycle ended %d days ago on %s.",
                                daysSinceLatestBill, latestBill.getToDate());
                        alertsToSave.add(new Alert(accountNo, "MISSING_BILL", "WARNING", msg, "UNREAD"));
                    }
                }
            }
        }

        // 5. Bulk save all alerts in batches
        if (!alertsToSave.isEmpty()) {
            for (int i = 0; i < alertsToSave.size(); i += 1000) {
                List<Alert> sub = alertsToSave.subList(i, Math.min(i + 1000, alertsToSave.size()));
                alertRepository.saveAll(sub);
            }
        }
    }

    /**
     * Resolves an alert by ID.
     */
    @Transactional
    public void resolveAlert(@NonNull Long alertId) {
        Optional<Alert> optAlert = alertRepository.findById(alertId);
        if (optAlert.isPresent()) {
            Alert alert = optAlert.get();
            alert.setStatus("RESOLVED");
            alertRepository.save(alert);
            clearOrphanCountCache();
        }
    }

    /**
     * Resolves all unread alerts matching optional severity and alertType filters.
     */
    @Transactional
    public int resolveAlertGroup(String severity, String alertType, String resolvedBy) {
        List<Alert> alerts = alertRepository.findAll().stream()
                .filter(a -> "UNREAD".equalsIgnoreCase(a.getStatus()))
                .filter(a -> severity == null || severity.isBlank() || "ALL".equalsIgnoreCase(severity) || severity.equalsIgnoreCase(a.getSeverity()))
                .filter(a -> alertType == null || alertType.isBlank() || "ALL".equalsIgnoreCase(alertType) || alertType.equalsIgnoreCase(a.getAlertType()))
                .toList();
        for (Alert a : alerts) {
            a.setStatus("RESOLVED");
        }
        alertRepository.saveAll(alerts);
        clearOrphanCountCache();
        return alerts.size();
    }

    /**
     * Re-checks and resolves historical false-positive "Negative values found" alerts
     * where all measured physical values were actually positive (grid import > solar export).
     */
    @Transactional
    public Map<String, Integer> recheckAndResolveFalseNegativeAlerts(String resolvedBy) {
        List<Alert> impossibleAlerts = alertRepository.findAll().stream()
                .filter(a -> "IMPOSSIBLE_VALUE".equalsIgnoreCase(a.getAlertType()) && "UNREAD".equalsIgnoreCase(a.getStatus()))
                .filter(a -> a.getMessage() != null && a.getMessage().contains("Negative values found in bill Ref"))
                .toList();

        int totalEvaluated = impossibleAlerts.size();
        int resolvedCount = 0;
        for (Alert alert : impossibleAlerts) {
            String msg = alert.getMessage();
            boolean hasRealNegative = msg.contains("=-") || msg.contains("= -");
            if (!hasRealNegative) {
                alert.setStatus("RESOLVED");
                alert.setMessage(msg + " [Resolved: Net grid import (export < import) is not a negative physical meter anomaly]");
                alertRepository.save(alert);
                resolvedCount++;
            }
        }
        if (resolvedCount > 0) {
            clearOrphanCountCache();
        }
        int skippedCount = totalEvaluated - resolvedCount;
        Map<String, Integer> result = new LinkedHashMap<>();
        result.put("totalEvaluated", totalEvaluated);
        result.put("resolvedCount", resolvedCount);
        result.put("skippedCount", skippedCount);
        return result;
    }

    /**
     * Returns counters of unresolved alerts grouped by severity.
     */
    public Map<String, Long> getAlertCounters() {
        Map<String, Long> counters = new HashMap<>();
        counters.put("critical", alertRepository.countBySeverityAndStatus("CRITICAL", "UNREAD"));
        counters.put("warning", alertRepository.countBySeverityAndStatus("WARNING", "UNREAD"));
        counters.put("info", alertRepository.countBySeverityAndStatus("INFO", "UNREAD"));
        counters.put("total", alertRepository.countByStatus("UNREAD"));
        return counters;
    }

    /**
     * Checks if an account exists in any APPROVED monthly directory snapshot.
     */
    public boolean isAccountInAnyApprovedSnapshot(String accountNo) {
        if (accountNo == null || accountNo.isBlank()) return false;
        String acc = accountNo.trim();
        List<com.ceb.billing.entities.MonthlyDirectorySnapshot> approved = snapshotRepository.findByStatusOrderByCreatedDateDesc("APPROVED");
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        for (com.ceb.billing.entities.MonthlyDirectorySnapshot snap : approved) {
            String json = snap.getFinalDataJson();
            if (json == null || json.isBlank()) continue;
            if (monthlyDirectoryHashService != null && monthlyDirectoryHashService.isReady()) {
                Map<String, Map<String, Object>> recMap = monthlyDirectoryHashService.getRecordsMap(snap.getId());
                if (recMap != null && recMap.containsKey(acc)) {
                    return true;
                }
            }
            if (json.contains("\"" + acc + "\"")) {
                try {
                    List<Map<String, Object>> recs = mapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                    for (Map<String, Object> r : recs) {
                        if (acc.equalsIgnoreCase(String.valueOf(r.get("accountNo")).trim())) {
                            return true;
                        }
                    }
                } catch (Exception ignored) {}
            }
        }
        return false;
    }

    // 30-second server-side cache for orphan alert count
    private static volatile Integer cachedOrphanCount = null;
    private static volatile long cachedOrphanExpiry = 0L;
    private static volatile long lastQueryDurationMs = 0L;

    public static void clearOrphanCountCache() {
        cachedOrphanCount = null;
        cachedOrphanExpiry = 0L;
    }

    public static long getLastQueryDurationMs() {
        return lastQueryDurationMs;
    }

    /**
     * Resolves open alerts for an account that has been deleted from a snapshot,
     * provided the account no longer exists in any other APPROVED snapshot.
     */
    @Transactional
    public int resolveAlertsForRemovedCustomer(String accountNo, String actor) {
        if (accountNo == null || accountNo.isBlank()) return 0;
        String trimmed = accountNo.trim();

        if (isAccountInAnyApprovedSnapshot(trimmed)) {
            return 0; // Still active in another approved snapshot
        }

        List<Alert> unread = alertRepository.findByAccountNoAndStatus(trimmed, "UNREAD");
        if (unread.isEmpty()) return 0;

        for (Alert a : unread) {
            a.setStatus("RESOLVED");
        }
        alertRepository.saveAll(unread);
        clearOrphanCountCache();

        auditLogService.log("ALERT_RESOLVED", String.format(
                "%s resolved %d open alert(s) for account %s. Reason: Customer removed from directory",
                actor, unread.size(), trimmed
        ));

        com.ceb.billing.controllers.DashboardController.invalidateCache();
        return unread.size();
    }

    /**
     * Returns the set of all account numbers present across all APPROVED snapshots.
     */
    public Set<String> getApprovedSnapshotAccountNumbers() {
        Set<String> accounts = new HashSet<>();
        List<com.ceb.billing.entities.MonthlyDirectorySnapshot> approved = snapshotRepository.findByStatusOrderByCreatedDateDesc("APPROVED");
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        for (com.ceb.billing.entities.MonthlyDirectorySnapshot snap : approved) {
            String json = snap.getFinalDataJson();
            if (json == null || json.isBlank()) continue;
            if (monthlyDirectoryHashService != null && monthlyDirectoryHashService.isReady()) {
                Map<String, Map<String, Object>> recMap = monthlyDirectoryHashService.getRecordsMap(snap.getId());
                if (recMap != null) {
                    accounts.addAll(recMap.keySet());
                    continue;
                }
            }
            try {
                List<Map<String, Object>> recs = mapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                for (Map<String, Object> r : recs) {
                    Object a = r.get("accountNo");
                    if (a != null) {
                        accounts.add(String.valueOf(a).trim());
                    }
                }
            } catch (Exception ignored) {}
        }
        return accounts;
    }

    /**
     * Counts open alerts for accounts that no longer exist in any APPROVED snapshot.
     * Cached for 30 seconds to prevent repetitive scanning.
     */
    public int countOrphanAlerts() {
        long now = System.currentTimeMillis();
        if (cachedOrphanCount != null && now < cachedOrphanExpiry) {
            return cachedOrphanCount;
        }

        long start = System.nanoTime();
        Set<String> approvedAccounts = getApprovedSnapshotAccountNumbers();
        int count = (int) alertRepository.findByStatusOrderByCreatedAtDesc("UNREAD").stream()
                .filter(a -> a.getAccountNo() != null && !approvedAccounts.contains(a.getAccountNo().trim()))
                .count();
        lastQueryDurationMs = (System.nanoTime() - start) / 1_000_000;

        cachedOrphanCount = count;
        cachedOrphanExpiry = now + 30_000L; // 30 seconds
        return count;
    }

    /**
     * Admin one-off cleanup action: resolves all open alerts belonging to accounts
     * that no longer exist in any APPROVED snapshot.
     */
    @Transactional
    public Map<String, Object> resolveAllOrphanAlerts(String adminUsername) {
        Set<String> approvedAccounts = getApprovedSnapshotAccountNumbers();
        List<Alert> orphanAlerts = alertRepository.findByStatusOrderByCreatedAtDesc("UNREAD").stream()
                .filter(a -> a.getAccountNo() != null && !approvedAccounts.contains(a.getAccountNo().trim()))
                .toList();

        for (Alert a : orphanAlerts) {
            a.setStatus("RESOLVED");
        }
        alertRepository.saveAll(orphanAlerts);
        clearOrphanCountCache();

        int resolvedCount = orphanAlerts.size();
        long distinctAccountsCount = orphanAlerts.stream().map(Alert::getAccountNo).distinct().count();

        auditLogService.log("ALERT_RESOLVED", String.format(
                "Admin %s resolved %d open orphan alert(s) across %d account(s). Reason: Customer removed from directory",
                adminUsername, resolvedCount, distinctAccountsCount
        ));

        com.ceb.billing.controllers.DashboardController.invalidateCache();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resolvedCount", resolvedCount);
        res.put("message", String.format("Successfully resolved %d alerts of removed customers.", resolvedCount));
        return res;
    }
}
