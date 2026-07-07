package com.ceb.billing.controllers;

import com.ceb.billing.entities.CostCode;
import com.ceb.billing.entities.ExpenseCode;
import com.ceb.billing.entities.NetType;
import com.ceb.billing.repositories.CostCodeRepository;
import com.ceb.billing.repositories.ExpenseCodeRepository;
import com.ceb.billing.repositories.NetTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/lookup")
@PreAuthorize("hasRole('OFFICER') or hasRole('ADMIN')")
public class LookupController {

    @Autowired
    private CostCodeRepository costCodeRepository;

    @Autowired
    private NetTypeRepository netTypeRepository;

    @Autowired
    private ExpenseCodeRepository expenseCodeRepository;

    @GetMapping("/cost-codes")
    public ResponseEntity<List<CostCode>> getCostCodes() {
        return ResponseEntity.ok(costCodeRepository.findAll());
    }

    @GetMapping("/net-types")
    public ResponseEntity<List<NetType>> getNetTypes() {
        return ResponseEntity.ok(netTypeRepository.findAll());
    }

    @GetMapping("/expense-codes")
    public ResponseEntity<List<ExpenseCode>> getExpenseCodes() {
        return ResponseEntity.ok(expenseCodeRepository.findAll());
    }
}
