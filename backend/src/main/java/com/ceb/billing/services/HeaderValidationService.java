package com.ceb.billing.services;

import com.ceb.billing.entities.HeaderMapping;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class HeaderValidationService {

    public Map<String, Object> validateHeaders(String sheetName, List<String> actualHeaders, List<HeaderMapping> expectedMappings) {
        List<Map<String, Object>> logs = new ArrayList<>();
        boolean pass = true;

        // Clean headers mapping
        Map<String, Integer> actualCleanMap = new HashMap<>();
        List<String> duplicates = new ArrayList<>();
        Set<String> seenHeaders = new HashSet<>();
        
        for (int i = 0; i < actualHeaders.size(); i++) {
            String rawHeader = actualHeaders.get(i);
            if (rawHeader == null || rawHeader.trim().isEmpty()) {
                Map<String, Object> log = new HashMap<>();
                log.put("type", "HEADER_EMPTY");
                log.put("severity", "WARNING");
                log.put("details", "Sheet '" + sheetName + "' column " + (i + 1) + " has an empty or blank header.");
                logs.add(log);
                continue;
            }

            String clean = cleanHeaderString(rawHeader);
            if (!seenHeaders.add(clean)) {
                duplicates.add(rawHeader);
            }
            actualCleanMap.put(clean, i);
        }

        // Log duplicate columns
        for (String dup : duplicates) {
            pass = false;
            Map<String, Object> log = new HashMap<>();
            log.put("type", "HEADER_DUPLICATE");
            log.put("severity", "ERROR");
            log.put("details", "Sheet '" + sheetName + "' contains duplicate column header: '" + dup + "'");
            logs.add(log);
        }

        // Match expected mappings
        for (HeaderMapping mapping : expectedMappings) {
            String targetHeader = mapping.getHeaderName();
            String cleanTarget = cleanHeaderString(targetHeader);
            
            // Check mapping compatibility
            boolean found = false;
            // Let's support synonyms or exact clean matches
            if (actualCleanMap.containsKey(cleanTarget)) {
                found = true;
                mapping.setMappedColumnIndex(actualCleanMap.get(cleanTarget));
            } else {
                // Try alias fallback mapping checks
                for (Map.Entry<String, Integer> entry : actualCleanMap.entrySet()) {
                    if (isAliasMatch(cleanTarget, entry.getKey())) {
                        found = true;
                        mapping.setMappedColumnIndex(entry.getValue());
                        break;
                    }
                }
            }

            if (!found && mapping.getIsRequired()) {
                pass = false;
                Map<String, Object> log = new HashMap<>();
                log.put("type", "HEADER_MISSING");
                log.put("severity", "ERROR");
                log.put("details", "Sheet '" + sheetName + "' is missing required column: '" + targetHeader + "'");
                logs.add(log);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", pass ? "PASS" : "FAIL");
        response.put("logs", logs);
        return response;
    }

    private String cleanHeaderString(String raw) {
        if (raw == null) return "";
        return raw.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private boolean isAliasMatch(String cleanTarget, String cleanActual) {
        // Look up both inside FIELD_ALIASES to check if they map to the same logical field
        for (Map.Entry<String, List<String>> entry : com.ceb.billing.services.PreviewService.FIELD_ALIASES.entrySet()) {
            boolean targetMatched = false;
            boolean actualMatched = false;
            for (String alias : entry.getValue()) {
                String cleanAlias = alias.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (cleanTarget.equals(cleanAlias)) targetMatched = true;
                if (cleanActual.equals(cleanAlias)) actualMatched = true;
            }
            if (targetMatched && actualMatched) return true;
        }

        // Fallback substring compatibility checks
        if (cleanTarget.contains(cleanActual) || cleanActual.contains(cleanTarget)) {
            return true;
        }
        return false;
    }
}
