package com.ceb.billing.repositories;

import com.ceb.billing.entities.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, String> {
    
    Page<Customer> findByAccountNoContainingOrCustomerNameContainingIgnoreCase(
        String accountNo, String customerName, Pageable pageable
    );

    @Query("SELECT c FROM Customer c WHERE " +
           "(:query IS NULL OR LOWER(c.accountNo) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.customerName) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Customer> searchCustomers(@Param("query") String query, Pageable pageable);

    Page<Customer> findByValidationStatus(String validationStatus, Pageable pageable);

    @Query("SELECT c FROM Customer c WHERE c.validationStatus = :validationStatus AND " +
           "(:query IS NULL OR LOWER(c.accountNo) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.customerName) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Customer> searchCustomersWithStatus(@Param("query") String query, @Param("validationStatus") String validationStatus, Pageable pageable);

    @Query("SELECT c.solarType, COUNT(c) FROM Customer c GROUP BY c.solarType")
    List<Object[]> getSolarTypeDistribution();

    @Query("SELECT DISTINCT c.branchCode FROM Customer c WHERE c.branchCode IS NOT NULL ORDER BY c.branchCode ASC")
    List<String> findDistinctBranchCodes();

    List<Customer> findByCreatedByUploadId(Long createdByUploadId);
}
