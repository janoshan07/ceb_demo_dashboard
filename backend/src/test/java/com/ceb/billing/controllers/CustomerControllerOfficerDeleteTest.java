package com.ceb.billing.controllers;

import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.ceb.billing.services.AuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerControllerOfficerDeleteTest {

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private BillingRecordRepository billingRecordRepository;

    @Mock
    private ApprovalRequestRepository approvalRequestRepository;

    @Mock
    private MonthlyDirectorySnapshotRepository monthlyDirectorySnapshotRepository;

    @Mock
    private AuditLogService auditLogService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("null")
    @Test
    void snapshotOnlyCustomerCreatesPendingDeletionApproval() throws Exception {
        CustomerController controller = new CustomerController();
        ReflectionTestUtils.setField(controller, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(controller, "billingRecordRepository", billingRecordRepository);
        ReflectionTestUtils.setField(controller, "approvalRequestRepository", approvalRequestRepository);
        ReflectionTestUtils.setField(controller, "monthlyDirectorySnapshotRepository", monthlyDirectorySnapshotRepository);
        ReflectionTestUtils.setField(controller, "auditLogService", auditLogService);
        ReflectionTestUtils.setField(controller, "objectMapper", new ObjectMapper());

        MonthlyDirectorySnapshot snapshot = new MonthlyDirectorySnapshot();
        snapshot.setId(17L);
        snapshot.setFinalDataJson("[{\"accountNo\":\"1234567890\",\"customerName\":\"Snapshot Customer\"}]");
        when(customerRepository.findById("1234567890")).thenReturn(Optional.empty());
        when(monthlyDirectorySnapshotRepository.findAllByOrderByCreatedDateDesc()).thenReturn(List.of(snapshot));
        when(monthlyDirectorySnapshotRepository.findAll()).thenReturn(List.of(snapshot));
        when(billingRecordRepository.countByCustomerAccountNo("1234567890")).thenReturn(0L);
        when(approvalRequestRepository.save(any(ApprovalRequest.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("officer-1", "ignored"));

        ResponseEntity<?> response = controller.officerDeleteCustomer("1234567890");

        assertEquals(200, response.getStatusCode().value());
        assertEquals("PENDING", ((Map<?, ?>) Objects.requireNonNull(response.getBody())).get("status"));
        ArgumentCaptor<ApprovalRequest> requestCaptor = ArgumentCaptor.forClass(ApprovalRequest.class);
        verify(approvalRequestRepository).save(requestCaptor.capture());
        ApprovalRequest request = requestCaptor.getValue();
        assertEquals("DELETE", request.getActionType());
        assertEquals("CUSTOMER", request.getEntityType());
        assertTrue(request.getOldValues().contains("Snapshot Customer"));
        assertTrue(snapshot.getFinalDataJson().contains("\"pendingAdminApproval\":true"));
    }

    @Test
    void missingCustomerReturnsDescriptiveNotFoundResponse() {
        CustomerController controller = new CustomerController();
        ReflectionTestUtils.setField(controller, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(controller, "monthlyDirectorySnapshotRepository", monthlyDirectorySnapshotRepository);
        when(customerRepository.findById("1234567890")).thenReturn(Optional.empty());
        when(monthlyDirectorySnapshotRepository.findAllByOrderByCreatedDateDesc()).thenReturn(List.of());

        ResponseEntity<?> response = controller.officerDeleteCustomer("1234567890");

        assertEquals(404, response.getStatusCode().value());
        assertEquals("Customer account 1234567890 was not found.",
                Objects.requireNonNull((MessageResponse) response.getBody()).getMessage());
    }
}
