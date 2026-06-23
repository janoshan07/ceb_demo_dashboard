package com.ceb.billing.repositories;

import com.ceb.billing.entities.SheetConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SheetConfigurationRepository extends JpaRepository<SheetConfiguration, Long> {
    List<SheetConfiguration> findByTemplateIdAndIsDeletedFalse(Long templateId);
    List<SheetConfiguration> findByTemplateId(Long templateId);
}
