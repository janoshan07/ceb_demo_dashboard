package com.ceb.billing.services;

import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.CostCode;
import com.ceb.billing.entities.NetType;
import com.ceb.billing.entities.ExpenseCode;
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
import java.util.*;
import java.util.logging.Logger;

/**
 * Keeps the permanent {@code customers} directory in sync with the Monthly Customer Directory.
 *
 * Uses in-memory Hash Maps and batching to achieve high-speed O(1) lookups and eliminate
 * thousands of redundant N+1 SQL queries during snapshot approvals.
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

    @Autowired(required = false)
    private CustomerHashIndexService customerHashIndexService;

    /**
     * High-speed sync of every record in an approved snapshot into the Customer Directory
     * using in-memory Hash Maps and batch persistence.
     */
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
        if (records == null || records.isEmpty()) return 0;

        String division = snap.getDivision();
        String billingMonth = snap.getBillingMonth();

        // 1. Pre-load reference lookup tables into Hash Maps once [O(1) Access]
        Map<String, NetType> netTypeHash = new HashMap<>();
        try {
            for (NetType nt : netTypeRepository.findAll()) {
                if (nt.getName() != null) netTypeHash.put(nt.getName().trim().toLowerCase(), nt);
            }
        } catch (Exception ignored) {}

        Map<String, CostCode> costCodeHash = new HashMap<>();
        try {
            for (CostCode cc : costCodeRepository.findAll()) {
                if (cc.getCostCode() != null) costCodeHash.put(cc.getCostCode().trim().toLowerCase(), cc);
                costCodeHash.put(String.valueOf(cc.getId()), cc);
            }
        } catch (Exception ignored) {}

        Map<String, ExpenseCode> expenseCodeHash = new HashMap<>();
        try {
            for (ExpenseCode ec : expenseCodeRepository.findAll()) {
                if (ec.getExpCode() != null) expenseCodeHash.put(ec.getExpCode().trim().toLowerCase(), ec);
                if (ec.getExp() != null) expenseCodeHash.put(ec.getExp().trim().toLowerCase(), ec);
                expenseCodeHash.put(String.valueOf(ec.getId()), ec);
            }
        } catch (Exception ignored) {}

        // 2. Pre-load existing customers in ONE batch query into an Account Hash Map [O(1) Access]
        Set<String> accountNos = new HashSet<>();
        for (Map<String, Object> record : records) {
            String acc = str(record, "accountNo");
            if (acc != null && !acc.isEmpty()) {
                accountNos.add(acc);
            }
        }

        Map<String, Customer> customerHash = new HashMap<>();
        if (!accountNos.isEmpty()) {
            try {
                for (Customer c : customerRepository.findAllById(accountNos)) {
                    if (c.getAccountNo() != null) {
                        customerHash.put(c.getAccountNo().trim(), c);
                    }
                }
            } catch (Exception ignored) {}
        }

        // 3. Process records with O(1) lookups
        List<Customer> toSave = new ArrayList<>(records.size());
        int synced = 0;

        for (Map<String, Object> record : records) {
            try {
                if (billingMonth != null) {
                    record.put("billingMonth", billingMonth);
                }
                if (division != null) {
                    record.put("division", division);
                }

                String accountNo = str(record, "accountNo");
                if (accountNo == null) continue;

                Customer c = customerHash.get(accountNo);
                if (c == null) {
                    c = new Customer();
                    c.setAccountNo(accountNo);
                    customerHash.put(accountNo, c);
                }

                populateCustomerFields(c, record, division, netTypeHash, costCodeHash, expenseCodeHash);
                toSave.add(c);
                synced++;
            } catch (Exception e) {
                log.warning("CustomerDirectorySync: failed to sync record: " + e.getMessage());
            }
        }

        // 4. Single Batch Save
        if (!toSave.isEmpty()) {
            customerRepository.saveAll(toSave);
        }

        log.info("CustomerDirectorySync: synced " + synced + " customer(s) from snapshot " + snap.getId()
                + " (division=" + division + ") in high-performance batch mode.");

        // 5. In-Memory Hash Index Warmup / Rebuild
        if (customerHashIndexService != null && synced > 0) {
            customerHashIndexService.rebuildIndex();
        }
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

        populateCustomerFields(c, record, division, null, null, null);
        customerRepository.save(c);
        if (customerHashIndexService != null) {
            customerHashIndexService.putOrUpdate(c);
        }
        return true;
    }

    public void populateCustomerFields(Customer c, Map<String, Object> record, String division,
                                        Map<String, NetType> netTypeHash,
                                        Map<String, CostCode> costCodeHash,
                                        Map<String, ExpenseCode> expenseCodeHash) {
        String accountNo = str(record, "accountNo");
        String name = str(record, "masterName", "customerName", "npayName", "ngenName");
        if (name != null) c.setCustomerName(name);
        else if (isBlank(c.getCustomerName())) c.setCustomerName(accountNo); // NOT NULL guard

        setIfPresent(str(record, "customerAddress", "masterAddress", "address"), c::setCustomerAddress);
        setIfPresent(str(record, "mobileNo", "masterMobile", "telephone", "phone"), c::setMobileNo);
        setIfPresent(str(record, "bankCode", "masterBankCode"), c::setBankCode);
        setIfPresent(str(record, "branchCode", "masterBranchCode"), c::setBranchCode);
        setIfPresent(str(record, "bankAccountNo", "masterBankAccountNo"), c::setBankAccountNo);
        setIfPresent(str(record, "refNo", "masterRefNo"), c::setRefNo);
        setIfPresent(str(record, "tariffType", "masterTariffType"), c::setTariffType);

        String solarType = str(record, "masterNetType", "ngenNetType", "npayNetType", "solarType");
        if (solarType != null) {
            c.setSolarType(solarType);
            String cleanSt = solarType.trim().toLowerCase();
            if (netTypeHash != null && netTypeHash.containsKey(cleanSt)) {
                c.setNetType(netTypeHash.get(cleanSt));
            } else {
                netTypeRepository.findByName(solarType.trim()).ifPresent(c::setNetType);
            }
        }

        Double unitRate = dbl(record, "masterUnitRate", "unitRate", "ngenUnitRate");
        if (unitRate != null) c.setUnitRate(unitRate);

        Double panelCapacity = dbl(record, "panelCapacity", "masterPanelCapacity", "masterPanelCap", "capacity");
        if (panelCapacity != null) c.setPanelCapacity(panelCapacity);

        LocalDate agreementDate = date(record, "agreementDate", "masterAgreementDate", "masterAgrDate");
        if (agreementDate != null) c.setAgreementDate(agreementDate);

        String costCode = str(record, "costCode", "masterCostCode", "cost_code");
        if (costCode != null) {
            final String ccTrim = costCode.trim();
            final String ccLower = ccTrim.toLowerCase();
            if (costCodeHash != null && costCodeHash.containsKey(ccLower)) {
                c.setCostCode(costCodeHash.get(ccLower));
            } else {
                costCodeRepository.findByCostCode(ccTrim).ifPresentOrElse(c::setCostCode, () -> {
                    try {
                        costCodeRepository.findById(Long.parseLong(ccTrim)).ifPresent(c::setCostCode);
                    } catch (Exception ignored) {}
                });
            }
        }

        String expCode = str(record, "billingMode", "expenseCode", "lCode", "masterBillingMode", "masterExpenseCode", "masterLCode", "expCode");
        if (expCode == null) {
            expCode = com.ceb.billing.services.ExcelValidationService.deriveLCode(c.getSolarType(), c.getTariffType());
        }
        if (expCode != null) {
            final String cleanEc = expCode.trim();
            final String cleanEcLower = cleanEc.toLowerCase();
            if (expenseCodeHash != null && expenseCodeHash.containsKey(cleanEcLower)) {
                c.setExpenseCode(expenseCodeHash.get(cleanEcLower));
            } else {
                expenseCodeRepository.findByExpCode(cleanEc).ifPresentOrElse(c::setExpenseCode, () -> {
                    try {
                        expenseCodeRepository.findById(Long.parseLong(cleanEc)).ifPresent(c::setExpenseCode);
                    } catch (Exception ignored) {
                        expenseCodeRepository.findAll().stream()
                            .filter(e -> cleanEc.equalsIgnoreCase(e.getExp()) || cleanEc.equalsIgnoreCase(e.getExpCode()))
                            .findFirst()
                            .ifPresent(c::setExpenseCode);
                    }
                });
            }
        }

        String divTag = division;
        if (divTag == null || divTag.trim().isEmpty()) {
            divTag = str(record, "division", "location");
        }
        if (divTag != null && !divTag.trim().isEmpty()) {
            c.setDivision(divTag.trim());
        }

        String status = str(record, "status");
        if ("ERROR".equalsIgnoreCase(status)) {
            c.setValidationStatus("ERROR");
        } else {
            c.setValidationStatus("VALID");
        }
        c.setValidationErrors(joinIssues(record));

        try {
            c.setDirectoryJson(objectMapper.writeValueAsString(record));
        } catch (Exception e) {
            log.warning("CustomerDirectorySync: could not serialise directory record for " + accountNo);
        }
    }

    // ── field helpers ─────────────────────────────────────────────────────────

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
            return LocalDate.parse(s);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private void setIfPresent(String val, java.util.function.Consumer<String> setter) {
        if (val != null) setter.accept(val);
    }

    @SuppressWarnings("unchecked")
    private String joinIssues(Map<String, Object> record) {
        List<String> issues = new ArrayList<>();
        Object errs = record.get("errors");
        if (errs instanceof List) {
            for (Object e : (List<?>) errs) {
                if (e != null) issues.add("ERROR: " + e);
            }
        }
        Object warns = record.get("warnings");
        if (warns instanceof List) {
            for (Object w : (List<?>) warns) {
                if (w != null) issues.add("WARN: " + w);
            }
        }
        return issues.isEmpty() ? null : String.join("; ", issues);
    }
}
