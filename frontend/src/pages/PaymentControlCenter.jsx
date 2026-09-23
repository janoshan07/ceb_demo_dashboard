import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Send,
  Layers,
  FileCheck2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Lock,
  Unlock,
  AlertCircle,
  Calendar,
  Building,
  User,
  Zap,
  FileText,
  SlidersHorizontal,
  X,
  Check,
  Wrench,
  Sparkles,
  ArrowRight
} from 'lucide-react';

const DIVISIONS = ['ALL', 'Ampara', 'Batticaloa', 'Trincomalee', 'Valaichenai', 'Kalmunai'];

const formatLKR = (val) => {
  if (val == null || isNaN(val)) return '—';
  return 'LKR ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const PaymentControlCenter = () => {
  const navigate = useNavigate();
  const { user, authFetch } = useAuth();
  const { showToast, showConfirm, showPrompt } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  // ── Filters & Navigation State ─────────────────────────────────────
  const [billingPeriod, setBillingPeriod] = useState('ALL');
  const [division, setDivision] = useState('ALL');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, READY, ON_HOLD, REVIEW, BATCHES, HISTORY
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [validationFilter, setValidationFilter] = useState('ALL');
  const [holdReasonFilter, setHoldReasonFilter] = useState('ALL');
  const [netTypeFilter, setNetTypeFilter] = useState('ALL');
  const [multiPaymentFilter, setMultiPaymentFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [searchFocused, setSearchFocused] = useState(false);

  // ── Canonical Data State ───────────────────────────────────────────
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    customerCount: 0,
    totalPaymentRecords: 0,
    multiPaymentCount: 0,
    multiPaymentCustomersCount: 0,
    paymentReadyCount: 0,
    onHoldCount: 0,
    reviewCount: 0,
    totalPayable: 0,
    totalOnHold: 0
  });

  const [customersData, setCustomersData] = useState({
    content: [],
    totalElements: 0,
    totalPages: 1
  });

  const [batches, setBatches] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);

  // ── UI / Selection State ───────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());

  const toggleExpandCustomer = (accNo) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(accNo)) next.delete(accNo);
      else next.add(accNo);
      return next;
    });
  };

  const expandAllCustomers = () => {
    setExpandedCustomers(new Set(customersData.content.map(c => c.accountNo)));
  };

  const collapseAllCustomers = () => {
    setExpandedCustomers(new Set());
  };

  // ── Modals & Drawer State ──────────────────────────────────────────
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview'); // overview, mismatches, checklist, resolve
  const [correctionForm, setCorrectionForm] = useState({});
  const [batchReviewModalOpen, setBatchReviewModalOpen] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
  const [batchDetailsModalOpen, setBatchDetailsModalOpen] = useState(false);
  const [summaryModalCard, setSummaryModalCard] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  // ── 1. Load Canonical Summary (Invariant under table filters) ───────
  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (billingPeriod && billingPeriod !== 'ALL') params.append('billingPeriod', billingPeriod);
      if (division && division !== 'ALL') params.append('division', division);

      const res = await authFetch(`/api/payments/summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load canonical summary:', err);
    }
  }, [billingPeriod, division, authFetch]);

  // ── 2. Load Customers Table (Paginated & Server-filtered) ───────────
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (billingPeriod && billingPeriod !== 'ALL') params.append('billingPeriod', billingPeriod);
      if (division && division !== 'ALL') params.append('division', division);

      // Tab mapping to category filter
      if (activeTab === 'READY') {
        params.append('category', 'READY');
      } else if (activeTab === 'ON_HOLD') {
        params.append('category', 'ON_HOLD');
      } else if (activeTab === 'REVIEW') {
        params.append('category', 'REVIEW');
      } else if (statusFilter !== 'ALL') {
        params.append('category', statusFilter);
      }

      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (holdReasonFilter !== 'ALL') params.append('holdReason', holdReasonFilter);
      if (validationFilter !== 'ALL') params.append('validationStatus', validationFilter);
      if (netTypeFilter !== 'ALL') params.append('netType', netTypeFilter);
      if (multiPaymentFilter) params.append('multiPaymentOnly', 'true');
      params.append('page', currentPage);
      params.append('size', pageSize);

      const res = await authFetch(`/api/payments/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomersData(data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, [billingPeriod, division, activeTab, statusFilter, searchQuery, holdReasonFilter, validationFilter, netTypeFilter, multiPaymentFilter, currentPage, pageSize, authFetch]);

  // ── 3. Load Batches ────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    try {
      const res = await authFetch('/api/payments/batches');
      if (res.ok) {
        const data = await res.json();
        setBatches(data || []);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  }, [authFetch]);

  // ── 4. Load History ────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch('/api/payments/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data || []);
      }
    } catch (err) {
      console.error('Failed to load payment history:', err);
    }
  }, [authFetch]);

  // ── 5. Load Available Billing Months ───────────────────────────────
  useEffect(() => {
    const loadMonths = async () => {
      try {
        let res = await authFetch('/api/payments/months');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setAvailableMonths(list.map(m => typeof m === 'string' ? m : (m.billingMonth || m.name)).filter(Boolean));
            return;
          }
        }
        res = await authFetch('/api/officer/monthly-directory/months');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            setAvailableMonths(list.map(m => m.billingMonth || m.name).filter(Boolean));
          }
        }
      } catch (e) {
        console.error('Failed to load months:', e);
      }
    };
    loadMonths();
  }, [authFetch]);

  // React to filter changes
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === 'BATCHES') {
      fetchBatches();
    } else if (activeTab === 'HISTORY') {
      fetchHistory();
    } else {
      fetchCustomers();
    }
  }, [activeTab, fetchCustomers, fetchBatches, fetchHistory]);

  const handleRefresh = () => {
    fetchSummary();
    if (activeTab === 'BATCHES') fetchBatches();
    else if (activeTab === 'HISTORY') fetchHistory();
    else fetchCustomers();
  };

  const handleResetFilters = () => {
    setBillingPeriod('ALL');
    setDivision('ALL');
    setActiveTab('ALL');
    setStatusFilter('ALL');
    setValidationFilter('ALL');
    setHoldReasonFilter('ALL');
    setNetTypeFilter('ALL');
    setMultiPaymentFilter(false);
    setSearchQuery('');
    setCurrentPage(0);
  };

  // ── Selection for Batch (Only READY records permitted) ─────────────
  const toggleSelectRecord = (recordKey, isEligible, accNo) => {
    if (!isEligible) {
      showToast(`Record ${accNo || recordKey} cannot be selected: Only PAYMENT READY records can enter a payment batch.`, 'warning');
      return;
    }
    const next = new Set(selectedRecords);
    if (next.has(recordKey)) next.delete(recordKey);
    else next.add(recordKey);
    setSelectedRecords(next);
  };

  const toggleSelectCustomer = (customer) => {
    const pList = Array.isArray(customer.payments) && customer.payments.length > 0 ? customer.payments : [customer];
    const readyPayments = pList.filter(p => p.paymentStatus === 'READY' || p.isEligible);
    if (readyPayments.length === 0) {
      showToast(`Customer ${customer.accountNo} has no PAYMENT READY records to select.`, 'warning');
      return;
    }
    const next = new Set(selectedRecords);
    const allSelected = readyPayments.every(p => next.has(p.recordKey || p.accountNo));
    if (allSelected) {
      readyPayments.forEach(p => next.delete(p.recordKey || p.accountNo));
      showToast(`Deselected all records for customer ${customer.accountNo}`);
    } else {
      readyPayments.forEach(p => next.add(p.recordKey || p.accountNo));
      showToast(`Selected ${readyPayments.length} ready record(s) for customer ${customer.accountNo}`);
    }
    setSelectedRecords(next);
  };

  const selectCustomerAllRecords = (accountNo) => {
    const cust = customersData.content.find(c => c.accountNo === accountNo);
    if (!cust) return;
    toggleSelectCustomer(cust);
  };

  const selectAllEligibleVisible = () => {
    const allReadyPayments = [];
    customersData.content.forEach(c => {
      const pList = Array.isArray(c.payments) && c.payments.length > 0 ? c.payments : [c];
      pList.forEach(p => {
        if (p.paymentStatus === 'READY' || p.isEligible) {
          allReadyPayments.push(p);
        }
      });
    });

    if (allReadyPayments.length === 0) {
      showToast('No PAYMENT READY records available on this page to select.', 'warning');
      return;
    }
    const allSelected = allReadyPayments.every(p => selectedRecords.has(p.recordKey || p.accountNo));
    const next = new Set(selectedRecords);
    if (allSelected) {
      allReadyPayments.forEach(p => next.delete(p.recordKey || p.accountNo));
    } else {
      allReadyPayments.forEach(p => next.add(p.recordKey || p.accountNo));
    }
    setSelectedRecords(next);
  };

  // ── Release All Payments for Customer (Preserving Individual Records) ───
  const handleReleaseCustomerPayments = async (accountNo) => {
    const confirmed = await showConfirm({
      title: 'Approve Accumulated Obligations',
      message: `Release all payment holds and approve accumulated payment obligations for customer ${accountNo}?`,
      confirmText: 'Release All Holds',
      cancelText: 'Cancel',
      type: 'confirm'
    });
    if (!confirmed) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/payments/customers/${accountNo}/release-all`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Customer ${accountNo} payments released successfully!`);
        fetchSummary();
        fetchCustomers();
      } else {
        showToast(data.message || 'Release failed', 'error');
      }
    } catch (e) {
      showToast('Release error: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Test Case 12345 One-Click Seeder ────────────────────────────────
  const handleSeedTestCase = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch('/api/payments/test-case/seed-12345', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Test Case 12345 seeded successfully with 3 monthly payments!');
        fetchSummary();
        fetchCustomers();
      } else {
        showToast(data.message || 'Failed seeding test case', 'error');
      }
    } catch (e) {
      showToast('Seed error: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Open Detail Drawer / Modal ─────────────────────────────────────
  const openCustomerDetails = async (accountNo, rowBillingMonth, initialTab = 'overview', recordKey = null) => {
    setActionLoading(true);
    try {
      const bp = rowBillingMonth || billingPeriod;
      const params = new URLSearchParams();
      if (bp && bp !== 'ALL') params.append('billingPeriod', bp);
      if (recordKey) params.append('recordKey', recordKey);
      const res = await authFetch(`/api/payments/customers/${accountNo}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCustomerDetails(data);
        const rec = data.record || {};
        setCorrectionForm({
          customerName: rec.customerName || rec.masterName || '',
          bankAccountNo: rec.bankAccountNo || rec.masterBankAccountNo || '',
          bankCode: rec.bankCode || rec.masterBankCode || '',
          branchCode: rec.branchCode || rec.masterBranchCode || '',
          solarType: rec.solarType || rec.masterNetType || '',
          unitRate: rec.unitRate || rec.masterUnitRate || ''
        });
        setDrawerTab(initialTab);
        setDetailsModalOpen(true);
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to open customer details', 'error');
      }
    } catch (e) {
      showToast('Error fetching customer details: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Save Staging Correction & Auto Re-validate ─────────────────────
  const handleSaveCorrection = async () => {
    if (!selectedCustomerDetails) return;
    setActionLoading(true);
    try {
      const acc = selectedCustomerDetails.record?.accountNo || selectedCustomerDetails.customerInfo?.accountNumber;
      const bp = selectedCustomerDetails.billingInfo?.billingMonth || billingPeriod;
      const rk = selectedCustomerDetails.recordKey || selectedCustomerDetails.record?.recordKey;
      const params = new URLSearchParams();
      if (bp && bp !== 'ALL') params.append('billingPeriod', bp);

      const res = await authFetch(`/api/payments/customers/${acc}/correct?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctionForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Correction saved and re-validated successfully!', data.newStatus === 'READY' ? 'success' : 'warning');
        openCustomerDetails(acc, bp, 'overview', rk);
        fetchSummary();
        fetchCustomers();
      } else {
        showToast(data.message || 'Correction failed', 'error');
      }
    } catch (e) {
      showToast('Correction error: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Toggle Manual Payment Hold ─────────────────────────────────────
  const handleToggleHold = async (accountNo, currentHold, rowBillingMonth, recordKey = null) => {
    let reason = null;
    if (!currentHold) {
      reason = await showPrompt({
        title: 'Place Customer on Payment Hold',
        message: `Specify reason for placing account #${accountNo} on payment hold:`,
        placeholder: 'e.g. Disputed energy units, master data mismatch...',
        confirmText: 'Activate Hold',
        cancelText: 'Cancel',
        type: 'warning',
        required: false
      });
      if (reason === null) return;
    }

    setActionLoading(true);
    try {
      const bp = rowBillingMonth || billingPeriod;
      const params = new URLSearchParams();
      if (bp && bp !== 'ALL') params.append('billingPeriod', bp);
      params.append('hold', String(!currentHold));
      if (reason) params.append('reason', reason);

      const res = await authFetch(`/api/payments/customers/${accountNo}/toggle-hold?${params.toString()}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Payment hold ${!currentHold ? 'activated' : 'released'} for ${accountNo}.`);
        fetchSummary();
        fetchCustomers();
        if (detailsModalOpen) openCustomerDetails(accountNo, bp, drawerTab, recordKey);
      } else {
        showToast(data.message || 'Action failed', 'error');
      }
    } catch (e) {
      showToast('Toggle hold error: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Create Payment Batch (Strict Backend & Frontend Verification) ──
  const handleCreateBatch = async () => {
    setActionLoading(true);
    try {
      const allPayments = [];
      customersData.content.forEach(c => {
        const pList = Array.isArray(c.payments) && c.payments.length > 0 ? c.payments : [c];
        pList.forEach(p => {
          allPayments.push({ ...p, accountNo: c.accountNo });
        });
      });

      const selectedRows = allPayments.filter(c =>
        selectedRecords.has(c.recordKey || c.accountNo) && (c.paymentStatus === 'READY' || c.isEligible)
      );

      if (selectedRows.length === 0) {
        showToast('Cannot create batch: Zero eligible READY records selected.', 'error');
        setActionLoading(false);
        return;
      }

      const readyAccounts = Array.from(new Set(selectedRows.map(c => c.accountNo)));
      const readyRecordKeys = selectedRows.map(c => c.recordKey).filter(Boolean);

      const res = await authFetch('/api/payments/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: billingPeriod !== 'ALL' ? billingPeriod : (availableMonths[0] || 'Current Period'),
          division: division !== 'ALL' ? division : 'ALL',
          accountNos: readyAccounts,
          recordKeys: readyRecordKeys
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Payment Batch ${data.batchNumber} successfully created with ${data.customerCount || selectedRows.length} payment records!`);
        setSelectedRecords(new Set());
        setBatchReviewModalOpen(false);
        fetchSummary();
        setActiveTab('BATCHES');
      } else {
        showToast(data.message || 'Batch creation failed', 'error');
      }
    } catch (e) {
      showToast('Batch error: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Batch Transitions ──────────────────────────────────────────────
  const handleBatchTransition = async (batchId, action) => {
    let reason = null;
    if (action === 'REJECT') {
      reason = await showPrompt({
        title: 'Reject Payment Batch',
        message: 'Provide supervisory rejection reason for this payment batch:',
        placeholder: 'e.g. Discrepancy in batch total or pending verification...',
        confirmText: 'Reject Batch',
        cancelText: 'Cancel',
        type: 'danger',
        required: true
      });
      if (reason === null) return;
    }

    setActionLoading(true);
    try {
      const res = await authFetch(`/api/payments/batches/${batchId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Batch transitioned to ${data.status} successfully.`);
        fetchBatches();
        if (batchDetailsModalOpen) openBatchDetails(batchId);
      } else {
        showToast(data.message || 'Action failed', 'error');
      }
    } catch (e) {
      showToast('Transition error: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openBatchDetails = async (batchId) => {
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/payments/batches/${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedBatchDetails(data);
        setBatchDetailsModalOpen(true);
      } else {
        showToast('Failed to load batch details', 'error');
      }
    } catch (e) {
      showToast('Error loading batch: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculations for selected items in Ready table
  const selectedFinancials = useMemo(() => {
    const allPayments = [];
    customersData.content.forEach(c => {
      const pList = Array.isArray(c.payments) && c.payments.length > 0 ? c.payments : [c];
      pList.forEach(p => {
        allPayments.push({ ...p, accountNo: c.accountNo });
      });
    });

    const selRows = allPayments.filter(c => selectedRecords.has(c.recordKey || c.accountNo));
    const eligibleRows = selRows.filter(c => c.paymentStatus === 'READY' || c.isEligible);
    const onHoldRows = selRows.filter(c => c.paymentStatus !== 'READY' && !c.isEligible);

    const totals = eligibleRows.reduce((acc, row) => {
      acc.currentPayment += Number(row.currentPayment || 0);
      acc.outstandingBalance += Number(row.outstandingBalance || 0);
      acc.billSetOff += Number(row.billSetOff || 0);
      acc.retentionMoney += Number(row.retentionMoney || 0);
      acc.totalPayable += Number(row.totalPayable || 0);
      return acc;
    }, { currentPayment: 0, outstandingBalance: 0, billSetOff: 0, retentionMoney: 0, totalPayable: 0 });

    return {
      eligibleCount: eligibleRows.length,
      onHoldCount: onHoldRows.length,
      onHoldAccounts: onHoldRows.map(r => r.accountNo),
      ...totals
    };
  }, [customersData.content, selectedRecords]);

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.75rem 2rem' }}>
      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
            }}>
              <CreditCard size={22} style={{ color: '#10b981' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Payment Control Center
              </h1>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Central Enterprise Payment Verification, Month-Wise Settlement & Batch Approval Console
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleRefresh}
            className="btn"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={15} className={loading || actionLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleSeedTestCase}
            disabled={loading || actionLoading}
            title="Seed Test Case: Customer 12345 with 3 monthly payment obligations (Jan Hold 10k, Feb Hold 12k, Mar Ready 15k)"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(99, 102, 241, 0.25))',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              color: '#d8b4fe',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            <Sparkles size={15} />
            <span>Seed Test Case (12345)</span>
          </button>

          <button
            onClick={() => setBatchReviewModalOpen(true)}
            disabled={selectedRecords.size === 0}
            className="btn"
            style={{
              background: selectedRecords.size > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
              border: 'none',
              color: selectedRecords.size > 0 ? '#fff' : 'var(--text-muted)',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              cursor: selectedRecords.size > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: '0.88rem',
              boxShadow: selectedRecords.size > 0 ? '0 4px 14px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Send size={16} />
            <span>Create Payment Batch ({selectedRecords.size})</span>
          </button>
        </div>
      </div>

      {/* ── 1. CANONICAL SUMMARY CARDS (6 CARDS IN EXACT ORDER) ──────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        {/* Card 1: Total Customers */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSummaryModalCard('TOTAL_CUSTOMERS')}
          onMouseEnter={() => setHoveredCard('TOTAL_CUSTOMERS')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            background: hoveredCard === 'TOTAL_CUSTOMERS'
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(17, 24, 39, 0.95))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(17, 24, 39, 0.8))',
            border: hoveredCard === 'TOTAL_CUSTOMERS' ? '1px solid rgba(59, 130, 246, 0.65)' : '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            cursor: 'pointer',
            transform: hoveredCard === 'TOTAL_CUSTOMERS' ? 'translateY(-3px)' : 'none',
            boxShadow: hoveredCard === 'TOTAL_CUSTOMERS' ? '0 10px 24px -4px rgba(59, 130, 246, 0.28)' : 'none',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Customers
              </span>
              <User size={18} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
              {(summary.totalCustomers || summary.customerCount || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total canonical producers</span>
            <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: hoveredCard === 'TOTAL_CUSTOMERS' ? 1 : 0.65 }}>
              Details <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 2: Payment Ready */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSummaryModalCard('PAYMENT_READY')}
          onMouseEnter={() => setHoveredCard('PAYMENT_READY')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            background: hoveredCard === 'PAYMENT_READY'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(17, 24, 39, 0.95))'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(17, 24, 39, 0.8))',
            border: hoveredCard === 'PAYMENT_READY' ? '1px solid rgba(16, 185, 129, 0.65)' : '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            cursor: 'pointer',
            transform: hoveredCard === 'PAYMENT_READY' ? 'translateY(-3px)' : 'none',
            boxShadow: hoveredCard === 'PAYMENT_READY' ? '0 10px 24px -4px rgba(16, 185, 129, 0.28)' : 'none',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Payment Ready
              </span>
              <CheckCircle2 size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
              {(summary.paymentReadyCount || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified eligible for disbursement</span>
            <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: hoveredCard === 'PAYMENT_READY' ? 1 : 0.65 }}>
              Details <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 3: Payment On Hold */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSummaryModalCard('PAYMENT_ON_HOLD')}
          onMouseEnter={() => setHoveredCard('PAYMENT_ON_HOLD')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            background: hoveredCard === 'PAYMENT_ON_HOLD'
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(17, 24, 39, 0.95))'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(17, 24, 39, 0.8))',
            border: hoveredCard === 'PAYMENT_ON_HOLD' ? '1px solid rgba(245, 158, 11, 0.65)' : '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            cursor: 'pointer',
            transform: hoveredCard === 'PAYMENT_ON_HOLD' ? 'translateY(-3px)' : 'none',
            boxShadow: hoveredCard === 'PAYMENT_ON_HOLD' ? '0 10px 24px -4px rgba(245, 158, 11, 0.28)' : 'none',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Payment On Hold
              </span>
              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
              {(summary.onHoldCount || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Withheld by blocking validations</span>
            <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: hoveredCard === 'PAYMENT_ON_HOLD' ? 1 : 0.65 }}>
              Details <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 4: Requires Review */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSummaryModalCard('REQUIRES_REVIEW')}
          onMouseEnter={() => setHoveredCard('REQUIRES_REVIEW')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            background: hoveredCard === 'REQUIRES_REVIEW'
              ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.22), rgba(17, 24, 39, 0.95))'
              : 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(17, 24, 39, 0.8))',
            border: hoveredCard === 'REQUIRES_REVIEW' ? '1px solid rgba(168, 85, 247, 0.65)' : '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            cursor: 'pointer',
            transform: hoveredCard === 'REQUIRES_REVIEW' ? 'translateY(-3px)' : 'none',
            boxShadow: hoveredCard === 'REQUIRES_REVIEW' ? '0 10px 24px -4px rgba(168, 85, 247, 0.28)' : 'none',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Requires Review
              </span>
              <Clock size={18} style={{ color: '#a855f7' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
              {(summary.reviewCount || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Duplicate / audit flag</span>
            <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: hoveredCard === 'REQUIRES_REVIEW' ? 1 : 0.65 }}>
              Details <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 5: Total Payable */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSummaryModalCard('TOTAL_PAYABLE')}
          onMouseEnter={() => setHoveredCard('TOTAL_PAYABLE')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            background: hoveredCard === 'TOTAL_PAYABLE'
              ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.22), rgba(17, 24, 39, 0.95))'
              : 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(17, 24, 39, 0.8))',
            border: hoveredCard === 'TOTAL_PAYABLE' ? '1px solid rgba(6, 182, 212, 0.65)' : '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            cursor: 'pointer',
            transform: hoveredCard === 'TOTAL_PAYABLE' ? 'translateY(-3px)' : 'none',
            boxShadow: hoveredCard === 'TOTAL_PAYABLE' ? '0 10px 24px -4px rgba(6, 182, 212, 0.28)' : 'none',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Payable
              </span>
              <DollarSign size={18} style={{ color: '#06b6d4' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatLKR(summary.totalPayable)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ready settlement balance</span>
            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: hoveredCard === 'TOTAL_PAYABLE' ? 1 : 0.65 }}>
              Details <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 6: Total On Hold */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSummaryModalCard('TOTAL_ON_HOLD')}
          onMouseEnter={() => setHoveredCard('TOTAL_ON_HOLD')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            background: hoveredCard === 'TOTAL_ON_HOLD'
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(17, 24, 39, 0.95))'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(17, 24, 39, 0.8))',
            border: hoveredCard === 'TOTAL_ON_HOLD' ? '1px solid rgba(239, 68, 68, 0.65)' : '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            cursor: 'pointer',
            transform: hoveredCard === 'TOTAL_ON_HOLD' ? 'translateY(-3px)' : 'none',
            boxShadow: hoveredCard === 'TOTAL_ON_HOLD' ? '0 10px 24px -4px rgba(239, 68, 68, 0.28)' : 'none',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total On Hold
              </span>
              <Lock size={18} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatLKR(summary.totalOnHold)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending resolution</span>
            <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: hoveredCard === 'TOTAL_ON_HOLD' ? 1 : 0.65 }}>
              Details <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 7: Multi-Payment Customers */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSummaryModalCard('MULTI_PAYMENTS')}
          onMouseEnter={() => setHoveredCard('MULTI_PAYMENTS')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            background: hoveredCard === 'MULTI_PAYMENTS'
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(17, 24, 39, 0.95))'
              : (multiPaymentFilter
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(17, 24, 39, 0.9))'
                  : 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(17, 24, 39, 0.8))'),
            border: hoveredCard === 'MULTI_PAYMENTS' || multiPaymentFilter ? '1px solid rgba(99, 102, 241, 0.75)' : '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem 1.35rem',
            cursor: 'pointer',
            transform: hoveredCard === 'MULTI_PAYMENTS' ? 'translateY(-3px)' : 'none',
            boxShadow: hoveredCard === 'MULTI_PAYMENTS' || multiPaymentFilter ? '0 10px 24px -4px rgba(99, 102, 241, 0.35)' : 'none',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Multi-Payments
              </span>
              <Layers size={18} style={{ color: '#818cf8' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
              {(summary.multiPaymentCustomersCount || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600 }}>
              {(summary.multiPaymentCount || 0).toLocaleString()} records
            </span>
            <span style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: hoveredCard === 'MULTI_PAYMENTS' ? 1 : 0.65 }}>
              Details <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. FILTER BAR & DIVISION CONTROLS ─────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        {/* Upper Filter Row: Month, Division, Search */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          {/* Billing Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={17} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Billing Month:</span>
            <select
              value={billingPeriod}
              onChange={(e) => { setBillingPeriod(e.target.value); setCurrentPage(0); }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Approved Months</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Division Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto' }}>
            <Building size={16} style={{ color: 'var(--text-secondary)', marginRight: '0.2rem' }} />
            {DIVISIONS.map(div => (
              <button
                key={div}
                onClick={() => { setDivision(div); setCurrentPage(0); }}
                style={{
                  background: division === div ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  border: division === div ? '1px solid var(--primary)' : '1px solid transparent',
                  color: division === div ? '#60a5fa' : 'var(--text-secondary)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: division === div ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {div}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div
            className="pcc-search-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: searchFocused ? 'rgba(15, 23, 42, 0.95)' : 'var(--bg-card)',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              border: searchFocused ? '1.5px solid #22d3ee' : '1px solid var(--border-color)',
              boxShadow: searchFocused
                ? '0 0 16px rgba(34, 211, 238, 0.4), inset 0 0 8px rgba(34, 211, 238, 0.1)'
                : 'none',
              minWidth: '280px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Search
              size={16}
              className="pcc-search-icon"
              style={{
                color: searchFocused ? '#22d3ee' : 'var(--text-muted)',
                marginRight: '0.5rem',
                filter: searchFocused ? 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.6))' : 'none',
                transition: 'all 0.25s ease'
              }}
            />
            <input
              type="text"
              className="search-bar-input-override pcc-search-input"
              placeholder="Search Account No or Customer Name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                width: '100%',
                padding: 0
              }}
            />
            {searchQuery && (
              <X
                size={14}
                style={{
                  color: searchFocused ? '#22d3ee' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease'
                }}
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>
        </div>

        {/* Lower Filter Row: Detailed Criteria Filters */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filters:</span>
          </div>

          {/* Payment Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Payment:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(0); }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="READY">READY</option>
              <option value="ON_HOLD">ON HOLD</option>
              <option value="REVIEW">REVIEW</option>
              <option value="PAID">PAID</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          {/* Validation Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Validation:</span>
            <select
              value={validationFilter}
              onChange={(e) => { setValidationFilter(e.target.value); setCurrentPage(0); }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="ALL">All Validation Statuses</option>
              <option value="VALID">VALID</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          {/* Hold Reason Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hold Reason:</span>
            <select
              value={holdReasonFilter}
              onChange={(e) => { setHoldReasonFilter(e.target.value); setCurrentPage(0); }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="ALL">All Hold Reasons</option>
              <option value="Name Mismatch">Name Mismatch</option>
              <option value="Missing Information">Missing Information</option>
              <option value="Invalid Bank Details">Invalid Bank Details</option>
              <option value="Unit Rate Mismatch">Unit Rate Mismatch</option>
              <option value="Net Type Mismatch">Net Type Mismatch</option>
              <option value="Payment Mismatch">Payment Mismatch</option>
              <option value="Payment Hold Active">Payment Hold Active</option>
              <option value="No Billing Data">No Billing Data</option>
            </select>
          </div>

          {/* Net Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net Type:</span>
            <select
              value={netTypeFilter}
              onChange={(e) => { setNetTypeFilter(e.target.value); setCurrentPage(0); }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="ALL">All Net Types</option>
              <option value="Net Plus">Net Plus</option>
              <option value="Net Plus Plus">Net Plus Plus</option>
              <option value="Net Metering">Net Metering</option>
              <option value="Net Accounting">Net Accounting</option>
            </select>
          </div>

          {/* Multi-Payment Customers Filter Toggle */}
          <button
            onClick={() => { setMultiPaymentFilter(!multiPaymentFilter); setCurrentPage(0); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: multiPaymentFilter ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-card)',
              border: multiPaymentFilter ? '1.5px solid #818cf8' : '1px solid var(--border-color)',
              color: multiPaymentFilter ? '#a5b4fc' : 'var(--text-secondary)',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: multiPaymentFilter ? 700 : 500,
              cursor: 'pointer',
              boxShadow: multiPaymentFilter ? '0 0 12px rgba(99, 102, 241, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
            title="Show only customers with multiple payment records (e.g. released hold payments + current cycle)"
          >
            <Layers size={14} style={{ color: multiPaymentFilter ? '#818cf8' : 'var(--text-muted)' }} />
            <span>Multi-Payment ({summary.multiPaymentCustomersCount || 0} Customers • {summary.multiPaymentCount || 0} Records)</span>
            {multiPaymentFilter && <Check size={12} style={{ color: '#818cf8' }} />}
          </button>

          {/* Reset Filters button */}
          <button
            onClick={handleResetFilters}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              textDecoration: 'underline',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            Reset All Filters
          </button>
        </div>
      </div>

      {/* ── 3. WORKFLOW TABS ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.5rem',
        paddingBottom: '0.5rem',
        overflowX: 'auto'
      }}>
        {/* Tab 1: ALL */}
        <button
          onClick={() => { setActiveTab('ALL'); setCurrentPage(0); }}
          style={{
            background: activeTab === 'ALL' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: activeTab === 'ALL' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
            color: activeTab === 'ALL' ? '#60a5fa' : 'var(--text-secondary)',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <User size={15} />
          <span>All Records ({summary.totalCustomers || summary.customerCount || 0})</span>
        </button>

        {/* Tab 2: READY */}
        <button
          onClick={() => { setActiveTab('READY'); setCurrentPage(0); }}
          style={{
            background: activeTab === 'READY' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            border: activeTab === 'READY' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
            color: activeTab === 'READY' ? '#10b981' : 'var(--text-secondary)',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <CheckCircle2 size={15} />
          <span>Payment Ready ({summary.paymentReadyCount})</span>
        </button>

        {/* Tab 3: ON_HOLD */}
        <button
          onClick={() => { setActiveTab('ON_HOLD'); setCurrentPage(0); }}
          style={{
            background: activeTab === 'ON_HOLD' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            border: activeTab === 'ON_HOLD' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
            color: activeTab === 'ON_HOLD' ? '#f59e0b' : 'var(--text-secondary)',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <AlertTriangle size={15} />
          <span>On Hold ({summary.onHoldCount})</span>
        </button>

        {/* Tab 4: REVIEW */}
        <button
          onClick={() => { setActiveTab('REVIEW'); setCurrentPage(0); }}
          style={{
            background: activeTab === 'REVIEW' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
            border: activeTab === 'REVIEW' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
            color: activeTab === 'REVIEW' ? '#c084fc' : 'var(--text-secondary)',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Clock size={15} />
          <span>Requires Review ({summary.reviewCount})</span>
        </button>

        {/* Tab 5: BATCHES */}
        <button
          onClick={() => { setActiveTab('BATCHES'); setSelectedRecords(new Set()); }}
          style={{
            background: activeTab === 'BATCHES' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: activeTab === 'BATCHES' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
            color: activeTab === 'BATCHES' ? '#3b82f6' : 'var(--text-secondary)',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={15} />
          <span>Payment Batches ({batches.length})</span>
        </button>

        {/* Tab 6: HISTORY */}
        <button
          onClick={() => { setActiveTab('HISTORY'); setSelectedRecords(new Set()); }}
          style={{
            background: activeTab === 'HISTORY' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            border: activeTab === 'HISTORY' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
            color: activeTab === 'HISTORY' ? '#10b981' : 'var(--text-secondary)',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <FileCheck2 size={15} />
          <span>Payment History</span>
        </button>
      </div>

      {/* ── 4. MAIN DATA TABLE (ALL, READY, ON_HOLD, REVIEW) ──────────── */}
      {activeTab !== 'BATCHES' && activeTab !== 'HISTORY' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          {/* Table Header Controls */}
          <div style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span>
                Showing {customersData.content.length > 0 ? (currentPage * pageSize + 1) : 0} to{' '}
                {Math.min((currentPage + 1) * pageSize, customersData.totalElements)} of {customersData.totalElements} customers
                {customersData.totalPaymentRecords ? ` • ${customersData.totalPaymentRecords} total payment obligations across months` : ''}
              </span>
              {selectedRecords.size > 0 && (
                <span style={{ color: '#10b981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                  {selectedRecords.size} payment obligation(s) selected for batch
                </span>
              )}
            </div>

            {/* Quick Actions in Table Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={expandAllCustomers}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Expand All
              </button>
              <button
                onClick={collapseAllCustomers}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Collapse All
              </button>
              {activeTab === 'READY' && selectedRecords.size > 0 && (
                <button
                  onClick={() => setBatchReviewModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Send size={13} />
                  <span>Create Batch ({selectedRecords.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.85rem 0.75rem', width: '38px' }}>
                    <input
                      type="checkbox"
                      checked={
                        customersData.content.length > 0 &&
                        customersData.content.some(c => (c.payments || [c]).some(p => p.paymentStatus === 'READY' || p.isEligible)) &&
                        customersData.content.every(c => {
                          const readyP = (c.payments || [c]).filter(p => p.paymentStatus === 'READY' || p.isEligible);
                          return readyP.length === 0 || readyP.every(p => selectedRecords.has(p.recordKey || p.accountNo));
                        })
                      }
                      onChange={selectAllEligibleVisible}
                      title="Select all PAYMENT READY records on this page"
                      style={{ cursor: 'pointer', accentColor: '#10b981' }}
                    />
                  </th>
                  <th style={{ padding: '0.85rem 0.4rem', width: '32px' }}></th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Account No</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Customer Name</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Net Type</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Obligations</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Customer Status</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>Total Pending</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>Ready Amount</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>On Hold Amount</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>Total Payable</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
                      <div style={{ fontWeight: 600 }}>Loading customer-level payment records...</div>
                    </td>
                  </tr>
                ) : customersData.content.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <HelpCircle size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No Customer Payment Records Found</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
                        No records match the chosen month, division, or filter criteria. Try selecting "All Approved Months" or resetting filters.
                      </div>
                    </td>
                  </tr>
                ) : (
                  customersData.content.map((row, idx) => {
                    const isExpanded = expandedCustomers.has(row.accountNo);
                    const pList = Array.isArray(row.payments) && row.payments.length > 0 ? row.payments : [row];
                    const readyPayments = pList.filter(p => p.paymentStatus === 'READY' || p.isEligible);
                    const hasReady = readyPayments.length > 0;
                    const isFullySelected = hasReady && readyPayments.every(p => selectedRecords.has(p.recordKey || p.accountNo));
                    const isPartiallySelected = hasReady && !isFullySelected && readyPayments.some(p => selectedRecords.has(p.recordKey || p.accountNo));
                    const status = row.customerPaymentStatus || row.paymentStatus || 'ON HOLD';

                    const isStatusReady = status === 'READY FOR PAYMENT' || status === 'READY';
                    const isStatusPartial = status === 'PARTIALLY READY';
                    const isStatusHold = status === 'ON HOLD';
                    const isStatusProcessing = status === 'PROCESSING';
                    const isStatusPaid = status === 'PAID';

                    return (
                      <React.Fragment key={row.accountNo || `cust-${idx}`}>
                        {/* ── Customer Summary Row ──────────────────────── */}
                        <tr
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)',
                            background: isFullySelected
                              ? 'rgba(16, 185, 129, 0.06)'
                              : (isExpanded ? 'rgba(59, 130, 246, 0.04)' : 'transparent'),
                            borderLeft: isStatusReady
                              ? '4px solid #10b981'
                              : isStatusPartial
                                ? '4px solid #fbbf24'
                                : isStatusPaid
                                  ? '4px solid #059669'
                                  : '4px solid #f87171',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Checkbox (Batch Selection across ready records) */}
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={isFullySelected}
                              ref={el => { if (el) el.indeterminate = isPartiallySelected; }}
                              disabled={!hasReady}
                              onChange={() => toggleSelectCustomer(row)}
                              title={hasReady ? `Select all ${readyPayments.length} ready payment(s) for customer ${row.accountNo}` : 'No READY records for this customer'}
                              style={{ cursor: hasReady ? 'pointer' : 'not-allowed', accentColor: '#10b981', opacity: hasReady ? 1 : 0.3 }}
                            />
                          </td>

                          {/* Caret / Expand Toggle */}
                          <td style={{ padding: '0.85rem 0.4rem', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleExpandCustomer(row.accountNo)}
                              title={isExpanded ? 'Collapse payment obligations' : `Expand ${row.paymentRecordsCount || pList.length} payment obligation(s)`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isExpanded ? '#60a5fa' : 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.2rem',
                                borderRadius: '4px'
                              }}
                            >
                              {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                            </button>
                          </td>

                          {/* Account No */}
                          <td style={{ padding: '0.85rem 0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>
                            <span
                              onClick={() => navigate(`/customers?accountNo=${row.accountNo}&tab=payment`)}
                              title="Open Customer 360 in Directory"
                              style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                            >
                              {row.accountNo}
                            </span>
                          </td>

                          {/* Customer Name */}
                          <td style={{ padding: '0.85rem 0.75rem', maxWidth: '230px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.customerName || row.masterName || '—'}
                              </span>
                              {(row.paymentRecordsCount > 1 || pList.length > 1) && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.67rem',
                                  color: '#a5b4fc',
                                  fontWeight: 700
                                }}>
                                  <Layers size={10} /> {row.paymentRecordsCount || pList.length} Monthly Obligations
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Net Type */}
                          <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-secondary)' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.18rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(255,255,255,0.06)',
                              fontSize: '0.74rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap'
                            }}>
                              {row.solarType || row.masterNetType || '—'}
                            </span>
                          </td>

                          {/* Obligations count badge */}
                          <td style={{ padding: '0.85rem 0.75rem' }}>
                            <span
                              onClick={() => toggleExpandCustomer(row.accountNo)}
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: '#a5b4fc',
                                border: '1px solid rgba(99, 102, 241, 0.3)'
                              }}
                            >
                              <Layers size={11} />
                              <span>{row.paymentRecordsCount || pList.length} Records</span>
                            </span>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              <span style={{ color: '#34d399' }}>{row.readyRecordsCount ?? readyPayments.length} Ready</span> •{' '}
                              <span style={{ color: '#fbbf24' }}>{row.onHoldRecordsCount ?? (pList.length - readyPayments.length)} Hold</span>
                            </div>
                          </td>

                          {/* Customer Payment Status */}
                          <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.25rem 0.7rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              background: isStatusReady
                                ? 'rgba(16, 185, 129, 0.15)'
                                : isStatusPartial
                                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(99, 102, 241, 0.2))'
                                  : isStatusPaid
                                    ? 'rgba(16, 185, 129, 0.25)'
                                    : isStatusProcessing
                                      ? 'rgba(6, 182, 212, 0.15)'
                                      : 'rgba(245, 158, 11, 0.15)',
                              color: isStatusReady || isStatusPaid
                                ? '#10b981'
                                : isStatusPartial
                                  ? '#fbbf24'
                                  : isStatusProcessing
                                    ? '#38bdf8'
                                    : '#f87171',
                              border: `1px solid ${
                                isStatusReady || isStatusPaid
                                  ? 'rgba(16, 185, 129, 0.35)'
                                  : isStatusPartial
                                    ? 'rgba(245, 158, 11, 0.4)'
                                    : 'rgba(245, 158, 11, 0.3)'
                              }`
                            }}>
                              {isStatusReady ? <CheckCircle2 size={12} /> : isStatusPartial ? <AlertTriangle size={12} /> : isStatusPaid ? <Check size={12} /> : <Lock size={12} />}
                              <span>{status}</span>
                            </span>
                          </td>

                          {/* Total Pending Amount */}
                          <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {formatLKR(row.totalPendingAmount ?? row.totalPayableAmount ?? row.totalPayable)}
                          </td>

                          {/* Ready Amount */}
                          <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                            {formatLKR(row.totalReadyAmount ?? row.readyAmount ?? (isStatusReady ? row.totalPayable : 0))}
                          </td>

                          {/* On Hold Amount */}
                          <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: Number(row.totalOnHoldAmount ?? row.onHoldAmount) > 0 ? '#fbbf24' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatLKR(row.totalOnHoldAmount ?? row.onHoldAmount ?? (isStatusHold ? row.totalPayable : 0))}
                          </td>

                          {/* Total Payable */}
                          <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                            {formatLKR(row.totalPayableAmount ?? row.totalPayable)}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {/* Expand / Collapse records button */}
                              <button
                                onClick={() => toggleExpandCustomer(row.accountNo)}
                                title={isExpanded ? 'Collapse records sub-table' : 'Expand all payment obligations'}
                                style={{
                                  background: isExpanded ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.06)',
                                  border: isExpanded ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-color)',
                                  color: isExpanded ? '#60a5fa' : 'var(--text-primary)',
                                  padding: '0.3rem 0.55rem',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 600
                                }}
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span>{isExpanded ? 'Hide' : 'Records'}</span>
                              </button>

                              {/* Customer-Level Release Payments button */}
                              {(isStatusPartial || isStatusHold || (row.onHoldRecordsCount > 0)) && (
                                <button
                                  onClick={() => handleReleaseCustomerPayments(row.accountNo)}
                                  title="Release all on-hold payments and re-evaluate accumulated records for this customer"
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                    color: '#10b981',
                                    padding: '0.3rem 0.55rem',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    fontSize: '0.74rem',
                                    fontWeight: 700
                                  }}
                                >
                                  <Unlock size={11} />
                                  <span>Release</span>
                                </button>
                              )}

                              {/* View Customer 360 Dossier */}
                              <button
                                onClick={() => openCustomerDetails(row.accountNo, row.billingMonth, 'overview')}
                                title="View Customer Dossier & History"
                                style={{
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-primary)',
                                  padding: '0.3rem 0.55rem',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 600
                                }}
                              >
                                <Eye size={11} />
                                <span>Dossier</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Expanded Nested Payment Obligations Sub-Table ─ */}
                        {isExpanded && (
                          <tr style={{ background: 'rgba(15, 23, 42, 0.65)', borderBottom: '2px solid rgba(59, 130, 246, 0.25)' }}>
                            <td colSpan={12} style={{ padding: '0.85rem 1.25rem 1.25rem 2.5rem' }}>
                              <div style={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                                <div style={{ padding: '0.65rem 1rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Layers size={14} style={{ color: '#818cf8' }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      Payment Obligations for Customer: <strong style={{ color: '#38bdf8' }}>{row.accountNo}</strong> — {row.customerName || row.masterName}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                      ({pList.length} historical & current payment obligations)
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.76rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Total Pending: <strong style={{ color: '#f3f4f6' }}>{formatLKR(row.totalPendingAmount || row.totalPayableAmount)}</strong></span>
                                    <span style={{ color: '#10b981' }}>Ready: <strong>{formatLKR(row.totalReadyAmount)}</strong></span>
                                    <span style={{ color: '#fbbf24' }}>On Hold: <strong>{formatLKR(row.totalOnHoldAmount)}</strong></span>
                                  </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      <th style={{ padding: '0.65rem 0.75rem', width: '36px' }}>[ ]</th>
                                      <th style={{ padding: '0.65rem 0.75rem' }}>Obligation #</th>
                                      <th style={{ padding: '0.65rem 0.75rem' }}>Billing Month</th>
                                      <th style={{ padding: '0.65rem 0.75rem' }}>Billing Period</th>
                                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Current Payment</th>
                                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Bill Set-Off</th>
                                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Retention</th>
                                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Outstanding</th>
                                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Total Payable</th>
                                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Record Status</th>
                                      <th style={{ padding: '0.65rem 0.75rem' }}>Hold Status & Reason</th>
                                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pList.map((p, pIdx) => {
                                      const pKey = p.recordKey || `${row.accountNo}-${p.billingMonth || pIdx}`;
                                      const isPReady = p.paymentStatus === 'READY' || p.isEligible;
                                      const isPSelected = selectedRecords.has(pKey);
                                      const isPHold = p.paymentStatus === 'ON_HOLD' || p.paymentStatus === 'REVIEW';

                                      return (
                                        <tr
                                          key={pKey}
                                          style={{
                                            borderBottom: pIdx < pList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                            background: isPSelected ? 'rgba(16, 185, 129, 0.06)' : 'transparent'
                                          }}
                                        >
                                          {/* Individual Checkbox */}
                                          <td style={{ padding: '0.65rem 0.75rem' }}>
                                            <input
                                              type="checkbox"
                                              checked={isPSelected}
                                              disabled={!isPReady}
                                              onChange={() => toggleSelectRecord(pKey, isPReady, row.accountNo)}
                                              title={isPReady ? 'Select for payment batch' : 'Only READY records can enter payment batch'}
                                              style={{ cursor: isPReady ? 'pointer' : 'not-allowed', accentColor: '#10b981', opacity: isPReady ? 1 : 0.3 }}
                                            />
                                          </td>

                                          {/* Obligation Number */}
                                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#a5b4fc' }}>
                                            Payment {pIdx + 1} of {pList.length}
                                          </td>

                                          {/* Billing Month */}
                                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#38bdf8' }}>
                                            {p.billingMonth || '—'}
                                          </td>

                                          {/* Billing Period */}
                                          <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>
                                            {p.billingPeriod || p.billingMonth || '—'}
                                          </td>

                                          {/* Current Payment */}
                                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                            {formatLKR(p.currentPayment)}
                                          </td>

                                          {/* Bill Set-Off */}
                                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                            {formatLKR(p.billSetOff)}
                                          </td>

                                          {/* Retention */}
                                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                            {formatLKR(p.retentionMoney)}
                                          </td>

                                          {/* Outstanding */}
                                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: Number(p.outstandingBalance) > 0 ? '#f87171' : 'var(--text-muted)' }}>
                                            {formatLKR(p.outstandingBalance)}
                                          </td>

                                          {/* Total Payable */}
                                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#10b981' }}>
                                            {formatLKR(p.totalPayable)}
                                          </td>

                                          {/* Record Status Badge */}
                                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                                            <span style={{
                                              padding: '0.2rem 0.55rem',
                                              borderRadius: '999px',
                                              fontSize: '0.7rem',
                                              fontWeight: 800,
                                              background: p.paymentStatus === 'READY'
                                                ? 'rgba(16, 185, 129, 0.15)'
                                                : p.paymentStatus === 'PAID'
                                                  ? 'rgba(16, 185, 129, 0.25)'
                                                  : p.paymentStatus === 'PROCESSING'
                                                    ? 'rgba(6, 182, 212, 0.15)'
                                                    : 'rgba(245, 158, 11, 0.15)',
                                              color: p.paymentStatus === 'READY' || p.paymentStatus === 'PAID'
                                                ? '#10b981'
                                                : p.paymentStatus === 'PROCESSING'
                                                  ? '#38bdf8'
                                                  : '#fbbf24',
                                              border: `1px solid ${p.paymentStatus === 'READY' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                            }}>
                                              {p.paymentStatus || 'ON_HOLD'}
                                            </span>
                                          </td>

                                          {/* Hold Status & Diagnostics */}
                                          <td style={{ padding: '0.65rem 0.75rem', maxWidth: '240px' }}>
                                            {isPReady ? (
                                              <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                                                <CheckCircle2 size={12} /> Eligible for Payment
                                              </span>
                                            ) : p.paymentStatus === 'PAID' ? (
                                              <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem' }}>Settled</span>
                                            ) : (
                                              <div style={{ fontSize: '0.74rem' }}>
                                                {p.mismatches && p.mismatches.length > 0 ? (
                                                  <span style={{ color: '#f87171', fontWeight: 700 }}>
                                                    Mismatch: {p.mismatches.map(m => m.field).join(', ')}
                                                  </span>
                                                ) : p.missingFields && p.missingFields.length > 0 ? (
                                                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                                    Missing: {p.missingFields.slice(0, 2).join(', ')}
                                                  </span>
                                                ) : (
                                                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                                                    {p.holdStatus || (p.holdReasons && p.holdReasons.length > 0 ? p.holdReasons[0] : 'ON HOLD')}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </td>

                                          {/* Action button */}
                                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                                            <button
                                              onClick={() => openCustomerDetails(row.accountNo, p.billingMonth, isPHold ? 'resolve' : 'overview', pKey)}
                                              style={{
                                                background: isPHold ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                                border: isPHold ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)',
                                                color: isPHold ? '#fbbf24' : 'var(--text-primary)',
                                                padding: '0.25rem 0.55rem',
                                                borderRadius: '4px',
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                              }}
                                            >
                                              {isPHold ? <Wrench size={11} /> : <Eye size={11} />}
                                              <span>{isPHold ? 'Resolve' : 'Inspect'}</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)'
          }}>
            <div>
              Page <strong style={{ color: 'var(--text-primary)' }}>{currentPage + 1}</strong> of {customersData.totalPages || 1}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: currentPage === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  cursor: currentPage === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={currentPage >= (customersData.totalPages - 1)}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: currentPage >= (customersData.totalPages - 1) ? 'var(--text-muted)' : 'var(--text-primary)',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  cursor: currentPage >= (customersData.totalPages - 1) ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. PAYMENT BATCHES TAB ────────────────────────────────────── */}
      {activeTab === 'BATCHES' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Official Payment Batches & Supervisor Approval
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                Only verified PAYMENT READY customers enter official batches for authorization and bank export.
              </p>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Total Batches: <strong style={{ color: '#38bdf8' }}>{batches.length}</strong>
            </div>
          </div>

          {batches.length === 0 ? (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.35 }} />
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)' }}>No Payment Batches Created Yet</div>
              <div style={{ fontSize: '0.84rem', marginTop: '0.35rem' }}>
                Switch to the "Payment Ready" tab, select eligible accounts, and click "Create Payment Batch".
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {batches.map(batch => {
                const getStatusColor = (s) => {
                  switch (s) {
                    case 'READY': return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' };
                    case 'SUBMITTED': return { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' };
                    case 'UNDER_REVIEW': return { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' };
                    case 'APPROVED': return { bg: 'rgba(16,185,129,0.15)', text: '#34d399', border: 'rgba(16,185,129,0.3)' };
                    case 'PAYMENT_PROCESSED': return { bg: 'rgba(6,182,212,0.15)', text: '#38bdf8', border: 'rgba(6,182,212,0.3)' };
                    case 'PAID': return { bg: 'rgba(16,185,129,0.25)', text: '#10b981', border: 'rgba(16,185,129,0.45)' };
                    case 'REJECTED': return { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' };
                    default: return { bg: 'rgba(255,255,255,0.08)', text: 'var(--text-secondary)', border: 'var(--border-color)' };
                  }
                };
                const sc = getStatusColor(batch.status);

                return (
                  <div
                    key={batch.id}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                            {batch.batchNumber}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Period: <strong style={{ color: '#38bdf8' }}>{batch.billingPeriod}</strong> • Division: {batch.division}
                          </div>
                        </div>
                        <span style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          background: sc.bg,
                          color: sc.text,
                          border: `1px solid ${sc.border}`
                        }}>
                          {batch.status}
                        </span>
                      </div>

                      {/* Batch Financials */}
                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Customer Count:</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{batch.customerCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Payable:</span>
                          <span style={{ fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>{formatLKR(batch.totalPayableAmount)}</span>
                        </div>
                        {batch.approvedAmount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Approved Amount:</span>
                            <span style={{ fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>{formatLKR(batch.approvedAmount)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                          <span>Created By: {batch.createdBy || 'System'}</span>
                          <span>{batch.createdDate ? new Date(batch.createdDate).toLocaleDateString() : '—'}</span>
                        </div>
                      </div>

                      {batch.rejectionReason && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#f87171', marginBottom: '0.75rem' }}>
                          <strong>Rejection Reason:</strong> {batch.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Batch Actions Toolbar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <button
                        onClick={() => openBatchDetails(batch.id)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        View Items ({batch.customerCount})
                      </button>

                      {batch.status === 'READY' && (
                        <button
                          onClick={() => handleBatchTransition(batch.id, 'SUBMIT')}
                          style={{
                            background: 'rgba(59,130,246,0.15)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            color: '#60a5fa',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Submit Batch
                        </button>
                      )}

                      {batch.status === 'SUBMITTED' && isAdmin && (
                        <button
                          onClick={() => handleBatchTransition(batch.id, 'REVIEW')}
                          style={{
                            background: 'rgba(168,85,247,0.15)',
                            border: '1px solid rgba(168,85,247,0.3)',
                            color: '#c084fc',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Start Review
                        </button>
                      )}

                      {(batch.status === 'SUBMITTED' || batch.status === 'UNDER_REVIEW') && isAdmin && (
                        <>
                          <button
                            onClick={() => handleBatchTransition(batch.id, 'APPROVE')}
                            style={{
                              background: 'rgba(16,185,129,0.15)',
                              border: '1px solid rgba(16,185,129,0.3)',
                              color: '#10b981',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleBatchTransition(batch.id, 'REJECT')}
                            style={{
                              background: 'rgba(239,68,68,0.15)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              color: '#f87171',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {batch.status === 'REJECTED' && (
                        <button
                          onClick={() => handleBatchTransition(batch.id, 'CORRECT')}
                          style={{
                            background: 'rgba(245,158,11,0.15)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            color: '#fbbf24',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Send to Correction
                        </button>
                      )}

                      {batch.status === 'APPROVED' && (
                        <button
                          onClick={() => handleBatchTransition(batch.id, 'PROCESS')}
                          style={{
                            background: 'rgba(6,182,212,0.15)',
                            border: '1px solid rgba(6,182,212,0.3)',
                            color: '#38bdf8',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Process Payment
                        </button>
                      )}

                      {batch.status === 'PAYMENT_PROCESSED' && (
                        <button
                          onClick={() => handleBatchTransition(batch.id, 'COMPLETE')}
                          style={{
                            background: 'rgba(16,185,129,0.2)',
                            border: '1px solid rgba(16,185,129,0.4)',
                            color: '#10b981',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Mark Paid & Settled
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 6. PAYMENT HISTORY TAB ────────────────────────────────────── */}
      {activeTab === 'HISTORY' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Completed & Settled Payment Disbursements
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              Historical payment settlements recorded from completed payment batches.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.74rem' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Account No</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Customer Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Net Type</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Bank / Branch</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Settled</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Settled Date</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <FileCheck2 size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.35 }} />
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No Settled Payments Recorded Yet</div>
                    </td>
                  </tr>
                ) : (
                  historyItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                        {item.accountNo}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.customerName}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{item.solarType || '—'}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {item.bankCode || '—'} / {item.branchCode || '—'} ({item.bankAccountNo || '—'})
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#10b981' }}>
                        {formatLKR(item.totalPayable)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800, fontSize: '0.74rem' }}>
                          PAID
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 7. PROFESSIONAL PAYMENT DETAILS DRAWER / MODAL ─────────────── */}
      {detailsModalOpen && selectedCustomerDetails && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.15)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Customer Payment Dossier & Eligibility Verification
                  </h3>
                  <span style={{
                    padding: '0.2rem 0.65rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: selectedCustomerDetails.paymentInfo?.paymentStatus === 'READY'
                      ? 'rgba(16,185,129,0.15)'
                      : selectedCustomerDetails.paymentInfo?.paymentStatus === 'PAID'
                        ? 'rgba(16,185,129,0.25)'
                        : 'rgba(245,158,11,0.15)',
                    color: selectedCustomerDetails.paymentInfo?.paymentStatus === 'READY' || selectedCustomerDetails.paymentInfo?.paymentStatus === 'PAID'
                      ? '#10b981'
                      : '#f59e0b',
                    border: `1px solid ${selectedCustomerDetails.paymentInfo?.paymentStatus === 'READY' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                  }}>
                    {selectedCustomerDetails.paymentInfo?.paymentStatus || 'ON HOLD'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Account: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedCustomerDetails.customerInfo?.accountNumber || selectedCustomerDetails.record?.accountNo}</strong> • {selectedCustomerDetails.customerInfo?.customerName} • Billing Month: <strong style={{ color: '#fbbf24' }}>{selectedCustomerDetails.billingInfo?.billingMonth}</strong>
                </div>

                {/* Multi-Payment Switcher Tabs */}
                {selectedCustomerDetails.allCustomerPayments && selectedCustomerDetails.allCustomerPayments.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
                      Multiple Payments ({selectedCustomerDetails.allCustomerPayments.length}):
                    </span>
                    {selectedCustomerDetails.allCustomerPayments.map((p, pIdx) => {
                      const currentKey = selectedCustomerDetails.recordKey || selectedCustomerDetails.record?.recordKey;
                      const isCurrent = (p.recordKey && p.recordKey === currentKey) || (!currentKey && pIdx === 0);
                      const isPReady = p.paymentStatus === 'READY' || p.paymentEligibility === 'READY';
                      return (
                        <button
                          key={p.recordKey || pIdx}
                          onClick={() => openCustomerDetails(
                            selectedCustomerDetails.customerInfo?.accountNumber || selectedCustomerDetails.record?.accountNo,
                            p.billingMonth,
                            drawerTab,
                            p.recordKey
                          )}
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: isCurrent ? '1px solid #38bdf8' : '1px solid var(--border-color)',
                            background: isCurrent ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            color: isCurrent ? '#38bdf8' : 'var(--text-secondary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>{p.paymentLabel || `Payment ${pIdx + 1}`}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: isPReady ? '#10b981' : '#f59e0b' }}>
                            {formatLKR(p.totalPayable != null ? p.totalPayable : p.currentPayment)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={() => setDetailsModalOpen(false)}
                className="modal-close-btn"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Internal Navigation Tabs */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '0.6rem 1.75rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.015)'
            }}>
              <button
                onClick={() => setDrawerTab('overview')}
                style={{
                  background: drawerTab === 'overview' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  border: drawerTab === 'overview' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                  color: drawerTab === 'overview' ? '#38bdf8' : 'var(--text-secondary)',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Overview & Financials
              </button>

              <button
                onClick={() => setDrawerTab('mismatches')}
                style={{
                  background: drawerTab === 'mismatches' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  border: drawerTab === 'mismatches' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid transparent',
                  color: drawerTab === 'mismatches' ? '#f87171' : 'var(--text-secondary)',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Mismatch Comparisons ({selectedCustomerDetails.validationInfo?.mismatches?.length || 0})
              </button>

              <button
                onClick={() => setDrawerTab('checklist')}
                style={{
                  background: drawerTab === 'checklist' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  border: drawerTab === 'checklist' ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
                  color: drawerTab === 'checklist' ? '#fbbf24' : 'var(--text-secondary)',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Required Details Checklist ({selectedCustomerDetails.validationInfo?.missingDetails?.length || 0} missing)
              </button>

              <button
                onClick={() => setDrawerTab('resolve')}
                style={{
                  background: drawerTab === 'resolve' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  border: drawerTab === 'resolve' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
                  color: drawerTab === 'resolve' ? '#10b981' : 'var(--text-secondary)',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Wrench size={13} />
                <span>Resolve Issue & Re-evaluate</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* TAB 1: OVERVIEW & FINANCIALS */}
              {drawerTab === 'overview' && (
                <>
                  {/* Payment Hold Banner if held */}
                  {selectedCustomerDetails.paymentInfo?.paymentStatus !== 'READY' && selectedCustomerDetails.paymentInfo?.paymentStatus !== 'PAID' && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                        <AlertTriangle size={18} />
                        <span>Payment Hold — {selectedCustomerDetails.billingInfo?.billingMonth}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        This customer's payment is withheld due to one or more blocking validation discrepancies:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.4rem', fontSize: '0.83rem', color: '#f87171', lineHeight: '1.5' }}>
                        {(selectedCustomerDetails.validationInfo?.blockingIssues || selectedCustomerDetails.blockingIssues || ['Blocking discrepancy active']).map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Multi-Payment Timeline & Breakdown Banner */}
                  {selectedCustomerDetails.allCustomerPayments && selectedCustomerDetails.allCustomerPayments.length > 1 && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(17, 24, 39, 0.85))',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      borderRadius: '10px',
                      padding: '1.15rem 1.25rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a5b4fc', fontWeight: 700, fontSize: '0.92rem' }}>
                          <Layers size={18} style={{ color: '#818cf8' }} />
                          <span>Customer Multi-Payment Schedule ({selectedCustomerDetails.allCustomerPayments.length} Active Records)</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          Combined Customer Total: <strong style={{ color: '#10b981', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                            {formatLKR(selectedCustomerDetails.allCustomerPayments.reduce((acc, p) => acc + Number(p.totalPayable != null ? p.totalPayable : (p.currentPayment || 0)), 0))}
                          </strong>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                        {selectedCustomerDetails.allCustomerPayments.map((p, pIdx) => {
                          const currentKey = selectedCustomerDetails.recordKey || selectedCustomerDetails.record?.recordKey;
                          const isCurrent = (p.recordKey && p.recordKey === currentKey) || (!currentKey && pIdx === 0);
                          const isPReady = p.paymentStatus === 'READY' || p.paymentEligibility === 'READY';
                          return (
                            <div
                              key={p.recordKey || pIdx}
                              onClick={() => openCustomerDetails(
                                selectedCustomerDetails.customerInfo?.accountNumber || selectedCustomerDetails.record?.accountNo,
                                p.billingMonth,
                                drawerTab,
                                p.recordKey
                              )}
                              style={{
                                background: isCurrent ? 'rgba(99, 102, 241, 0.22)' : 'rgba(0,0,0,0.25)',
                                border: isCurrent ? '1.5px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '8px',
                                padding: '0.75rem 0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isCurrent ? '#818cf8' : 'var(--text-primary)' }}>
                                  {p.paymentLabel || `Payment ${pIdx + 1}`}
                                </span>
                                <span style={{
                                  fontSize: '0.68rem',
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '4px',
                                  fontWeight: 800,
                                  background: isPReady ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: isPReady ? '#10b981' : '#fbbf24'
                                }}>
                                  {p.paymentStatus || (isPReady ? 'READY' : 'ON HOLD')}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                Period: <strong style={{ color: 'var(--text-primary)' }}>{p.billingMonth || p.billingPeriod || '—'}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', paddingTop: '0.3rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Payable:</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>
                                  {formatLKR(p.totalPayable != null ? p.totalPayable : p.currentPayment)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3 Panels: Customer Info, Billing Info, Payment Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {/* Panel 1: Customer Information */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1.15rem' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <User size={15} />
                        <span>Customer Information</span>
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Account Number:</span>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{selectedCustomerDetails.customerInfo?.accountNumber}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Customer Name:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedCustomerDetails.customerInfo?.customerName}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Net Type:</span>
                          <span style={{ fontWeight: 600, color: '#60a5fa' }}>{selectedCustomerDetails.customerInfo?.netType}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Bank Code:</span>
                          <span style={{ fontFamily: 'monospace' }}>{selectedCustomerDetails.customerInfo?.bankCode || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Branch Code:</span>
                          <span style={{ fontFamily: 'monospace' }}>{selectedCustomerDetails.customerInfo?.branchCode || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Bank Account No:</span>
                          <span style={{ fontFamily: 'monospace', color: '#10b981' }}>{selectedCustomerDetails.customerInfo?.bankAccountNo || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Panel 2: Billing Information */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1.15rem' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Zap size={15} />
                        <span>Billing Information</span>
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Billing Month:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedCustomerDetails.billingInfo?.billingMonth}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Billing Period Dates:</span>
                          <span>{selectedCustomerDetails.billingInfo?.fromDate || '—'} to {selectedCustomerDetails.billingInfo?.toDate || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Import Units:</span>
                          <span style={{ fontFamily: 'monospace' }}>{selectedCustomerDetails.billingInfo?.importUnits || 0} kWh</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Export Units:</span>
                          <span style={{ fontFamily: 'monospace' }}>{selectedCustomerDetails.billingInfo?.exportUnits || 0} kWh</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Unit Rate:</span>
                          <strong style={{ fontFamily: 'monospace', color: '#38bdf8' }}>LKR {selectedCustomerDetails.billingInfo?.unitRate || '—'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Current Payment:</span>
                          <strong style={{ fontFamily: 'monospace', color: '#10b981' }}>{formatLKR(selectedCustomerDetails.billingInfo?.currentPayment)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Panel 3: Payment Information */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1.15rem' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <DollarSign size={15} />
                        <span>Payment & Eligibility</span>
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Payment Status:</span>
                          <strong style={{ color: selectedCustomerDetails.paymentInfo?.paymentStatus === 'READY' ? '#10b981' : '#f59e0b' }}>
                            {selectedCustomerDetails.paymentInfo?.paymentStatus}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Eligibility:</span>
                          <span style={{ fontWeight: 700, color: selectedCustomerDetails.paymentInfo?.isEligible ? '#10b981' : '#f87171' }}>
                            {selectedCustomerDetails.paymentInfo?.paymentEligibility}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Bill Set-Off:</span>
                          <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{formatLKR(selectedCustomerDetails.paymentInfo?.billSetOff)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Outstanding Balance:</span>
                          <span style={{ fontFamily: 'monospace', color: Number(selectedCustomerDetails.paymentInfo?.outstandingBalance) > 0 ? '#f87171' : 'var(--text-muted)' }}>
                            {formatLKR(selectedCustomerDetails.paymentInfo?.outstandingBalance)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Total Payable:</strong>
                          <strong style={{ fontFamily: 'monospace', color: '#10b981', fontSize: '1rem' }}>{formatLKR(selectedCustomerDetails.paymentInfo?.totalPayable)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: VALIDATION DETAILS */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Validation Details
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Evaluated against active rules for <strong>{selectedCustomerDetails.billingInfo?.billingMonth}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
                        <span style={{
                          padding: '0.2rem 0.65rem',
                          borderRadius: '4px',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          background: selectedCustomerDetails.validationInfo?.validationStatus === 'ERROR'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : selectedCustomerDetails.validationInfo?.validationStatus === 'WARNING'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                          color: selectedCustomerDetails.validationInfo?.validationStatus === 'ERROR'
                            ? '#ef4444'
                            : selectedCustomerDetails.validationInfo?.validationStatus === 'WARNING'
                              ? '#fbbf24'
                              : '#10b981'
                        }}>
                          {selectedCustomerDetails.validationInfo?.validationStatus || 'VALID'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      {/* Sub-Panel A: Mismatches */}
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>Mismatches</span>
                          <button
                            onClick={() => setDrawerTab('mismatches')}
                            style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Compare Side-by-Side
                          </button>
                        </div>
                        {selectedCustomerDetails.validationInfo?.mismatches?.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {selectedCustomerDetails.validationInfo.mismatches.map((m, idx) => (
                              <div key={idx} style={{ fontSize: '0.78rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                                <strong>{m.field}</strong>: Master "<em>{String(m.masterValue)}</em>" ≠ Source "<em>{String(m.sourceValue)}</em>"
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Check size={14} /> No data mismatches detected
                          </div>
                        )}
                      </div>

                      {/* Sub-Panel B: Missing Details */}
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24' }}>Missing Details</span>
                          <button
                            onClick={() => setDrawerTab('checklist')}
                            style={{ background: 'transparent', border: 'none', color: '#fbbf24', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            View Checklist
                          </button>
                        </div>
                        {selectedCustomerDetails.validationInfo?.missingDetails?.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {selectedCustomerDetails.validationInfo.missingDetails.map((f, idx) => (
                              <div key={idx} style={{ fontSize: '0.78rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>❌</span> <span>{f}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Check size={14} /> All required details complete
                          </div>
                        )}
                      </div>

                      {/* Sub-Panel C: Validation Errors */}
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.45rem' }}>Validation Errors</div>
                        {selectedCustomerDetails.validationInfo?.validationErrors && selectedCustomerDetails.validationInfo.validationErrors.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#f87171', lineHeight: '1.4' }}>
                            {selectedCustomerDetails.validationInfo.validationErrors.map((err, idx) => (
                              <li key={idx}>{String(err)}</li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Check size={14} /> Zero validation errors
                          </div>
                        )}
                      </div>

                      {/* Sub-Panel D: Hold Reasons */}
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', marginBottom: '0.45rem' }}>Hold Reasons</div>
                        {selectedCustomerDetails.validationInfo?.holdReasons && selectedCustomerDetails.validationInfo.holdReasons.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {selectedCustomerDetails.validationInfo.holdReasons.map((hr, idx) => (
                              <div key={idx} style={{ fontSize: '0.78rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <AlertCircle size={13} /> <span>{hr}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Check size={14} /> No active payment holds
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: MISMATCH COMPARISONS */}
              {drawerTab === 'mismatches' && (
                <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Field Comparison: Master Value vs Source Value
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                      Month-specific comparison of master directory records versus monthly billing uploads for <strong>{selectedCustomerDetails.billingInfo?.billingMonth}</strong>.
                    </p>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Field</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#60a5fa' }}>Master Value</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#fbbf24' }}>Source Value</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedCustomerDetails.comparisons || []).map((comp, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: comp.isMismatch ? 'rgba(239, 68, 68, 0.07)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {comp.field}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                            {String(comp.masterValue)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: comp.isMismatch ? '#f87171' : 'var(--text-primary)', fontWeight: comp.isMismatch ? 700 : 400 }}>
                            {String(comp.sourceValue)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            {comp.isMismatch ? (
                              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '4px', background: 'rgba(239,68,68,0.18)', color: '#f87171', fontWeight: 800, fontSize: '0.75rem' }}>
                                MISMATCH
                              </span>
                            ) : (
                              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: 700, fontSize: '0.75rem' }}>
                                MATCHED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: REQUIRED DETAILS CHECKLIST */}
              {drawerTab === 'checklist' && (
                <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Required Details Verification Checklist
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                      All required fields must be present and valid before payment disbursement can be approved for <strong>{selectedCustomerDetails.billingInfo?.billingMonth}</strong>.
                    </p>
                  </div>

                  {/* Summary of missing details if any */}
                  {selectedCustomerDetails.validationInfo?.missingDetails?.length > 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f87171', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Missing Details:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {selectedCustomerDetails.validationInfo.missingDetails.map((f, idx) => (
                          <div key={idx} style={{ fontSize: '0.82rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <span>❌</span> <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {(selectedCustomerDetails.requiredFieldChecklist || []).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.7rem 0.85rem',
                          borderRadius: '8px',
                          background: item.isPresent ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.08)',
                          border: `1px solid ${item.isPresent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <span style={{ fontSize: '1rem' }}>{item.isPresent ? '✓' : '❌'}</span>
                          <span style={{ fontSize: '0.83rem', fontWeight: 600, color: item.isPresent ? 'var(--text-primary)' : '#f87171' }}>
                            {item.fieldName}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.76rem', color: item.isPresent ? 'var(--text-secondary)' : '#f87171', fontFamily: 'monospace' }}>
                          {item.isPresent ? item.value : 'MISSING'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: RESOLVE ISSUE & RE-EVALUATE */}
              {drawerTab === 'resolve' && (
                <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
                      <Wrench size={18} />
                      <span>In-Place Staging Correction & Auto Re-validation</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Correct customer information for <strong>{selectedCustomerDetails.billingInfo?.billingMonth}</strong>. Saving will re-run validations, re-compute financials, and automatically promote status from <strong>ON HOLD → READY</strong> if resolved.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 700 }}>Customer Name</label>
                      <input
                        type="text"
                        value={correctionForm.customerName || ''}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, customerName: e.target.value })}
                        style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 700 }}>Bank Account No</label>
                      <input
                        type="text"
                        value={correctionForm.bankAccountNo || ''}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, bankAccountNo: e.target.value })}
                        style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 700 }}>Bank Code</label>
                      <input
                        type="text"
                        value={correctionForm.bankCode || ''}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, bankCode: e.target.value })}
                        style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 700 }}>Branch Code</label>
                      <input
                        type="text"
                        value={correctionForm.branchCode || ''}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, branchCode: e.target.value })}
                        style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 700 }}>Net Type</label>
                      <select
                        value={correctionForm.solarType || ''}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, solarType: e.target.value })}
                        style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      >
                        <option value="Net Plus">Net Plus</option>
                        <option value="Net Plus Plus">Net Plus Plus</option>
                        <option value="Net Metering">Net Metering</option>
                        <option value="Net Accounting">Net Accounting</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 700 }}>Unit Rate (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={correctionForm.unitRate || ''}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, unitRate: e.target.value })}
                        style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCorrection}
                    disabled={actionLoading}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#fff',
                      padding: '0.65rem 1.4rem',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Save Correction & Re-evaluate Payment Eligibility</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.75rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: 'rgba(0,0,0,0.15)'
            }}>
              <button
                onClick={() => {
                  const acc = selectedCustomerDetails.record?.accountNo || selectedCustomerDetails.customerInfo?.accountNumber;
                  setDetailsModalOpen(false);
                  if (acc) navigate(`/customers?accountNo=${acc}&tab=payment`);
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <User size={15} />
                <span>Open in Customer 360</span>
              </button>

              <button
                onClick={() => setDetailsModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. PAYMENT BATCH REVIEW & CONFIRMATION MODAL ──────────────── */}
      {batchReviewModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)'
          }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShieldCheck size={22} style={{ color: '#10b981' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Confirm Payment Batch Creation
                </h3>
              </div>
              <button
                onClick={() => setBatchReviewModalOpen(false)}
                className="modal-close-btn"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  You are bundling <strong style={{ color: '#34d399' }}>{selectedFinancials.eligibleCount}</strong> PAYMENT READY customer(s) into an official payment batch for supervisor approval and bank disbursement.
                </div>
              </div>

              {/* Warning if any ON HOLD customers were attempted */}
              {selectedFinancials.onHoldCount > 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem' }}>
                    <AlertTriangle size={16} />
                    <span>{selectedFinancials.onHoldCount} Selected Account(s) Are ON HOLD & Excluded:</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                    {selectedFinancials.onHoldAccounts.join(', ')}
                  </div>
                </div>
              )}

              {/* Financial Totals Breakdown */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Selected Eligible Customers:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedFinancials.eligibleCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Current Payment:</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{formatLKR(selectedFinancials.currentPayment)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Bill Outstanding Set Off:</span>
                  <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{formatLKR(selectedFinancials.billSetOff)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Outstanding Carried Balance:</span>
                  <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{formatLKR(selectedFinancials.outstandingBalance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '1.05rem' }}>
                  <strong style={{ color: '#10b981' }}>Total Net Payable Amount:</strong>
                  <strong style={{ fontFamily: 'monospace', color: '#10b981', fontSize: '1.2rem' }}>{formatLKR(selectedFinancials.totalPayable)}</strong>
                </div>
              </div>

              {/* Security check badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <Lock size={14} style={{ color: '#10b981' }} />
                <span>Backend enforcement active: Ineligible accounts are strictly rejected from entering payment batches.</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'rgba(0,0,0,0.15)' }}>
              <button
                onClick={() => setBatchReviewModalOpen(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.55rem 1.1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBatch}
                disabled={actionLoading || selectedFinancials.eligibleCount === 0}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.55rem 1.4rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: selectedFinancials.eligibleCount > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                }}
              >
                <CheckCircle2 size={16} />
                <span>Confirm & Create Batch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. BATCH ITEMS VIEW MODAL ─────────────────────────────────── */}
      {batchDetailsModalOpen && selectedBatchDetails && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '880px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'monospace' }}>
                  {selectedBatchDetails.batch?.batchNumber}
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Period: <strong>{selectedBatchDetails.batch?.billingPeriod}</strong> • Total: <strong style={{ color: '#10b981' }}>{formatLKR(selectedBatchDetails.batch?.totalPayableAmount)}</strong> • Status: <strong>{selectedBatchDetails.batch?.status}</strong>
                </div>
              </div>
              <button
                onClick={() => setBatchDetailsModalOpen(false)}
                className="modal-close-btn"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.74rem' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Account No</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Customer Name</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Bank / Branch</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Total Payable</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Item Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedBatchDetails.items || []).map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>{item.accountNo}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.customerName}</td>
                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{item.bankCode || '—'} / {item.branchCode || '—'}</td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>
                        {formatLKR(item.totalPayable)}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', fontSize: '0.74rem', fontWeight: 600 }}>
                          {item.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.15)' }}>
              <button
                onClick={() => setBatchDetailsModalOpen(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 1.1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. SUMMARY CARD DETAILS MODAL POPUP ─────────────────────── */}
      {summaryModalCard && (() => {
        const getModalCardConfig = (cardKey) => {
          switch (cardKey) {
            case 'TOTAL_CUSTOMERS':
              return {
                title: 'Total Customers Overview',
                icon: <User size={22} style={{ color: '#3b82f6' }} />,
                color: '#3b82f6',
                gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(17, 24, 39, 0.95))',
                badgeColor: 'rgba(59, 130, 246, 0.15)',
                badgeText: '#60a5fa',
                badgeBorder: 'rgba(59, 130, 246, 0.3)',
                stat: (summary.totalCustomers || summary.customerCount || 0).toLocaleString(),
                statLabel: 'Total Canonical Solar Producers',
                description: 'Complete directory of registered solar producers across the selected billing period and division scope. This count represents the complete backend dataset invariant of local filters.',
                filterTab: 'ALL',
                filterTabLabel: 'View All in Table',
                metrics: [
                  { label: 'Payment Ready', value: (summary.paymentReadyCount || 0).toLocaleString(), color: '#10b981' },
                  { label: 'Payment On Hold', value: (summary.onHoldCount || 0).toLocaleString(), color: '#f59e0b' },
                  { label: 'Requires Review', value: (summary.reviewCount || 0).toLocaleString(), color: '#c084fc' },
                  { label: 'Total Ready Payable', value: formatLKR(summary.totalPayable), color: '#38bdf8' },
                  { label: 'Total Withheld Balance', value: formatLKR(summary.totalOnHold), color: '#f87171' }
                ],
                filterPredicate: () => true
              };

            case 'PAYMENT_READY':
              return {
                title: 'Payment Ready Verification',
                icon: <CheckCircle2 size={22} style={{ color: '#10b981' }} />,
                color: '#10b981',
                gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(17, 24, 39, 0.95))',
                badgeColor: 'rgba(16, 185, 129, 0.15)',
                badgeText: '#34d399',
                badgeBorder: 'rgba(16, 185, 129, 0.3)',
                stat: (summary.paymentReadyCount || 0).toLocaleString(),
                statLabel: 'Verified Eligible for Disbursement',
                description: 'Producers who have passed all 11 backend verification and banking integrity checks. These records are verified, free of payment holds, and ready for payment batch bundling.',
                filterTab: 'READY',
                filterTabLabel: 'View Payment Ready Tab',
                metrics: [
                  { label: 'Ready Producers', value: (summary.paymentReadyCount || 0).toLocaleString(), color: '#10b981' },
                  { label: 'Ready Total Payable', value: formatLKR(summary.totalPayable), color: '#34d399' },
                  { label: 'Verification Gates', value: '11 of 11 Passed', color: '#60a5fa' },
                  { label: 'Batch Eligibility', value: 'Eligible for Batch Creation', color: '#10b981' }
                ],
                filterPredicate: (c) => c.paymentStatus === 'READY' || c.isEligible
              };

            case 'PAYMENT_ON_HOLD':
              return {
                title: 'Payment On Hold Diagnostics',
                icon: <AlertTriangle size={22} style={{ color: '#f59e0b' }} />,
                color: '#f59e0b',
                gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(17, 24, 39, 0.95))',
                badgeColor: 'rgba(245, 158, 11, 0.15)',
                badgeText: '#fbbf24',
                badgeBorder: 'rgba(245, 158, 11, 0.3)',
                stat: (summary.onHoldCount || 0).toLocaleString(),
                statLabel: 'Withheld by Blocking Validations',
                description: 'Producers temporarily prevented from receiving disbursement due to active payment holds, missing bank or identity information, negative net calculations, or validation errors.',
                filterTab: 'ON_HOLD',
                filterTabLabel: 'View On Hold Tab',
                metrics: [
                  { label: 'On Hold Producers', value: (summary.onHoldCount || 0).toLocaleString(), color: '#f59e0b' },
                  { label: 'Total Withheld Balance', value: formatLKR(summary.totalOnHold), color: '#f87171' },
                  { label: 'Primary Blockers', value: 'Holds & Missing Details', color: '#fbbf24' },
                  { label: 'Resolution Path', value: 'Customer 360 / Edit Details', color: '#38bdf8' }
                ],
                filterPredicate: (c) => c.paymentStatus === 'ON_HOLD' || (c.holdReasons && c.holdReasons.length > 0)
              };

            case 'REQUIRES_REVIEW':
              return {
                title: 'Requires Review Audit Queue',
                icon: <Clock size={22} style={{ color: '#a855f7' }} />,
                color: '#a855f7',
                gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(17, 24, 39, 0.95))',
                badgeColor: 'rgba(168, 85, 247, 0.15)',
                badgeText: '#c084fc',
                badgeBorder: 'rgba(168, 85, 247, 0.3)',
                stat: (summary.reviewCount || 0).toLocaleString(),
                statLabel: 'Pending Officer Investigation',
                description: 'Producers flagged with multi-source billing discrepancies, duplicate records, or pending supervisory batch review requiring official confirmation.',
                filterTab: 'REVIEW',
                filterTabLabel: 'View Requires Review Tab',
                metrics: [
                  { label: 'Flagged Records', value: (summary.reviewCount || 0).toLocaleString(), color: '#a855f7' },
                  { label: 'Review Categories', value: 'Duplicate Sources / Batches', color: '#c084fc' },
                  { label: 'Under Review Batches', value: batches.filter(b => b.status === 'UNDER_REVIEW' || b.status === 'SUBMITTED').length, color: '#fbbf24' },
                  { label: 'Audit Gateway', value: 'Supervisor Action Required', color: '#60a5fa' }
                ],
                filterPredicate: (c) => c.paymentStatus === 'REVIEW'
              };

            case 'TOTAL_PAYABLE':
              return {
                title: 'Total Ready Payable Balance',
                icon: <DollarSign size={22} style={{ color: '#06b6d4' }} />,
                color: '#06b6d4',
                gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(17, 24, 39, 0.95))',
                badgeColor: 'rgba(6, 182, 212, 0.15)',
                badgeText: '#38bdf8',
                badgeBorder: 'rgba(6, 182, 212, 0.3)',
                stat: formatLKR(summary.totalPayable),
                statLabel: 'Net Approved Settlement Capital',
                description: 'Aggregated net settlement amount payable to verified ready producers. Calculated as: kWh Energy Purchase / Sales Amount minus Bill Set-Off and Retention Money.',
                filterTab: 'READY',
                filterTabLabel: 'View Ready Accounts in Table',
                metrics: [
                  { label: 'Ready Payable', value: formatLKR(summary.totalPayable), color: '#38bdf8' },
                  { label: 'Eligible Payees', value: (summary.paymentReadyCount || 0).toLocaleString(), color: '#10b981' },
                  { label: 'Formula Enforced', value: 'kWh Sales − SetOff − Retention', color: '#fbbf24' },
                  { label: 'Disbursement Status', value: 'Available for Batching', color: '#34d399' }
                ],
                filterPredicate: (c) => (c.totalPayable != null && c.totalPayable > 0) || c.paymentStatus === 'READY'
              };

            case 'TOTAL_ON_HOLD':
              return {
                title: 'Total Withheld / On Hold Balance',
                icon: <Lock size={22} style={{ color: '#ef4444' }} />,
                color: '#ef4444',
                gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(17, 24, 39, 0.95))',
                badgeColor: 'rgba(239, 68, 68, 0.15)',
                badgeText: '#f87171',
                badgeBorder: 'rgba(239, 68, 68, 0.3)',
                stat: formatLKR(summary.totalOnHold),
                statLabel: 'Withheld Financial Liability',
                description: 'Aggregate value of payments currently held or pending review due to active hold triggers, identity mismatches, or missing details awaiting verification.',
                filterTab: 'ON_HOLD',
                filterTabLabel: 'View On Hold Accounts in Table',
                metrics: [
                  { label: 'Withheld Total', value: formatLKR(summary.totalOnHold), color: '#f87171' },
                  { label: 'Withheld Producers', value: ((summary.onHoldCount || 0) + (summary.reviewCount || 0)).toLocaleString(), color: '#fbbf24' },
                  { label: 'Disbursement Guard', value: 'Strictly Locked', color: '#ef4444' },
                  { label: 'Release Trigger', value: 'Pass Validation Criteria', color: '#38bdf8' }
                ],
                filterPredicate: (c) => c.paymentStatus === 'ON_HOLD' || c.paymentStatus === 'REVIEW' || (c.holdReasons && c.holdReasons.length > 0)
              };

            case 'MULTI_PAYMENTS':
              return {
                title: 'Multi-Payment Customer Records',
                icon: <Layers size={22} style={{ color: '#818cf8' }} />,
                color: '#818cf8',
                gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(17, 24, 39, 0.95))',
                badgeColor: 'rgba(99, 102, 241, 0.18)',
                badgeText: '#a5b4fc',
                badgeBorder: 'rgba(99, 102, 241, 0.35)',
                stat: (summary.multiPaymentCustomersCount || 0).toLocaleString(),
                statLabel: 'Customers with Multiple Payments',
                description: 'Producers with multiple active payment records in this period (e.g. previously held payments released alongside the current billing cycle). Color-coded grouping and sequence tags ensure full payment traceability.',
                filterTab: 'ALL',
                filterTabLabel: 'Filter Multi-Payments in Table',
                onFilterClick: () => {
                  setMultiPaymentFilter(true);
                  setActiveTab('ALL');
                  setCurrentPage(0);
                  setSummaryModalCard(null);
                },
                metrics: [
                  { label: 'Multi-Pay Customers', value: (summary.multiPaymentCustomersCount || 0).toLocaleString(), color: '#818cf8' },
                  { label: 'Total Payment Records', value: (summary.multiPaymentCount || 0).toLocaleString(), color: '#a5b4fc' },
                  { label: 'Hold / Arrears Releases', value: 'Supported & Visualized', color: '#38bdf8' },
                  { label: 'Grouping Method', value: 'Deterministic Color-Coded', color: '#10b981' }
                ],
                filterPredicate: (c) => Boolean(c.hasMultiplePayments)
              };

            default:
              return null;
          }
        };

        const modalConfig = getModalCardConfig(summaryModalCard);
        if (!modalConfig) return null;

        const relevantRecords = customersData.content.filter(modalConfig.filterPredicate);

        return (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '1.5rem'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSummaryModalCard(null);
            }}
          >
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '880px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '1.25rem 1.75rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: modalConfig.badgeColor,
                    border: `1px solid ${modalConfig.badgeBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {modalConfig.icon}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {modalConfig.title}
                      </h3>
                      <span style={{
                        padding: '0.15rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: modalConfig.badgeColor,
                        color: modalConfig.badgeText,
                        border: `1px solid ${modalConfig.badgeBorder}`
                      }}>
                        Summary Breakdown
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Scope: <strong style={{ color: '#38bdf8' }}>{billingPeriod === 'ALL' ? 'All Months' : billingPeriod}</strong> • Division: <strong style={{ color: '#38bdf8' }}>{division}</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSummaryModalCard(null)}
                  className="modal-close-btn"
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                {/* Hero Stat & Description Banner */}
                <div style={{
                  background: modalConfig.gradient,
                  border: `1px solid ${modalConfig.badgeBorder}`,
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: modalConfig.badgeText, fontWeight: 700 }}>
                      {modalConfig.statLabel}
                    </span>
                    <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#f3f4f6', marginTop: '0.2rem', letterSpacing: '-0.02em' }}>
                      {modalConfig.stat}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(243, 244, 246, 0.85)', marginTop: '0.4rem', maxWidth: '620px', lineHeight: '1.45' }}>
                      {modalConfig.description}
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '0.85rem'
                }}>
                  {modalConfig.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '0.9rem 1.1rem'
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: m.color, marginTop: '0.25rem' }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Relevant Customer Records Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <FileText size={16} style={{ color: '#38bdf8' }} />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Relevant Customer Records ({relevantRecords.length} on current page)
                      </h4>
                    </div>
                    {customersData.totalElements > 0 && (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        From {customersData.totalElements.toLocaleString()} loaded producers
                      </span>
                    )}
                  </div>

                  {relevantRecords.length === 0 ? (
                    <div style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '2.2rem 1.5rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)'
                    }}>
                      <SlidersHorizontal size={32} style={{ margin: '0 auto 0.6rem', opacity: 0.35 }} />
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        No records on the current page match this specific category
                      </div>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', maxWidth: '480px', margin: '0.35rem auto 0' }}>
                        The canonical count above reflects the complete dataset. Click below to switch the main table tab to view all matching records.
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
                            <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Account No</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Customer Name</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Solar Type</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Location</th>
                              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Total Payable</th>
                              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Status</th>
                              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relevantRecords.map((c, i) => {
                              const isReady = c.paymentStatus === 'READY' || c.isEligible;
                              const isHold = c.paymentStatus === 'ON_HOLD';
                              const isRev = c.paymentStatus === 'REVIEW';

                              let badgeBg = 'rgba(255,255,255,0.06)';
                              let badgeColor = 'var(--text-secondary)';
                              let badgeBorder = 'var(--border-color)';
                              if (isReady) {
                                badgeBg = 'rgba(16, 185, 129, 0.15)';
                                badgeColor = '#34d399';
                                badgeBorder = 'rgba(16, 185, 129, 0.3)';
                              } else if (isHold) {
                                badgeBg = 'rgba(245, 158, 11, 0.15)';
                                badgeColor = '#fbbf24';
                                badgeBorder = 'rgba(245, 158, 11, 0.3)';
                              } else if (isRev) {
                                badgeBg = 'rgba(168, 85, 247, 0.15)';
                                badgeColor = '#c084fc';
                                badgeBorder = 'rgba(168, 85, 247, 0.3)';
                              }

                              return (
                                <tr
                                  key={c.accountNo || i}
                                  style={{
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    transition: 'background 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <td style={{ padding: '0.55rem 0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                                    {c.accountNo}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {c.customerName || '—'}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>
                                    {c.solarType || '—'}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>
                                    {c.division || c.branchCode || '—'}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.85rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isReady ? '#10b981' : (isHold ? '#f59e0b' : 'var(--text-primary)') }}>
                                    {formatLKR(c.totalPayable)}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center' }}>
                                    <span style={{
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      background: badgeBg,
                                      color: badgeColor,
                                      border: `1px solid ${badgeBorder}`
                                    }}>
                                      {c.paymentStatus || 'ON_HOLD'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.55rem 0.85rem', textAlign: 'right' }}>
                                    <button
                                      onClick={() => {
                                        setSummaryModalCard(null);
                                        openCustomerDetails(c.accountNo, c.billingMonth, 'overview', c.recordKey);
                                      }}
                                      title="Inspect payment dossier"
                                      style={{
                                        background: 'rgba(56, 189, 248, 0.12)',
                                        border: '1px solid rgba(56, 189, 248, 0.25)',
                                        color: '#38bdf8',
                                        padding: '0.25rem 0.55rem',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                      }}
                                    >
                                      <Eye size={12} />
                                      <span>Inspect</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1rem 1.75rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.2)'
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Canonical Metric: <strong style={{ color: modalConfig.badgeText }}>{modalConfig.stat}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {modalConfig.filterTab && (
                    <button
                      onClick={() => {
                        if (typeof modalConfig.onFilterClick === 'function') {
                          modalConfig.onFilterClick();
                        } else {
                          setActiveTab(modalConfig.filterTab);
                          setCurrentPage(0);
                          setSummaryModalCard(null);
                        }
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Filter size={13} />
                      <span>{modalConfig.filterTabLabel}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSummaryModalCard(null)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PaymentControlCenter;
