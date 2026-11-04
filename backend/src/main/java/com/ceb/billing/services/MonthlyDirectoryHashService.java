package com.ceb.billing.services;

import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * High-Performance In-Memory Hash Index & Cache Service for Monthly Customer Directory.
 *
 * Provides:
 * 1. O(1) constant-time dataset retrieval by snapshot ID (eliminates repeated DB queries
 *    and multi-megabyte Jackson JSON deserialization cycles).
 * 2. O(1) constant-time customer record lookup by Account Number within any monthly snapshot.
 * 3. O(1) snapshot resolution by (Billing Month + Division) hash key.
 * 4. Pre-warmed in-memory hash tables on application startup.
 */
@Service
public class MonthlyDirectoryHashService {

    private static final Logger log = Logger.getLogger(MonthlyDirectoryHashService.class.getName());
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Autowired
    private MonthlyDirectorySnapshotRepository snapshotRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    @Lazy
    private MonthlyDirectoryService monthlyDirectoryService;

    // Primary Hash Index: snapshotId -> Pre-parsed Full Snapshot DTO [O(1) Access]
    private final Map<Long, Map<String, Object>> snapshotHashIndex = new ConcurrentHashMap<>();

    // Secondary Hash Index: snapshotId -> Map<accountNo, recordMap> [O(1) Account Lookup]
    private final Map<Long, Map<String, Map<String, Object>>> recordsByAccountHashIndex = new ConcurrentHashMap<>();

    // Slot Hash Index: "billingMonth|division" (lowercase) -> snapshotId [O(1) Slot Lookup]
    private final Map<String, Long> monthDivisionHashIndex = new ConcurrentHashMap<>();

    private volatile boolean initialized = false;

    @PostConstruct
    public void init() {
        Thread warmUpThread = new Thread(this::rebuildIndex, "Monthly-Directory-Hash-Warmup");
        warmUpThread.setDaemon(true);
        warmUpThread.start();
    }

    /**
     * Rebuilds all hash indices from database snapshots.
     */
    public synchronized void rebuildIndex() {
        long start = System.currentTimeMillis();
        try {
            List<MonthlyDirectorySnapshot> allSnapshots = snapshotRepository.findAllByOrderByCreatedDateDesc();
            Map<Long, Map<String, Object>> tempSnapshots = new HashMap<>();
            Map<Long, Map<String, Map<String, Object>>> tempRecords = new HashMap<>();
            Map<String, Long> tempSlots = new HashMap<>();

            for (MonthlyDirectorySnapshot s : allSnapshots) {
                if (s == null || s.getId() == null) continue;
                try {
                    Map<String, Object> dto = buildSnapshotDto(s);
                    tempSnapshots.put(s.getId(), dto);

                    // Build account hash index for this snapshot
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> recList = (List<Map<String, Object>>) dto.get("records");
                    Map<String, Map<String, Object>> accMap = new HashMap<>();
                    if (recList != null) {
                        for (Map<String, Object> r : recList) {
                            String acc = r.get("accountNo") != null ? String.valueOf(r.get("accountNo")).trim() : "";
                            if (!acc.isEmpty()) {
                                accMap.put(acc, r);
                            }
                        }
                    }
                    tempRecords.put(s.getId(), accMap);

                    // Build Month + Division hash slot key
                    String slotKey = slotKey(s.getBillingMonth(), s.getDivision());
                    if (!slotKey.isEmpty() && !tempSlots.containsKey(slotKey)) {
                        tempSlots.put(slotKey, s.getId());
                    }
                } catch (Exception ex) {
                    log.warning("MonthlyDirectoryHashService: Failed to index snapshot " + s.getId() + ": " + ex.getMessage());
                }
            }

            snapshotHashIndex.clear();
            snapshotHashIndex.putAll(tempSnapshots);

            recordsByAccountHashIndex.clear();
            recordsByAccountHashIndex.putAll(tempRecords);

            monthDivisionHashIndex.clear();
            monthDivisionHashIndex.putAll(tempSlots);

            initialized = true;
            long elapsed = System.currentTimeMillis() - start;
            log.info("Monthly Directory Hash Index built: " + snapshotHashIndex.size() + " snapshots indexed in " + elapsed + "ms.");
        } catch (Exception e) {
            log.warning("MonthlyDirectoryHashService: Rebuild failed: " + e.getMessage());
        }
    }

    /**
     * Checks if a snapshot is present in the hash table.
     */
    public boolean isCached(Long id) {
        return id != null && snapshotHashIndex.containsKey(id);
    }

    /**
     * O(1) constant-time snapshot retrieval from in-memory hash table.
     */
    public Map<String, Object> getSnapshot(Long id) {
        if (id == null) return null;
        Map<String, Object> cached = snapshotHashIndex.get(id);
        if (cached != null) {
            // Return defensive copy of top-level map to prevent accidental external mutation
            return new LinkedHashMap<>(cached);
        }
        return null;
    }

    /**
     * O(1) constant-time customer record lookup by Account Number in a given snapshot.
     */
    
    /**
     * O(1) constant-time retrieval of all records indexed by Account Number for a snapshot.
     */
    public Map<String, Map<String, Object>> getRecordsMap(Long snapshotId) {
        if (snapshotId == null) return null;
        return recordsByAccountHashIndex.get(snapshotId);
    }

    public Map<String, Object> getRecordByAccount(Long snapshotId, String accountNo) {
        if (snapshotId == null || accountNo == null) return null;
        Map<String, Map<String, Object>> accMap = recordsByAccountHashIndex.get(snapshotId);
        if (accMap != null) {
            return accMap.get(accountNo.trim());
        }
        return null;
    }

    /**
     * O(1) lookup of snapshot ID for a given billing month and division.
     */
    public Long getSnapshotIdBySlot(String billingMonth, String division) {
        String key = slotKey(billingMonth, division);
        return monthDivisionHashIndex.get(key);
    }

    /**
     * Registers or updates a snapshot in the in-memory hash indices.
     */
    public void putSnapshot(MonthlyDirectorySnapshot snap,
                            List<Map<String, Object>> records,
                            Map<String, Object> validationSummary,
                            List<Map<String, Object>> auditLog) {
        if (snap == null || snap.getId() == null) return;
        Long id = snap.getId();

        Map<String, Object> dto = toMetadata(snap);
        List<Map<String, Object>> safeRecords = records != null ? new ArrayList<>(records) : new ArrayList<>();
        dto.put("records", safeRecords);
        dto.put("totalRecords", safeRecords.size());
        dto.put("validationSummary", validationSummary != null ? new LinkedHashMap<>(validationSummary) : new LinkedHashMap<>());
        dto.put("auditLog", auditLog != null ? new ArrayList<>(auditLog) : new ArrayList<>());

        snapshotHashIndex.put(id, dto);

        // Update account hash index
        Map<String, Map<String, Object>> accMap = new ConcurrentHashMap<>();
        for (Map<String, Object> r : safeRecords) {
            String acc = r.get("accountNo") != null ? String.valueOf(r.get("accountNo")).trim() : "";
            if (!acc.isEmpty()) {
                accMap.put(acc, r);
            }
        }
        recordsByAccountHashIndex.put(id, accMap);

        // Update slot hash index
        String slotKey = slotKey(snap.getBillingMonth(), snap.getDivision());
        if (!slotKey.isEmpty()) {
            monthDivisionHashIndex.put(slotKey, id);
        }
    }

    /**
     * Updates one record in the cached snapshot in O(1) time.
     */
    public synchronized void updateRecord(Long snapshotId, int recordIndex,
                                          Map<String, Object> updatedRecord,
                                          Map<String, Object> newSummary,
                                          List<Map<String, Object>> newAuditLog) {
        Map<String, Object> cached = snapshotHashIndex.get(snapshotId);
        if (cached == null) return;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) cached.get("records");
        if (records != null && recordIndex >= 0 && recordIndex < records.size()) {
            records.set(recordIndex, updatedRecord);
            cached.put("validationSummary", newSummary);
            cached.put("auditLog", newAuditLog);
            cached.put("totalRecords", records.size());

            // Update account hash index
            String acc = updatedRecord.get("accountNo") != null ? String.valueOf(updatedRecord.get("accountNo")).trim() : "";
            if (!acc.isEmpty()) {
                Map<String, Map<String, Object>> accMap = recordsByAccountHashIndex.get(snapshotId);
                if (accMap != null) {
                    accMap.put(acc, updatedRecord);
                }
            }
        }
    }

    /**
     * Updates snapshot metadata in the hash table.
     */
    public void updateMetadata(Long id, String datasetName, String status, String approvedBy, java.time.LocalDateTime approvalDate) {
        Map<String, Object> cached = snapshotHashIndex.get(id);
        if (cached != null) {
            if (datasetName != null) cached.put("datasetName", datasetName);
            if (status != null) cached.put("status", status);
            if (approvedBy != null) cached.put("approvedBy", approvedBy);
            if (approvalDate != null) cached.put("approvalDate", approvalDate.format(TS));
        }
    }

    /**
     * Evicts a snapshot from all hash tables in O(1) time.
     */
    public void evict(Long id) {
        if (id == null) return;
        Map<String, Object> removed = snapshotHashIndex.remove(id);
        recordsByAccountHashIndex.remove(id);
        if (removed != null) {
            String slotKey = slotKey((String) removed.get("billingMonth"), (String) removed.get("division"));
            if (!slotKey.isEmpty() && id.equals(monthDivisionHashIndex.get(slotKey))) {
                monthDivisionHashIndex.remove(slotKey);
            }
        }
    }

    /**
     * Clears all hash indices.
     */
    public void clear() {
        snapshotHashIndex.clear();
        recordsByAccountHashIndex.clear();
        monthDivisionHashIndex.clear();
    }

    public boolean isReady() {
        return initialized;
    }

    public int size() {
        return snapshotHashIndex.size();
    }

    private String slotKey(String month, String division) {
        String m = month != null ? month.trim().toLowerCase() : "";
        String d = division != null ? division.trim().toLowerCase() : "";
        if (m.isEmpty() || d.isEmpty()) return "";
        return m + "|" + d;
    }

    private Map<String, Object> toMetadata(MonthlyDirectorySnapshot s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("datasetName", s.getDatasetName());
        m.put("billingMonth", s.getBillingMonth());
        m.put("division", s.getDivision());
        m.put("approvalDate", s.getApprovalDate() != null ? s.getApprovalDate().format(TS) : null);
        m.put("createdDate", s.getCreatedDate() != null ? s.getCreatedDate().format(TS) : null);
        m.put("approvedBy", s.getApprovedBy());
        m.put("totalRecords", s.getTotalRecords());
        m.put("status", s.getStatus());
        m.put("sessionId", s.getSessionId());
        return m;
    }

    private Map<String, Object> buildSnapshotDto(MonthlyDirectorySnapshot s) {
        Map<String, Object> out = toMetadata(s);

        List<Map<String, Object>> records = parseJsonArray(s.getFinalDataJson());

        // Filter out rejected records
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> r : records) {
            boolean isRejected = "REJECTED".equalsIgnoreCase(String.valueOf(r.get("status")))
                    || Boolean.TRUE.equals(r.get("rejected"));
            if (!isRejected) {
                filtered.add(r);
            }
        }

        Map<String, Object> summary = parseJsonObject(s.getValidationSummary());
        if (summary.isEmpty() && monthlyDirectoryService != null) {
            summary = monthlyDirectoryService.computeSummaryStats(filtered);
        }

        out.put("records", filtered);
        out.put("totalRecords", filtered.size());
        out.put("validationSummary", summary);
        out.put("auditLog", parseJsonArray(s.getAuditLogJson()));
        return out;
    }

    private List<Map<String, Object>> parseJsonArray(String json) {
        if (json == null || json.trim().isEmpty()) return new ArrayList<>();
        try {
            String trimmed = json.trim();
            if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() > 2) {
                try {
                    Object unwrapped = objectMapper.readValue(trimmed, Object.class);
                    if (unwrapped instanceof String) trimmed = (String) unwrapped;
                } catch (Exception ignored) {}
            }
            return objectMapper.readValue(trimmed, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private Map<String, Object> parseJsonObject(String json) {
        if (json == null || json.trim().isEmpty()) return new LinkedHashMap<>();
        try {
            String trimmed = json.trim();
            if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() > 2) {
                try {
                    Object unwrapped = objectMapper.readValue(trimmed, Object.class);
                    if (unwrapped instanceof String) trimmed = (String) unwrapped;
                } catch (Exception ignored) {}
            }
            return objectMapper.readValue(trimmed, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }
}

