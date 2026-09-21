package com.ceb.billing.config;

import com.ceb.billing.entities.User;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.services.AuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

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
            userRepository.save(new User("admin", encoder.encode("admin123"), "ADMIN", "+94771234567"));
            userRepository.save(new User("officer", encoder.encode("officer123"), "OFFICER", "+94772345678"));
            userRepository.save(new User("viewer", encoder.encode("viewer123"), "USER", "+94773456789"));
            
            // Seed a customer user account matching account number 3202345091 for testing the customer portal
            userRepository.save(new User("3202345091", encoder.encode("customer123"), "USER", "+94774567890"));
            
            auditLogService.log("DATABASE_INIT", "Default users seeded with phone numbers (admin/admin123, officer/officer123, viewer/viewer123, 3202345091/customer123)");
        } else {
            // Backfill default phone numbers for existing seeded users if phone_number is missing
            userRepository.findByUsername("admin").ifPresent(u -> {
                if (u.getPhoneNumber() == null || u.getPhoneNumber().trim().isEmpty()) {
                    u.setPhoneNumber("+94771234567");
                    userRepository.save(u);
                }
            });
            userRepository.findByUsername("officer").ifPresent(u -> {
                if (u.getPhoneNumber() == null || u.getPhoneNumber().trim().isEmpty()) {
                    u.setPhoneNumber("+94772345678");
                    userRepository.save(u);
                }
            });
            userRepository.findByUsername("viewer").ifPresent(u -> {
                if (u.getPhoneNumber() == null || u.getPhoneNumber().trim().isEmpty()) {
                    u.setPhoneNumber("+94773456789");
                    userRepository.save(u);
                }
            });
            userRepository.findByUsername("3202345091").ifPresent(u -> {
                if (u.getPhoneNumber() == null || u.getPhoneNumber().trim().isEmpty()) {
                    u.setPhoneNumber("+94774567890");
                    userRepository.save(u);
                }
            });
        }

        // 2. Clear pre-existing demo/sample customers & billing records so Customer Directory starts clean.
        // Records will populate automatically when new data is uploaded and approved by Admin.
        if (customerRepository.count() > 0) {
            billingRecordRepository.deleteAll();
            customerRepository.deleteAll();
            auditLogService.log("DATABASE_INIT", "Cleared pre-existing customers and billing records for clean Customer Directory.");
        }
    }
}
