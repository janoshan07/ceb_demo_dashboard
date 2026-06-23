package com.ceb.billing.repositories;

import com.ceb.billing.entities.ExcelTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExcelTemplateRepository extends JpaRepository<ExcelTemplate, Long> {
    List<ExcelTemplate> findByIsDeletedFalse();
    Optional<ExcelTemplate> findByTemplateNameAndIsDeletedFalse(String templateName);
}
