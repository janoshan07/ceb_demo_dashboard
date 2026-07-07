package com.ceb.billing.repositories;

import com.ceb.billing.entities.NetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NetTypeRepository extends JpaRepository<NetType, Long> {
    Optional<NetType> findByName(String name);
}
