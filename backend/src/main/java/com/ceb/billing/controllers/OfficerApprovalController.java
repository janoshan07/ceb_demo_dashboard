package com.ceb.billing.controllers;

import com.ceb.billing.entities.ApprovalRequest;
import com.ceb.billing.repositories.ApprovalRequestRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/officer/approvals")
@PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
public class OfficerApprovalController {
    private final ApprovalRequestRepository approvalRequestRepository;

    public OfficerApprovalController(ApprovalRequestRepository approvalRequestRepository) {
        this.approvalRequestRepository = approvalRequestRepository;
    }

    @GetMapping
    public ResponseEntity<List<ApprovalRequest>> getMyApprovalHistory() {
        String actor = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(approvalRequestRepository.findByChangedByOrderByCreatedAtDesc(actor));
    }
}
