import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Lock, 
  Printer, 
  Download, 
  RefreshCw, 
  Search, 
  FileSpreadsheet, 
  Building, 
  Calendar, 
  DollarSign, 
  FileText,
  AlertCircle
} from 'lucide-react';

const PaymentReadyReportView = ({ authFetch, showToast }) => {
  // Filter States
  const [billingMonth, setBillingMonth] = useState('July 2026');
  const [availableMonths, setAvailableMonths] = useState(['July 2026', 'August 2026']);
  const [division, setDivision] = useState('ALL');
  const [accountNo, setAccountNo] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Data States
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState({
    summary: {
      reportTitle: 'SLIP TRANSACTION LISTING - PAYMENT OF NET ACCOUNTING / NET PLUS / NET PLUS PLUS',
      selectedBillingMonth: 'JULY 2026',
      selectedDivision: 'ALL DIVISIONS',
      costCentre: 'EASTERN PROVINCE / ALL DIVISIONS',
      paymentDate: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      totalPaymentReadyCustomers: 0,
      totalAmountSum: 0.0,
      totalBillSetOffSum: 0.0,
      totalStampDutySum: 0.0,
      totalAmountPayableSum: 0.0,
      reportGeneratedDate: ''
    },
    records: []
  });

  const divisionsList = ['ALL', 'Ampara', 'Batticaloa', 'Kalmunai', 'Trincomalee', 'Valaichenai'];

  // Fetch available billing months on mount
  useEffect(() => {
    const fetchMonths = async () => {
      try {
        const res = await authFetch('/api/officer/reports/payment-ready/months');
        if (res.ok) {
          const months = await res.json();
          if (Array.isArray(months) && months.length > 0) {
            setAvailableMonths(months);
            // Default to July 2026 if present, else first month
            if (months.includes('July 2026')) {
              setBillingMonth('July 2026');
            } else {
              setBillingMonth(months[0]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch billing months:', err);
      }
    };
    fetchMonths();
  }, []);

  // Fetch Payment Ready Data
  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (billingMonth) params.append('billingMonth', billingMonth);
      if (division) params.append('division', division);
      if (accountNo.trim()) params.append('accountNo', accountNo.trim());
      if (customerName.trim()) params.append('customerName', customerName.trim());

      const res = await authFetch(`/api/officer/reports/payment-ready?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to fetch payment ready report.');
      }
    } catch (err) {
      setError(err.message || 'Failed to generate Payment Ready Report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [billingMonth, division]);

  // Format currency with two decimal places
  const formatAmount = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    const num = Number(val);
    if (isNaN(num)) return '-';
    if (num === 0) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatAlwaysNumber = (val) => {
    if (val === null || val === undefined) return '0.00';
    const num = Number(val);
    return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Export Excel directly from backend Apache POI endpoint
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const params = new URLSearchParams();
      if (billingMonth) params.append('billingMonth', billingMonth);
      if (division) params.append('division', division);
      if (accountNo.trim()) params.append('accountNo', accountNo.trim());
      if (customerName.trim()) params.append('customerName', customerName.trim());

      const res = await authFetch(`/api/officer/reports/payment-ready/excel?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Backend failed to generate Excel file');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const bMonthName = billingMonth ? billingMonth.replace(/\s+/g, '_') : 'ALL';
      const divName = division ? division.replace(/\s+/g, '_') : 'ALL';
      a.download = `Payment_Ready_Report_${bMonthName}_${divName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (showToast) showToast('Payment Ready Report exported to Excel successfully!', 'success');
    } catch (err) {
      console.error('Excel Export Error:', err);
      if (showToast) showToast('Failed to export Excel report. Please retry.', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  // Lifecycle listener for print dialog
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

  const handlePrint = () => {
    if (isPrinting) return; // Prevent multiple simultaneous export requests
    if (records.length === 0) {
      if (showToast) showToast('No records available to export.', 'warning');
      return;
    }
    
    setIsPrinting(true);
    
    // Large report handling notification
    if (records.length > 500 && showToast) {
      showToast(`Preparing PDF document for ${records.length} records. Please wait...`, 'info');
    }

    // Allow React state to flush and display the loading UI before synchronous print blocking
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Print dialog failed:', err);
        if (showToast) showToast('Failed to open PDF print preview. Please retry.', 'error');
        setIsPrinting(false);
      } finally {
        // Fallback release after timeout in case afterprint does not trigger
        setTimeout(() => setIsPrinting(false), 800);
      }
    }, 250);
  };

  const summary = reportData.summary || {};
  const records = reportData.records || [];

  return (
    <div className="payment-ready-container animate-fade-in">
      <style>{`
        /* Landscape Print Rules */
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, sans-serif !important;
          }
          .no-print, .back-btn, .reports-sidebar, .reports-filters-card, header, nav, .page-header {
            display: none !important;
          }
          .main-content, .page-wrapper, .payment-ready-container {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .slip-wrapper {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .slip-table {
            font-size: 9px !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .slip-table th {
            background-color: #FADBD8 !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            border: 1px solid #777 !important;
            padding: 3px 2px !important;
          }
          .slip-table td {
            border: 1px solid #777 !important;
            padding: 2px 3px !important;
            color: #000000 !important;
          }
          .pay-slip-box {
            border: 1px solid #e57373 !important;
            background: #FDEDEC !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        .slip-table-container {
          overflow-x: auto;
          background: #ffffff;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .slip-table {
          width: 100%;
          border-collapse: collapse;
          font-family: Arial, -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11px;
          color: #1a202c;
        }

        .slip-table th, .slip-table td {
          border: 1px solid #cbd5e1;
          padding: 5px 6px;
        }

        .slip-table thead th {
          background-color: #FADBD8;
          color: #1e293b;
          font-weight: 700;
          text-align: center;
          vertical-align: middle;
          font-size: 10.5px;
          line-height: 1.2;
        }

        .slip-table thead tr:first-child th {
          border-bottom: 1px solid #cbd5e1;
        }

        .slip-table tbody tr:hover {
          background-color: #f8fafc;
        }

        .slip-table .cell-center { text-align: center; }
        .slip-table .cell-left { text-align: left; }
        .slip-table .cell-right { text-align: right; }
        .slip-table .exp-code-cell {
          color: #b91c1c;
          font-weight: 700;
          text-align: center;
        }

        .pay-slip-box {
          border: 1.5px solid #F5B7B1;
          background: #FDEDEC;
          height: 24px;
          width: 120px;
          display: inline-block;
          vertical-align: middle;
          border-radius: 2px;
        }
      `}</style>

      {/* Top Action Bar */}
      <div className="card no-print" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Payment Ready Report
              </h2>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                <CheckCircle2 size={13} />
                STATUS: READY
                <Lock size={11} style={{ marginLeft: '2px', opacity: 0.7 }} />
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
              Authoritative slip transaction listing of accounts validated and ready for payment disbursement.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || isPrinting || loading || records.length === 0}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: (exportingExcel || isPrinting || loading || records.length === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {exportingExcel ? (
                <>
                  <RefreshCw size={15} className="animate-spin text-success" />
                  Exporting Excel...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={15} className="text-success" />
                  Export Excel
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting || exportingExcel || loading || records.length === 0}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: (isPrinting || exportingExcel || loading || records.length === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {isPrinting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" style={{ color: '#2563eb' }} />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download size={15} />
                  Export PDF
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting || exportingExcel || loading || records.length === 0}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: (isPrinting || exportingExcel || loading || records.length === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              <Printer size={15} />
              Print Report
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{
          marginTop: '1.25rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #f1f5f9',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          alignItems: 'flex-end'
        }}>
          {/* Billing Month Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Billing Month
            </label>
            <select
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="neon-input"
              style={{ width: '100%', height: '38px', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              <option value="ALL">All Billing Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Division Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Division
            </label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="neon-input"
              style={{ width: '100%', height: '38px', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              {divisionsList.map((d) => (
                <option key={d} value={d}>
                  {d === 'ALL' ? 'All Divisions' : d}
                </option>
              ))}
            </select>
          </div>

          {/* Account Number Search */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Account Number
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search Account No..."
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                className="neon-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', paddingLeft: '2rem', borderRadius: '6px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
            </div>
          </div>

          {/* Customer Name Search */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Customer Name
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search Customer Name..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                className="neon-input"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem', paddingLeft: '2rem', borderRadius: '6px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
            </div>
          </div>

          {/* Payment Status (Locked Display) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Payment Status
            </label>
            <div style={{
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#059669'
            }}>
              <CheckCircle2 size={14} />
              <span>READY (Locked)</span>
            </div>
          </div>

          {/* Refresh / Apply Button */}
          <div>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                width: '100%',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '6px'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="metrics-grid no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="metric-card success" style={{ padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
              PAYMENT READY CUSTOMERS
            </span>
            <span className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669' }}>
              {summary.totalPaymentReadyCustomers || 0}
            </span>
          </div>
          <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="metric-card primary" style={{ padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
              TOTAL AMOUNT (GROSS)
            </span>
            <span className="metric-value" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2563eb' }}>
              LKR {formatAlwaysNumber(summary.totalAmountSum)}
            </span>
          </div>
          <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb' }}>
            <DollarSign size={18} />
          </div>
        </div>

        <div className="metric-card warning" style={{ padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
              TOTAL SET OFF & STAMP
            </span>
            <span className="metric-value" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#d97706' }}>
              LKR {formatAlwaysNumber((summary.totalBillSetOffSum || 0) + (summary.totalStampDutySum || 0))}
            </span>
          </div>
          <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fffbeb', color: '#d97706' }}>
            <Building size={18} />
          </div>
        </div>

        <div className="metric-card teal" style={{ padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
              NET PAYABLE (L9001)
            </span>
            <span className="metric-value" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0d9488' }}>
              LKR {formatAlwaysNumber(summary.totalAmountPayableSum)}
            </span>
          </div>
          <div className="metric-icon-box" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdfa', color: '#0d9488' }}>
            <FileText size={18} />
          </div>
        </div>
      </div>

      {/* Slip Transaction Listing Presentation Card (Exact Reference Reproduction) */}
      <div className="slip-wrapper card" style={{
        padding: '1.75rem',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        borderRadius: '6px'
      }}>
        {/* Slip Header Banner */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{
            fontSize: '13px',
            fontWeight: 800,
            color: '#1e293b',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            margin: '0 0 1rem 0'
          }}>
            SLIP TRANSACTION LISTING - PAYMENT OF NET ACCOUNTING / NET PLUS / NET PLUS PLUS FOR THE MONTH OF {summary.selectedBillingMonth || 'ALL BILLING MONTHS'}
          </h3>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            fontSize: '10.5px',
            fontWeight: 700,
            color: '#334155'
          }}>
            {/* Left Subheader */}
            <div style={{ textAlign: 'left', lineHeight: 1.6 }}>
              <div>{summary.costCentre || 'COST CENTRE - EASTERN PROVINCE / AMPARA'}</div>
              <div>PAYMENT DATE - {summary.paymentDate || '2026.08.24'}</div>
            </div>

            {/* Right Subheader: Pay Slip & Cheque Boxes */}
            <div style={{ textAlign: 'right', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                <span>PAY SLIP NO :</span>
                <span className="pay-slip-box"></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <span>CHEQUE NO :</span>
                <span className="pay-slip-box"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error states */}
        {loading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#2563eb' }} />
            <span>Compiling Payment Ready Listing...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8' }}>
            No payment ready records match the selected month and division parameters.
          </div>
        ) : (
          /* Table Reproduction */
          <div className="slip-table-container">
            <table className="slip-table">
              <thead>
                <tr>
                  <th rowSpan="2" style={{ width: '35px' }}>S.No</th>
                  <th rowSpan="2" style={{ width: '85px' }}>Account No:</th>
                  <th rowSpan="2" style={{ minWidth: '150px' }}>Customer Name</th>
                  <th rowSpan="2" style={{ width: '70px' }}>Ref No:</th>
                  <th colSpan="2" style={{ width: '150px' }}>Bill Period</th>
                  <th colSpan="3" style={{ width: '135px' }}>Units (KWh)</th>
                  <th rowSpan="2" style={{ width: '55px' }}>Unit Cost</th>
                  <th rowSpan="2" style={{ width: '50px' }}>Exp. Code</th>
                  <th rowSpan="2" style={{ width: '50px' }}>Bank Code</th>
                  <th rowSpan="2" style={{ width: '50px' }}>Branch Code</th>
                  <th rowSpan="2" style={{ width: '95px' }}>Account No:</th>
                  <th rowSpan="2" style={{ width: '85px' }}>Total Amount</th>
                  <th rowSpan="2" style={{ width: '70px' }}>Bill Set off</th>
                  <th rowSpan="2" style={{ width: '65px' }}>Stamp Duty<br/>L5229</th>
                  <th rowSpan="2" style={{ width: '90px' }}>Amount Payable<br/>L9001</th>
                </tr>
                <tr>
                  <th style={{ width: '75px' }}>From</th>
                  <th style={{ width: '75px' }}>To</th>
                  <th style={{ width: '45px' }}>Imports</th>
                  <th style={{ width: '45px' }}>Exports</th>
                  <th style={{ width: '45px' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={idx}>
                    <td className="cell-center">{r.sNo}</td>
                    <td className="cell-center" style={{ fontWeight: 600 }}>{r.accountNo}</td>
                    <td className="cell-left">{r.customerName}</td>
                    <td className="cell-center">{r.refNo || '-'}</td>
                    <td className="cell-center">{r.billingPeriodFrom || '-'}</td>
                    <td className="cell-center">{r.billingPeriodTo || '-'}</td>
                    <td className="cell-right">{r.importUnits !== undefined ? r.importUnits.toLocaleString() : '-'}</td>
                    <td className="cell-right">{r.exportUnits !== undefined ? r.exportUnits.toLocaleString() : '-'}</td>
                    <td className="cell-right" style={{ fontWeight: 600 }}>{r.netUnits !== undefined ? r.netUnits.toLocaleString() : '-'}</td>
                    <td className="cell-right">{r.unitCost ? r.unitCost.toFixed(2) : '0.00'}</td>
                    <td className="exp-code-cell">{r.expCode || 'L5001'}</td>
                    <td className="cell-center">{r.bankCode || '-'}</td>
                    <td className="cell-center">{r.branchCode || '-'}</td>
                    <td className="cell-center" style={{ fontFamily: 'monospace', fontSize: '10.5px' }}>{r.bankAccountNo || '-'}</td>
                    <td className="cell-right" style={{ fontWeight: 600 }}>{formatAmount(r.totalAmount)}</td>
                    <td className="cell-right">{formatAmount(r.billSetOff)}</td>
                    <td className="cell-right">{formatAmount(r.stampDuty)}</td>
                    <td className="cell-right" style={{ fontWeight: 700, color: '#1e293b' }}>{formatAmount(r.amountPayable)}</td>
                  </tr>
                ))}

                {/* Summary Totals Footer Row */}
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #94a3b8' }}>
                  <td colSpan="14" style={{ textAlign: 'right', paddingRight: '12px', fontSize: '11px', textTransform: 'uppercase' }}>
                    TOTAL ({records.length} CUSTOMERS)
                  </td>
                  <td className="cell-right" style={{ fontSize: '11px', color: '#1e293b', borderTop: '2px solid #94a3b8' }}>
                    {formatAlwaysNumber(summary.totalAmountSum)}
                  </td>
                  <td className="cell-right" style={{ fontSize: '11px', borderTop: '2px solid #94a3b8' }}>
                    {formatAlwaysNumber(summary.totalBillSetOffSum)}
                  </td>
                  <td className="cell-right" style={{ fontSize: '11px', borderTop: '2px solid #94a3b8' }}>
                    {formatAlwaysNumber(summary.totalStampDutySum)}
                  </td>
                  <td className="cell-right" style={{ fontSize: '11.5px', color: '#0f172a', borderTop: '2px solid #94a3b8' }}>
                    {formatAlwaysNumber(summary.totalAmountPayableSum)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Meta */}
        <div style={{
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          color: '#64748b'
        }}>
          <div>
            Ceylon Electricity Board &bull; EDL Customer Billing Management System &bull; Payment Control Verified
          </div>
          <div>
            Generated: {summary.reportGeneratedDate || new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* PDF Generation Modal Overlay */}
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
              Generating PDF...
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              Compiling printable slip transaction listing for {records.length} customers. Opening system print preview.
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
              <span>Report Ready for Printing &amp; PDF Export</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentReadyReportView;

