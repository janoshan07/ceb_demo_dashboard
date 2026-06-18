package com.ceb.billing.repositories;

import com.ceb.billing.entities.BillingRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface BillingRecordRepository extends JpaRepository<BillingRecord, Long> {
    
    List<BillingRecord> findByCustomerAccountNoOrderByFromDateDesc(String accountNo);

    List<BillingRecord> findByCustomerAccountNoOrderByFromDateAsc(String accountNo);

    Optional<BillingRecord> findByCustomerAccountNoAndRefNoAndFromDateAndToDate(
        String accountNo, String refNo, LocalDate fromDate, LocalDate toDate
    );

    @Query("SELECT b FROM BillingRecord b WHERE b.customer.accountNo = ?1 AND YEAR(b.fromDate) = ?2 AND MONTH(b.fromDate) = ?3")
    Optional<BillingRecord> findByCustomerAccountNoAndFromDateYearAndMonth(String accountNo, int year, int month);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0.0) FROM BillingRecord b")
    Double sumTotalAmount();

    @Query("SELECT COALESCE(SUM(b.importUnits), 0.0) FROM BillingRecord b")
    Double sumTotalImports();

    @Query("SELECT COALESCE(SUM(b.exportUnits), 0.0) FROM BillingRecord b")
    Double sumTotalExports();

    // Top 5 highest exporters
    List<BillingRecord> findTop5ByOrderByExportUnitsDesc();

    // Top 5 highest importers
    List<BillingRecord> findTop5ByOrderByImportUnitsDesc();

    // Group billing revenue and imports/exports by Year and Month
    @Query("SELECT YEAR(b.fromDate) as yr, MONTH(b.fromDate) as mo, " +
           "COALESCE(SUM(b.totalAmount), 0.0) as rev, " +
           "COALESCE(SUM(b.importUnits), 0.0) as imp, " +
           "COALESCE(SUM(b.exportUnits), 0.0) as exp " +
           "FROM BillingRecord b " +
           "GROUP BY YEAR(b.fromDate), MONTH(b.fromDate) " +
           "ORDER BY yr DESC, mo DESC")
    List<Object[]> getMonthlyRevenueReport();
}
