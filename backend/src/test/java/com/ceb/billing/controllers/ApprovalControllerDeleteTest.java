package com.ceb.billing.controllers;

import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.entities.MonthlyDirectorySnapshot;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.ceb.billing.services.AuditLogService;
import com.ceb.billing.services.CustomerHashIndexService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApprovalControllerDeleteTest {

    @Mock
    private ApprovalRequestRepository approvalRequestRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private BillingRecordRepository billingRecordRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private MonthlyDirectorySnapshotRepository monthlyDirectorySnapshotRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private CustomerHashIndexService customerHashIndexService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("null")
    @Test
    void approvingSnapshotOnlyCustomerDeletionRemovesTheDirectoryRecord() {
        ApprovalController controller = new ApprovalController();
        ReflectionTestUtils.setField(controller, "approvalRequestRepository", approvalRequestRepository);
        ReflectionTestUtils.setField(controller, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(controller, "billingRecordRepository", billingRecordRepository);
        ReflectionTestUtils.setField(controller, "auditLogService", auditLogService);
        ReflectionTestUtils.setField(controller, "monthlyDirectorySnapshotRepository", monthlyDirectorySnapshotRepository);
        ReflectionTestUtils.setField(controller, "eventPublisher", eventPublisher);
        ReflectionTestUtils.setField(controller, "customerHashIndexService", customerHashIndexService);

        ApprovalRequest request = new ApprovalRequest(
                null, "1234567890", "officer-1", "{\"customerName\":\"Snapshot Customer\"}",
                "{}", "PENDING", "DELETE", "CUSTOMER");
        request.setRequestId(24L);
        MonthlyDirectorySnapshot snapshot = new MonthlyDirectorySnapshot();
        snapshot.setId(17L);
        snapshot.setTotalRecords(2);
        snapshot.setFinalDataJson("[{\"accountNo\":\"1234567890\"},{\"accountNo\":\"0987654321\"}]");
        when(approvalRequestRepository.findById(24L)).thenReturn(Optional.of(request));
        when(customerRepository.findById("1234567890")).thenReturn(Optional.empty());
        when(monthlyDirectorySnapshotRepository.findAll()).thenReturn(List.of(snapshot));
        when(approvalRequestRepository.save(any(ApprovalRequest.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin-1", "ignored"));

        ResponseEntity<?> response = controller.approveRequest(24L);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("APPROVED", request.getStatus());
        assertFalse(snapshot.getFinalDataJson().contains("1234567890"));
        assertEquals(1, snapshot.getTotalRecords());
        verify(monthlyDirectorySnapshotRepository).save(snapshot);
        verify(customerHashIndexService).evict("1234567890");
    }
}
