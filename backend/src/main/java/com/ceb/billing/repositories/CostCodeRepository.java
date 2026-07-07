package com.ceb.billing.repositories;

import com.ceb.billing.entities.CostCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CostCodeRepository extends JpaRepository<CostCode, Long> {
    Optional<CostCode> findByCostCode(String costCode);
}
