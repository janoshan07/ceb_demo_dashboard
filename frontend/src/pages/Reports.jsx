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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import SVGLineChart from '../components/charts/SVGLineChart';
import SVGDonutChart from '../components/charts/SVGDonutChart';
import PaymentReadyReportView from '../components/PaymentReadyReportView';

const Reports = () => {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  
  // States
  const [reportType, setReportType] = useState('MONTHLY_REVENUE');
  const [billingMonth, setBillingMonth] = useState('ALL');
  const [availableMonths, setAvailableMonths] = useState(['July 2026', 'August 2026']);
  const [branchCode, setBranchCode] = useState('');
  const [branches, setBranches] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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

  // Fetch branch list and available billing months on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, monthsRes] = await Promise.all([
          authFetch('/api/officer/reports/branches'),
          authFetch('/api/officer/reports/payment-ready/months')
        ]);
        if (branchRes.ok) {
          const branchList = await branchRes.json();
          setBranches(branchList);
        }
        if (monthsRes.ok) {
          const monthList = await monthsRes.json();
          if (Array.isArray(monthList) && monthList.length > 0) {
            setAvailableMonths(monthList);
          }
        }
      } catch (err) {
        console.error('Error fetching report metadata:', err);
      }
    };
    fetchMetadata();
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
      if (billingMonth && billingMonth !== 'ALL') url += `&billingMonth=${encodeURIComponent(billingMonth)}`;
      if (branchCode && branchCode !== 'ALL') url += `&branchCode=${encodeURIComponent(branchCode)}`;

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
    setCurrentPage(1);
    fetchReport();
  }, [reportType, billingMonth, branchCode]);

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

  // Pagination computations for high-performance virtual rendering
  const totalRows = reportData ? reportData.length : 0;
  const isAll = pageSize === 'ALL';
  const effectivePageSize = isAll ? Math.max(1, totalRows) : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const displayedRows = isAll || isPrinting
    ? reportData
    : reportData.slice((validCurrentPage - 1) * effectivePageSize, validCurrentPage * effectivePageSize);

  const startIndex = totalRows === 0 ? 0 : (validCurrentPage - 1) * effectivePageSize + 1;
  const endIndex = isAll ? totalRows : Math.min(validCurrentPage * effectivePageSize, totalRows);

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
      const bMonthName = billingMonth && billingMonth !== 'ALL' ? billingMonth.replace(/\s+/g, '_') : 'all_months';
      const bBranchName = branchCode && branchCode !== 'ALL' ? branchCode.replace(/\s+/g, '_') : 'all_branches';
      link.download = `edl_${reportType.toLowerCase()}_${bMonthName}_${bBranchName}.csv`;
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
      const bMonthName = billingMonth && billingMonth !== 'ALL' ? billingMonth.replace(/\s+/g, '_') : 'all_months';
      const bBranchName = branchCode && branchCode !== 'ALL' ? branchCode.replace(/\s+/g, '_') : 'all_branches';
      link.download = `edl_${reportType.toLowerCase()}_${bMonthName}_${bBranchName}.xls`;
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
    { id: 'PAYMENT_READY', label: 'Payment Ready Report', icon: CheckCircle2, badge: 'READY', badgeColor: '#059669', badgeBg: '#ecfdf5' },
    { id: 'MONTHLY_REVENUE', label: 'Monthly Revenue Report', icon: TrendingUp },
    { id: 'CUSTOMER_BILLING', label: 'Customer Billing Ledger', icon: FileText },
    { id: 'HIGHEST_EXPORTERS', label: 'Highest Solar Exporters', icon: Sun },
    { id: 'HIGHEST_IMPORTERS', label: 'Highest Import Consumers', icon: TrendingDown },
    { id: 'BRANCH_PERFORMANCE', label: 'Branch Performance Summary', icon: Building },
    { id: 'SOLAR_TYPE', label: 'Solar Connection Distribution', icon: Zap },
    { id: 'ALERT_ANOMALY', label: 'Alert Anomaly Audit Log', icon: AlertCircle },
  ];

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '1600px', margin: '0 auto', padding: '1.25rem 1.5rem 2.5rem 1.5rem' }}>
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

        .reports-sidebar-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem 0.85rem;
          border: none;
          border-radius: 8px;
          background-color: transparent;
          color: #475569;
          cursor: pointer;
          font-weight: 500;
          text-align: left;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          position: relative;
        }
        .reports-sidebar-btn:hover {
          background-color: #f8fafc;
          color: #0f172a;
          transform: translateX(2px);
        }
        .reports-sidebar-btn.active {
          background-color: #eff6ff;
          color: #1d4ed8;
          font-weight: 700;
          box-shadow: inset 3px 0 0 #2563eb;
        }

        .report-filter-input {
          width: 100%;
          height: 40px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          padding: 0 0.85rem;
          font-size: 0.85rem;
          color: #0f172a;
          transition: all 0.15s ease;
          outline: none;
        }
        .report-filter-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .modern-metric-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.15rem 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .modern-metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.08);
        }
      `}</style>

      {/* Modern Back Button */}
      <button 
        onClick={() => navigate('/')} 
        className="back-btn no-print"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.4rem 0.85rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          color: '#475569',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease',
          marginBottom: '1rem'
        }}
      >
        <ArrowLeft size={14} />
        <span>Back to Dashboard</span>
      </button>

      {/* Modern Executive Page Header */}
      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '0.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Advanced Report Center
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              letterSpacing: '0.02em'
            }}>
              ENTERPRISE REPORTING
            </span>
          </div>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Formulate financial ledgers, audit grid performance, and trace anomaly logs across all Eastern Province divisions.
          </p>
        </div>

        {reportType !== 'PAYMENT_READY' && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} className="no-print">
            <button
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#1e293b',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                cursor: (isExporting || isPrinting || reportData.length === 0) ? 'not-allowed' : 'pointer'
              }}
              onClick={exportToExcel}
              disabled={isExporting || isPrinting || reportData.length === 0}
              title="Download Excel Spreadsheet (.xls)"
            >
              {isExporting ? <RefreshCw size={14} className="animate-spin text-success" /> : <Download size={14} className="text-success" />}
              <span>Export Excel</span>
            </button>

            <button
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#1e293b',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                cursor: (isExporting || isPrinting || reportData.length === 0) ? 'not-allowed' : 'pointer'
              }}
              onClick={exportToCSV}
              disabled={isExporting || isPrinting || reportData.length === 0}
              title="Download CSV file"
            >
              {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Export CSV</span>
            </button>

            <button
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#1e293b',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                cursor: (isExporting || isPrinting || reportData.length === 0) ? 'not-allowed' : 'pointer'
              }}
              onClick={handlePrint}
              disabled={isPrinting || isExporting || reportData.length === 0}
              title="Export report as formatted PDF"
            >
              <Download size={14} className="text-primary" />
              <span>Export PDF</span>
            </button>

            <button
              className="btn btn-primary"
              style={{
                padding: '0.5rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                cursor: (isExporting || isPrinting || reportData.length === 0) ? 'not-allowed' : 'pointer'
              }}
              onClick={handlePrint}
              disabled={isPrinting || isExporting || reportData.length === 0}
              title="Open browser print dialog"
            >
              {isPrinting ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />}
              <span>{isPrinting ? 'Preparing Print...' : 'Print Report'}</span>
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Modern Sidebar Tabs */}
        <div 
          className="reports-sidebar no-print" 
          style={{ 
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.35rem' 
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 0.5rem 0.65rem 0.5rem',
            borderBottom: '1px solid #f1f5f9',
            marginBottom: '0.35rem'
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Report Directory
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: '#f1f5f9',
              color: '#475569'
            }}>
              {reportTypes.length}
            </span>
          </div>

          {reportTypes.map((type) => {
            const Icon = type.icon;
            const isActive = reportType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setReportType(type.id)}
                className={`reports-sidebar-btn ${isActive ? 'active' : ''}`}
              >
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? '#dbeafe' : '#f8fafc',
                  color: isActive ? '#2563eb' : '#64748b',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}>
                  <Icon size={16} />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}>
                    {type.label}
                  </span>
                  {type.badge && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '8px',
                      backgroundColor: type.badgeBg,
                      color: type.badgeColor,
                      border: `1px solid ${type.badgeColor}30`,
                      marginLeft: '6px'
                    }}>
                      {type.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* View Grid */}
        {reportType === 'PAYMENT_READY' ? (
          <PaymentReadyReportView authFetch={authFetch} showToast={showToast} branches={branches} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Modern Filters Card */}
          <div 
            className="no-print" 
            style={{ 
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Billing Month
                </label>
                <select 
                  value={billingMonth} 
                  onChange={(e) => setBillingMonth(e.target.value)} 
                  className="report-filter-input"
                >
                  <option value="ALL">All Billing Months</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {reportType !== 'BRANCH_PERFORMANCE' && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    Divisional Branch
                  </label>
                  <select 
                    value={branchCode} 
                    onChange={(e) => setBranchCode(e.target.value)} 
                    className="report-filter-input"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                onClick={fetchReport}
                disabled={loading}
                style={{ 
                  height: 40, 
                  padding: '0 1.35rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.45rem', 
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>

          {/* Aggregate Stats Cards */}
          {stats && (
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: 0 }}>
              {stats.totalRevenue > 0 && (
                <div className="modern-metric-card" style={{ borderTop: '3px solid #2563eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Report Aggregate Balance
                      </span>
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {formatLKR(stats.totalRevenue)}
                      </span>
                    </div>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={18} />
                    </div>
                  </div>
                </div>
              )}

              {stats.totalImports > 0 && (
                <div className="modern-metric-card" style={{ borderTop: '3px solid #d97706' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Total Imports
                      </span>
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(stats.totalImports).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>kWh</span>
                      </span>
                    </div>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingDown size={18} />
                    </div>
                  </div>
                </div>
              )}

              {stats.totalExports > 0 && (
                <div className="modern-metric-card" style={{ borderTop: '3px solid #059669' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Total Exports
                      </span>
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(stats.totalExports).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>kWh</span>
                      </span>
                    </div>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={18} />
                    </div>
                  </div>
                </div>
              )}

              <div className="modern-metric-card" style={{ borderTop: '3px solid #0d9488' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                      Records Compiled
                    </span>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0d9488', fontVariantNumeric: 'tabular-nums' }}>
                      {stats.totalRows}
                    </span>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={18} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visual Charts Section */}
          {renderReportChart()}

          {/* Report Data Table */}
          <div 
            className="card" 
            style={{ 
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={15} />
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Data Records Table View
                </h2>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', backgroundColor: '#f8fafc', padding: '3px 9px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                {billingMonth === 'ALL' ? 'All Billing Months' : billingMonth}{branchCode && branchCode !== 'ALL' ? ` • ${branchCode}` : ' • All Branches'}
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '3.5rem 0', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: '#2563eb' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Compiling report records...</span>
              </div>
            ) : error ? (
              <div style={{ padding: '1.25rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fef2f2' }}>
                <AlertCircle size={20} />
                <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{error}</span>
              </div>
            ) : reportData.length === 0 ? (
              <div style={{ padding: '3.5rem 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                No records match the active criteria parameters.
              </div>
            ) : (
              <>
                <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="custom-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
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
                    {displayedRows.map((row, i) => (
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
                            <td style={{ fontWeight: 700 }}>#{startIndex + i}</td>
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

              {/* Table Pagination Controls */}
              {totalRows > 0 && (
                <div className="no-print" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '0.85rem',
                  padding: '0.65rem 0.95rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.82rem', color: '#64748b' }}>
                    <span>
                      Showing <strong style={{ color: '#0f172a' }}>{startIndex}</strong> to <strong style={{ color: '#0f172a' }}>{endIndex}</strong> of <strong style={{ color: '#0f172a' }}>{totalRows.toLocaleString()}</strong> records
                    </span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>Per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value="ALL">All ({totalRows.toLocaleString()})</option>
                      </select>
                    </div>
                  </div>

                  {!isAll && totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={validCurrentPage === 1}
                        title="First Page"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: validCurrentPage === 1 ? '#f1f5f9' : '#ffffff',
                          color: validCurrentPage === 1 ? '#94a3b8' : '#0f172a',
                          cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={validCurrentPage === 1}
                        title="Previous Page"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: validCurrentPage === 1 ? '#f1f5f9' : '#ffffff',
                          color: validCurrentPage === 1 ? '#94a3b8' : '#0f172a',
                          cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <ChevronLeft size={14} />
                      </button>

                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', padding: '0 8px' }}>
                        Page {validCurrentPage} of {totalPages}
                      </span>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={validCurrentPage === totalPages}
                        title="Next Page"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: validCurrentPage === totalPages ? '#f1f5f9' : '#ffffff',
                          color: validCurrentPage === totalPages ? '#94a3b8' : '#0f172a',
                          cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={validCurrentPage === totalPages}
                        title="Last Page"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: validCurrentPage === totalPages ? '#f1f5f9' : '#ffffff',
                          color: validCurrentPage === totalPages ? '#94a3b8' : '#0f172a',
                          cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
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
