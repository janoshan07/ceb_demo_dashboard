package com.ceb.billing.services;

import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.CostCodeRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.ExpenseCodeRepository;
import com.ceb.billing.repositories.NetTypeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Logger;

/**
 * Keeps the permanent {@code customers} directory in sync with the Monthly Customer Directory.
 *
 * Whenever a monthly snapshot is APPROVED (or an approved record is edited), every record it
 * contains is upserted into the {@link Customer} table: the customer's master fields are refreshed
 * from the approved data, the Eastern Province {@code division} is stamped, and the complete merged
 * record (Master / CEB Assist / NGEN / NPAY + validation) is stored as JSON so the Customer 360
 * view can show the exact same detail as the Monthly Directory. The Monthly Directory is the source
 * of truth, so non-blank approved values overwrite existing customer fields; blank values never
 * erase existing data. This service only writes to the customer directory — it never modifies any
 * snapshot, validation or approval logic.
 */
@Service
public class CustomerDirectorySyncService {

    private static final Logger log = Logger.getLogger(CustomerDirectorySyncService.class.getName());

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private CostCodeRepository costCodeRepository;

    @Autowired
    private NetTypeRepository netTypeRepository;

    @Autowired
    private ExpenseCodeRepository expenseCodeRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /** Syncs every record of an approved snapshot into the Customer Directory. */
    @Transactional
    public int syncSnapshot(MonthlyDirectorySnapshot snap) {
        if (snap == null || snap.getFinalDataJson() == null) return 0;
        List<Map<String, Object>> records;
        try {
            records = objectMapper.readValue(snap.getFinalDataJson(),
                    new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.warning("CustomerDirectorySync: could not parse snapshot " + snap.getId() + ": " + e.getMessage());
            return 0;
        }
        String division = snap.getDivision();
        int synced = 0;
        for (Map<String, Object> record : records) {
            try {
                if (upsertCustomer(record, division)) synced++;
            } catch (Exception e) {
                log.warning("CustomerDirectorySync: failed to sync a record from snapshot "
                        + snap.getId() + ": " + e.getMessage());
            }
        }
        log.info("CustomerDirectorySync: synced " + synced + " customer(s) from snapshot " + snap.getId()
                + " (division=" + division + ").");
        return synced;
    }

    /** Upserts a single Monthly Directory record into the customer directory. */
    @Transactional
    public boolean upsertCustomer(Map<String, Object> record, String division) {
        String accountNo = str(record, "accountNo");
        if (accountNo == null) return false;

        Optional<Customer> existing = customerRepository.findById(accountNo);
        Customer c = existing.orElseGet(Customer::new);
        if (existing.isEmpty()) {
            c.setAccountNo(accountNo);
        }

        String name = str(record, "masterName", "customerName", "npayName", "ngenName");
        if (name != null) c.setCustomerName(name);
        else if (isBlank(c.getCustomerName())) c.setCustomerName(accountNo); // NOT NULL guard

        setIfPresent(str(record, "customerAddress"), c::setCustomerAddress);
        setIfPresent(str(record, "mobileNo"), c::setMobileNo);
        setIfPresent(str(record, "bankCode"), c::setBankCode);
        setIfPresent(str(record, "branchCode"), c::setBranchCode);
        setIfPresent(str(record, "bankAccountNo"), c::setBankAccountNo);
        setIfPresent(str(record, "refNo"), c::setRefNo);
        setIfPresent(str(record, "tariffType"), c::setTariffType);

        String solarType = str(record, "masterNetType", "ngenNetType", "npayNetType", "solarType");
        if (solarType != null) {
            c.setSolarType(solarType);
            netTypeRepository.findByName(solarType.trim()).ifPresent(c::setNetType);
        }

        Double unitRate = dbl(record, "masterUnitRate", "unitRate", "ngenUnitRate");
        if (unitRate != null) c.setUnitRate(unitRate);

        Double panelCapacity = dbl(record, "panelCapacity");
        if (panelCapacity != null) c.setPanelCapacity(panelCapacity);

        LocalDate agreementDate = date(record, "agreementDate");
        if (agreementDate != null) c.setAgreementDate(agreementDate);

        String costCode = str(record, "costCode");
        if (costCode != null) {
            costCodeRepository.findByCostCode(costCode.trim()).ifPresent(c::setCostCode);
        }

        String expCode = str(record, "billingMode", "expenseCode", "lCode");
        if (expCode != null) {
            final String cleanEc = expCode.trim();
            expenseCodeRepository.findByExpCode(cleanEc).ifPresentOrElse(c::setExpenseCode, () -> {
                try {
                    expenseCodeRepository.findById(Long.parseLong(cleanEc)).ifPresent(c::setExpenseCode);
                } catch (Exception ignored) {
                    // free-text expense code that is neither a known code nor an id — leave as-is
                }
            });
        }

        // Stamp the division this billing belongs to (folds onto branch code when absent).
        if (division != null && !division.trim().isEmpty()) {
            c.setDivision(division.trim());
        }

        // Preserve the approved validation state so the directory reflects the snapshot.
        String status = str(record, "status");
        if ("ERROR".equalsIgnoreCase(status)) {
            c.setValidationStatus("ERROR");
        } else {
            c.setValidationStatus("VALID");
        }
        c.setValidationErrors(joinIssues(record));

        // Store the complete merged record so the Customer 360 view mirrors the Monthly Directory.
        try {
            c.setDirectoryJson(objectMapper.writeValueAsString(record));
        } catch (Exception e) {
            log.warning("CustomerDirectorySync: could not serialise directory record for " + accountNo);
        }

        customerRepository.save(c);
        return true;
    }

    // ── field helpers ─────────────────────────────────────────────────────────

    /** First non-blank value across the given keys, unwrapping {value:...} cells and dropping "—". */
    private String str(Map<String, Object> r, String... keys) {
        if (r == null) return null;
        for (String k : keys) {
            Object v = r.get(k);
            if (v instanceof Map) v = ((Map<?, ?>) v).get("value");
            if (v != null) {
                String s = String.valueOf(v).trim();
                if (!s.isEmpty() && !"—".equals(s) && !"null".equalsIgnoreCase(s)) return s;
            }
        }
        return null;
    }

    private Double dbl(Map<String, Object> r, String... keys) {
        String s = str(r, keys);
        if (s == null) return null;
        try {
            return Double.valueOf(s.replaceAll(",", ""));
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate date(Map<String, Object> r, String... keys) {
        String s = str(r, keys);
        if (s == null) return null;
        try {
            return LocalDate.parse(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    /** Joins any validation error/warning strings carried on the record for the customer flag. */
    @SuppressWarnings("unchecked")
    private String joinIssues(Map<String, Object> r) {
        StringBuilder sb = new StringBuilder();
        for (String key : new String[]{"errors", "warnings"}) {
            Object v = r.get(key);
            if (v instanceof List) {
                for (Object item : (List<Object>) v) {
                    if (item == null) continue;
                    String s = String.valueOf(item).trim();
                    if (s.isEmpty()) continue;
                    if (sb.length() > 0) sb.append("; ");
                    sb.append(s);
                }
            }
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private void setIfPresent(String value, java.util.function.Consumer<String> setter) {
        if (value != null) setter.accept(value);
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
