package com.ceb.billing.utils;

import java.util.Map;

public class BranchDetector {
    
    private static final Map<String, String> PREFIX_TO_BRANCH = Map.of(
        "24", "Ampara",
        "69", "Kalmunai",
        "56", "Valaichenai",
        "32", "Batticaloa",
        "34", "Trincomalee"
    );

    public static String detectBranch(String accountNo) {
        if (accountNo == null || accountNo.length() < 2) {
            return null;
        }
        String prefix = accountNo.substring(0, 2);
        return PREFIX_TO_BRANCH.get(prefix);
    }
}
