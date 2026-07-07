package com.ceb.billing.repositories;

import com.ceb.billing.entities.ExpenseCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExpenseCodeRepository extends JpaRepository<ExpenseCode, Long> {
    Optional<ExpenseCode> findByExpCode(String expCode);
}
