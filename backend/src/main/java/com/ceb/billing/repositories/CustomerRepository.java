package com.ceb.billing.repositories;

import com.ceb.billing.entities.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, String> {
    
    Optional<Customer> findByAccountNo(String accountNo);

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

    /**
     * Unified, null-safe customer search used by the Customer Directory. Any of the three filters
     * may be null to be ignored: free-text query (account no / name), validation status, and
     * location (matched against either the synced division or the auto-derived branch code, so
     * the 5 Eastern Province divisions can be viewed independently). Sorting is supplied via the
     * Pageable.
     */
    @Query("SELECT c FROM Customer c WHERE " +
           "(:query IS NULL OR LOWER(c.accountNo) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.customerName) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "(:status IS NULL OR c.validationStatus = :status) AND " +
           "(:location IS NULL OR " +
           "(c.division IS NOT NULL AND TRIM(c.division) <> '' AND LOWER(TRIM(c.division)) = LOWER(TRIM(:location))) OR " +
           "(c.branchCode IS NOT NULL AND TRIM(c.branchCode) <> '' AND LOWER(TRIM(c.branchCode)) = LOWER(TRIM(:location))) OR " +
           "(LOWER(TRIM(:location)) = 'ampara' AND (c.accountNo LIKE '24%' OR LOWER(TRIM(c.division)) LIKE '%ampara%')) OR " +
           "(LOWER(TRIM(:location)) = 'kalmunai' AND (c.accountNo LIKE '69%' OR LOWER(TRIM(c.division)) LIKE '%kalmunai%')) OR " +
           "(LOWER(TRIM(:location)) = 'valaichenai' AND (c.accountNo LIKE '56%' OR LOWER(TRIM(c.division)) LIKE '%valai%')) OR " +
           "(LOWER(TRIM(:location)) = 'batticaloa' AND (c.accountNo LIKE '32%' OR LOWER(TRIM(c.division)) LIKE '%batti%')) OR " +
           "(LOWER(TRIM(:location)) = 'trincomalee' AND (c.accountNo LIKE '34%' OR LOWER(TRIM(c.division)) LIKE '%trinco%')))")
    Page<Customer> searchCustomersFiltered(@Param("query") String query,
                                           @Param("status") String status,
                                           @Param("location") String location,
                                           Pageable pageable);

    @Query("SELECT c.solarType, COUNT(c) FROM Customer c GROUP BY c.solarType")
    List<Object[]> getSolarTypeDistribution();

    @Query("SELECT DISTINCT c.branchCode FROM Customer c WHERE c.branchCode IS NOT NULL ORDER BY c.branchCode ASC")
    List<String> findDistinctBranchCodes();

    List<Customer> findByCreatedByUploadId(Long createdByUploadId);
}
