package com.ceb.billing.repositories;

import com.ceb.billing.entities.BillingRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import jakarta.transaction.Transactional;
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

    @Transactional
    void deleteByUploadHistoryId(Long uploadHistoryId);

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

    @Query("SELECT YEAR(b.fromDate) as yr, MONTH(b.fromDate) as mo, " +
           "COALESCE(SUM(b.totalAmount), 0.0) as rev, " +
           "COALESCE(SUM(b.importUnits), 0.0) as imp, " +
           "COALESCE(SUM(b.exportUnits), 0.0) as exp, " +
           "COALESCE(SUM(b.netUnit), 0.0) as net " +
           "FROM BillingRecord b " +
           "GROUP BY YEAR(b.fromDate), MONTH(b.fromDate) " +
           "ORDER BY yr ASC, mo ASC")
    List<Object[]> getMonthlyAnalyticsReport();

    @Query(value = "SELECT b.account_no, c.customer_name, COALESCE(SUM(b.export_units), 0.0) as totalExport " +
                  "FROM billing_records b JOIN customers c ON b.account_no = c.account_no " +
                  "GROUP BY b.account_no, c.customer_name " +
                  "ORDER BY totalExport DESC LIMIT 10", nativeQuery = true)
    List<Object[]> getTop10SolarExporters();

    @Query(value = "SELECT b.account_no, c.customer_name, COALESCE(SUM(b.import_units), 0.0) as totalImport " +
                  "FROM billing_records b JOIN customers c ON b.account_no = c.account_no " +
                  "GROUP BY b.account_no, c.customer_name " +
                  "ORDER BY totalImport DESC LIMIT 10", nativeQuery = true)
    List<Object[]> getTop10ImportConsumers();

    @Query(value = "SELECT c.branch_code, COUNT(DISTINCT c.account_no) as customerCount, " +
                  "COALESCE(SUM(b.import_units), 0.0) as totalImports, " +
                  "COALESCE(SUM(b.export_units), 0.0) as totalExports, " +
                  "COALESCE(SUM(b.total_amount), 0.0) as totalRevenue " +
                  "FROM customers c " +
                  "LEFT JOIN billing_records b ON c.account_no = b.account_no " +
                  "GROUP BY c.branch_code " +
                  "ORDER BY totalRevenue DESC", nativeQuery = true)
    List<Object[]> getBranchWiseAnalytics();

    long countByCustomerAccountNo(String accountNo);
}
