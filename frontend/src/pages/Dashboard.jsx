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
  Bell
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
        const statsData = await statsRes.json();
        setStats(statsData);

        // Fetch advanced analytics if admin or officer
        if (user?.role === 'ADMIN' || user?.role === 'OFFICER') {
          const analyticsRes = await authFetch('/api/admin/dashboard/analytics');
          if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json();
            setAnalytics(analyticsData);
          }
        }

        // Fetch monthly trend for chart (backward compatible / user chart)
        const trendRes = await authFetch(trendUrl);
        const trendData = await trendRes.json();
        
        // Sort chronologically (oldest to newest)
        const sortedTrend = [...trendData].sort((a, b) => {
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
    }).format(val);
  };

  const getMonthName = (monthNumber) => {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString('en-US', { month: 'short' });
  };

  if (loading) {
    return (
      <div className="page-wrapper animate-fade-in">
        {/* Header Skeleton */}
        <div className="page-header" style={{ marginBottom: '2.5rem' }}>
          <div>
            <div className="skeleton" style={{ height: '32px', width: '280px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '450px' }}></div>
          </div>
        </div>

        {/* summary metrics cards skeleton */}
        <div className="analytics-grid-4" style={{ marginBottom: '2.5rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="metric-card skeleton" style={{ height: '135px' }}></div>
          ))}
        </div>

        {/* charts grid skeleton */}
        <div className="analytics-layout" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '2.5rem' }}>
          <div className="analytics-widget-card skeleton" style={{ height: '300px' }}></div>
          <div className="analytics-widget-card skeleton" style={{ height: '300px' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: '2rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '12px', display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--danger)' }}>
          <AlertCircle size={32} />
          <div>
            <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>Dashboard Sync Failed</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{error}</p>
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
      <div className="page-wrapper animate-fade-in">
        {/* Title Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Zap className="text-primary" size={28} />
              Advanced Analytics Dashboard
            </h1>
            <p className="page-subtitle">
              Enterprise metrics engine. Aggregating solar data distribution, energy transfers, and ledger flow.
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={14} />
              Today: {new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Animated Summary Cards Row */}
        <div className="analytics-grid-4">
          <div className="metric-card glow-primary animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <div className="metric-info">
              <span className="metric-label">Registered Customers</span>
              <span className="metric-value">{stats?.totalCustomers?.toLocaleString() || 0}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Grid Accounts</span>
            </div>
            <div className="metric-icon-box">
              <Users size={24} />
            </div>
          </div>

          <div className="metric-card glow-success animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            <div className="metric-info">
              <span className="metric-label">Total Net Revenue</span>
              <span className="metric-value" style={{ color: 'var(--success)' }}>{formatLKR(stats?.totalRevenue || 0)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cumulative Grid Ledger Balance</span>
            </div>
            <div className="metric-icon-box" style={{ color: 'var(--success)', backgroundColor: 'var(--success-glow)' }}>
              <DollarSign size={24} />
            </div>
          </div>

          <div className="metric-card glow-warning animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="metric-info">
              <span className="metric-label">Total Import Units</span>
              <span className="metric-value" style={{ color: 'var(--warning)' }}>
                {analytics?.totalImportUnits?.toLocaleString() || 0} <span style={{ fontSize: '0.85rem' }}>kWh</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Energy Drawn from Grid</span>
            </div>
            <div className="metric-icon-box" style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-glow)' }}>
              <ArrowDownCircle size={24} />
            </div>
          </div>

          <div className="metric-card glow-teal animate-fade-in-up" style={{ animationDelay: '155ms' }}>
            <div className="metric-info">
              <span className="metric-label">Total Export Units</span>
              <span className="metric-value" style={{ color: 'var(--accent-teal)' }}>
                {analytics?.totalExportUnits?.toLocaleString() || 0} <span style={{ fontSize: '0.85rem' }}>kWh</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solar Energy Exported</span>
            </div>
            <div className="metric-icon-box" style={{ color: 'var(--accent-teal)', backgroundColor: 'var(--accent-teal-glow)' }}>
              <ArrowUpCircle size={24} />
            </div>
          </div>
        </div>

        {/* Smart Alert Engine Panel */}
        <div className="alerts-card animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="alerts-header">
            <div className="alerts-header-left">
              <div className="alerts-header-title">
                <Bell className="text-primary" size={20} />
                Smart Alert Engine
              </div>
              <div className="alerts-counters-chips">
                <span className="alert-counter-chip critical">
                  {alertCounters.critical} Critical
                </span>
                <span className="alert-counter-chip warning">
                  {alertCounters.warning} Warnings
                </span>
                <span className="alert-counter-chip info">
                  {alertCounters.info} Info
                </span>
              </div>
            </div>
            <div className="alerts-filter-bar">
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
                <button
                  key={sev}
                  className={`alerts-filter-btn ${severityFilter === sev ? 'active' : ''}`}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {alertsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
              <div style={{ border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '24px', height: '24px', animation: 'spin 1s linear infinite' }}></div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="alert-empty-state">
              <CheckCircle className="alert-empty-icon" size={32} />
              <div>
                <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>No Active Anomalies</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>All customer grid cycles and statement ledger records validate correctly.</p>
              </div>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert) => (
                <div key={alert.alertId} className={`alert-item ${alert.severity.toLowerCase()}`}>
                  <div className="alert-item-content">
                    <div className="alert-item-icon-wrapper">
                      <AlertCircle 
                        className={
                          alert.severity === 'CRITICAL' ? 'text-danger' : 
                          alert.severity === 'WARNING' ? 'text-warning' : 'text-primary'
                        } 
                        size={18} 
                      />
                    </div>
                    <div className="alert-item-body">
                      <div className="alert-item-msg">{alert.message}</div>
                      <div className="alert-item-meta">
                        <span className="alert-item-account">Account: {alert.accountNo}</span>
                        <span className="alert-item-time">
                          Detected: {new Date(alert.createdAt).toLocaleString('en-LK', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="alert-resolve-btn"
                    onClick={() => handleResolveAlert(alert.alertId)}
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* First Grid Row: Trend Charts */}
        <div className="analytics-layout">
          {/* Revenue Trend Chart */}
          <div className="analytics-widget-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={18} className="text-primary" />
                  Monthly Net Revenue Trend
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Net payouts and statements generated over billing cycles</p>
              </div>
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

          {/* Net Unit Trend Chart */}
          <div className="analytics-widget-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} className="text-primary" />
                  Net Energy Flow Trend
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Monthly Net Units (Export - Import) in kWh</p>
              </div>
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

        {/* Second Grid Row: Top 10 Solar Exporters vs Top 10 Consumers */}
        <div className="analytics-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Top Exporters */}
          <div className="analytics-widget-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sun size={18} style={{ color: 'var(--success)' }} />
              Top 10 Solar Exporters
            </h3>
            {analytics?.topExporters?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No billing export records found.</p>
            ) : (
              <div className="top-list-container">
                {analytics?.topExporters?.map((item, idx) => {
                  const percent = (item.totalExport / maxExporterValue) * 100;
                  return (
                    <div className="top-list-item" key={item.accountNo}>
                      <div className="top-list-meta">
                        <span className="top-list-name">
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', width: '18px' }}>#{idx + 1}</span>
                          {item.customerName}
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({item.accountNo})</span>
                        </span>
                        <span className="top-list-val" style={{ color: 'var(--success)' }}>
                          {item.totalExport.toLocaleString()} kWh
                        </span>
                      </div>
                      <div className="top-list-bar-track">
                        <div className="top-list-bar-fill success-teal" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Consumers */}
          <div className="analytics-widget-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingDown size={18} style={{ color: 'var(--warning)' }} />
              Top 10 Import Consumers
            </h3>
            {analytics?.topConsumers?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No billing import records found.</p>
            ) : (
              <div className="top-list-container">
                {analytics?.topConsumers?.map((item, idx) => {
                  const percent = (item.totalImport / maxConsumerValue) * 100;
                  return (
                    <div className="top-list-item" key={item.accountNo}>
                      <div className="top-list-meta">
                        <span className="top-list-name">
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', width: '18px' }}>#{idx + 1}</span>
                          {item.customerName}
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({item.accountNo})</span>
                        </span>
                        <span className="top-list-val" style={{ color: 'var(--warning)' }}>
                          {item.totalImport.toLocaleString()} kWh
                        </span>
                      </div>
                      <div className="top-list-bar-track">
                        <div className="top-list-bar-fill warning-red" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Third Grid Row: Solar Type Distribution & Branch Analytics */}
        <div className="analytics-layout" style={{ gridTemplateColumns: '1.1fr 1.9fr', marginTop: '1.5rem' }}>
          {/* Solar Type Distribution */}
          <div className="analytics-widget-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sun size={18} className="text-primary" />
                Solar Type Distribution
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Segmentation of registered customers</p>
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <SVGDonutChart
                data={solarDistributionData}
                colors={['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6']}
                centerLabel="Customers"
              />
            </div>
          </div>

          {/* Branch-wise Analytics */}
          <div className="analytics-widget-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={18} className="text-primary" />
              Branch-wise Analytics Breakdown
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Divisional summary of customers, grid loads, and branch revenue contributions</p>
            
            <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Branch Code</th>
                    <th style={{ textAlign: 'right' }}>Customers</th>
                    <th style={{ textAlign: 'right' }}>Total Imports</th>
                    <th style={{ textAlign: 'right' }}>Total Exports</th>
                    <th style={{ textAlign: 'right' }}>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.branchAnalytics?.map((branch) => (
                    <tr className="branch-row" key={branch.branchCode}>
                      <td style={{ fontWeight: 600 }}>{branch.branchCode}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{branch.customerCount}</td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{branch.totalImports.toLocaleString()} kWh</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{branch.totalExports.toLocaleString()} kWh</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatLKR(branch.totalRevenue)}</td>
                    </tr>
                  ))}
                  {(!analytics?.branchAnalytics || analytics.branchAnalytics.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No branch records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CEB Predictor Engine Section */}
        {!isCustomer && predictions && (
          <div style={{ marginTop: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <Zap className="text-primary" size={22} style={{ color: '#a78bfa' }} />
              CEB Predictor Engine (Linear Regression Model)
            </h2>

            {/* Predictions Summary Cards Row */}
            <div className="analytics-grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '1.5rem' }}>
              <div className="metric-card glow-indigo animate-fade-in-up" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.02) 100%)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                <div className="metric-info">
                  <span className="metric-label" style={{ color: 'var(--text-secondary)' }}>Forecasted Next Month ({predictions.nextMonthName}) Revenue</span>
                  <span className="metric-value" style={{ color: '#a78bfa' }}>{formatLKR(predictions.nextMonthRevenue)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Net Revenue Statement</span>
                </div>
                <div className="metric-icon-box" style={{ color: '#a78bfa', backgroundColor: 'rgba(139, 92, 246, 0.12)' }}>
                  <TrendingUp size={24} />
                </div>
              </div>

              <div className="metric-card glow-teal animate-fade-in-up" style={{ background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, rgba(6, 182, 212, 0.02) 100%)', borderColor: 'rgba(20, 184, 166, 0.2)' }}>
                <div className="metric-info">
                  <span className="metric-label" style={{ color: 'var(--text-secondary)' }}>Forecasted Next Month ({predictions.nextMonthName}) Exports</span>
                  <span className="metric-value" style={{ color: 'var(--success)' }}>
                    {Math.round(predictions.nextMonthExports).toLocaleString()} <span style={{ fontSize: '0.85rem' }}>kWh</span>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Solar Generation Export</span>
                </div>
                <div className="metric-icon-box" style={{ color: 'var(--success)', backgroundColor: 'var(--success-glow)' }}>
                  <Sun size={24} />
                </div>
              </div>

              <div className="metric-card glow-warning animate-fade-in-up" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                <div className="metric-info">
                  <span className="metric-label" style={{ color: 'var(--text-secondary)' }}>Forecasted Next Month ({predictions.nextMonthName}) Imports</span>
                  <span className="metric-value" style={{ color: 'var(--warning)' }}>
                    {Math.round(predictions.nextMonthImports).toLocaleString()} <span style={{ fontSize: '0.85rem' }}>kWh</span>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Consumer Demand Draw</span>
                </div>
                <div className="metric-icon-box" style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-glow)' }}>
                  <ArrowDownCircle size={24} />
                </div>
              </div>
            </div>

            {/* Predictions Comparative Charts Row */}
            <div className="analytics-layout" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '1.5rem' }}>
              {/* Revenue Comparison Chart */}
              <div className="analytics-widget-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <DollarSign size={18} style={{ color: '#a78bfa' }} />
                  Revenue: Actual vs Forecast Trend
                </h3>
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

              {/* Energy Units Comparison Chart */}
              <div className="analytics-widget-card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <Sun size={18} style={{ color: 'var(--success)' }} />
                  Solar Exports: Actual vs Forecast Trend
                </h3>
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

        {/* Quick Operations Control & Ingestions Panel */}
        <div className="analytics-layout" style={{ gridTemplateColumns: '1.8fr 1.2fr', marginTop: '1.5rem' }}>
          {/* Recent Billing Imports */}
          <div className="card">
            <div className="panel-header">
              <h2 className="panel-title">Recent Billing Imports</h2>
              <Link to="/upload" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}>Manage Uploads</Link>
            </div>

            <div className="table-container">
              {stats?.recentUploads?.length === 0 ? (
                <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No files have been imported yet.
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Import Date</th>
                      <th>Filename</th>
                      <th>Uploaded By</th>
                      <th>Status</th>
                      <th>Bills Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.recentUploads?.map((upload) => (
                      <tr key={upload.id}>
                        <td>{new Date(upload.uploadTime).toLocaleString('en-LK', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td style={{ fontWeight: 600 }}>{upload.filename}</td>
                        <td>{upload.uploadedBy}</td>
                        <td>
                          <span className={`badge ${
                            upload.status === 'SUCCESS' ? 'success' : 
                            upload.status === 'PENDING_APPROVAL' ? 'warning' :
                            upload.status === 'COMPLETED_WITH_ERRORS' ? 'warning' : 'danger'
                          }`}>
                            {upload.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td>{upload.billingInserted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Quick Actions Operations Widget */}
          <div className="card">
            <div className="panel-header">
              <h2 className="panel-title">Operations Control</h2>
              <Link to="/upload" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>New Ingestion</Link>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Upload energy billing sheets. Ensure files contain correct divisional segments.
              </p>
              
              {stats?.pendingApprovalsCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--warning)', backgroundColor: 'rgba(245,158,11,0.06)', color: 'var(--warning)', animation: 'pulseGlow 2s infinite' }}>
                  <Clock size={20} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Pending Staging Review</div>
                    <div style={{ fontSize: '0.75rem' }}>{stats.pendingApprovalsCount} file upload batches are pending admin review.</div>
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>System Quick Actions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Link to="/customers" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
                    Customer Registry
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link to="/admin" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
                      Admin Review Center
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Customer self-service dashboard (Original user view, fully styled) ---
  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome, {customerInfo?.customerName || 'Solar Customer'}
          </h1>
          <p className="page-subtitle">
            Self-service solar dashboard. Track your energy generation, consumption, and statement ledger.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={14} />
            Today: {new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="metric-card primary">
          <div className="metric-info">
            <span className="metric-label">Account No</span>
            <span className="metric-value" style={{ fontSize: '1.4rem' }}>{user.username}</span>
          </div>
          <div className="metric-icon-box">
            <User size={24} />
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-info">
            <span className="metric-label">Net Balance (LKR)</span>
            <span className="metric-value">{formatLKR(stats?.totalRevenue)}</span>
          </div>
          <div className="metric-icon-box">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="metric-card teal">
          <div className="metric-info">
            <span className="metric-label">Total Exported</span>
            <span className="metric-value" style={{ color: 'var(--success)' }}>
              {stats?.totalExportUnits?.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>kWh</span>
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
            <ArrowUpCircle size={24} />
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-info">
            <span className="metric-label">Total Imported</span>
            <span className="metric-value" style={{ color: 'var(--warning)' }}>
              {stats?.totalImportUnits?.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>kWh</span>
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
            <ArrowDownCircle size={24} />
          </div>
        </div>
      </div>

      {/* Customer Chart & Details Section */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1.2fr' }}>
        {/* Customer Chart */}
        <div className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} className="text-primary" />
                Your Solar Export vs Consumption Grid Trend
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Showing last 6 months energy flow metrics (kWh)
              </span>
            </div>
          </div>
          
          {monthlyTrend.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px', color: 'var(--text-muted)' }}>
              No billing data available yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="chart-container">
                {monthlyTrend.slice(-6).map((item, index) => {
                  const impPct = (item.imports / maxVal) * 100;
                  const expPct = (item.exports / maxVal) * 100;
                  return (
                    <div key={index} className="chart-bar-wrapper" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: '4px' }}>
                      <div 
                        className="chart-bar" 
                        style={{ height: `${Math.max(impPct, 4)}%`, width: '16px', background: 'linear-gradient(180deg, var(--warning), rgba(245, 158, 11, 0.2))' }}
                      >
                        <div className="chart-bar-tooltip" style={{ top: '-25px' }}>Grid Import: {item.imports.toLocaleString()} kWh</div>
                      </div>
                      <div 
                        className="chart-bar" 
                        style={{ height: `${Math.max(expPct, 4)}%`, width: '16px', background: 'linear-gradient(180deg, var(--success), rgba(16, 185, 129, 0.2))' }}
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
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', fontSize: '0.85rem', justifyContent: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--warning)', borderRadius: '2px' }}></span>
                  Imports (Grid Draw)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--success)', borderRadius: '2px' }}></span>
                  Exports (Solar Generation)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Connection Profile */}
        <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} className="text-primary" />
              Connection Profile
            </h2>
            <span className="badge success">{customerInfo?.solarType || 'Solar Grid'}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <User size={16} className="text-muted" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Account Name</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{customerInfo?.customerName}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MapPin size={16} className="text-muted" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Service Location</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{customerInfo?.customerAddress || 'Ceylon Electricity Board, Grid'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Phone size={16} className="text-muted" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Contact Phone</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{customerInfo?.mobileNo || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.15rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Panel Capacity</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {customerInfo?.panelCapacity ? `${customerInfo.panelCapacity} kW` : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Agreement Date</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {customerInfo?.agreementDate ? new Date(customerInfo.agreementDate).toLocaleDateString('en-LK') : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.15rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Bank</span>
                <div style={{ fontWeight: 500 }}>{customerInfo?.bankCode || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Branch</span>
                <div style={{ fontWeight: 500 }}>{customerInfo?.branchCode || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Bank A/C</span>
                <div style={{ fontWeight: 500 }}>{customerInfo?.bankAccountNo || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer statement ledger */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="panel-header">
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet className="text-primary" size={18} />
            Personal Monthly Statements Ledger
          </h2>
        </div>

        <div className="table-container">
          {monthlyTrend.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No statements found for your account.
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Billing Cycle</th>
                  <th>Statement Ref No</th>
                  <th>Imports (kWh)</th>
                  <th>Exports (kWh)</th>
                  <th>Net Balance Flow</th>
                  <th>Statement Value</th>
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
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{bill.refNo}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning)' }}>
                          <ArrowDownCircle size={12} />
                          {bill.imports.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                          <ArrowUpCircle size={12} />
                          {bill.exports.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: netUnits >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {netUnits > 0 ? `+${netUnits.toLocaleString()}` : netUnits.toLocaleString()} kWh
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
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
