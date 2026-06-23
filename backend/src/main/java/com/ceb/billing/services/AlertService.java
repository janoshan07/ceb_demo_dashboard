package com.ceb.billing.services;

import com.ceb.billing.entities.Alert;
import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.repositories.AlertRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
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

    /**
     * Incrementally runs the anomaly detection engine for a set of impacted customer accounts.
     * Clears previous active (UNREAD) alerts for the customer accounts and generates new ones.
     */
    @Transactional
    public void generateAlertsForAccounts(Set<String> accountNos) {
        if (accountNos == null || accountNos.isEmpty()) {
            return;
        }

        // Determine reference date for "latest bill older than 45 days" check.
        // We look up the maximum toDate across all billing records in the DB to support older static demo files.
        LocalDate referenceDate = LocalDate.now();
        LocalDate maxToDate = null;
        try {
            // Find max toDate dynamically
            List<BillingRecord> allRecords = billingRecordRepository.findAll();
            for (BillingRecord r : allRecords) {
                if (r.getToDate() != null) {
                    if (maxToDate == null || r.getToDate().isAfter(maxToDate)) {
                        maxToDate = r.getToDate();
                    }
                }
            }
        } catch (Exception e) {
            // Fallback to today
        }

        if (maxToDate != null && maxToDate.isBefore(referenceDate)) {
            if (ChronoUnit.DAYS.between(maxToDate, referenceDate) > 45) {
                referenceDate = maxToDate;
            }
        }

        for (String accountNo : accountNos) {
            Optional<Customer> optCustomer = customerRepository.findById(accountNo);
            if (optCustomer.isEmpty()) {
                continue;
            }
            Customer customer = optCustomer.get();

            // Clear old UNREAD alerts for this account
            alertRepository.deleteByAccountNoAndAlertTypeAndStatus(accountNo, "IMPOSSIBLE_VALUE", "UNREAD");
            alertRepository.deleteByAccountNoAndAlertTypeAndStatus(accountNo, "DUPLICATE_BILL", "UNREAD");
            alertRepository.deleteByAccountNoAndAlertTypeAndStatus(accountNo, "EXPORT_DROP", "UNREAD");
            alertRepository.deleteByAccountNoAndAlertTypeAndStatus(accountNo, "IMPORT_SPIKE", "UNREAD");
            alertRepository.deleteByAccountNoAndAlertTypeAndStatus(accountNo, "MISSING_BILL", "UNREAD");

            List<BillingRecord> bills = billingRecordRepository.findByCustomerAccountNoOrderByFromDateAsc(accountNo);
            if (bills.isEmpty()) {
                continue;
            }

            // 1. Negative / Impossible Unit Values & Duplicate Bills checking
            Map<String, List<BillingRecord>> cycleGroups = new HashMap<>();

            for (BillingRecord bill : bills) {
                // Negative or impossible values check
                Double importUnits = bill.getImportUnits();
                Double exportUnits = bill.getExportUnits();
                Double unitCost = bill.getUnitCost();
                Double totalAmount = bill.getTotalAmount();

                if (importUnits < 0 || exportUnits < 0 || unitCost < 0 || totalAmount < 0) {
                    String msg = String.format("Negative values found in bill Ref %s: Import=%s kWh, Export=%s kWh, Cost=%s LKR.",
                            bill.getRefNo(), importUnits, exportUnits, unitCost);
                    alertRepository.save(new Alert(accountNo, "IMPOSSIBLE_VALUE", "CRITICAL", msg, "UNREAD"));
                } else if (customer.getPanelCapacity() != null && customer.getPanelCapacity() > 0 
                        && exportUnits > 1000.0 * customer.getPanelCapacity()) {
                    String msg = String.format("Solar export of %s kWh in bill Ref %s exceeds safety yield limit for panel capacity %s kW (max 1000 kWh/kW).",
                            exportUnits, bill.getRefNo(), customer.getPanelCapacity());
                    alertRepository.save(new Alert(accountNo, "IMPOSSIBLE_VALUE", "CRITICAL", msg, "UNREAD"));
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
                    alertRepository.save(new Alert(accountNo, "DUPLICATE_BILL", "CRITICAL", msg, "UNREAD"));
                }
            }

            // 3. Chronological checks: Export drops, Import spikes, and Missing monthly bills
            for (int i = 1; i < bills.size(); i++) {
                BillingRecord prev = bills.get(i - 1);
                BillingRecord curr = bills.get(i);

                // Sudden Export Drop: prev exports > 50 and curr exports < 50% of prev
                if (prev.getExportUnits() > 50.0 && curr.getExportUnits() < 0.5 * prev.getExportUnits()) {
                    String msg = String.format("Export units dropped by %.1f%% MoM (from %.1f kWh in Ref %s to %.1f kWh in Ref %s).",
                            ((prev.getExportUnits() - curr.getExportUnits()) / prev.getExportUnits()) * 100.0,
                            prev.getExportUnits(), prev.getRefNo(), curr.getExportUnits(), curr.getRefNo());
                    alertRepository.save(new Alert(accountNo, "EXPORT_DROP", "WARNING", msg, "UNREAD"));
                }

                // Sudden Import Spike: curr imports doubled and increased by >= 100 kWh
                if (prev.getImportUnits() > 0 && curr.getImportUnits() >= 2.0 * prev.getImportUnits() 
                        && (curr.getImportUnits() - prev.getImportUnits()) >= 100.0) {
                    String msg = String.format("Import units spiked by %.1f%% MoM (from %.1f kWh in Ref %s to %.1f kWh in Ref %s).",
                            ((curr.getImportUnits() - prev.getImportUnits()) / prev.getImportUnits()) * 100.0,
                            prev.getImportUnits(), prev.getRefNo(), curr.getImportUnits(), curr.getRefNo());
                    alertRepository.save(new Alert(accountNo, "IMPORT_SPIKE", "WARNING", msg, "UNREAD"));
                }

                // Missing Monthly Bills (gap between end of previous and start of next is > 35 days)
                if (prev.getToDate() != null && curr.getFromDate() != null) {
                    long gapDays = ChronoUnit.DAYS.between(prev.getToDate(), curr.getFromDate());
                    if (gapDays > 35) {
                        String msg = String.format("Billing records gap of %d days detected between cycle end %s (Ref %s) and cycle start %s (Ref %s).",
                                gapDays, prev.getToDate(), prev.getRefNo(), curr.getFromDate(), curr.getRefNo());
                        alertRepository.save(new Alert(accountNo, "MISSING_BILL", "WARNING", msg, "UNREAD"));
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
                    alertRepository.save(new Alert(accountNo, "MISSING_BILL", "WARNING", msg, "UNREAD"));
                }
            }
        }
    }

    /**
     * Resolves an alert by ID.
     */
    @Transactional
    public void resolveAlert(Long alertId) {
        Optional<Alert> optAlert = alertRepository.findById(alertId);
        if (optAlert.isPresent()) {
            Alert alert = optAlert.get();
            alert.setStatus("RESOLVED");
            alertRepository.save(alert);
        }
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
}
