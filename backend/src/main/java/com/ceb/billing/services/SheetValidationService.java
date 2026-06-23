package com.ceb.billing.services;

import com.ceb.billing.entities.SheetConfiguration;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SheetValidationService {

    public Map<String, Object> validateSheets(List<String> actualSheetNames, List<SheetConfiguration> expectedConfigs) {
        List<Map<String, Object>> logs = new ArrayList<>();
        boolean pass = true;

        // Check duplicates in uploaded file
        Set<String> seenActual = new HashSet<>();
        Set<String> duplicateActual = new HashSet<>();
        for (String name : actualSheetNames) {
            if (!seenActual.add(name)) {
                duplicateActual.add(name);
            }
        }

        for (String dup : duplicateActual) {
            pass = false;
            Map<String, Object> log = new HashMap<>();
            log.put("type", "SHEET_DUPLICATE");
            log.put("severity", "ERROR");
            log.put("details", "Duplicate sheet found in Excel workbook: '" + dup + "'");
            logs.add(log);
        }

        // Map configs by sheet name for fast lookup
        Map<String, SheetConfiguration> configMap = new HashMap<>();
        for (SheetConfiguration config : expectedConfigs) {
            configMap.put(config.getSheetName().trim().toLowerCase(), config);
        }

        // Check missing required sheets
        for (SheetConfiguration config : expectedConfigs) {
            if (config.getIsRequired() && !config.getIsIgnored()) {
                boolean found = false;
                for (String name : actualSheetNames) {
                    if (name.trim().equalsIgnoreCase(config.getSheetName().trim())) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    pass = false;
                    Map<String, Object> log = new HashMap<>();
                    log.put("type", "SHEET_MISSING");
                    log.put("severity", "ERROR");
                    log.put("details", "Required sheet is missing: '" + config.getSheetName() + "'");
                    logs.add(log);
                }
            }
        }

        // Check extra unwanted sheets
        for (String name : actualSheetNames) {
            String key = name.trim().toLowerCase();
            SheetConfiguration config = configMap.get(key);
            if (config == null) {
                // Extra sheet warning
                Map<String, Object> log = new HashMap<>();
                log.put("type", "SHEET_EXTRA");
                log.put("severity", "WARNING");
                log.put("details", "Extra/unwanted sheet detected in Excel: '" + name + "'. It will be ignored from processing.");
                logs.add(log);
            } else if (config.getIsIgnored()) {
                // Ignored sheet info
                Map<String, Object> log = new HashMap<>();
                log.put("type", "SHEET_IGNORED");
                log.put("severity", "INFO");
                log.put("details", "Sheet '" + name + "' is marked as ignored in template settings and will be skipped.");
                logs.add(log);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", pass ? "PASS" : "FAIL");
        response.put("logs", logs);
        return response;
    }
}
