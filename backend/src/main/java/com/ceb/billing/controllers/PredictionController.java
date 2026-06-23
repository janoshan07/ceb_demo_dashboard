package com.ceb.billing.controllers;

import com.ceb.billing.services.PredictionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/dashboard/predictions")
public class PredictionController {

    @Autowired
    private PredictionService predictionService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('OFFICER')")
    public ResponseEntity<?> getDashboardPredictions() {
        Map<String, Object> predictions = predictionService.getDashboardPredictions();
        return ResponseEntity.ok(predictions);
    }
}
