package com.ceb.billing.services;

import com.ceb.billing.entities.Customer;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.CostCodeRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.ExpenseCodeRepository;
import com.ceb.billing.repositories.NetTypeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerDirectorySyncDistinctTest {

    @Mock private CustomerRepository customerRepository;
    @Mock private CostCodeRepository costCodeRepository;
    @Mock private NetTypeRepository netTypeRepository;
    @Mock private ExpenseCodeRepository expenseCodeRepository;

    @Test
    @SuppressWarnings("null")
    void strictSyncPersistsOneCustomerForNormalizedDuplicateAccounts() {
        CustomerDirectorySyncService service = service();
        AtomicReference<List<Customer>> savedCustomers = new AtomicReference<>();
        doAnswer(invocation -> {
            List<Customer> saved = new java.util.ArrayList<>();
            Object argument = invocation.getArgument(0);
            if (argument instanceof Iterable<?> rows) {
                for (Object row : rows) {
                    if (row instanceof Customer customer) saved.add(customer);
                }
            }
            savedCustomers.set(saved);
            return saved;
        }).when(customerRepository).<Customer>saveAll(any());
        MonthlyDirectorySnapshot snapshot = snapshot(
                "[{\"accountNo\":\" 100 \",\"customerName\":\"Customer A\"},"
                        + "{\"accountNo\":\"100\",\"customerAddress\":\"Address A\"}]");

        assertEquals(1, service.syncSnapshotStrict(snapshot));

        verify(customerRepository).<Customer>saveAll(any());
        List<Customer> customers = savedCustomers.get();
        assertEquals(1, customers.size());
        assertEquals("100", customers.get(0).getAccountNo());
        assertEquals("Address A", customers.get(0).getCustomerAddress());
    }

    @Test
    @SuppressWarnings("null")
    void strictSyncRejectsRowsWithoutAccountBeforeSavingAnyCustomer() {
        CustomerDirectorySyncService service = service();
        MonthlyDirectorySnapshot snapshot = snapshot("[{\"customerName\":\"No account\"}]");

        assertThrows(IllegalStateException.class, () -> service.syncSnapshotStrict(snapshot));

        verify(customerRepository, never()).saveAll(any());
    }

    private CustomerDirectorySyncService service() {
        CustomerDirectorySyncService service = new CustomerDirectorySyncService();
        ReflectionTestUtils.setField(service, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(service, "costCodeRepository", costCodeRepository);
        ReflectionTestUtils.setField(service, "netTypeRepository", netTypeRepository);
        ReflectionTestUtils.setField(service, "expenseCodeRepository", expenseCodeRepository);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        when(costCodeRepository.findAll()).thenReturn(List.of());
        when(netTypeRepository.findAll()).thenReturn(List.of());
        when(expenseCodeRepository.findAll()).thenReturn(List.of());
        return service;
    }

    private MonthlyDirectorySnapshot snapshot(String data) {
        MonthlyDirectorySnapshot snapshot = new MonthlyDirectorySnapshot();
        snapshot.setId(12L);
        snapshot.setStatus("PENDING_APPROVAL");
        snapshot.setDivision("Kalmunai");
        snapshot.setBillingMonth("August 2026");
        snapshot.setFinalDataJson(data);
        return snapshot;
    }

}
