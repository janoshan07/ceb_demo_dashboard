package com.ceb.billing.controllers;

import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.entities.Customer;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import com.ceb.billing.repositories.BillingRecordRepository;
import com.ceb.billing.repositories.CustomerRepository;
import com.ceb.billing.repositories.MonthlyDirectorySnapshotRepository;
import com.ceb.billing.security.OfficerStepUpInterceptor;
import com.ceb.billing.security.OfficerStepUpResult;
import com.ceb.billing.services.AuditLogService;
import com.ceb.billing.services.CustomerHashIndexService;
import com.ceb.billing.services.OfficerStepUpService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNotNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CustomerDeleteStepUpFlowTest {

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

    @Mock
    private OfficerStepUpService officerStepUpService;

    @Mock
    private CustomerHashIndexService customerHashIndexService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("null")
    @Test
    void validAdminPasswordQueuesOfficerDeleteAndAdminApprovalDeletesCustomer() throws Exception {
        CustomerController customerController = new CustomerController();
        ReflectionTestUtils.setField(customerController, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(customerController, "billingRecordRepository", billingRecordRepository);
        ReflectionTestUtils.setField(customerController, "approvalRequestRepository", approvalRequestRepository);
        ReflectionTestUtils.setField(customerController, "monthlyDirectorySnapshotRepository", monthlyDirectorySnapshotRepository);
        ReflectionTestUtils.setField(customerController, "auditLogService", auditLogService);
        ReflectionTestUtils.setField(customerController, "objectMapper", new ObjectMapper());

        OfficerStepUpInterceptor interceptor = new OfficerStepUpInterceptor();
        ReflectionTestUtils.setField(interceptor, "officerStepUpService", officerStepUpService);
        ReflectionTestUtils.setField(interceptor, "objectMapper", new ObjectMapper());
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(customerController)
                .addInterceptors(interceptor)
                .build();

        Customer customer = new Customer();
        customer.setAccountNo("1234567890");
        when(officerStepUpService.verify("officer-1", "valid-admin-password",
                "CUSTOMER_DELETE_REQUEST", "1234567890")).thenReturn(OfficerStepUpResult.VERIFIED);
        when(customerRepository.findById("1234567890")).thenReturn(Optional.of(customer));
        when(billingRecordRepository.countByCustomerAccountNo("1234567890")).thenReturn(0L);
        when(monthlyDirectorySnapshotRepository.findAll()).thenReturn(List.of());
        when(approvalRequestRepository.save(any(ApprovalRequest.class)))
                .thenAnswer(invocation -> java.util.Objects.requireNonNull(invocation.getArgument(0)));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("officer-1", null,
                        List.of(new SimpleGrantedAuthority("ROLE_OFFICER"))));

        mockMvc.perform(delete("/api/officer/customers/1234567890")
                        .with(java.util.Objects.requireNonNull(officerRequest()))
                        .header("X-Admin-Password", "valid-admin-password"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        verify(officerStepUpService).verify("officer-1", "valid-admin-password",
                "CUSTOMER_DELETE_REQUEST", "1234567890");
        verify(customerRepository, never()).delete(isNotNull());

        ArgumentCaptor<ApprovalRequest> requestCaptor = ArgumentCaptor.forClass(ApprovalRequest.class);
        verify(approvalRequestRepository).save(requestCaptor.capture());
        ApprovalRequest request = java.util.Objects.requireNonNull(requestCaptor.getValue());
        request.setRequestId(501L);
        when(approvalRequestRepository.findByIdForUpdate(501L)).thenReturn(Optional.of(request));

        ApprovalController approvalController = new ApprovalController();
        ReflectionTestUtils.setField(approvalController, "approvalRequestRepository", approvalRequestRepository);
        ReflectionTestUtils.setField(approvalController, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(approvalController, "billingRecordRepository", billingRecordRepository);
        ReflectionTestUtils.setField(approvalController, "auditLogService", auditLogService);
        ReflectionTestUtils.setField(approvalController, "monthlyDirectorySnapshotRepository", monthlyDirectorySnapshotRepository);
        ReflectionTestUtils.setField(approvalController, "customerHashIndexService", customerHashIndexService);
        ReflectionTestUtils.setField(approvalController, "eventPublisher", eventPublisher);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin-1", null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        ResponseEntity<?> approvalResponse = approvalController.approveRequest(501L);

        assertEquals(200, approvalResponse.getStatusCode().value());
        assertEquals("APPROVED", request.getStatus());
        verify(customerRepository).delete(customer);
    }

    @SuppressWarnings("null")
    @Test
    void invalidAdminPasswordBlocksOfficerDeleteBeforeCreatingRequest() throws Exception {
        CustomerController customerController = new CustomerController();
        OfficerStepUpInterceptor interceptor = new OfficerStepUpInterceptor();
        ReflectionTestUtils.setField(interceptor, "officerStepUpService", officerStepUpService);
        ReflectionTestUtils.setField(interceptor, "objectMapper", new ObjectMapper());
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(customerController)
                .addInterceptors(interceptor)
                .build();
        when(officerStepUpService.verify("officer-1", "wrong-password",
                "CUSTOMER_DELETE_REQUEST", "1234567890")).thenReturn(OfficerStepUpResult.INVALID);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("officer-1", null,
                        List.of(new SimpleGrantedAuthority("ROLE_OFFICER"))));

        mockMvc.perform(delete("/api/officer/customers/1234567890")
                        .with(java.util.Objects.requireNonNull(officerRequest()))
                        .header("X-Admin-Password", "wrong-password"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_PASSWORD_INVALID"));

        verify(approvalRequestRepository, never()).save(isNotNull());
        verify(customerRepository, never()).delete(isNotNull());
    }

    @NonNull
    private RequestPostProcessor officerRequest() {
        return request -> {
            request.addUserRole("OFFICER");
            request.setUserPrincipal(new UsernamePasswordAuthenticationToken(
                    "officer-1", null, List.of(new SimpleGrantedAuthority("ROLE_OFFICER"))));
            return request;
        };
    }
}
