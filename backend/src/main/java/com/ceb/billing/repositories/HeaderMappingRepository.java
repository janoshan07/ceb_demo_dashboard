package com.ceb.billing.repositories;

import com.ceb.billing.entities.HeaderMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HeaderMappingRepository extends JpaRepository<HeaderMapping, Long> {
    List<HeaderMapping> findBySheetConfigurationIdAndIsDeletedFalse(Long sheetConfigId);
    List<HeaderMapping> findBySheetConfigurationId(Long sheetConfigId);
}
