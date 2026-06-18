import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Award,
  Calendar,
  AlertCircle,
  Download
} from 'lucide-react';

const Reports = () => {
  const { authFetch } = useAuth();
  
  const [totals, setTotals] = useState(null);
  const [topExporters, setTopExporters] = useState([]);
  const [topImporters, setTopImporters] = useState([]);
  const [monthlyAggregates, setMonthlyAggregates] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch aggregates
        const totalsRes = await authFetch('/api/officer/reports/totals');
        const totalsData = await totalsRes.json();
        setTotals(totalsData);

        // Fetch top exporters
        const expRes = await authFetch('/api/officer/reports/top-exporters');
        const expData = await expRes.json();
        setTopExporters(expData);

        // Fetch top importers
        const impRes = await authFetch('/api/officer/reports/top-importers');
        const impData = await impRes.json();
        setTopImporters(impData);

        // Fetch monthly list
        const monthRes = await authFetch('/api/officer/reports/monthly');
        const monthData = await monthRes.json();
        setMonthlyAggregates(monthData);

      } catch (err) {
        setError(err.message || 'Error occurred while loading reports.');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, []);

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
    return date.toLocaleString('en-US', { month: 'long' });
  };

  // Export to CSV Function
  const exportToCSV = () => {
    if (monthlyAggregates.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Billing Cycle,Total Imports (kWh),Total Exports (kWh),Net Energy Flow (kWh),Aggregate Revenue (LKR)\r\n";
    monthlyAggregates.forEach((row) => {
      const netUnits = row.exports - row.imports;
      const billingCycle = `${getMonthName(row.month)} ${row.year}`;
      csvContent += `"${billingCycle}",${row.imports},${row.exports},${netUnits},${row.revenue}\r\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ceb_monthly_financial_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel Function (Tab-separated HTML format compatible with Excel)
  const exportToExcel = () => {
    if (monthlyAggregates.length === 0) return;
    let excelContent = "<table><tr><th>Billing Cycle</th><th>Total Imports (kWh)</th><th>Total Exports (kWh)</th><th>Net Energy Flow</th><th>Aggregate Revenue (LKR)</th></tr>";
    monthlyAggregates.forEach((row) => {
      const netUnits = row.exports - row.imports;
      const billingCycle = `${getMonthName(row.month)} ${row.year}`;
      excelContent += `<tr><td>${billingCycle}</td><td>${row.imports}</td><td>${row.exports}</td><td>${netUnits}</td><td>${row.revenue}</td></tr>`;
    });
    excelContent += "</table>";
    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ceb_monthly_financial_report.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Compiling Analytical Reports...</p>
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
            <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>Reports Synchronization Error</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Management Reports</h1>
          <p className="page-subtitle">Aggregate data metrics, grid consumption, and top energy exporting accounts.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={exportToExcel}>
            <Download size={14} />
            Excel
          </button>
          <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={exportToCSV}>
            <Download size={14} />
            CSV
          </button>
          <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => window.print()}>
            Print PDF
          </button>
        </div>
      </div>

      {/* Totals Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-info">
            <span className="metric-label">Total Imported Energy</span>
            <span className="metric-value" style={{ color: 'var(--warning)' }}>
              {totals?.totalImports?.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kWh</span>
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-info">
            <span className="metric-label">Total Exported Energy</span>
            <span className="metric-value" style={{ color: 'var(--success)' }}>
              {totals?.totalExports?.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kWh</span>
            </span>
          </div>
          <div className="metric-icon-box">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="metric-card teal">
          <div className="metric-info">
            <span className="metric-label">Net Board Earnings</span>
            <span className="metric-value">
              {formatLKR(totals?.totalRevenue)}
            </span>
          </div>
          <div className="metric-icon-box">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Energy Contributor Rank Lists */}
      <div className="dashboard-grid">
        {/* Top Exporters */}
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award className="text-success" size={18} />
              Top 5 Energy Exporters (Solar/Wind Feed-in)
            </h2>
          </div>
          
          <div className="table-container">
            {topExporters.length === 0 ? (
              <p style={{ padding: '1.5rem 0', color: 'var(--text-muted)', textAlign: 'center' }}>No export records registered.</p>
            ) : (
              <table className="custom-table" style={{ fontSize: '0.88rem' }}>
                <thead>
                  <tr>
                    <th>Account No</th>
                    <th>Customer Name</th>
                    <th>Exports (kWh)</th>
                    <th>Total (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {topExporters.map((record, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{record.customer.accountNo}</td>
                      <td>{record.customer.customerName}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>{record.exportUnits?.toLocaleString()}</td>
                      <td>{formatLKR(record.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Importers */}
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award className="text-warning" style={{ color: 'var(--warning)' }} size={18} />
              Top 5 Energy Consumers (Imports)
            </h2>
          </div>

          <div className="table-container">
            {topImporters.length === 0 ? (
              <p style={{ padding: '1.5rem 0', color: 'var(--text-muted)', textAlign: 'center' }}>No import records registered.</p>
            ) : (
              <table className="custom-table" style={{ fontSize: '0.88rem' }}>
                <thead>
                  <tr>
                    <th>Account No</th>
                    <th>Customer Name</th>
                    <th>Imports (kWh)</th>
                    <th>Total (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {topImporters.map((record, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{record.customer.accountNo}</td>
                      <td>{record.customer.customerName}</td>
                      <td style={{ fontWeight: 600, color: 'var(--warning)' }}>{record.importUnits?.toLocaleString()}</td>
                      <td>{formatLKR(record.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Revenue Table */}
      <div className="card">
        <div className="panel-header">
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} className="text-primary" />
            Monthly Financial Summary
          </h2>
        </div>

        <div className="table-container">
          {monthlyAggregates.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>
              No billing cycles recorded in database.
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Billing Cycle</th>
                  <th>Total Imports (kWh)</th>
                  <th>Total Exports (kWh)</th>
                  <th>Net Energy Flow</th>
                  <th>Aggregate Revenue (LKR)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyAggregates.map((row, i) => {
                  const netUnits = row.exports - row.imports;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>
                        {getMonthName(row.month)} {row.year}
                      </td>
                      <td>{row.imports?.toLocaleString()}</td>
                      <td>{row.exports?.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: netUnits >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {netUnits > 0 ? `+${netUnits.toLocaleString()}` : netUnits.toLocaleString()} kWh
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {formatLKR(row.revenue)}
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

export default Reports;
