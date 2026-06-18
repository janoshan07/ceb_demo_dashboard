package com.ceb.billing.config;

import com.ceb.billing.entities.BillingRecord;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.User;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.services.AuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BillingRecordRepository billingRecordRepository;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private AuditLogService auditLogService;

    @Override
    public void run(String... args) throws Exception {
        // 1. Seed Users if empty
        if (userRepository.count() == 0) {
            userRepository.save(new User("admin", encoder.encode("admin123"), "ADMIN"));
            userRepository.save(new User("officer", encoder.encode("officer123"), "OFFICER"));
            userRepository.save(new User("viewer", encoder.encode("viewer123"), "USER"));
            
            // Seed a customer user account matching account number 1002345091 for testing the customer portal
            userRepository.save(new User("1002345091", encoder.encode("customer123"), "USER"));
            
            auditLogService.log("DATABASE_INIT", "Default users seeded (admin/admin123, officer/officer123, viewer/viewer123, 1002345091/customer123)");
        }

        // 2. Seed Customers & Bills if empty
        if (customerRepository.count() == 0) {
            Customer c1 = new Customer("1002345091", "Sun Industrial Pvt Ltd", "123 Industrial Zone, Colombo", "0771234567", LocalDate.of(2025, 1, 15), 150.0, "BOC", "032", "7045920", "Net Plus");
            Customer c2 = new Customer("1008761230", "Dilmah Tea Factory", "Peliyagoda, Kandy Road", "0719876543", LocalDate.of(2024, 6, 20), 300.0, "COM", "104", "1209384", "Net Plus Plus");
            Customer c3 = new Customer("2004561001", "Lanka Hospitals Corp", "578 Elvitigala Mawatha, Colombo 5", "0725544332", LocalDate.of(2023, 10, 5), 450.0, "HNB", "001", "4592810", "Net Metering");
            Customer c4 = new Customer("3001204092", "Keells Supermarket Col 3", "45 Galle Road, Colombo 3", "0766543210", LocalDate.of(2025, 3, 10), 80.0, "SAMP", "087", "8876529", "Net Accounting");

            customerRepository.save(c1);
            customerRepository.save(c2);
            customerRepository.save(c3);
            customerRepository.save(c4);

            // April Bills
            billingRecordRepository.save(new BillingRecord(c1, "REF-202604-01", LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), 1200.0, 5600.0, 48.0, "Fixed", null));
            billingRecordRepository.save(new BillingRecord(c2, "REF-202604-02", LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), 800.0, 4200.0, 48.0, "Fixed", null));
            billingRecordRepository.save(new BillingRecord(c3, "REF-202604-03", LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), 4500.0, 3100.0, 52.0, "Variable", null));
            billingRecordRepository.save(new BillingRecord(c4, "REF-202604-04", LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30), 1500.0, 2900.0, 48.0, "Fixed", null));

            // May Bills
            billingRecordRepository.save(new BillingRecord(c1, "REF-202605-01", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), 1150.0, 6100.0, 48.0, "Fixed", null));
            billingRecordRepository.save(new BillingRecord(c2, "REF-202605-02", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), 900.0, 4800.0, 48.0, "Fixed", null));
            billingRecordRepository.save(new BillingRecord(c3, "REF-202605-03", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), 4800.0, 3400.0, 52.0, "Variable", null));
            billingRecordRepository.save(new BillingRecord(c4, "REF-202605-04", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), 1600.0, 3200.0, 48.0, "Fixed", null));

            auditLogService.log("DATABASE_INIT", "Demo customers and billing records seeded");
        }
    }
}
