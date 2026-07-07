package com.ceb.billing.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "expense_codes")
public class ExpenseCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String exp;

    @Column(name = "exp_code", nullable = false, unique = true, length = 50)
    private String expCode;

    @Column(nullable = false, length = 255)
    private String description;

    public ExpenseCode() {
    }

    public ExpenseCode(String exp, String expCode, String description) {
        this.exp = exp;
        this.expCode = expCode;
        this.description = description;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getExp() {
        return exp;
    }

    public void setExp(String exp) {
        this.exp = exp;
    }

    public String getExpCode() {
        return expCode;
    }

    public void setExpCode(String expCode) {
        this.expCode = expCode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
