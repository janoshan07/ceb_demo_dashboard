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
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SVGLineChart from '../components/charts/SVGLineChart';
import SVGDonutChart from '../components/charts/SVGDonutChart';
import SVGPredictionChart from '../components/charts/SVGPredictionChart';

const Dashboard = () => {
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

  // Predictions Module State
  const [predictions, setPredictions] = useState(null);
  const [predictionsLoading, setPredictionsLoading] = useState(true);

  // Ranking view toggle states (Show Top 5 vs All 10)
  const [showAllExporters, setShowAllExporters] = useState(false);
  const [showAllConsumers, setShowAllConsumers] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'OFFICER')) {
      const fetchPredictionsData = async () => {
        try {
          setPredictionsLoading(true);
          const res = await authFetch('/api/admin/dashboard/predictions');
          if (res.ok) {
            const data = await res.json();
            setPredictions(data);
          }
        } catch (err) {
          console.error('Failed to load predictions:', err);
        } finally {
          setPredictionsLoading(false);
        }
      };
      fetchPredictionsData();
    }
  }, [user]);

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'OFFICER')) {
      const fetchFilteredAlerts = async () => {
        try {
          setAlertsLoading(true);
          const cntRes = await authFetch('/api/admin/alerts/counters');
          if (cntRes.ok) {
            const cntData = await cntRes.json();
            setAlertCounters(cntData);
          }
          const alertsRes = await authFetch(`/api/admin/alerts?severity=${severityFilter}`);
          if (alertsRes.ok) {
            const alertsData = await alertsRes.json();
            setAlerts(alertsData);
          }
        } catch (err) {
          console.error('Error fetching alerts:', err);
        } finally {
          setAlertsLoading(false);
        }
      };
      fetchFilteredAlerts();
    }
  }, [severityFilter, user]);

  const handleResolveAlert = async (alertId) => {
    try {
      const res = await authFetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Alert anomaly marked as resolved.', 'success');
        const cntRes = await authFetch('/api/admin/alerts/counters');
        if (cntRes.ok) {
          const cntData = await cntRes.json();
          setAlertCounters(cntData);
        }
        const alertsRes = await authFetch(`/api/admin/alerts?severity=${severityFilter}`);
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData);
        }
      }
    } catch (err) {
      showToast('Failed to resolve alert: ' + err.message, 'error');
      console.error('Failed to resolve alert:', err);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let summaryUrl = '';
        let trendUrl = '';
        let profileUrl = '';

        if (user?.role === 'ADMIN') {
          summaryUrl = '/api/admin/dashboard/summary';
          trendUrl = '/api/officer/reports/monthly';
        } else if (user?.role === 'OFFICER') {
          summaryUrl = '/api/officer/dashboard/summary';
          trendUrl = '/api/officer/reports/monthly';
        } else if (user?.role === 'USER') {
          summaryUrl = '/api/user/dashboard/summary';
          trendUrl = '/api/user/reports/monthly';
          profileUrl = `/api/user/customers/${user.username}`;
        } else {
          throw new Error('Unauthorized role session.');
        }

        // Fetch stats
        const statsRes = await authFetch(summaryUrl);
        const statsData = statsRes.ok ? await statsRes.json().catch(() => ({})) : null;
        if (!statsRes.ok || !statsData) {
          throw new Error(statsData?.message || `Failed to load dashboard summary (Status ${statsRes.status})`);
        }
        setStats(statsData);

        // Fetch advanced analytics if admin or officer
        if (user?.role === 'ADMIN' || user?.role === 'OFFICER') {
          const analyticsRes = await authFetch('/api/admin/dashboard/analytics');
          if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json().catch(() => ({}));
            setAnalytics(analyticsData);
          }
        }

        // Fetch monthly trend for chart (backward compatible / user chart)
        const trendRes = await authFetch(trendUrl);
        const trendData = trendRes.ok ? await trendRes.json().catch(() => ([])) : [];
        if (!trendRes.ok) {
          throw new Error(trendData?.message || `Failed to load monthly reports (Status ${trendRes.status})`);
        }
        
        const trendArray = Array.isArray(trendData) ? trendData : [];
        
        // Sort chronologically (oldest to newest)
        const sortedTrend = [...trendArray].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
        
        setMonthlyTrend(sortedTrend);

        // If Customer (USER) role, fetch their customer details
        if (user?.role === 'USER' && profileUrl) {
          const custRes = await authFetch(profileUrl);
          if (custRes.ok) {
            const custData = await custRes.json();
            setCustomerInfo(custData);
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

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
                color: '#60a5fa', 
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
                color: '#34d399', 
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
            <span style={{ 
              fontSize: '0.82rem', 
              color: 'var(--text-secondary)', 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid rgba(255, 255, 255, 0.08)', 
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
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderTop: '3px solid #3b82f6', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
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
                color: '#60a5fa', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Users size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solar Grid Accounts</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Active Registry
              </span>
            </div>
          </div>

          {/* Card 2: Net Settlement Revenue */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderTop: '3px solid #10b981', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Net Statement Revenue
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem', lineHeight: 1.1 }}>
                  {formatLKR(stats?.totalRevenue || 0)}
                </div>
              </div>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                color: '#34d399', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <DollarSign size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ledger Balance Flow</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Settlement Net
              </span>
            </div>
          </div>

          {/* Card 3: Total Solar Exports */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderTop: '3px solid #06b6d4', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Solar Exports
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#22d3ee', marginTop: '0.25rem', lineHeight: 1.1 }}>
                  {analytics?.totalExportUnits?.toLocaleString() || 0}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>kWh</span>
                </div>
              </div>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: 'rgba(6, 182, 212, 0.12)', 
                color: '#22d3ee', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <ArrowUpCircle size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solar Generation Fed to Grid</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#22d3ee', backgroundColor: 'rgba(6, 182, 212, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Renewable Feed
              </span>
            </div>
          </div>

          {/* Card 4: Total Grid Imports */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderTop: '3px solid #f59e0b', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Grid Imports
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem', lineHeight: 1.1 }}>
                  {analytics?.totalImportUnits?.toLocaleString() || 0}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.35rem' }}>kWh</span>
                </div>
              </div>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                color: '#fbbf24', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <ArrowDownCircle size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consumer Load Drawn</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fbbf24', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Grid Consumption
              </span>
            </div>
          </div>
        </div>

        {/* Operational Smart Alert Engine */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          marginBottom: '1.75rem',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Operational Watchdog & Alerts
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.15rem 0.5rem', borderRadius: '50px' }}>
                  {alertCounters.critical} Critical
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '0.15rem 0.5rem', borderRadius: '50px' }}>
                  {alertCounters.warning} Warnings
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '0.15rem 0.5rem', borderRadius: '50px' }}>
                  {alertCounters.info} Info
                </span>
              </div>
            </div>

            {/* Severity Filter Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
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
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sev}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alerts Content */}
          <div style={{ marginTop: '1rem' }}>
            {alertsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px' }}>
                <div style={{ border: '2px solid rgba(255, 255, 255, 0.1)', borderTop: '2px solid var(--primary)', borderRadius: '50%', width: '22px', height: '22px', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : alerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.25rem', backgroundColor: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px' }}>
                <CheckCircle size={22} style={{ color: '#10b981', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Grid Ledger In Steady State</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>No pending billing anomalies detected across active customer cycles.</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '280px', overflowY: 'auto' }}>
                {alerts.map((alert) => {
                  const isCrit = alert.severity === 'CRITICAL';
                  const isWarn = alert.severity === 'WARNING';
                  const borderCol = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#3b82f6';
                  const bgTint = isCrit ? 'rgba(239, 68, 68, 0.05)' : isWarn ? 'rgba(245, 158, 11, 0.05)' : 'rgba(59, 130, 246, 0.05)';

                  return (
                    <div 
                      key={alert.alertId} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: '0.85rem', 
                        padding: '0.75rem 1rem', 
                        backgroundColor: bgTint, 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderLeft: `4px solid ${borderCol}`, 
                        borderRadius: '8px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <AlertCircle size={18} style={{ color: borderCol, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {alert.message}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              #{alert.accountNo}
                            </span>
                            <span>
                              {new Date(alert.createdAt).toLocaleString('en-LK', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleResolveAlert(alert.alertId)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
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
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <CheckCircle size={13} style={{ color: '#10b981' }} />
                        Resolve
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Primary Trend Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
          {/* Monthly Net Revenue Trend */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
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
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
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
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
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
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
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
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
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
                    border: '1px solid rgba(255, 255, 255, 0.1)',
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
                        <span style={{ fontWeight: 700, color: '#34d399', flexShrink: 0, marginLeft: '0.5rem' }}>
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
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
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
                    border: '1px solid rgba(255, 255, 255, 0.1)',
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
                        <span style={{ fontWeight: 700, color: '#fbbf24', flexShrink: 0, marginLeft: '0.5rem' }}>
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
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)',
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
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)',
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
                      <td style={{ textAlign: 'right', color: '#fbbf24' }}>{branch.totalImports.toLocaleString()} kWh</td>
                      <td style={{ textAlign: 'right', color: '#34d399' }}>{branch.totalExports.toLocaleString()} kWh</td>
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

        {/* EDL Predictor Engine Section */}
        {!isCustomer && predictions && (
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(167, 139, 250, 0.25)', 
            borderRadius: '12px', 
            padding: '1.4rem', 
            marginBottom: '1.75rem',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <Sparkles size={18} style={{ color: '#a78bfa' }} />
                  EDL Predictor Engine
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a78bfa', backgroundColor: 'rgba(167, 139, 250, 0.15)', border: '1px solid rgba(167, 139, 250, 0.3)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    Linear Regression
                  </span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Next month forecast calculated from trailing billing cycles & energy load models
                </p>
              </div>
              <span style={{ fontSize: '0.76rem', color: '#a78bfa', fontWeight: 600, backgroundColor: 'rgba(167, 139, 250, 0.08)', padding: '0.3rem 0.65rem', borderRadius: '6px' }}>
                Forecast Target: {predictions.nextMonthName}
              </span>
            </div>

            {/* 3 Prediction Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(167, 139, 250, 0.2)', borderRadius: '10px', padding: '1rem 1.15rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Forecasted Revenue</span>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#a78bfa', marginTop: '0.25rem' }}>
                  {formatLKR(predictions.nextMonthRevenue)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Estimated Next Month Statements</div>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '1rem 1.15rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Forecasted Exports</span>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>
                  {Math.round(predictions.nextMonthExports).toLocaleString()} <span style={{ fontSize: '0.85rem' }}>kWh</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Estimated Solar Generation Export</div>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', padding: '1rem 1.15rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Forecasted Imports</span>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
                  {Math.round(predictions.nextMonthImports).toLocaleString()} <span style={{ fontSize: '0.85rem' }}>kWh</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Estimated Consumer Load Draw</div>
              </div>
            </div>

            {/* Prediction Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.15rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '1.15rem' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <DollarSign size={16} style={{ color: '#a78bfa' }} />
                  Revenue: Actual vs Forecast Trend
                </h4>
                <SVGPredictionChart
                  data={predictions.history}
                  actualKey="actualRevenue"
                  predictedKey="predictedRevenue"
                  strokeColor="#3b82f6"
                  predictedStrokeColor="#a78bfa"
                  tooltipSuffix=" LKR"
                  formatter={(val) => formatLKR(val).replace('LKR', '')}
                />
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '1.15rem' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Sun size={16} style={{ color: '#34d399' }} />
                  Solar Exports: Actual vs Forecast Trend
                </h4>
                <SVGPredictionChart
                  data={predictions.history}
                  actualKey="actualExports"
                  predictedKey="predictedExports"
                  strokeColor="#10b981"
                  predictedStrokeColor="#34d399"
                  tooltipSuffix=" kWh"
                />
              </div>
            </div>
          </div>
        )}

        {/* Recent Ingestions & Operations Hub */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem' }}>
          {/* Recent Ingestions Table */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
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
                            upload.status === 'SUCCESS' ? 'success' : 
                            upload.status === 'PENDING_APPROVAL' ? 'warning' :
                            upload.status === 'COMPLETED_WITH_ERRORS' || upload.status === 'PARTIAL_SUCCESS' ? 'warning' : 'danger'
                          }`} style={{ fontSize: '0.7rem' }}>
                            {upload.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{upload.billingInserted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Operations Hub */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '12px', 
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)',
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
                  color: '#fbbf24',
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
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
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
              color: '#60a5fa', 
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
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
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
          background: 'var(--bg-secondary)', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderTop: '3px solid #3b82f6', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Number</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem', fontFamily: 'monospace' }}>
              {user.username}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Registered Meter ID</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} />
          </div>
        </div>

        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderTop: '3px solid #10b981', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Balance</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>
              {formatLKR(stats?.totalRevenue)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Statement Balance Flow</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} />
          </div>
        </div>

        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderTop: '3px solid #06b6d4', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Generation</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#22d3ee', marginTop: '0.25rem' }}>
              {stats?.totalExportUnits?.toLocaleString() || 0} <span style={{ fontSize: '0.85rem' }}>kWh</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cumulative Solar Exports</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(6, 182, 212, 0.12)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUpCircle size={20} />
          </div>
        </div>

        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderTop: '3px solid #f59e0b', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Consumption</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
              {stats?.totalImportUnits?.toLocaleString() || 0} <span style={{ fontSize: '0.85rem' }}>kWh</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cumulative Grid Imports</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowDownCircle size={20} />
          </div>
        </div>
      </div>

      {/* Customer Chart & Profile Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        {/* Customer Chart */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)',
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
          background: 'var(--bg-secondary)', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderRadius: '12px', 
          padding: '1.25rem 1.4rem',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.85rem' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.85rem', fontSize: '0.78rem' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.85rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Outstanding Balance</span>
                  <div style={{ fontWeight: 800, color: '#ef4444', marginTop: '0.15rem' }}>
                    {customerInfo?.directory?.outstandingBalance != null ? formatLKR(customerInfo.directory.outstandingBalance) : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Settled Payment</span>
                  <div style={{ fontWeight: 800, color: '#34d399', marginTop: '0.15rem' }}>
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
        background: 'var(--bg-secondary)', 
        border: '1px solid rgba(255, 255, 255, 0.08)', 
        borderRadius: '12px', 
        padding: '1.25rem 1.4rem',
        boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)'
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#fbbf24' }}>
                          <ArrowDownCircle size={13} />
                          {bill.imports.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#34d399' }}>
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

export default Dashboard;
