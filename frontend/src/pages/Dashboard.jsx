import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  FileSpreadsheet
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { authFetch, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        // Fetch monthly trend for chart
        const trendRes = await authFetch(trendUrl);
        const trendData = await trendRes.json();
        
        // Sort chronologically (oldest to newest)
        const sortedTrend = [...trendData].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
        
        setMonthlyTrend(sortedTrend.slice(-6)); // Take latest 6 months

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
      <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading Dashboard Analytics...</p>
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

  // Calculate highest metric for scaling the SVG chart
  const maxVal = monthlyTrend.length > 0 
    ? Math.max(...monthlyTrend.map(item => isCustomer ? Math.max(item.imports, item.exports) : item.revenue)) 
    : 10000;

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isCustomer ? `Welcome, ${customerInfo?.customerName || 'Solar Customer'}` : 'CEB Analytics Dashboard'}
          </h1>
          <p className="page-subtitle">
            {isCustomer 
              ? 'Self-service solar dashboard. Track your energy generation, consumption, and statement ledger.' 
              : 'Monthly electricity consumption, imports, exports, and revenue summaries.'}
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
      <div className="metrics-grid" style={{ gridTemplateColumns: isCustomer ? 'repeat(auto-fit, minmax(220px, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {isCustomer ? (
          <>
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
          </>
        ) : (
          <>
            <div className="metric-card primary">
              <div className="metric-info">
                <span className="metric-label">Registered Customers</span>
                <span className="metric-value">{stats?.totalCustomers}</span>
              </div>
              <div className="metric-icon-box">
                <Users size={24} />
              </div>
            </div>

            <div className="metric-card success">
              <div className="metric-info">
                <span className="metric-label">Total Net Revenue</span>
                <span className="metric-value">{formatLKR(stats?.totalRevenue)}</span>
              </div>
              <div className="metric-icon-box">
                <DollarSign size={24} />
              </div>
            </div>

            <div className="metric-card warning">
              <div className="metric-info">
                <span className="metric-label">Pending Approvals</span>
                <span className="metric-value" style={{ color: stats?.pendingApprovalsCount > 0 ? 'var(--warning)' : 'inherit' }}>
                  {stats?.pendingApprovalsCount || 0}
                </span>
              </div>
              <div className="metric-icon-box" style={{ color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
                {user.role === 'ADMIN' ? (
                  <Link to="/admin" style={{ color: 'inherit' }}><Clock size={24} /></Link>
                ) : (
                  <Clock size={24} />
                )}
              </div>
            </div>

            <div className="metric-card teal">
              <div className="metric-info">
                <span className="metric-label">Imported Energy</span>
                <span className="metric-value" style={{ fontSize: '1.5rem' }}>{stats?.totalImportUnits?.toLocaleString()} kWh</span>
              </div>
              <div className="metric-icon-box">
                <ArrowDownCircle size={24} />
              </div>
            </div>

            <div className="metric-card success">
              <div className="metric-info">
                <span className="metric-label">Exported Solar</span>
                <span className="metric-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>{stats?.totalExportUnits?.toLocaleString()} kWh</span>
              </div>
              <div className="metric-icon-box">
                <ArrowUpCircle size={24} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts & Details Section */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: isCustomer ? '1.5fr 1.2fr' : '2fr 1fr' }}>
        {/* SVG Analytics Chart */}
        <div className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} className="text-primary" />
                {isCustomer ? 'Your Solar Export vs Consumption Grid Trend' : 'Revenue & Energy Flow Trends'}
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isCustomer ? 'Showing last 6 months energy flow metrics (kWh)' : 'Showing last 6 months revenue cycles (LKR)'}
              </span>
            </div>
          </div>
          
          {monthlyTrend.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px', color: 'var(--text-muted)' }}>
              No billing data available yet.
            </div>
          ) : (
            <div>
              {isCustomer ? (
                /* Customer Chart: Side-by-Side Imports vs Exports (kWh) */
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="chart-container">
                    {monthlyTrend.map((item, index) => {
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
              ) : (
                /* Admin/Officer Chart: Revenue Bars */
                <div>
                  <div className="chart-container">
                    {monthlyTrend.map((item, index) => {
                      const percentage = (item.revenue / maxVal) * 100;
                      return (
                        <div key={index} className="chart-bar-wrapper">
                          <div 
                            className="chart-bar" 
                            style={{ height: `${Math.max(percentage, 5)}%` }}
                          >
                            <div className="chart-bar-tooltip">
                              <div>Revenue: {formatLKR(item.revenue)}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                Imp: {item.imports.toLocaleString()} | Exp: {item.exports.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <span className="chart-bar-label">
                            {getMonthName(item.month)} '{String(item.year).substring(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', fontSize: '0.85rem', justifyContent: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--primary)', borderRadius: '2px' }}></span>
                      Monthly Revenue (LKR)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                      Hover over bars to inspect Import/Export values
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Widgets / Customer Details */}
        {isCustomer ? (
          /* Customer Profile Details Card */
          <div className="card animate-fade-in" style={{ backgroundColor: 'var(--bg-secondary)' }}>
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
        ) : (
          /* Admin/Officer Widget */
          <div className="card">
            <div className="panel-header">
              <h2 className="panel-title">Operations Control</h2>
              {(user.role === 'ADMIN' || user.role === 'OFFICER') && (
                <Link to="/upload" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>New Ingestion</Link>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Import energy billing sheets. Ensure files contain correct divisional segments.
              </p>
              
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
        )}
      </div>

      {/* Bottom Listing Details */}
      {isCustomer ? (
        /* Customer-Specific Billing Ledger */
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet className="text-primary" size={18} />
              Personal Monthly Statements Ledger
            </h2>
          </div>

          <div className="table-container">
            {monthlyTrend.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>
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
                    <th>Ingestion Date</th>
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
                        <td>{new Date().toLocaleDateString('en-LK')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Admin / Officer: Ingestions Log */
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title">Recent Billing Imports</h2>
            <Link to="/upload" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}>Manage Uploads</Link>
          </div>

          <div className="table-container">
            {stats?.recentUploads?.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>
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
                    <th>Processed Rows</th>
                    <th>New Customers</th>
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
                          upload.status === 'COMPLETED_WITH_ERRORS' ? 'warning' : 'danger'
                        }`}>
                          {upload.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td>{upload.rowsProcessed}</td>
                      <td style={{ color: upload.newCustomers > 0 ? 'var(--success)' : 'inherit' }}>
                        {upload.newCustomers}
                      </td>
                      <td>{upload.billingInserted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
