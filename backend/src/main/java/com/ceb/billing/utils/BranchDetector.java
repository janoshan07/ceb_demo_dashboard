package com.ceb.billing.utils;

import java.util.Map;

public class BranchDetector {
    
    public static final Map<String, String> PREFIX_TO_BRANCH = Map.of(
        "24", "Ampara",
        "69", "Kalmunai",
        "56", "Valaichenai",
        "32", "Batticaloa",
        "34", "Trincomalee"
    );

    public static final Map<String, String> BRANCH_TO_PREFIX = Map.of(
        "Ampara", "24",
        "Kalmunai", "69",
        "Valaichenai", "56",
        "Batticaloa", "32",
        "Trincomalee", "34"
    );

    public static String detectBranch(String accountNo) {
        if (accountNo == null) {
            return null;
        }
        String clean = accountNo.trim();
        if (clean.length() < 2) {
            return null;
        }
        // If accountNo starts directly with 2 digits
        String prefix = clean.substring(0, 2);
        if (PREFIX_TO_BRANCH.containsKey(prefix)) {
            return PREFIX_TO_BRANCH.get(prefix);
        }
        // In case there are non-digit prefixes like 'CEB-34...', extract first 2 digits
        String digitsOnly = clean.replaceAll("^\\D+", "");
        if (digitsOnly.length() >= 2) {
            String digitPrefix = digitsOnly.substring(0, 2);
            if (PREFIX_TO_BRANCH.containsKey(digitPrefix)) {
                return PREFIX_TO_BRANCH.get(digitPrefix);
            }
        }
        return null;
    }

    public static String canonicalDivision(String div) {
        if (div == null) return "";
        String d = div.trim().toLowerCase();
        if (d.isEmpty() || "null".equals(d) || "—".equals(d) || "-".equals(d)) return "";
        if (d.contains("ampara") || d.equals("24")) return "Ampara";
        if (d.contains("batticaloa") || d.contains("batti") || d.equals("32")) return "Batticaloa";
        if (d.contains("trincomalee") || d.contains("trinco") || d.equals("34")) return "Trincomalee";
        if (d.contains("valaichenai") || d.contains("valai") || d.equals("56")) return "Valaichenai";
        if (d.contains("kalmunai") || d.equals("69")) return "Kalmunai";
        return "";
    }
}

