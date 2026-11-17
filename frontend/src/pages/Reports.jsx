import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Award,
  Calendar,
  AlertCircle,
  Download,
  ArrowLeft,
  Filter,
  FileText,
  Building,
  Sun,
  Zap,
  Printer,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import SVGLineChart from '../components/charts/SVGLineChart';
import SVGDonutChart from '../components/charts/SVGDonutChart';
import PaymentReadyReportView from '../components/PaymentReadyReportView';

const Reports = () => {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  
  // States
  const [reportType, setReportType] = useState('MONTHLY_REVENUE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branches, setBranches] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { showToast } = useToast();

  // Print lifecycle listeners
  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Fetch branch list on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await authFetch('/api/officer/reports/branches');
        if (res.ok) {
          const data = await res.json();
          setBranches(data);
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // Fetch report data when type or filters change
  const fetchReport = async () => {
    if (reportType === 'PAYMENT_READY') {
      return;
    }
    try {
      setLoading(true);
      setError(null);

      let url = `/api/officer/reports/generate?type=${reportType}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (branchCode) url += `&branchCode=${branchCode}`;

      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to generate report.');
      }
    } catch (err) {
      setError(err.message || 'Error occurred while loading reports.');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

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

  // Helper to compute summary stats based on current report data
  const getSummaryStats = () => {
    if (!reportData || reportData.length === 0) return null;
    
    let totalRevenue = 0;
    let totalImports = 0;
    let totalExports = 0;
    let totalCustomers = 0;
    
    switch (reportType) {
      case 'MONTHLY_REVENUE':
      case 'BRANCH_PERFORMANCE':
      case 'SOLAR_TYPE':
        reportData.forEach(row => {
          totalRevenue += row.revenue || 0;
          totalImports += row.imports || 0;
          totalExports += row.exports || 0;
          if (row.customerCount) totalCustomers += row.customerCount;
        });
        break;
      case 'CUSTOMER_BILLING':
        reportData.forEach(row => {
          totalRevenue += row.totalAmount || 0;
          totalImports += row.imports || 0;
          totalExports += row.exports || 0;
        });
        break;
      case 'HIGHEST_EXPORTERS':
        reportData.forEach(row => {
          totalExports += row.exports || 0;
          totalRevenue += row.revenue || 0;
        });
        break;
      case 'HIGHEST_IMPORTERS':
        reportData.forEach(row => {
          totalImports += row.imports || 0;
          totalRevenue += row.revenue || 0;
        });
        break;
      default:
        break;
    }

    return { totalRevenue, totalImports, totalExports, totalCustomers, totalRows: reportData.length };
  };

  const stats = getSummaryStats();

  // Optimized Export to CSV Function using Blob and memory-efficient streaming lines
  const exportToCSV = () => {
    if (reportData.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const keys = Object.keys(reportData[0]);
      const lines = [keys.join(",")];
      
      for (let i = 0; i < reportData.length; i++) {
        const row = reportData[i];
        const line = keys.map(k => {
          let val = row[k];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string') {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(",");
        lines.push(line);
      }

      const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edl_report_${reportType.toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Report successfully exported as CSV.', 'success');
    } catch (err) {
      showToast('Failed to export CSV: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Optimized Export to Excel Function (Buffered HTML chunk array into Blob)
  const exportToExcel = () => {
    if (reportData.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const keys = Object.keys(reportData[0]);
      const chunks = [];
      chunks.push('<table><thead><tr>');
      keys.forEach(k => {
        chunks.push(`<th>${k.toUpperCase().replace('_', ' ')}</th>`);
      });
      chunks.push('</tr></thead><tbody>');

      for (let i = 0; i < reportData.length; i++) {
        const row = reportData[i];
        chunks.push('<tr>');
        for (let j = 0; j < keys.length; j++) {
          const val = row[keys[j]];
          chunks.push(`<td>${val !== null && val !== undefined ? val : ''}</td>`);
        }
        chunks.push('</tr>');
      }
      chunks.push('</tbody></table>');

      const blob = new Blob(chunks, { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edl_report_${reportType.toLowerCase()}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Report successfully exported as Excel.', 'success');
    } catch (err) {
      showToast('Failed to export Excel: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Optimized Print / PDF Preview handler
  const handlePrint = () => {
    if (isPrinting || reportData.length === 0) return;
    setIsPrinting(true);

    if (reportData.length > 500) {
      showToast(`Preparing print layout for ${reportData.length} records...`, 'info');
    }

    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Print failed:', err);
        showToast('Failed to open print / PDF preview.', 'error');
        setIsPrinting(false);
      } finally {
        setTimeout(() => setIsPrinting(false), 800);
      }
    }, 250);
  };

  // Render Charts based on Report Type
  const renderReportChart = () => {
    if (!reportData || reportData.length === 0) return null;

    if (reportType === 'MONTHLY_REVENUE') {
      const chartData = [...reportData].reverse().map(item => ({
        label: `${getMonthName(item.month)} '${String(item.year).substring(2)}`,
        revenue: item.revenue
      }));

      return (
        <div className="analytics-widget-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} className="text-primary" />
            Monthly Net Revenue Trend (Filtered)
          </h3>
          <SVGLineChart
            data={chartData}
            dataKey="revenue"
            strokeColor="#3b82f6"
            fillGradientId="blue-rev-reports"
            tooltipSuffix=" LKR"
            formatter={(val) => formatLKR(val).replace('LKR', '')}
          />
        </div>
      );
    }

    if (reportType === 'SOLAR_TYPE') {
      const donutData = reportData.map(item => ({
        name: item.solarType === 'Net Plus Plus' ? 'Net++' : item.solarType === 'Net Plus' ? 'Net+' : item.solarType,
        value: item.customerCount
      }));

      return (
        <div className="analytics-widget-card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ alignSelf: 'flex-start', width: '100%' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sun size={18} className="text-primary" />
              Customer Segmentation by Solar System Type
            </h3>
          </div>
          <div style={{ width: '100%', maxWidth: '340px', padding: '1rem 0' }}>
            <SVGDonutChart
              data={donutData}
              colors={['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6']}
              centerLabel="Accounts"
            />
          </div>
        </div>
      );
    }

    if (reportType === 'BRANCH_PERFORMANCE') {
      const maxRev = Math.max(...reportData.map(b => b.revenue), 1);
      return (
        <div className="analytics-widget-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building size={18} className="text-primary" />
            Branch Performance comparison (Aggregate Net Revenue Contribution)
          </h3>
          <div className="top-list-container">
            {reportData.map((item, idx) => {
              const percent = Math.max(5, (item.revenue / maxRev) * 100);
              return (
                <div className="top-list-item" key={item.branchCode}>
                  <div className="top-list-meta">
                    <span className="top-list-name">
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                      Branch: {item.branchCode}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({item.customerCount} Active Accounts)</span>
                    </span>
                    <span className="top-list-val" style={{ color: 'var(--primary)' }}>
                      {formatLKR(item.revenue)}
                    </span>
                  </div>
                  <div className="top-list-bar-track">
                    <div className="top-list-bar-fill" style={{ width: `${percent}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent-teal))' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  const reportTypes = [
    { id: 'PAYMENT_READY', label: 'Payment Ready Report', icon: CheckCircle2 },
    { id: 'MONTHLY_REVENUE', label: 'Monthly Revenue Report', icon: TrendingUp },
    { id: 'CUSTOMER_BILLING', label: 'Customer Billing Ledger', icon: FileText },
    { id: 'HIGHEST_EXPORTERS', label: 'Highest Solar Exporters', icon: Sun },
    { id: 'HIGHEST_IMPORTERS', label: 'Highest Import Consumers', icon: TrendingDown },
    { id: 'BRANCH_PERFORMANCE', label: 'Branch Performance Summary', icon: Building },
    { id: 'SOLAR_TYPE', label: 'Solar Connection Distribution', icon: Zap },
    { id: 'ALERT_ANOMALY', label: 'Alert Anomaly Audit Log', icon: AlertCircle },
  ];

  return (
    <div className="page-wrapper animate-fade-in">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .back-btn, .btn, .reports-sidebar, .reports-filters-card, .no-print {
            display: none !important;
          }
          .main-content, .page-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .card, .analytics-widget-card {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin-bottom: 2rem !important;
            page-break-inside: avoid;
          }
          .custom-table th {
            background-color: #f3f4f6 !important;
            color: #000000 !important;
            border-bottom: 2px solid #000000 !important;
          }
          .custom-table td {
            border-bottom: 1px solid #e5e7eb !important;
            color: #000000 !important;
          }
        }
      `}</style>

      <button onClick={() => navigate('/')} className="back-btn no-print">
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Advanced Report Center</h1>
          <p className="page-subtitle">Formulate financial ledgers, audit grid performance, and trace anomaly logs.</p>
        </div>
        {reportType !== 'PAYMENT_READY' && (
          <div style={{ display: 'flex', gap: '0.5rem' }} className="no-print">
            <button
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: (isExporting || isPrinting || reportData.length === 0) ? 'not-allowed' : 'pointer'
              }}
              onClick={exportToExcel}
              disabled={isExporting || isPrinting || reportData.length === 0}
            >
              {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Export Excel
            </button>
            <button
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: (isExporting || isPrinting || reportData.length === 0) ? 'not-allowed' : 'pointer'
              }}
              onClick={exportToCSV}
              disabled={isExporting || isPrinting || reportData.length === 0}
            >
              {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
            <button
              className="btn btn-primary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: (isExporting || isPrinting || reportData.length === 0) ? 'not-allowed' : 'pointer'
              }}
              onClick={handlePrint}
              disabled={isPrinting || isExporting || reportData.length === 0}
            >
              {isPrinting ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />}
              {isPrinting ? 'Preparing PDF...' : 'Print PDF'}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Sidebar Tabs */}
        <div className="card reports-sidebar no-print" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: '0.75rem', marginBottom: '0.5rem' }}>Report Categories</h4>
          {reportTypes.map((type) => {
            const Icon = type.icon;
            const isActive = reportType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setReportType(type.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  textAlign: 'left',
                  transition: 'var(--transition)',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  paddingLeft: isActive ? 'calc(1rem - 3px)' : '1rem'
                }}
              >
                <Icon size={16} className={isActive ? 'text-primary' : ''} />
                <span style={{ fontSize: '0.88rem' }}>{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* View Grid */}
        {reportType === 'PAYMENT_READY' ? (
          <PaymentReadyReportView authFetch={authFetch} showToast={showToast} branches={branches} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Filters Card */}
          <div className="neon-card no-print" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label className="neon-label">Start Cycle Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="neon-input" 
                  style={{ width: '100%', height: 42, paddingLeft: '1rem' }} 
                />
              </div>

              <div style={{ flex: 1, minWidth: '150px' }}>
                <label className="neon-label">End Cycle Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="neon-input" 
                  style={{ width: '100%', height: 42, paddingLeft: '1rem' }} 
                />
              </div>

              {reportType !== 'BRANCH_PERFORMANCE' && (
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label className="neon-label">Divisional Branch</label>
                  <select 
                    value={branchCode} 
                    onChange={(e) => setBranchCode(e.target.value)} 
                    className="neon-input"
                    style={{ width: '100%', height: 42, padding: '0 1rem' }}
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                className="neon-btn-primary" 
                onClick={fetchReport}
                style={{ height: 42, padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>

          {/* Aggregate Stats Cards */}
          {stats && (
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 0 }}>
              {stats.totalRevenue > 0 && (
                <div className="metric-card primary" style={{ padding: '1.25rem' }}>
                  <div className="metric-info">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Report Aggregate Balance</span>
                    <span className="metric-value" style={{ fontSize: '1.4rem' }}>{formatLKR(stats.totalRevenue)}</span>
                  </div>
                  <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
                    <DollarSign size={18} />
                  </div>
                </div>
              )}

              {stats.totalImports > 0 && (
                <div className="metric-card warning" style={{ padding: '1.25rem' }}>
                  <div className="metric-info">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Total Imports</span>
                    <span className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--warning)' }}>
                      {Math.round(stats.totalImports).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>kWh</span>
                    </span>
                  </div>
                  <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px', color: 'var(--warning)', backgroundColor: 'var(--warning-glow)' }}>
                    <TrendingDown size={18} />
                  </div>
                </div>
              )}

              {stats.totalExports > 0 && (
                <div className="metric-card success" style={{ padding: '1.25rem' }}>
                  <div className="metric-info">
                    <span className="metric-label" style={{ fontSize: '0.8rem' }}>Total Exports</span>
                    <span className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--success)' }}>
                      {Math.round(stats.totalExports).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>kWh</span>
                    </span>
                  </div>
                  <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
                    <TrendingUp size={18} />
                  </div>
                </div>
              )}

              <div className="metric-card teal" style={{ padding: '1.25rem' }}>
                <div className="metric-info">
                  <span className="metric-label" style={{ fontSize: '0.8rem' }}>Records Compiled</span>
                  <span className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--accent-teal)' }}>{stats.totalRows}</span>
                </div>
                <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px', color: 'var(--accent-teal)', backgroundColor: 'var(--accent-teal-glow)' }}>
                  <FileText size={18} />
                </div>
              </div>
            </div>
          )}

          {/* Visual Charts Section */}
          {renderReportChart()}

          {/* Report Data Table */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div className="panel-header" style={{ marginBottom: '1rem' }}>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <FileText size={16} className="text-primary" />
                Data Records Table View
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {startDate || 'Beginning'} &rarr; {endDate || 'Latest'}
              </span>
            </div>

            {loading ? (
      <div className="page-wrapper animate-fade-in">
        {/* Title Header Skeleton */}
        <div className="page-header" style={{ marginBottom: '2.5rem' }}>
          <div>
            <div className="skeleton" style={{ height: '32px', width: '280px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '450px' }}></div>
          </div>
        </div>

        {/* 3 cards skeleton */}
        <div className="metrics-grid" style={{ marginBottom: '2.5rem' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="metric-card skeleton" style={{ height: '120px' }}></div>
          ))}
        </div>

        {/* Main layout skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
          <div className="card skeleton" style={{ height: '320px' }}></div>
          <div className="card skeleton" style={{ height: '320px' }}></div>
        </div>
      </div>
    ) : error ? (
              <div style={{ padding: '2rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid var(--danger)', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                <AlertCircle size={20} />
                <span style={{ fontSize: '0.9rem' }}>{error}</span>
              </div>
            ) : reportData.length === 0 ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No records match the active criteria parameters.
              </div>
            ) : (
              <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    {reportType === 'MONTHLY_REVENUE' && (
                      <tr>
                        <th>Billing Cycle</th>
                        <th style={{ textAlign: 'right' }}>Total Imports</th>
                        <th style={{ textAlign: 'right' }}>Total Exports</th>
                        <th style={{ textAlign: 'right' }}>Net Flow</th>
                        <th style={{ textAlign: 'right' }}>Revenue (LKR)</th>
                      </tr>
                    )}
                    {reportType === 'CUSTOMER_BILLING' && (
                      <tr>
                        <th>Account No</th>
                        <th>Customer Name</th>
                        <th>Branch</th>
                        <th>Cycle Start</th>
                        <th>Cycle End</th>
                        <th>Ref No</th>
                        <th style={{ textAlign: 'right' }}>Imports</th>
                        <th style={{ textAlign: 'right' }}>Exports</th>
                        <th style={{ textAlign: 'right' }}>Net</th>
                        <th style={{ textAlign: 'right' }}>Cost</th>
                        <th style={{ textAlign: 'right' }}>Total Amount</th>
                      </tr>
                    )}
                    {(reportType === 'HIGHEST_EXPORTERS' || reportType === 'HIGHEST_IMPORTERS') && (
                      <tr>
                        <th>Rank</th>
                        <th>Account No</th>
                        <th>Customer Name</th>
                        <th>Branch</th>
                        <th style={{ textAlign: 'right' }}>
                          {reportType === 'HIGHEST_EXPORTERS' ? 'Exports (kWh)' : 'Imports (kWh)'}
                        </th>
                        <th style={{ textAlign: 'right' }}>Revenue / Cost (LKR)</th>
                      </tr>
                    )}
                    {reportType === 'BRANCH_PERFORMANCE' && (
                      <tr>
                        <th>Branch Code</th>
                        <th style={{ textAlign: 'right' }}>Customer Count</th>
                        <th style={{ textAlign: 'right' }}>Total Imports</th>
                        <th style={{ textAlign: 'right' }}>Total Exports</th>
                        <th style={{ textAlign: 'right' }}>Aggregate Net Revenue</th>
                      </tr>
                    )}
                    {reportType === 'SOLAR_TYPE' && (
                      <tr>
                        <th>Solar Type System</th>
                        <th style={{ textAlign: 'right' }}>Registered Customers</th>
                        <th style={{ textAlign: 'right' }}>Total Imports</th>
                        <th style={{ textAlign: 'right' }}>Total Exports</th>
                        <th style={{ textAlign: 'right' }}>Aggregate Net Revenue</th>
                      </tr>
                    )}
                    {reportType === 'ALERT_ANOMALY' && (
                      <tr>
                        <th>Alert ID</th>
                        <th>Account No</th>
                        <th>Alert Type</th>
                        <th>Severity</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Detected At</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => (
                      <tr key={i}>
                        {reportType === 'MONTHLY_REVENUE' && (
                          <>
                            <td style={{ fontWeight: 600 }}>{getMonthName(row.month)} {row.year}</td>
                            <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{row.imports?.toLocaleString()} kWh</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{row.exports?.toLocaleString()} kWh</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: ((row.exports || 0) - (row.imports || 0)) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {(() => {
                                const net = (row.exports || 0) - (row.imports || 0);
                                return net > 0 ? `+${net.toLocaleString()}` : net.toLocaleString();
                              })()} kWh
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatLKR(row.revenue)}</td>
                          </>
                        )}

                        {reportType === 'CUSTOMER_BILLING' && (
                          <>
                            <td style={{ fontWeight: 600 }}>{row.accountNo}</td>
                            <td>{row.customerName}</td>
                            <td><span className="badge info">{row.branchCode}</span></td>
                            <td>{row.fromDate}</td>
                            <td>{row.toDate}</td>
                            <td>{row.refNo}</td>
                            <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{row.imports?.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{row.exports?.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: (row.netUnit !== undefined && row.netUnit !== null ? row.netUnit : 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {row.netUnit !== undefined && row.netUnit !== null 
                                ? (row.netUnit > 0 ? `+${row.netUnit.toLocaleString()}` : row.netUnit.toLocaleString()) 
                                : '0'}
                            </td>
                            <td style={{ textAlign: 'right' }}>{row.unitCost?.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatLKR(row.totalAmount)}</td>
                          </>
                        )}

                        {(reportType === 'HIGHEST_EXPORTERS' || reportType === 'HIGHEST_IMPORTERS') && (
                          <>
                            <td style={{ fontWeight: 700 }}>#{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{row.accountNo}</td>
                            <td>{row.customerName}</td>
                            <td><span className="badge info">{row.branchCode}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: reportType === 'HIGHEST_EXPORTERS' ? 'var(--success)' : 'var(--warning)' }}>
                              {reportType === 'HIGHEST_EXPORTERS' ? row.exports?.toLocaleString() : row.imports?.toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatLKR(row.revenue)}</td>
                          </>
                        )}

                        {reportType === 'BRANCH_PERFORMANCE' && (
                          <>
                            <td style={{ fontWeight: 600 }}>{row.branchCode}</td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{row.customerCount}</td>
                            <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{row.imports?.toLocaleString()} kWh</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{row.exports?.toLocaleString()} kWh</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatLKR(row.revenue)}</td>
                          </>
                        )}

                        {reportType === 'SOLAR_TYPE' && (
                          <>
                            <td style={{ fontWeight: 600 }}>{row.solarType}</td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{row.customerCount}</td>
                            <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{row.imports?.toLocaleString()} kWh</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{row.exports?.toLocaleString()} kWh</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatLKR(row.revenue)}</td>
                          </>
                        )}

                        {reportType === 'ALERT_ANOMALY' && (
                          <>
                            <td>{row.alertId}</td>
                            <td style={{ fontWeight: 600 }}>{row.accountNo}</td>
                            <td><span className="badge info">{row.alertType}</span></td>
                            <td>
                              <span className={`badge ${
                                row.severity === 'CRITICAL' ? 'danger' : 
                                row.severity === 'WARNING' ? 'warning' : 'info'
                              }`}>
                                {row.severity}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-primary)' }}>{row.message}</td>
                            <td>
                              <span className={`badge ${row.status === 'RESOLVED' ? 'success' : 'warning'}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>{row.createdAt ? new Date(row.createdAt).toLocaleString('en-LK', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* PDF Print Preparation Overlay */}
      {isPrinting && (
        <div className="no-print" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '2rem 2.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '380px',
            width: '90%',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <RefreshCw size={28} className="animate-spin text-primary" style={{ color: '#2563eb' }} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              Preparing Print View...
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              Formatting {reportData.length} report rows for print and PDF export. Opening print dialog.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '16px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px solid #a7f3d0'
            }}>
              <CheckCircle2 size={13} />
              <span>Optimized Layout Ready</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
