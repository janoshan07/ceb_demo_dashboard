package com.ceb.billing.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "cost_codes")
public class CostCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cost_code", nullable = false, unique = true, length = 50)
    private String costCode;

    @Column(name = "area_name", nullable = false, length = 100)
    private String areaName;

    public CostCode() {
    }

    public CostCode(String costCode, String areaName) {
        this.costCode = costCode;
        this.areaName = areaName;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCostCode() {
        return costCode;
    }

    public void setCostCode(String costCode) {
        this.costCode = costCode;
    }

    public String getAreaName() {
        return areaName;
    }

    public void setAreaName(String areaName) {
        this.areaName = areaName;
    }
}
