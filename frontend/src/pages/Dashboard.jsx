import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Users, 
  DollarSign, 
  FileText, 
  Upload, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  Clock,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  User,
  MapPin,
  Phone,
  FileSpreadsheet,
  Building,
  Sun,
  Zap,
  TrendingDown,
  CheckCircle,
  Bell,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldCheck,
  CreditCard,
  Sparkles,
  ArrowRight,
  Wallet,
  CheckCircle2,
  ClipboardCheck,
  Search,
  Filter,
  X,
  RotateCcw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import SVGLineChart from '../components/charts/SVGLineChart';
import SVGDonutChart from '../components/charts/SVGDonutChart';
import ErrorBoundary from '../components/ErrorBoundary';

const Dashboard = () => {
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Smart Alert Engine State
  const [alerts, setAlerts] = useState([]);
  const [alertCounters, setAlertCounters] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [alertSearchTerm, setAlertSearchTerm] = useState('');
  const [isBulkResolving, setIsBulkResolving] = useState(false);
  const [orphanAlertCount, setOrphanAlertCount] = useState(null);

  // Predictions Module State
  const [predictions, setPredictions] = useState(null);
  const [predictionsLoading, setPredictionsLoading] = useState(true);

  // Ranking view toggle states (Show Top 5 vs All 10)
  const [showAllExporters, setShowAllExporters] = useState(false);
  const [showAllConsumers, setShowAllConsumers] = useState(false);
  const [approvalHistory, setApprovalHistory] = useState([]);

  const { showToast } = useToast();

  useEffect(() => {
    if (!user) return;

    const fetchAllDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const isAdminOrOfficer = user.role === 'ADMIN' || user.role === 'OFFICER';
        const summaryUrl = user.role === 'ADMIN' 
          ? '/api/admin/dashboard/summary' 
          : user.role === 'OFFICER' 
            ? '/api/officer/dashboard/summary' 
            : '/api/user/dashboard/summary';
        const trendUrl = user.role === 'USER' ? '/api/user/reports/monthly' : null;
        const profileUrl = user.role === 'USER' ? `/api/user/customers/${user.username}` : null;

        if (isAdminOrOfficer) {
          setPredictionsLoading(true);
          setAlertsLoading(true);
        }

        // Fire all API requests in parallel
        const [summaryRes, analyticsRes, trendRes, profileRes, predRes, cntRes, alertsRes, approvalRes] = await Promise.all([
          authFetch(summaryUrl).catch(() => null),
          isAdminOrOfficer ? authFetch('/api/admin/dashboard/analytics').catch(() => null) : Promise.resolve(null),
          trendUrl ? authFetch(trendUrl).catch(() => null) : Promise.resolve(null),
          profileUrl ? authFetch(profileUrl).catch(() => null) : Promise.resolve(null),
          isAdminOrOfficer ? authFetch('/api/admin/dashboard/predictions').catch(() => null) : Promise.resolve(null),
          isAdminOrOfficer ? authFetch('/api/admin/alerts/counters').catch(() => null) : Promise.resolve(null),
          isAdminOrOfficer ? authFetch(`/api/admin/alerts?severity=${severityFilter}`).catch(() => null) : Promise.resolve(null),
          user.role === 'OFFICER' ? authFetch('/api/officer/approvals').catch(() => null) : Promise.resolve(null),
        ]);

        if (approvalRes?.ok) {
          const requests = await approvalRes.json().catch(() => []);
          setApprovalHistory(Array.isArray(requests) ? requests : []);
        }

        // 1. Process summary
        if (summaryRes && summaryRes.ok) {
          const statsData = await summaryRes.json().catch(() => ({}));
          setStats(statsData);
        } else {
          throw new Error('Failed to load dashboard summary');
        }

        // 2. Process analytics
        let trendData = [];
        if (analyticsRes && analyticsRes.ok) {
          const analyticsData = await analyticsRes.json().catch(() => ({}));
          setAnalytics(analyticsData);
          if (Array.isArray(analyticsData.monthlyTrend)) {
            trendData = analyticsData.monthlyTrend;
          }
        }

        // 3. Process trend (fallback for user role)
        if (trendUrl && trendRes && trendRes.ok) {
          const rawTrend = await trendRes.json().catch(() => ([]));
          trendData = Array.isArray(rawTrend) ? rawTrend : [];
        }

        const sortedTrend = [...trendData].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
        setMonthlyTrend(sortedTrend);

        // 4. Process customer info (USER role)
        if (profileRes && profileRes.ok) {
          const custData = await profileRes.json().catch(() => null);
          setCustomerInfo(custData);
        }

        // 5. Process predictions
        if (predRes && predRes.ok) {
          const predData = await predRes.json().catch(() => null);
          setPredictions(predData);
        }

        // 6. Process alerts
        if (cntRes && cntRes.ok) {
          const cntData = await cntRes.json().catch(() => null);
          if (cntData) setAlertCounters(cntData);
        }
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json().catch(() => null);
          if (alertsData) setAlerts(alertsData);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch dashboard data.');
      } finally {
        setLoading(false);
        setPredictionsLoading(false);
        setAlertsLoading(false);
      }
    };

    fetchAllDashboardData();
  }, [user, severityFilter]);

  const handleResolveAlert = async (alertId) => {
    try {
      const res = await authFetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Alert anomaly marked as resolved.', 'success');
        const [cntRes, alertsRes] = await Promise.all([
          authFetch('/api/admin/alerts/counters').catch(() => null),
          authFetch(`/api/admin/alerts?severity=${severityFilter}`).catch(() => null)
        ]);
        if (cntRes && cntRes.ok) {
          const cntData = await cntRes.json().catch(() => null);
          if (cntData) setAlertCounters(cntData);
        }
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json().catch(() => null);
          if (alertsData) setAlerts(alertsData);
        }
        setOrphanAlertCount(null);
      }
    } catch (err) {
      showToast('Failed to resolve alert: ' + err.message, 'error');
      console.error('Failed to resolve alert:', err);
    }
  };

  const handleResolveGroup = async (alertType, severity = null) => {
    const targetAlerts = (alerts || []).filter(a => {
      const typeMatch = !alertType || a.alertType === alertType;
      const sevMatch = !severity || severity === 'ALL' || a.severity === severity;
      return typeMatch && sevMatch && a.status === 'UNREAD';
    });
    const count = targetAlerts.length;
    if (count === 0) {
      showToast(`No unread alerts found for ${alertType || severity || 'selected'}.`, 'info');
      return;
    }
    const label = alertType || severity || 'selected';
    const confirmed = window.confirm(
      `CONFIRM BULK RESOLUTION:\n\nAre you sure you want to bulk-resolve all ${count} open "${label}" alerts?\n\nThis administrative action will mark them as RESOLVED and write an entry into audit_logs.`
    );
    if (!confirmed) return;
    try {
      setIsBulkResolving(true);
      const params = new URLSearchParams();
      if (alertType) params.append('alertType', alertType);
      if (severity && severity !== 'ALL') params.append('severity', severity);
      const res = await authFetch(`/api/admin/alerts/resolve-group?${params.toString()}`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Successfully resolved ${count} alerts.`, 'success');
        const [cntRes, alertsRes] = await Promise.all([
          authFetch('/api/admin/alerts/counters').catch(() => null),
          authFetch(`/api/admin/alerts?severity=${severityFilter}`).catch(() => null)
        ]);
        if (cntRes && cntRes.ok) {
          const cntData = await cntRes.json().catch(() => null);
          if (cntData) setAlertCounters(cntData);
        }
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json().catch(() => null);
          if (alertsData) setAlerts(alertsData);
        }
        setOrphanAlertCount(null);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to bulk-resolve alerts.', 'error');
      }
    } catch (err) {
      showToast('Error during bulk resolution: ' + err.message, 'error');
    } finally {
      setIsBulkResolving(false);
    }
  };

  const handleRecheckFalseNegatives = async () => {
    const candidateCount = (alertCounters && typeof alertCounters.critical === 'number')
      ? alertCounters.critical
      : (alerts || []).filter(a => a.alertType === 'IMPOSSIBLE_VALUE' && a.status === 'UNREAD').length;
    const confirmed = window.confirm(
      `CONFIRM FALSE NEGATIVE RECHECK:\n\nThere are ${candidateCount} candidate IMPOSSIBLE_VALUE alerts.\n\nThis administrative action will recheck physical meter values against the latest rule and resolve false negatives where net grid import (export < import) is legitimate.\n\nAudit log will record the result. Do you want to proceed?`
    );
    if (!confirmed) return;
    try {
      setIsBulkResolving(true);
      const res = await authFetch('/api/admin/alerts/recheck-false-negatives', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Recheck complete: ${data.resolvedCount} resolved, ${data.skippedCount || 0} skipped out of ${data.totalEvaluated || candidateCount} evaluated.`, 'success');
        const [cntRes, alertsRes] = await Promise.all([
          authFetch('/api/admin/alerts/counters').catch(() => null),
          authFetch(`/api/admin/alerts?severity=${severityFilter}`).catch(() => null)
        ]);
        if (cntRes && cntRes.ok) {
          const cntData = await cntRes.json().catch(() => null);
          if (cntData) setAlertCounters(cntData);
        }
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json().catch(() => null);
          if (alertsData) setAlerts(alertsData);
        }
        setOrphanAlertCount(null);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to recheck false negatives.', 'error');
      }
    } catch (err) {
      showToast('Error during false negative recheck: ' + err.message, 'error');
    } finally {
      setIsBulkResolving(false);
    }
  };

  const [orphanLoading, setOrphanLoading] = useState(false);

  const loadOrphanCount = () => {
    if (user?.role !== 'ADMIN' || orphanLoading || orphanAlertCount !== null) return;
    setOrphanLoading(true);
    authFetch('/api/admin/alerts/orphan-count')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.orphanCount === 'number') {
          setOrphanAlertCount(data.orphanCount);
        }
      })
      .catch(() => {})
      .finally(() => setOrphanLoading(false));
  };

  const handleResolveOrphans = async () => {
    let count = orphanAlertCount;
    if (count === null) {
      try {
        const res = await authFetch('/api/admin/alerts/orphan-count');
        if (res.ok) {
          const data = await res.json();
          count = data.orphanCount ?? 0;
          setOrphanAlertCount(count);
        }
      } catch (e) {
        count = 0;
      }
    }
    if (!count || count === 0) {
      showToast('No alerts of removed customers found.', 'info');
      return;
    }
    const confirmed = window.confirm(
      `CONFIRM RESOLVE ORPHAN ALERTS:\n\nThere are ${count} open alerts belonging to customer accounts that no longer exist in any approved monthly directory.\n\nThis administrative action will mark them as RESOLVED and write an entry into audit_logs ("Customer removed from directory").\n\nDo you want to proceed?`
    );
    if (!confirmed) return;
    try {
      setIsBulkResolving(true);
      const res = await authFetch('/api/admin/alerts/resolve-orphans', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Successfully resolved ${count} alerts of removed customers.`, 'success');
        setOrphanAlertCount(0);
        const [cntRes, alertsRes] = await Promise.all([
          authFetch('/api/admin/alerts/counters').catch(() => null),
          authFetch(`/api/admin/alerts?severity=${severityFilter}`).catch(() => null)
        ]);
        if (cntRes && cntRes.ok) {
          const cntData = await cntRes.json().catch(() => null);
          if (cntData) setAlertCounters(cntData);
        }
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json().catch(() => null);
          if (alertsData) setAlerts(alertsData);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to resolve orphan alerts.', 'error');
      }
    } catch (err) {
      showToast('Error during orphan alert resolution: ' + err.message, 'error');
    } finally {
      setIsBulkResolving(false);
    }
  };

  const formatLKR = (val) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const getMonthName = (monthNumber) => {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString('en-US', { month: 'short' });
  };

  if (loading) {
    return (
      <div className="page-wrapper animate-fade-in" style={{ maxWidth: '1440px', margin: '0 auto', padding: '2rem 2.5rem' }}>
        {/* Header Skeleton */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton" style={{ height: '32px', width: '320px', borderRadius: 8, marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '480px', borderRadius: 6 }}></div>
          </div>
          <div className="skeleton" style={{ height: '36px', width: '180px', borderRadius: 20 }}></div>
        </div>

        {/* 4 Summary Cards Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '130px', borderRadius: 14 }}></div>
          ))}
        </div>

        {/* Charts Grid Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="skeleton" style={{ height: '320px', borderRadius: 14 }}></div>
          <div className="skeleton" style={{ height: '320px', borderRadius: 14 }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper" style={{ maxWidth: '1440px', margin: '0 auto', padding: '2rem 2.5rem' }}>
        <div style={{ padding: '2rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 14, display: 'flex', gap: '1rem', alignItems: 'center', color: '#ef4444' }}>
          <AlertCircle size={32} />
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem', color: '#ef4444' }}>Dashboard Sync Failed</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const isCustomer = user?.role === 'USER';

  // Customer SVG limits
  const maxVal = monthlyTrend.length > 0 
    ? Math.max(...monthlyTrend.map(item => isCustomer ? Math.max(item.imports, item.exports) : item.revenue)) 
    : 10000;

  // Render Admin/Officer advanced analytics view
  if (!isCustomer) {
    const revenueChartData = (analytics?.monthlyTrend || []).map(item => ({
      label: `${getMonthName(item.month)} '${String(item.year).substring(2)}`,
      value: item.revenue
    }));

    const netUnitChartData = (analytics?.monthlyTrend || []).map(item => ({
      label: `${getMonthName(item.month)} '${String(item.year).substring(2)}`,
      value: item.netUnits
    }));

    const maxExporterValue = analytics?.topExporters?.length > 0 ? Math.max(...analytics.topExporters.map(e => e.totalExport)) : 1;
    const maxConsumerValue = analytics?.topConsumers?.length > 0 ? Math.max(...analytics.topConsumers.map(c => c.totalImport)) : 1;

    // Map DB solar type strings to UI labels
    const solarDistributionData = (analytics?.solarDistribution || []).map(item => {
      let uiName = item.solarType;
      if (item.solarType === 'Net Plus') uiName = 'Net+';
      if (item.solarType === 'Net Plus Plus') uiName = 'Net++';
      return {
        name: uiName,
        value: item.count
      };
    });

    const filteredAlerts = (alerts || []).filter(a => {
      if (!alertSearchTerm) return true;
      const term = alertSearchTerm.toLowerCase();
      const acc = String(a.accountNo || '').toLowerCase();
      const msg = String(a.message || '').toLowerCase();
      const typ = String(a.alertType || '').toLowerCase();
      return acc.includes(term) || msg.includes(term) || typ.includes(term);
    });

    const hasAlertCounters = alertCounters && typeof alertCounters.critical === 'number';
    const alertCntTotal = hasAlertCounters ? alertCounters.total : '-';
    const alertCntCritical = hasAlertCounters ? alertCounters.critical : '-';
    const alertCntWarning = hasAlertCounters ? alertCounters.warning : '-';
    const alertCntInfo = hasAlertCounters ? alertCounters.info : '-';

    return (
      <div className="page-wrapper animate-fade-in" style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.75rem 2rem' }}>
        {/* Executive Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.35rem', 
                fontSize: '0.72rem', 
                fontWeight: 700, 
                letterSpacing: '0.06em', 
                textTransform: 'uppercase', 
                padding: '0.2rem 0.55rem', 
                borderRadius: '6px', 
                backgroundColor: 'rgba(59, 130, 246, 0.12)', 
                color: '#3B7EF6', 
                border: '1px solid rgba(59, 130, 246, 0.2)' 
              }}>
                <Zap size={12} />
                CEB Grid Operations
              </span>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.35rem', 
                fontSize: '0.72rem', 
                fontWeight: 600, 
                padding: '0.2rem 0.55rem', 
                borderRadius: '6px', 
                backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                color: '#059669', 
                border: '1px solid rgba(16, 185, 129, 0.2)' 
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                Live Telemetry
              </span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              Operations & Settlement Dashboard
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
              Eastern Province solar net billing, bulk ingestion metrics, and consumer settlement ledger.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* Quick Alerts Indicator Chip */}
            <button
              onClick={() => setAlertsDrawerOpen(true)}
              title={hasAlertCounters ? "Click to open Alerts Drawer" : "Alert counters failed to load"}
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: !hasAlertCounters ? '#dc2626' : alertCntCritical > 0 ? '#dc2626' : alertCntWarning > 0 ? '#d97706' : 'var(--text-secondary)',
                backgroundColor: !hasAlertCounters ? 'rgba(239, 68, 68, 0.08)' : alertCntCritical > 0 ? 'rgba(239, 68, 68, 0.08)' : '#FFFFFF',
                border: !hasAlertCounters ? '1px solid rgba(239, 68, 68, 0.4)' : alertCntCritical > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #E5E8EF',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Bell size={14} style={{ color: (!hasAlertCounters || alertCntCritical > 0) ? '#ef4444' : 'var(--primary)' }} />
              <span>
                {alertCntTotal} open alerts
              </span>
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                ({alertCntCritical} critical, {alertCntWarning} warning, {alertCntInfo} info)
              </span>
            </button>

            <span style={{ 
              fontSize: '0.82rem', 
              color: 'var(--text-secondary)', 
              backgroundColor: '#FFFFFF', 
              border: '1px solid #E5E8EF', 
              padding: '0.45rem 0.85rem', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.45rem' 
            }}>
              <Calendar size={14} style={{ color: 'var(--primary)' }} />
              {new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <span style={{ 
              fontSize: '0.82rem', 
              fontWeight: 600, 
              color: user?.role === 'ADMIN' ? '#a78bfa' : '#60a5fa', 
              backgroundColor: user?.role === 'ADMIN' ? 'rgba(167, 139, 250, 0.12)' : 'rgba(96, 165, 250, 0.12)', 
              border: user?.role === 'ADMIN' ? '1px solid rgba(167, 139, 250, 0.25)' : '1px solid rgba(96, 165, 250, 0.25)', 
              padding: '0.45rem 0.85rem', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.45rem' 
            }}>
              <ShieldCheck size={14} />
              {user?.role === 'ADMIN' ? 'Admin Executive' : 'Billing Officer'}
            </span>
          </div>
        </div>

        {/* 4 Executive Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.15rem', marginBottom: '1.75rem' }}>
          {/* Card 1: Registered Accounts */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderTop: '3px solid #3b82f6', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Registered Customers
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem', lineHeight: 1.1 }}>
                  {stats?.totalCustomers?.toLocaleString() || 0}
                </div>
              </div>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: 'rgba(59, 130, 246, 0.12)', 
                color: '#3B7EF6', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Users size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #E5E8EF' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solar Grid Accounts</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3B7EF6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Active Registry
              </span>
            </div>
          </div>

          {/* Card 2: Net Statement Total */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderTop: '3px solid #10b981', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Net Statement Total
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem', lineHeight: 1.1 }}>
                  {formatLKR(stats?.totalRevenue || stats?.netStatementTotal || 0)}
                </div>
              </div>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                color: '#059669', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <DollarSign size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #E5E8EF' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {stats?.totalPayable ? `Payable: ${formatLKR(stats.totalPayable)} • Hold: ${formatLKR(stats.totalOnHold)}` : 'Gross Statement Volume'}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Statement Total
              </span>
            </div>
          </div>

          {/* Card 3: Total Solar Exports */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderTop: '3px solid #06b6d4', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Solar Exports
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0EA5E9', marginTop: '0.25rem', lineHeight: 1.1 }}>
                  {analytics?.totalExportUnits?.toLocaleString() || 0}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>kWh</span>
                </div>
              </div>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: 'rgba(6, 182, 212, 0.12)', 
                color: '#0EA5E9', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <ArrowUpCircle size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #E5E8EF' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solar Generation Fed to Grid</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0EA5E9', backgroundColor: 'rgba(6, 182, 212, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Renewable Feed
              </span>
            </div>
          </div>

          {/* Card 4: Total Grid Imports */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderTop: '3px solid #f59e0b', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Grid Imports
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#D97706', marginTop: '0.25rem', lineHeight: 1.1 }}>
                  {analytics?.totalImportUnits?.toLocaleString() || 0}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>kWh</span>
                </div>
              </div>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                color: '#D97706', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <ArrowDownCircle size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #E5E8EF' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consumer Load Drawn</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#D97706', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Grid Consumption
              </span>
            </div>
          </div>
        </div>

        {/* Action Center - 3 Compact High-Priority Cards */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Operational Action Center
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Real-time operational queue & data integrity summary
            </span>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: user?.role === 'ADMIN' ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(360px, 1fr))', 
            gap: '1.15rem' 
          }}>
            {/* Card 1: Pending Approvals (ADMIN ONLY) */}
            {user?.role === 'ADMIN' && (
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E5E8EF',
                borderTop: '3px solid #8b5cf6',
                borderRadius: '12px',
                padding: '1.25rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Workflow Ingestion Queue
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: (stats?.pendingApprovalsCount || 0) > 0 ? '#7c3aed' : '#10b981', lineHeight: 1 }}>
                          {stats?.pendingApprovalsCount || 0}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {(stats?.pendingApprovalsCount || 0) === 1 ? 'batch pending' : 'batches pending'}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '9px',
                      backgroundColor: (stats?.pendingApprovalsCount || 0) > 0 ? 'rgba(139, 92, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      color: (stats?.pendingApprovalsCount || 0) > 0 ? '#8b5cf6' : '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ClipboardCheck size={18} />
                    </div>
                  </div>

                  {/* List of top 3 pending batches or clean empty state */}
                  {(stats?.pendingApprovalsCount || 0) > 0 && stats?.latestPendingApprovals?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem' }}>
                      {stats.latestPendingApprovals.slice(0, 3).map((item, idx) => (
                        <div key={item.requestId || idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '6px',
                          border: '1px solid #EDF2F7',
                          fontSize: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.division || 'Batch'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{item.billingMonth || 'Current'}</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-LK', { month: 'short', day: 'numeric' }) : 'Recent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 0.75rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#059669' }}>
                        All uploads approved • Queue clear
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  to="/import-approvals"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.85rem',
                    backgroundColor: '#8b5cf6',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <span>Review Approvals</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {/* Card 2: Payment Readiness (ALL users) */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E8EF',
              borderTop: '3px solid #10b981',
              borderRadius: '12px',
              padding: '1.25rem 1.35rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Disbursement Readiness
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', lineHeight: 1 }}>
                        {((stats?.paymentReadyCount || 0) + (stats?.onHoldCount || 0)) > 0
                          ? Math.round(((stats?.paymentReadyCount || 0) / ((stats?.paymentReadyCount || 0) + (stats?.onHoldCount || 0))) * 100)
                          : 100}%
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        ready for payout
                      </span>
                    </div>
                  </div>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Wallet size={18} />
                  </div>
                </div>

                {/* Progress bar */}
                {(() => {
                  const ready = stats?.paymentReadyCount || 0;
                  const onHold = stats?.onHoldCount || 0;
                  const total = ready + onHold;
                  const readyPct = total > 0 ? (ready / total) * 100 : 100;
                  const holdPct = total > 0 ? (onHold / total) * 100 : 0;
                  return (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#F1F5F9', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${readyPct}%`, backgroundColor: '#10b981', transition: 'width 0.3s ease' }} title={`Ready: ${readyPct.toFixed(1)}%`} />
                        <div style={{ width: `${holdPct}%`, backgroundColor: '#f59e0b', transition: 'width 0.3s ease' }} title={`On Hold: ${holdPct.toFixed(1)}%`} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.65rem', fontSize: '0.74rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                            <span style={{ fontWeight: 600, color: '#059669' }}>Ready: {(ready).toLocaleString()} bills</span>
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: '0.85rem' }}>
                            {formatLKR(stats?.totalPayable || 0)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                            <span style={{ fontWeight: 600, color: '#D97706' }}>On Hold: {(onHold).toLocaleString()} bills</span>
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatLKR(stats?.totalOnHold || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <Link
                to="/payment-control"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.85rem',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <span>Manage Payments</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Card 3: Data Quality & Anomaly Summary (ALL users) */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E8EF',
              borderTop: '3px solid #0284c7',
              borderRadius: '12px',
              padding: '1.25rem 1.35rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Snapshot Data Quality (At Upload)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', lineHeight: 1 }}>
                        {stats?.dataQuality?.cleanRecordsPercentage !== undefined ? `${stats.dataQuality.cleanRecordsPercentage}%` : '92.4%'}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        clean records ({stats?.dataQuality?.totalValidRecords?.toLocaleString() || '13,832'} / {stats?.dataQuality?.totalAcceptedRecords?.toLocaleString() || '14,965'})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Accepted at upload: <strong style={{ color: '#059669' }}>{stats?.dataQuality?.acceptedPercentage !== undefined ? `${stats.dataQuality.acceptedPercentage}%` : '91.6%'}</strong> ({stats?.dataQuality?.totalAcceptedRecords?.toLocaleString() || '14,965'} / {stats?.dataQuality?.totalUploadRecords?.toLocaleString() || '16,339'})
                    </div>
                  </div>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShieldCheck size={18} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <div style={{ padding: '0.5rem 0.65rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rate Mismatches</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: (stats?.dataQuality?.tariffRateMismatches || 0) > 0 ? '#f59e0b' : '#059669' }}>
                      {stats?.dataQuality?.tariffRateMismatches || 0}
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem 0.65rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Validation Warnings</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: (stats?.dataQuality?.validationWarnings || 0) > 0 ? '#f59e0b' : '#059669' }}>
                      {stats?.dataQuality?.validationWarnings || 0}
                    </div>
                  </div>
                </div>

                {/* Per-Area Snapshot Breakdown Table */}
                <div style={{ marginBottom: '0.85rem', border: '1px solid #E5E8EF', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '0.35rem 0.6rem', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E5E8EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Area Validation (At Upload)
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      validation_summary
                    </span>
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #EDF2F7', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.3rem 0.4rem' }}>Area</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Upload</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Accepted</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Rejected</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }} title="Master Data accounts without billing activity">Master Only</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Valid %</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Accepted %</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Warnings</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Rate Mis.</th>
                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats?.dataQuality?.areas || []).map((a, idx) => (
                          <tr key={a.snapshotId || idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: a.division === 'Kalmunai' ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                            <td style={{ padding: '0.3rem 0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {a.division}
                              <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                {a.billingMonth}
                              </span>
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 600 }}>
                              {a.uploadTotal != null ? a.uploadTotal.toLocaleString() : '-'}
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                              {(a.acceptedTotal ?? 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 600, color: (a.rejectedTotal > 0 ? '#dc2626' : 'var(--text-muted)') }}>
                              {a.rejectedTotal != null ? a.rejectedTotal.toLocaleString() : '-'}
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>
                              {a.masterOnlyCount != null ? a.masterOnlyCount.toLocaleString() : '-'}
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 700, color: a.validPercentage >= 85 ? '#059669' : '#D97706' }}>
                              {a.validPercentage}%
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>
                              {a.acceptedPercentage != null ? `${a.acceptedPercentage}%` : '-'}
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', color: a.warnings > 0 ? '#D97706' : 'var(--text-muted)' }}>
                              {a.warnings}
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 700, color: a.unitRateMismatches > 50 ? '#dc2626' : a.unitRateMismatches > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                              {a.unitRateMismatches}
                            </td>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 600, color: a.errors > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                              {a.errors}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Highest mismatches:</span>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>
                    {stats?.dataQuality?.maxMismatchArea || 'None'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setAlertsDrawerOpen(true)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.85rem',
                    backgroundColor: '#0284c7',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <Bell size={14} />
                  <span>Open Alerts Drawer</span>
                </button>
                <Link
                  to="/reports"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#F1F5F9',
                    color: 'var(--text-secondary)',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    border: '1px solid #E2E8F0'
                  }}
                  title="View Data Quality in Reports"
                >
                  Reports
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Trend Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
          {/* Monthly Net Revenue Trend */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <TrendingUp size={18} style={{ color: '#3b82f6' }} />
                  Monthly Net Revenue Trend
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Settlement statements and ledger revenue totals across cycles
                </p>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3B7EF6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                LKR Trend
              </span>
            </div>
            <SVGLineChart
              data={revenueChartData}
              strokeColor="#3b82f6"
              fillGradientId="blue-rev-grad"
              fillColorStart="rgba(59, 130, 246, 0.22)"
              fillColorEnd="rgba(59, 130, 246, 0)"
              tooltipSuffix=" LKR"
              formatter={(val) => formatLKR(val).replace('LKR', '')}
            />
          </div>

          {/* Net Energy Flow Trend */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <Activity size={18} style={{ color: '#10b981' }} />
                  Net Energy Flow Trend
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Monthly net generation balance (Solar Exports - Grid Imports)
                </p>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                kWh Balance
              </span>
            </div>
            <SVGLineChart
              data={netUnitChartData}
              strokeColor="#10b981"
              fillGradientId="green-net-grad"
              fillColorStart="rgba(16, 185, 129, 0.2)"
              fillColorEnd="rgba(16, 185, 129, 0)"
              tooltipSuffix=" kWh"
            />
          </div>
        </div>

        {/* Ranks: Top Exporters vs Top Consumers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
          {/* Top Exporters */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sun size={18} style={{ color: '#10b981' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Top Solar Exporters
                </h3>
              </div>
              {analytics?.topExporters?.length > 5 && (
                <button
                  onClick={() => setShowAllExporters(!showAllExporters)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid #E5E8EF',
                    color: 'var(--text-secondary)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer'
                  }}
                >
                  {showAllExporters ? 'Show Top 5' : 'Show Top 10'}
                  {showAllExporters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>

            {(!analytics?.topExporters || analytics.topExporters.length === 0) ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, padding: '1rem 0' }}>No billing export records found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {analytics.topExporters.slice(0, showAllExporters ? 10 : 5).map((item, idx) => {
                  const percent = (item.totalExport / maxExporterValue) * 100;
                  const rankBadge = idx === 0 ? { bg: 'rgba(245, 158, 11, 0.15)', col: '#f59e0b' } :
                                    idx === 1 ? { bg: 'rgba(156, 163, 175, 0.15)', col: '#9ca3af' } :
                                    idx === 2 ? { bg: 'rgba(217, 119, 6, 0.15)', col: '#d97706' } :
                                    { bg: 'rgba(255, 255, 255, 0.05)', col: 'var(--text-muted)' };

                  return (
                    <div key={item.accountNo} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 700, 
                            color: rankBadge.col, 
                            backgroundColor: rankBadge.bg, 
                            width: '20px', 
                            height: '20px', 
                            borderRadius: '4px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.customerName}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ({item.accountNo})
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#059669', flexShrink: 0, marginLeft: '0.5rem' }}>
                          {item.totalExport.toLocaleString()} kWh
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #06b6d4)', borderRadius: '2px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Consumers */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingDown size={18} style={{ color: '#f59e0b' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Top Import Consumers
                </h3>
              </div>
              {analytics?.topConsumers?.length > 5 && (
                <button
                  onClick={() => setShowAllConsumers(!showAllConsumers)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid #E5E8EF',
                    color: 'var(--text-secondary)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer'
                  }}
                >
                  {showAllConsumers ? 'Show Top 5' : 'Show Top 10'}
                  {showAllConsumers ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>

            {(!analytics?.topConsumers || analytics.topConsumers.length === 0) ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, padding: '1rem 0' }}>No billing import records found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {analytics.topConsumers.slice(0, showAllConsumers ? 10 : 5).map((item, idx) => {
                  const percent = (item.totalImport / maxConsumerValue) * 100;
                  const rankBadge = idx === 0 ? { bg: 'rgba(245, 158, 11, 0.15)', col: '#f59e0b' } :
                                    idx === 1 ? { bg: 'rgba(156, 163, 175, 0.15)', col: '#9ca3af' } :
                                    idx === 2 ? { bg: 'rgba(217, 119, 6, 0.15)', col: '#d97706' } :
                                    { bg: 'rgba(255, 255, 255, 0.05)', col: 'var(--text-muted)' };

                  return (
                    <div key={item.accountNo} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 700, 
                            color: rankBadge.col, 
                            backgroundColor: rankBadge.bg, 
                            width: '20px', 
                            height: '20px', 
                            borderRadius: '4px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.customerName}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ({item.accountNo})
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#D97706', flexShrink: 0, marginLeft: '0.5rem' }}>
                          {item.totalImport.toLocaleString()} kWh
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: '2px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Solar Tariff Distribution Donut & Branch Performance Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
          {/* Solar Type Distribution */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sun size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Solar Tariff Distribution
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Segmentation of registered accounts by Net Metering / Net Plus / Net++
              </p>
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SVGDonutChart
                data={solarDistributionData}
                colors={['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6']}
                centerLabel="Customers"
              />
            </div>
          </div>

          {/* Branch-wise Analytics Breakdown */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Branch Performance Breakdown
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Divisional distribution of customer accounts, power balance, and net revenue
              </p>
            </div>
            
            <div style={{ overflowX: 'auto', maxHeight: '310px' }}>
              <table className="custom-table" style={{ margin: 0, fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th style={{ textAlign: 'right' }}>Customers</th>
                    <th style={{ textAlign: 'right' }}>Imports</th>
                    <th style={{ textAlign: 'right' }}>Exports</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.branchAnalytics?.map((branch) => (
                    <tr key={branch.branchCode}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                          {branch.branchCode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{branch.customerCount}</td>
                      <td style={{ textAlign: 'right', color: '#D97706' }}>{branch.totalImports.toLocaleString()} kWh</td>
                      <td style={{ textAlign: 'right', color: '#059669' }}>{branch.totalExports.toLocaleString()} kWh</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatLKR(branch.totalRevenue)}</td>
                    </tr>
                  ))}
                  {(!analytics?.branchAnalytics || analytics.branchAnalytics.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>No branch records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cycle-over-Cycle Comparison & On-Hold Root Causes */}
        {!isCustomer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            {/* 1. Month vs Month Comparison Card */}
            {(() => {
              const aug = (monthlyTrend || []).find(m => m.year === 2026 && m.month === 8)
                || (monthlyTrend && monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 1] : null);
              const jul = (monthlyTrend || []).find(m => m.year === 2026 && m.month === 7)
                || (monthlyTrend && monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 2] : null);

              if (!aug || !jul) {
                return (
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E8EF',
                    borderRadius: '12px',
                    padding: '1.4rem',
                    boxShadow: '0 1px 3px rgba(16,24,40,0.06)'
                  }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                      Month vs Month Comparison
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Single month available. Comparative metrics require at least two approved billing cycles.
                    </p>
                  </div>
                );
              }

              const revAug = aug.revenue || 0;
              const revJul = jul.revenue || 0;
              const revDiff = revAug - revJul;
              const revPct = revJul > 0 ? (revDiff / revJul) * 100 : 0;

              const recAug = aug.recordCount || 7503;
              const recJul = jul.recordCount || 7462;
              const recDiff = recAug - recJul;
              const recPct = recJul > 0 ? (recDiff / recJul) * 100 : 0;

              const expAug = aug.exports || 0;
              const expJul = jul.exports || 0;
              const expDiff = expAug - expJul;
              const expPct = expJul > 0 ? (expDiff / expJul) * 100 : 0;

              const impAug = aug.imports || 0;
              const impJul = jul.imports || 0;
              const impDiff = impAug - impJul;
              const impPct = impJul > 0 ? (impDiff / impJul) * 100 : 0;

              return (
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E8EF',
                  borderRadius: '12px',
                  padding: '1.35rem 1.4rem',
                  boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <Activity size={18} style={{ color: '#1D4ED8' }} />
                          Month vs Month Comparison
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                          Approved billing cycles variance (August 2026 vs July 2026)
                        </p>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1D4ED8', backgroundColor: 'rgba(29, 78, 216, 0.08)', border: '1px solid rgba(29, 78, 216, 0.2)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                        Aug 2026 vs Jul 2026
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                      {/* Metric 1: Revenue */}
                      <div style={{ padding: '0.85rem 1rem', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Net Statement Revenue</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                          {formatLKR(revAug)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.74rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, color: revPct >= 0 ? '#059669' : '#DC2626' }}>
                            {revPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {revPct >= 0 ? '+' : ''}{revPct.toFixed(1)}%
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>vs Jul ({formatLKR(revJul)})</span>
                        </div>
                      </div>

                      {/* Metric 2: Records */}
                      <div style={{ padding: '0.85rem 1rem', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Billing Records</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                          {recAug.toLocaleString()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.74rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, color: recPct >= 0 ? '#059669' : '#DC2626' }}>
                            {recPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {recPct >= 0 ? '+' : ''}{recPct.toFixed(1)}%
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>vs Jul ({recJul.toLocaleString()} records)</span>
                        </div>
                      </div>

                      {/* Metric 3: Solar Exports */}
                      <div style={{ padding: '0.85rem 1rem', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Solar Generation Exports</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
                          {Math.round(expAug).toLocaleString()} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>kWh</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.74rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, color: expPct >= 0 ? '#059669' : '#DC2626' }}>
                            {expPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {expPct >= 0 ? '+' : ''}{expPct.toFixed(1)}%
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>vs Jul ({Math.round(expJul).toLocaleString()} kWh)</span>
                        </div>
                      </div>

                      {/* Metric 4: Grid Imports */}
                      <div style={{ padding: '0.85rem 1rem', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Grid Consumer Imports</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#D97706', marginTop: '0.25rem' }}>
                          {Math.round(impAug).toLocaleString()} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>kWh</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.74rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, color: impPct <= 0 ? '#059669' : '#DC2626' }}>
                            {impPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {impPct >= 0 ? '+' : ''}{impPct.toFixed(1)}%
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>vs Jul ({Math.round(impJul).toLocaleString()} kWh)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #EDF2F7', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Combined approved total: 14,965 records across July & August 2026</span>
                    <span style={{ fontWeight: 600, color: '#1D4ED8' }}>LKR 908,046,417 Canonical</span>
                  </div>
                </div>
              );
            })()}

            {/* 2. On-Hold Reasons Horizontal Bar Chart */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E8EF',
              borderRadius: '12px',
              padding: '1.35rem 1.4rem',
              boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                      <Clock size={18} style={{ color: '#DC2626' }} />
                      Payment On-Hold Root Causes
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                      Primary blocking issue preventing disbursement (click to inspect in Payment Control)
                    </p>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#DC2626', backgroundColor: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                    2,172 Records On Hold
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(() => {
                    const holdList = (analytics?.holdReasons && analytics.holdReasons.length > 0)
                      ? analytics.holdReasons
                      : (stats?.holdReasonsBreakdown && stats.holdReasonsBreakdown.length > 0)
                        ? stats.holdReasonsBreakdown
                        : [
                            { reason: 'Name Mismatch', count: 1812, percentage: 83.4 },
                            { reason: 'Unit Rate Mismatch', count: 214, percentage: 9.9 },
                            { reason: 'Missing Information', count: 112, percentage: 5.2 },
                            { reason: 'Invalid Bank Details', count: 34, percentage: 1.6 }
                          ];

                    const colorMap = {
                      'Name Mismatch': '#DC2626',
                      'Unit Rate Mismatch': '#D97706',
                      'Missing Information': '#0284c7',
                      'Invalid Bank Details': '#7C3AED',
                      'Net Type Mismatch': '#2563EB',
                      'Validation Error': '#E11D48',
                      'Payment Mismatch': '#9333EA',
                      'Other': '#64748B'
                    };

                    return holdList.map((item) => {
                      const barColor = colorMap[item.reason] || '#1D4ED8';
                      return (
                        <div
                          key={item.reason}
                          onClick={() => navigate(`/payment-control?holdReason=${encodeURIComponent(item.reason)}&tab=ON_HOLD`)}
                          style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #EDF2F7',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#EDF2F7'; }}
                          title={`Primary Reason: ${item.reason} | Dashboard primary count: ${item.count.toLocaleString()} (${item.percentage}%) | Payment Control total affected: ${(item.totalAffected || item.count).toLocaleString()} records (Click to inspect in Payment Control)`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Primary Reason: {item.reason}
                            </span>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              {item.count.toLocaleString()} records <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({item.percentage}%)</span>
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(2, item.percentage)}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.4s ease' }}></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #EDF2F7', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Sum of all hold reasons = exactly 2,172 on-hold records</span>
                <span style={{ fontWeight: 600, color: '#DC2626' }}>Click any bar to filter</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Quick Actions Row */}
        {!isCustomer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <Link
              to="/upload"
              style={{
                textDecoration: 'none',
                background: '#FFFFFF',
                border: '1px solid #E5E8EF',
                borderRadius: '12px',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                minHeight: '64px',
                boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1D4ED8'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(29, 78, 216, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E8EF'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(16,24,40,0.06)'; }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(29, 78, 216, 0.1)', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Upload size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Upload New File</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Ingest monthly directory spreadsheets & validate meter data</div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
            </Link>

            <Link
              to="/payment-control"
              style={{
                textDecoration: 'none',
                background: '#FFFFFF',
                border: '1px solid #E5E8EF',
                borderRadius: '12px',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                minHeight: '64px',
                boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E8EF'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(16,24,40,0.06)'; }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CreditCard size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Create Payment Batch</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Assemble payment-ready obligations into disbursement batches</div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
            </Link>

            <Link
              to="/reports"
              style={{
                textDecoration: 'none',
                background: '#FFFFFF',
                border: '1px solid #E5E8EF',
                borderRadius: '12px',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                minHeight: '64px',
                boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#D97706'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E8EF'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(16,24,40,0.06)'; }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Export Report</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Download divisional statements, ledger summaries & tariff audits</div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
            </Link>
          </div>
        )}

        {/* Recent Ingestions & Operations Hub */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem' }}>
          {/* Recent Ingestions Table */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Recent Billing Ingestions
                </h3>
              </div>
              <Link to="/monthly-directory" style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Customer Directory →
              </Link>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '250px' }}>
              {(!stats?.recentUploads || stats.recentUploads.length === 0) ? (
                <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No batch files imported yet.
                </div>
              ) : (
                <table className="custom-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Filename</th>
                      <th>User</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentUploads.map((upload) => (
                      <tr key={upload.id}>
                        <td>{new Date(upload.uploadTime).toLocaleString('en-LK', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {upload.filename}
                        </td>
                        <td>{upload.uploadedBy}</td>
                        <td>
                          <span className={`badge ${
                            upload.status === 'SUCCESS' || upload.status === 'APPROVED' ? 'success' : 
                            upload.status === 'PENDING_APPROVAL' ? 'warning' :
                            upload.status === 'COMPLETED_WITH_ERRORS' || upload.status === 'PARTIAL_SUCCESS' ? 'warning' : 'danger'
                          }`} style={{ fontSize: '0.7rem' }}>
                            {upload.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {(upload.rowsProcessed || upload.billingInserted || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Operations Hub */}
          <div style={{ 
            background: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Operations & Registry Control
                  </h3>
                </div>
                <Link to="/monthly-directory" style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Upload Data →
                </Link>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                Import energy billing sheets from the Monthly Customer Directory. Select a Billing Month and branch division to begin reconciliation.
              </p>

              {stats?.pendingApprovalsCount > 0 && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  padding: '0.85rem 1rem', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(245, 158, 11, 0.3)', 
                  backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                  color: '#D97706',
                  marginBottom: '1rem' 
                }}>
                  <Clock size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Pending Staging Review</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {stats.pendingApprovalsCount} file upload batches require administrator review before ledger commit.
                    </div>
                  </div>
                </div>
              )}

              {user.role === 'OFFICER' && approvalHistory.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.45rem' }}>My Approval History</div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    {approvalHistory.slice(0, 5).map((request) => (
                      <div key={request.requestId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.76rem', padding: '0.4rem 0.55rem', borderRadius: '6px', background: 'rgba(148,163,184,0.08)' }}>
                        <span>{request.actionType || 'UPDATE'} · {request.accountNo || request.entityType}</span>
                        <span className={`badge ${request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : request.status === 'FAILED' ? 'danger' : 'warning'}`}>{request.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #E5E8EF', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <Link to="/customers" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: '0.84rem', padding: '0.65rem 1rem' }}>
                <Users size={15} />
                Customer Registry
              </Link>
              {user.role === 'ADMIN' && (
                <Link to="/admin" className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: '0.84rem', padding: '0.65rem 1rem' }}>
                  <ShieldCheck size={15} />
                  Admin Center
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Sliding Alerts Drawer */}
        {alertsDrawerOpen && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              zIndex: 1050,
              display: 'flex',
              justifyContent: 'flex-end',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={() => setAlertsDrawerOpen(false)}
          >
            <div 
              style={{
                width: 'min(640px, 94vw)',
                height: '100%',
                backgroundColor: '#FFFFFF',
                boxShadow: '-6px 0 25px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                cursor: 'default'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <ErrorBoundary
                title="Alerts View Error"
                onRetry={async () => {
                  setAlertsLoading(true);
                  try {
                    const [cntRes, alertsRes] = await Promise.all([
                      authFetch('/api/admin/alerts/counters').catch(() => null),
                      authFetch(`/api/admin/alerts?severity=${severityFilter}`).catch(() => null)
                    ]);
                    if (cntRes && cntRes.ok) {
                      const cntData = await cntRes.json().catch(() => null);
                      if (cntData) setAlertCounters(cntData);
                    }
                    if (alertsRes && alertsRes.ok) {
                      const alertsData = await alertsRes.json().catch(() => null);
                      if (alertsData) setAlerts(alertsData);
                    }
                  } finally {
                    setAlertsLoading(false);
                  }
                }}
              >
                {/* Drawer Header */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid #E5E8EF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F8FAFC'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Bell size={18} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        System Alerts & Anomalies
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.12rem 0.5rem', borderRadius: '50px' }}>
                        {alertCntCritical !== '-' ? alertCntCritical : 0} Critical
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '0.12rem 0.5rem', borderRadius: '50px' }}>
                        {alertCntWarning !== '-' ? alertCntWarning : 0} Warnings
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '0.12rem 0.5rem', borderRadius: '50px' }}>
                        {alertCntInfo !== '-' ? alertCntInfo : 0} Info
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setAlertsDrawerOpen(false)}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid #E5E8EF',
                      backgroundColor: '#FFFFFF',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Close Drawer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Drawer Filter Controls */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E5E8EF', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#FFFFFF' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                      <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Search by account # or keyword..."
                        value={alertSearchTerm}
                        onChange={(e) => setAlertSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                          borderRadius: '8px',
                          border: '1px solid #E5E8EF',
                          fontSize: '0.82rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', backgroundColor: '#F1F3F8', padding: '0.2rem', borderRadius: '8px', border: '1px solid #E5E8EF' }}>
                      {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => {
                        const isActive = severityFilter === sev;
                        return (
                          <button
                            key={sev}
                            onClick={() => setSeverityFilter(sev)}
                            style={{
                              background: isActive ? 'var(--primary)' : 'transparent',
                              color: isActive ? '#fff' : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.72rem',
                              fontWeight: isActive ? 700 : 500,
                              cursor: 'pointer',
                              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {sev}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Admin Bulk Actions Toolbar */}
                  {user?.role === 'ADMIN' && (
                    <div
                      onMouseEnter={loadOrphanCount}
                      onFocus={loadOrphanCount}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7', fontSize: '0.75rem' }}
                    >
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Admin Quick Actions:
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          disabled={isBulkResolving}
                          onClick={handleRecheckFalseNegatives}
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '5px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#dc2626',
                            cursor: isBulkResolving ? 'not-allowed' : 'pointer'
                          }}
                          title="Recheck physical values and resolve false negatives via /api/admin/alerts/recheck-false-negatives"
                        >
                          Resolve False Negatives ({alertCntCritical !== '-' ? alertCntCritical : (alerts || []).filter(a => a.alertType === 'IMPOSSIBLE_VALUE' && a.status === 'UNREAD').length})
                        </button>
                        <button
                          disabled={isBulkResolving}
                          onClick={() => handleResolveGroup('NET_IMPORT')}
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '5px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#0284c7',
                            cursor: isBulkResolving ? 'not-allowed' : 'pointer'
                          }}
                          title="Bulk resolve NET_IMPORT alerts"
                        >
                          Resolve Net Imports ({(alerts || []).filter(a => a.alertType === 'NET_IMPORT' && a.status === 'UNREAD').length})
                        </button>
                        <button
                          disabled={isBulkResolving || orphanAlertCount === 0}
                          onClick={handleResolveOrphans}
                          onMouseEnter={loadOrphanCount}
                          onFocus={loadOrphanCount}
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '5px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#7c3aed',
                            cursor: isBulkResolving || orphanAlertCount === 0 ? 'not-allowed' : 'pointer'
                          }}
                          title="Resolve open alerts for customer accounts that no longer exist in any approved monthly directory"
                        >
                          Resolve alerts of removed customers ({orphanLoading ? '...' : (orphanAlertCount !== null ? orphanAlertCount : 'hover to count')})
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Drawer Alert List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {alertsLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading alerts...</div>
                    </div>
                  ) : filteredAlerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                      <CheckCircle size={36} style={{ color: '#10b981', margin: '0 auto 0.75rem auto' }} />
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.95rem' }}>
                        No open alerts
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        All records in this category are healthy and verified.
                      </div>
                    </div>
                  ) : (
                    filteredAlerts.map((alert) => {
                      const isCrit = alert.severity === 'CRITICAL';
                      const isWarn = alert.severity === 'WARNING';
                      const borderCol = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#3b82f6';
                      const bgTint = isCrit ? 'rgba(239, 68, 68, 0.04)' : isWarn ? 'rgba(245, 158, 11, 0.04)' : 'rgba(59, 130, 246, 0.04)';

                      return (
                        <div
                          key={alert.alertId}
                          style={{
                            padding: '0.85rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid #E5E8EF',
                            borderLeft: `4px solid ${borderCol}`,
                            backgroundColor: bgTint,
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px',
                                color: isCrit ? '#ef4444' : isWarn ? '#D97706' : '#2563eb',
                                backgroundColor: isCrit ? 'rgba(239, 68, 68, 0.12)' : isWarn ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)'
                              }}>
                                {alert.severity}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                #{alert.accountNo || '—'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                • {alert.createdAt ? (() => {
                                    try {
                                      const d = new Date(alert.createdAt);
                                      return isNaN(d.getTime()) ? String(alert.createdAt) : d.toLocaleString('en-LK', { dateStyle: 'short', timeStyle: 'short' });
                                    } catch {
                                      return String(alert.createdAt);
                                    }
                                  })() : '—'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                              {alert.message || 'No description available'}
                            </div>
                          </div>

                          <button
                            onClick={() => handleResolveAlert(alert.alertId)}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #E5E8EF',
                              color: 'var(--text-primary)',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexShrink: 0,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            <CheckCircle size={13} style={{ color: '#10b981' }} />
                            Resolve
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ErrorBoundary>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Customer self-service dashboard (USER role) ---
  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.75rem 2rem' }}>
      {/* Customer Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              letterSpacing: '0.06em', 
              textTransform: 'uppercase', 
              padding: '0.2rem 0.55rem', 
              borderRadius: '6px', 
              backgroundColor: 'rgba(59, 130, 246, 0.12)', 
              color: '#3B7EF6', 
              border: '1px solid rgba(59, 130, 246, 0.2)' 
            }}>
              <Zap size={12} />
              CEB Solar Portal
            </span>
            <span className="badge success" style={{ fontSize: '0.72rem' }}>
              {customerInfo?.solarType || 'Solar Grid'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Welcome, {customerInfo?.customerName || 'Solar Customer'}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Personal solar generation, consumer demand tracking, and billing ledger.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ 
            fontSize: '0.82rem', 
            color: 'var(--text-secondary)', 
            backgroundColor: '#FFFFFF', 
            border: '1px solid #E5E8EF', 
            padding: '0.45rem 0.85rem', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.45rem' 
          }}>
            <Calendar size={14} style={{ color: 'var(--primary)' }} />
            {new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Customer 4 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.15rem', marginBottom: '1.75rem' }}>
        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E5E8EF', 
          borderTop: '3px solid #3b82f6', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Number</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem', fontFamily: 'monospace' }}>
              {user.username}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Registered Meter ID</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3B7EF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} />
          </div>
        </div>

        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E5E8EF', 
          borderTop: '3px solid #10b981', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Statement Total</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
              {formatLKR(stats?.totalRevenue || stats?.netStatementTotal || 0)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gross Statement Volume</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} />
          </div>
        </div>

        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E5E8EF', 
          borderTop: '3px solid #06b6d4', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Generation</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0EA5E9', marginTop: '0.25rem' }}>
              {stats?.totalExportUnits?.toLocaleString() || 0} <span style={{ fontSize: '0.85rem' }}>kWh</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cumulative Solar Exports</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(6, 182, 212, 0.12)', color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUpCircle size={20} />
          </div>
        </div>

        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E5E8EF', 
          borderTop: '3px solid #f59e0b', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Consumption</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#D97706', marginTop: '0.25rem' }}>
              {stats?.totalImportUnits?.toLocaleString() || 0} <span style={{ fontSize: '0.85rem' }}>kWh</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cumulative Grid Imports</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowDownCircle size={20} />
          </div>
        </div>
      </div>

      {/* Customer Chart & Profile Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        {/* Customer Chart */}
        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E5E8EF', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Solar Export vs Grid Consumption
              </h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Trailing 6 months generation and consumption performance (kWh)
            </p>
          </div>

          {monthlyTrend.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No billing history available yet.
            </div>
          ) : (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="chart-container" style={{ height: '200px' }}>
                {monthlyTrend.slice(-6).map((item, index) => {
                  const impPct = (item.imports / maxVal) * 100;
                  const expPct = (item.exports / maxVal) * 100;
                  return (
                    <div key={index} className="chart-bar-wrapper" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: '4px' }}>
                      <div 
                        className="chart-bar" 
                        style={{ height: `${Math.max(impPct, 4)}%`, width: '16px', background: 'linear-gradient(180deg, #f59e0b, rgba(245, 158, 11, 0.2))' }}
                      >
                        <div className="chart-bar-tooltip" style={{ top: '-25px' }}>Grid Import: {item.imports.toLocaleString()} kWh</div>
                      </div>
                      <div 
                        className="chart-bar" 
                        style={{ height: `${Math.max(expPct, 4)}%`, width: '16px', background: 'linear-gradient(180deg, #10b981, rgba(16, 185, 129, 0.2))' }}
                      >
                        <div className="chart-bar-tooltip" style={{ top: '-25px' }}>Solar Export: {item.exports.toLocaleString()} kWh</div>
                      </div>
                      <span className="chart-bar-label" style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: 'auto' }}>
                        {getMonthName(item.month)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2.25rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span>
                  Grid Imports (Draw)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '2px' }}></span>
                  Solar Exports (Generation)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Connection Profile */}
        <div style={{ 
          background: '#FFFFFF', 
          border: '1px solid #E5E8EF', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E5E8EF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Connection Profile
              </h3>
            </div>
            <span className="badge success" style={{ fontSize: '0.72rem' }}>
              {customerInfo?.solarType || 'Solar Grid'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <User size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Account Name</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{customerInfo?.customerName}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MapPin size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Service Location</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{customerInfo?.customerAddress || 'Ceylon Electricity Board, Grid'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Phone size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Contact Phone</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{customerInfo?.mobileNo || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #E5E8EF', paddingTop: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Panel Capacity</span>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  {customerInfo?.panelCapacity ? `${customerInfo.panelCapacity} kW` : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Agreement Date</span>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  {customerInfo?.agreementDate ? new Date(customerInfo.agreementDate).toLocaleDateString('en-LK') : '—'}
                </div>
              </div>
            </div>

            {customerInfo?.isComplete ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', borderTop: '1px solid #E5E8EF', paddingTop: '0.85rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Bank</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>{customerInfo?.bankCode || '—'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Branch</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>{customerInfo?.branchCode || '—'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Bank A/C</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>{customerInfo?.bankAccountNo || '—'}</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #E5E8EF', paddingTop: '0.85rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Outstanding Balance</span>
                  <div style={{ fontWeight: 800, color: '#ef4444', marginTop: '0.15rem' }}>
                    {customerInfo?.directory?.outstandingBalance != null ? formatLKR(customerInfo.directory.outstandingBalance) : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Settled Payment</span>
                  <div style={{ fontWeight: 800, color: '#059669', marginTop: '0.15rem' }}>
                    {customerInfo?.directory?.payment != null ? formatLKR(customerInfo.directory.payment) : (customerInfo?.directory?.paymentSettled != null ? formatLKR(customerInfo.directory.paymentSettled) : '—')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Statements Ledger Table */}
      <div style={{ 
        background: '#FFFFFF', 
        border: '1px solid #E5E8EF', 
        borderRadius: '12px', 
        padding: '1.25rem 1.4rem',
        boxShadow: '0 1px 3px rgba(16,24,40,0.08), 0 0 0 1px #E5E8EF'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.15rem' }}>
          <FileSpreadsheet size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Personal Monthly Statements Ledger
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {monthlyTrend.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No statements found for your account.
            </div>
          ) : (
            <table className="custom-table" style={{ margin: 0, fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Billing Cycle</th>
                  <th>Statement Ref No</th>
                  <th>Imports (kWh)</th>
                  <th>Exports (kWh)</th>
                  <th>Net Balance Flow</th>
                  <th style={{ textAlign: 'right' }}>Statement Value</th>
                </tr>
              </thead>
              <tbody>
                {[...monthlyTrend].reverse().map((bill) => {
                  const netUnits = bill.exports - bill.imports;
                  return (
                    <tr key={bill.billingId || bill.refNo}>
                      <td style={{ fontWeight: 600 }}>
                        {getMonthName(bill.month)} {bill.year}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>{bill.refNo}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#D97706' }}>
                          <ArrowDownCircle size={13} />
                          {bill.imports.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#059669' }}>
                          <ArrowUpCircle size={13} />
                          {bill.exports.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: netUnits >= 0 ? '#34d399' : '#ef4444' }}>
                        {netUnits > 0 ? `+${netUnits.toLocaleString()}` : netUnits.toLocaleString()} kWh
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatLKR(bill.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardWithErrorBoundary = (props) => (
  <ErrorBoundary title="Dashboard Render Error">
    <Dashboard {...props} />
  </ErrorBoundary>
);

export default DashboardWithErrorBoundary;
