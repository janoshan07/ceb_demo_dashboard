import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
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
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(15);

  // ── Canonical Data State ───────────────────────────────────────────
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    customerCount: 0,
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
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [toastMessage, setToastMessage] = useState(null);

  // ── Modals & Drawer State ──────────────────────────────────────────
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview'); // overview, mismatches, checklist, resolve
  const [correctionForm, setCorrectionForm] = useState({});
  const [batchReviewModalOpen, setBatchReviewModalOpen] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
  const [batchDetailsModalOpen, setBatchDetailsModalOpen] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // ── 1. Load Canonical Summary (Invariant under table filters) ───────
  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (billingPeriod && billingPeriod !== 'ALL') params.append('billingPeriod', billingPeriod);
      if (division && division !== 'ALL') params.append('division', division);

      const res = await fetch(`/api/payments/summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load canonical summary:', err);
    }
  }, [billingPeriod, division]);

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
      params.append('page', currentPage);
      params.append('size', pageSize);

      const res = await fetch(`/api/payments/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomersData(data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, [billingPeriod, division, activeTab, statusFilter, searchQuery, holdReasonFilter, validationFilter, netTypeFilter, currentPage, pageSize]);

  // ── 3. Load Batches ────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/batches');
      if (res.ok) {
        const data = await res.json();
        setBatches(data || []);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  }, []);

  // ── 4. Load History ────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data || []);
      }
    } catch (err) {
      console.error('Failed to load payment history:', err);
    }
  }, []);

  // ── 5. Load Available Billing Months ───────────────────────────────
  useEffect(() => {
    const loadMonths = async () => {
      try {
        const res = await fetch('/api/officer/monthly-directory/months');
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
  }, []);

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
    setSearchQuery('');
    setCurrentPage(0);
  };

  // ── Selection for Batch (Only READY records permitted) ─────────────
  const toggleSelectAccount = (accNo, isEligible) => {
    if (!isEligible) {
      showToast(`Account ${accNo} cannot be selected: Only PAYMENT READY records can enter a payment batch.`, 'warning');
      return;
    }
    const next = new Set(selectedAccounts);
    if (next.has(accNo)) next.delete(accNo);
    else next.add(accNo);
    setSelectedAccounts(next);
  };

  const selectAllEligibleVisible = () => {
    const readyRows = customersData.content.filter(c => c.paymentStatus === 'READY' || c.isEligible);
    if (readyRows.length === 0) {
      showToast('No PAYMENT READY customers available on this page to select.', 'warning');
      return;
    }
    const allSelected = readyRows.every(c => selectedAccounts.has(c.accountNo));
    if (allSelected) {
      const next = new Set(selectedAccounts);
      readyRows.forEach(c => next.delete(c.accountNo));
      setSelectedAccounts(next);
    } else {
      const next = new Set(selectedAccounts);
      readyRows.forEach(c => next.add(c.accountNo));
      setSelectedAccounts(next);
    }
  };

  // ── Open Detail Drawer / Modal ─────────────────────────────────────
  const openCustomerDetails = async (accountNo, rowBillingMonth, initialTab = 'overview') => {
    setActionLoading(true);
    try {
      const bp = rowBillingMonth || billingPeriod;
      const params = new URLSearchParams();
      if (bp && bp !== 'ALL') params.append('billingPeriod', bp);
      const res = await fetch(`/api/payments/customers/${accountNo}?${params.toString()}`);
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
      const acc = selectedCustomerDetails.record?.accountNo;
      const bp = selectedCustomerDetails.billingInfo?.billingMonth || billingPeriod;
      const params = new URLSearchParams();
      if (bp && bp !== 'ALL') params.append('billingPeriod', bp);

      const res = await fetch(`/api/payments/customers/${acc}/correct?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctionForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Correction saved and re-validated successfully!', data.newStatus === 'READY' ? 'success' : 'warning');
        openCustomerDetails(acc, bp, 'overview');
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
  const handleToggleHold = async (accountNo, currentHold, rowBillingMonth) => {
    const reason = currentHold ? null : prompt(`Enter reason for placing ${accountNo} on payment hold:`);
    if (!currentHold && reason === null) return;

    setActionLoading(true);
    try {
      const bp = rowBillingMonth || billingPeriod;
      const params = new URLSearchParams();
      if (bp && bp !== 'ALL') params.append('billingPeriod', bp);
      params.append('hold', String(!currentHold));
      if (reason) params.append('reason', reason);

      const res = await fetch(`/api/payments/customers/${accountNo}/toggle-hold?${params.toString()}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Payment hold ${!currentHold ? 'activated' : 'released'} for ${accountNo}.`);
        fetchSummary();
        fetchCustomers();
        if (detailsModalOpen) openCustomerDetails(accountNo, bp);
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
      const readyAccounts = Array.from(selectedAccounts).filter(accNo => {
        const row = customersData.content.find(c => c.accountNo === accNo);
        return !row || row.paymentStatus === 'READY' || row.isEligible;
      });

      if (readyAccounts.length === 0) {
        showToast('Cannot create batch: Zero eligible READY customers selected.', 'error');
        setActionLoading(false);
        return;
      }

      const res = await fetch('/api/payments/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: billingPeriod !== 'ALL' ? billingPeriod : (availableMonths[0] || 'Current Period'),
          division: division !== 'ALL' ? division : 'ALL',
          accountNos: readyAccounts
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Payment Batch ${data.batchNumber} successfully created with ${data.customerCount} customers!`);
        setSelectedAccounts(new Set());
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
      reason = prompt('Enter rejection reason for this payment batch:');
      if (reason === null) return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/payments/batches/${batchId}/transition`, {
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
      const res = await fetch(`/api/payments/batches/${batchId}`);
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
    const selRows = customersData.content.filter(c => selectedAccounts.has(c.accountNo));
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
  }, [customersData.content, selectedAccounts]);

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.75rem 2rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 99999,
          padding: '0.85rem 1.4rem',
          borderRadius: '8px',
          background: toastMessage.type === 'error'
            ? 'rgba(239, 68, 68, 0.96)'
            : toastMessage.type === 'warning'
              ? 'rgba(245, 158, 11, 0.96)'
              : 'rgba(16, 185, 129, 0.96)',
          color: '#ffffff',
          fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage.type === 'error' ? <XCircle size={18} /> : toastMessage.type === 'warning' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ fontSize: '0.9rem' }}>{toastMessage.msg}</span>
        </div>
      )}

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
            onClick={() => setBatchReviewModalOpen(true)}
            disabled={selectedAccounts.size === 0}
            className="btn"
            style={{
              background: selectedAccounts.size > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
              border: 'none',
              color: selectedAccounts.size > 0 ? '#fff' : 'var(--text-muted)',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              cursor: selectedAccounts.size > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: '0.88rem',
              boxShadow: selectedAccounts.size > 0 ? '0 4px 14px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Send size={16} />
            <span>Create Payment Batch ({selectedAccounts.size})</span>
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
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(17, 24, 39, 0.8))',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '12px',
          padding: '1.15rem 1.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Customers
            </span>
            <User size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
            {(summary.totalCustomers || summary.customerCount || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Total canonical producers
          </div>
        </div>

        {/* Card 2: Payment Ready */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(17, 24, 39, 0.8))',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '1.15rem 1.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Payment Ready
            </span>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
            {(summary.paymentReadyCount || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Verified eligible for disbursement
          </div>
        </div>

        {/* Card 3: Payment On Hold */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(17, 24, 39, 0.8))',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '12px',
          padding: '1.15rem 1.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Payment On Hold
            </span>
            <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
            {(summary.onHoldCount || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Withheld by blocking validations
          </div>
        </div>

        {/* Card 4: Requires Review */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(17, 24, 39, 0.8))',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '12px',
          padding: '1.15rem 1.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Requires Review
            </span>
            <Clock size={18} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f3f4f6' }}>
            {(summary.reviewCount || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Duplicate / audit flag
          </div>
        </div>

        {/* Card 5: Total Payable */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(17, 24, 39, 0.8))',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: '12px',
          padding: '1.15rem 1.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Payable
            </span>
            <DollarSign size={18} style={{ color: '#06b6d4' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {formatLKR(summary.totalPayable)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Ready settlement balance
          </div>
        </div>

        {/* Card 6: Total On Hold */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(17, 24, 39, 0.8))',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          padding: '1.15rem 1.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total On Hold
            </span>
            <Lock size={18} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {formatLKR(summary.totalOnHold)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Pending resolution
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
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '8px', padding: '0.45rem 0.85rem', border: '1px solid var(--border-color)', minWidth: '280px' }}>
            <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
            <input
              type="text"
              placeholder="Search Account No or Customer Name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%' }}
            />
            {searchQuery && (
              <X size={14} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
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
          onClick={() => { setActiveTab('BATCHES'); setSelectedAccounts(new Set()); }}
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
          onClick={() => { setActiveTab('HISTORY'); setSelectedAccounts(new Set()); }}
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
            color: 'var(--text-secondary)'
          }}>
            <div>
              Showing {customersData.content.length > 0 ? (currentPage * pageSize + 1) : 0} to{' '}
              {Math.min((currentPage + 1) * pageSize, customersData.totalElements)} of {customersData.totalElements} records
              {activeTab === 'READY' && selectedAccounts.size > 0 && (
                <span style={{ marginLeft: '1rem', color: '#10b981', fontWeight: 600 }}>
                  ({selectedAccounts.size} selected for batch)
                </span>
              )}
            </div>

            {/* Quick batch button in header */}
            {activeTab === 'READY' && selectedAccounts.size > 0 && (
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
                <span>Create Batch ({selectedAccounts.size})</span>
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.85rem 0.75rem', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={
                        customersData.content.length > 0 &&
                        customersData.content.filter(c => c.paymentStatus === 'READY' || c.isEligible).length > 0 &&
                        customersData.content.filter(c => c.paymentStatus === 'READY' || c.isEligible).every(c => selectedAccounts.has(c.accountNo))
                      }
                      onChange={selectAllEligibleVisible}
                      title="Select all PAYMENT READY records on this page"
                      style={{ cursor: 'pointer', accentColor: '#10b981' }}
                    />
                  </th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Account No</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Customer Name</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Net Type</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Billing Month</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Billing Period</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>Current Payment</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>Outstanding Balance</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>Total Payable</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Validation</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Payment Status</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Eligibility</th>
                  <th style={{ padding: '0.85rem 0.75rem' }}>Hold Status & Reason</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
                      <div style={{ fontWeight: 600 }}>Loading month-wise payment records...</div>
                    </td>
                  </tr>
                ) : customersData.content.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <HelpCircle size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No Payment Records Found</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
                        No records match the chosen month, division, or filter criteria. Try selecting "All Approved Months" or resetting filters.
                      </div>
                    </td>
                  </tr>
                ) : (
                  customersData.content.map((row) => {
                    const isSelected = selectedAccounts.has(row.accountNo);
                    const isReady = row.paymentStatus === 'READY' || row.isEligible;
                    const isOnHold = row.paymentStatus === 'ON_HOLD' || row.paymentStatus === 'REVIEW';

                    return (
                      <tr
                        key={`${row.accountNo}-${row.billingMonth || row.billingPeriod}`}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isReady}
                            onChange={() => toggleSelectAccount(row.accountNo, isReady)}
                            title={isReady ? 'Select for payment batch' : 'Ineligible: Only READY records can enter payment batch'}
                            style={{ cursor: isReady ? 'pointer' : 'not-allowed', accentColor: '#10b981', opacity: isReady ? 1 : 0.3 }}
                          />
                        </td>

                        {/* Account Number */}
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
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.customerName || row.masterName || '—'}
                        </td>

                        {/* Net Type */}
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-secondary)' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.06)',
                            fontSize: '0.76rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}>
                            {row.solarType || row.masterNetType || '—'}
                          </span>
                        </td>

                        {/* Billing Month */}
                        <td style={{ padding: '0.85rem 0.75rem', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {row.billingMonth || billingPeriod || '—'}
                        </td>

                        {/* Billing Period */}
                        <td style={{ padding: '0.85rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {row.billingPeriod || row.billingMonth || '—'}
                        </td>

                        {/* Current Payment */}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {formatLKR(row.currentPayment)}
                        </td>

                        {/* Outstanding Balance */}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: Number(row.outstandingBalance) > 0 ? '#f87171' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatLKR(row.outstandingBalance)}
                        </td>

                        {/* Total Payable */}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>
                          {formatLKR(row.totalPayable)}
                        </td>

                        {/* Validation Status */}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: row.validationStatus === 'ERROR'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : row.validationStatus === 'WARNING'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                            color: row.validationStatus === 'ERROR'
                              ? '#ef4444'
                              : row.validationStatus === 'WARNING'
                                ? '#fbbf24'
                                : '#10b981'
                          }}>
                            {row.validationStatus || 'VALID'}
                          </span>
                        </td>

                        {/* Payment Status */}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '999px',
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            background: row.paymentStatus === 'READY'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : row.paymentStatus === 'PAID'
                                ? 'rgba(16, 185, 129, 0.25)'
                                : row.paymentStatus === 'PROCESSING' || row.paymentStatus === 'APPROVED'
                                  ? 'rgba(6, 182, 212, 0.15)'
                                  : row.paymentStatus === 'REVIEW'
                                    ? 'rgba(168, 85, 247, 0.15)'
                                    : 'rgba(245, 158, 11, 0.15)',
                            color: row.paymentStatus === 'READY' || row.paymentStatus === 'PAID'
                              ? '#10b981'
                              : row.paymentStatus === 'PROCESSING' || row.paymentStatus === 'APPROVED'
                                ? '#38bdf8'
                                : row.paymentStatus === 'REVIEW'
                                  ? '#c084fc'
                                  : '#f59e0b',
                            border: `1px solid ${
                              row.paymentStatus === 'READY' || row.paymentStatus === 'PAID'
                                ? 'rgba(16, 185, 129, 0.3)'
                                : row.paymentStatus === 'PROCESSING' || row.paymentStatus === 'APPROVED'
                                  ? 'rgba(6, 182, 212, 0.3)'
                                  : row.paymentStatus === 'REVIEW'
                                    ? 'rgba(168, 85, 247, 0.3)'
                                    : 'rgba(245, 158, 11, 0.3)'
                            }`
                          }}>
                            {row.paymentStatus}
                          </span>
                        </td>

                        {/* Payment Eligibility */}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            background: isReady
                              ? 'rgba(16, 185, 129, 0.12)'
                              : row.paymentStatus === 'REVIEW'
                                ? 'rgba(168, 85, 247, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                            color: isReady
                              ? '#34d399'
                              : row.paymentStatus === 'REVIEW'
                                ? '#c084fc'
                                : '#f87171'
                          }}>
                            {row.paymentEligibility || (isReady ? 'READY' : (row.paymentStatus === 'REVIEW' ? 'REVIEW' : 'ON HOLD'))}
                          </span>
                        </td>

                        {/* Month-Specific Hold Status / Diagnostics */}
                        <td style={{ padding: '0.85rem 0.75rem', minWidth: '170px' }}>
                          {isReady ? (
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <CheckCircle2 size={13} /> Eligible
                            </span>
                          ) : row.paymentStatus === 'PAID' ? (
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <CheckCircle2 size={13} /> Paid & Settled
                            </span>
                          ) : row.paymentStatus === 'PROCESSING' || row.paymentStatus === 'APPROVED' ? (
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#38bdf8' }}>
                              In Payment Batch
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {/* If mismatches present */}
                              {row.mismatches && row.mismatches.length > 0 ? (
                                <div>
                                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '3px', background: 'rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 800, fontSize: '0.7rem' }}>
                                    MISMATCH
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: '0.15rem' }}>
                                    {row.mismatches.map(m => m.field).join(', ')}
                                  </div>
                                </div>
                              ) : row.missingFields && row.missingFields.length > 0 ? (
                                <div>
                                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '3px', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontWeight: 800, fontSize: '0.7rem' }}>
                                    MISSING DETAILS
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: '#fde68a', marginTop: '0.15rem' }}>
                                    {row.missingFields.slice(0, 2).join(', ')}{row.missingFields.length > 2 ? '...' : ''}
                                  </div>
                                </div>
                              ) : Boolean(row.paymentHold) ? (
                                <div>
                                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '3px', background: 'rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 800, fontSize: '0.7rem' }}>
                                    PAYMENT HOLD
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                    {row.paymentHoldReason || 'Manual Hold'}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.74rem', color: '#fbbf24', fontWeight: 600 }}>
                                  {row.holdStatus || (row.holdReasons && row.holdReasons.length > 0 ? row.holdReasons[0] : 'ON HOLD')}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            {/* View Details button */}
                            <button
                              onClick={() => openCustomerDetails(row.accountNo, row.billingMonth, 'overview')}
                              title="View Customer Financial Dossier & Discrepancies"
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.78rem',
                                fontWeight: 600
                              }}
                            >
                              <Eye size={13} />
                              <span>Details</span>
                            </button>

                            {/* Resolve Issue button for ON_HOLD */}
                            {isOnHold && (
                              <button
                                onClick={() => openCustomerDetails(row.accountNo, row.billingMonth, 'resolve')}
                                title="Resolve Discrepancy & Re-evaluate"
                                style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  color: '#fbbf24',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 600
                                }}
                              >
                                <Wrench size={13} />
                                <span>Resolve</span>
                              </button>
                            )}

                            {/* Hold / Release toggle */}
                            {isAdmin && (
                              <button
                                onClick={() => handleToggleHold(row.accountNo, Boolean(row.paymentHold), row.billingMonth)}
                                title={row.paymentHold ? 'Release Payment Hold' : 'Place on Payment Hold'}
                                style={{
                                  background: row.paymentHold ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  border: row.paymentHold ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                  color: row.paymentHold ? '#10b981' : '#f87171',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 600
                                }}
                              >
                                {row.paymentHold ? <Unlock size={13} /> : <Lock size={13} />}
                                <span>{row.paymentHold ? 'Release' : 'Hold'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
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
              </div>

              <button
                onClick={() => setDetailsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem' }}
              >
                <X size={20} />
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
              <button onClick={() => setBatchReviewModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
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
              <button onClick={() => setBatchDetailsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
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
    </div>
  );
};

export default PaymentControlCenter;
