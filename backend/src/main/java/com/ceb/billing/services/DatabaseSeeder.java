package com.ceb.billing.services;

import com.ceb.billing.entities.CostCode;
import com.ceb.billing.entities.ExpenseCode;
import com.ceb.billing.entities.NetType;
import com.ceb.billing.repositories.CostCodeRepository;
import com.ceb.billing.repositories.ExpenseCodeRepository;
import com.ceb.billing.repositories.NetTypeRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class DatabaseSeeder {

    @Autowired
    private CostCodeRepository costCodeRepository;

    @Autowired
    private NetTypeRepository netTypeRepository;

    @Autowired
    private ExpenseCodeRepository expenseCodeRepository;

    @PostConstruct
    public void seed() {
        // Seed Cost Codes
        if (costCodeRepository.count() == 0) {
            costCodeRepository.save(new CostCode("461", "Trincomalee"));
            costCodeRepository.save(new CostCode("462", "Batticaloa"));
            costCodeRepository.save(new CostCode("463", "Ampara"));
            costCodeRepository.save(new CostCode("464", "Kalmunai"));
            costCodeRepository.save(new CostCode("465", "Valaichenai"));
        }

        // Seed Net Types
        if (netTypeRepository.count() == 0) {
            netTypeRepository.save(new NetType("Net Metering"));
            netTypeRepository.save(new NetType("Net Accounting"));
            netTypeRepository.save(new NetType("Net Plus"));
            netTypeRepository.save(new NetType("Net Plus Plus"));
        }

        // Seed Expense Codes
        if (expenseCodeRepository.count() == 0) {
            expenseCodeRepository.save(new ExpenseCode("1", "L5001", "Net Accounting (Fixed)"));
            expenseCodeRepository.save(new ExpenseCode("2", "L5002", "Net Plus (Fixed)"));
            expenseCodeRepository.save(new ExpenseCode("3", "L5005", "Net Plus Plus (Fixed)"));
            expenseCodeRepository.save(new ExpenseCode("4", "L5006", "Variable Ordinary Supply"));
            expenseCodeRepository.save(new ExpenseCode("6", "L5007", "Variable Bulk Supply"));
        }
    }
}
