package com.ceb.billing.services;

import com.ceb.billing.entities.ExcelTemplate;
import com.ceb.billing.entities.HeaderMapping;
import com.ceb.billing.entities.SheetConfiguration;
import com.ceb.billing.repositories.ExcelTemplateRepository;
import com.ceb.billing.repositories.HeaderMappingRepository;
import com.ceb.billing.repositories.SheetConfigurationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
public class ImportTemplateSeedService {

    @Autowired
    private ExcelTemplateRepository excelTemplateRepository;

    @Autowired
    private SheetConfigurationRepository sheetConfigurationRepository;

    @Autowired
    private HeaderMappingRepository headerMappingRepository;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedDefaultTemplate() {
        // If there are already active templates, skip seeding
        if (excelTemplateRepository.count() > 0) {
            return;
        }

        // 1. Create Default Template
        ExcelTemplate template = new ExcelTemplate("CEB Standard Billing Template",
                "Default template containing Customer_Master profile details and Billing_Records monthly consumption values.");
        template = excelTemplateRepository.save(template);

        // 2. Create Sheet Configurations
        
        // Sheet A: Customer_Master
        SheetConfiguration customerSheet = new SheetConfiguration(template, "Customer_Master", true, false);
        customerSheet = sheetConfigurationRepository.save(customerSheet);
        
        // Sheet B: Billing_Records
        SheetConfiguration billingSheet = new SheetConfiguration(template, "Billing_Records", true, false);
        billingSheet = sheetConfigurationRepository.save(billingSheet);
        
        // Sheet C: Summary (Ignored)
        SheetConfiguration summarySheet = new SheetConfiguration(template, "Summary", false, true);
        sheetConfigurationRepository.save(summarySheet);

        // 3. Create Header Mappings for Customer_Master
        List<String> customerHeaders = Arrays.asList(
                "Account No", "Customer Name", "Customer Address", "Mobile No",
                "Agreement Date", "Panel Capacity", "Solar Type", "Bank Code",
                "Branch Code", "Bank Account No"
        );
        for (String header : customerHeaders) {
            // Account No and Customer Name are required
            boolean isRequired = header.equals("Account No") || header.equals("Customer Name");
            HeaderMapping hm = new HeaderMapping(customerSheet, header, null, isRequired);
            headerMappingRepository.save(hm);
        }

        // 4. Create Header Mappings for Billing_Records
        List<String> billingHeaders = Arrays.asList(
                "Account No", "Ref No", "From Date", "To Date",
                "Imports", "Exports", "Unit Cost", "Billing Mode", "Total Amount"
        );
        for (String header : billingHeaders) {
            // Account No, From Date, To Date, Imports, Exports, Unit Cost are required
            boolean isRequired = header.equals("Account No") || header.equals("From Date") 
                    || header.equals("To Date") || header.equals("Imports") 
                    || header.equals("Exports") || header.equals("Unit Cost");
            HeaderMapping hm = new HeaderMapping(billingSheet, header, null, isRequired);
            headerMappingRepository.save(hm);
        }
        
        System.out.println("CEB Billing Dashboard: Successfully seeded default 'CEB Standard Billing Template' configurations.");
    }
}
