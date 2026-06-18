import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  User, 
  CreditCard, 
  History, 
  Edit,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

const CustomerDetails = () => {
  const { authFetch, user } = useAuth();
  
  // Search & Pagination State
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Selected Customer Details State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Customer Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAgreementDate, setEditAgreementDate] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editSolarType, setEditSolarType] = useState('Net Plus');
  const [editBankCode, setEditBankCode] = useState('');
  const [editBranchCode, setEditBranchCode] = useState('');
  const [editBankAccountNo, setEditBankAccountNo] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editMessage, setEditMessage] = useState(null);

  // Billing Record Editing State
  const [editingBill, setEditingBill] = useState(null);
  const [billRefNo, setBillRefNo] = useState('');
  const [billFromDate, setBillFromDate] = useState('');
  const [billToDate, setBillToDate] = useState('');
  const [billImportUnits, setBillImportUnits] = useState('');
  const [billExportUnits, setBillExportUnits] = useState('');
  const [billUnitCost, setBillUnitCost] = useState('');
  const [billMode, setBillMode] = useState('Fixed');
  const [billCycle, setBillCycle] = useState('');
  const [billSetOff, setBillSetOff] = useState('');
  const [billRetentionMoney, setBillRetentionMoney] = useState('');
  const [billPayment, setBillPayment] = useState('');
  const [billEditLoading, setBillEditLoading] = useState(false);
  const [billEditError, setBillEditError] = useState(null);
  const [billEditSuccess, setBillEditSuccess] = useState(null);

  // Load Customers list (officer customer search endpoint)
  const fetchCustomers = async (page = 0, query = '') => {
    try {
      setLoading(true);
      setError(null);
      
      let url = `/api/officer/customers?page=${page}&size=8`;
      if (query.trim()) {
        url += `&query=${encodeURIComponent(query.trim())}`;
      }
      
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error('Failed to load customers.');
      }
      const data = await res.json();
      setCustomers(data.content || []);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      setError(err.message || 'Error occurred while loading customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(currentPage, searchQuery);
  }, [currentPage]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchCustomers(0, searchQuery);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setCurrentPage(0);
    fetchCustomers(0, '');
  };

  const fetchBillingHistory = async (accountNo) => {
    try {
      setHistoryLoading(true);
      setBillingHistory([]);
      const res = await authFetch(`/api/officer/customers/${accountNo}/billing`);
      if (res.ok) {
        const historyData = await res.json();
        setBillingHistory(historyData);
      }
    } catch (err) {
      console.error('Failed to load billing history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewDetails = (customer) => {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
    setIsEditing(false);
    setEditError(null);
    setEditMessage(null);
    setEditingBill(null);
    
    // Prep Edit Fields
    setEditName(customer.customerName);
    setEditAddress(customer.customerAddress || '');
    setEditMobile(customer.mobileNo || '');
    setEditAgreementDate(customer.agreementDate || '');
    setEditCapacity(customer.panelCapacity || '');
    setEditSolarType(customer.solarType || 'Net Plus');
    setEditBankCode(customer.bankCode || '');
    setEditBranchCode(customer.branchCode || '');
    setEditBankAccountNo(customer.bankAccountNo || '');

    fetchBillingHistory(customer.accountNo);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditError('Customer name is required.');
      return;
    }

    try {
      setEditLoading(true);
      setEditError(null);
      setEditMessage(null);
      
      const editPrefix = user.role === 'ADMIN' ? 'admin' : 'officer';
      const res = await authFetch(`/api/${editPrefix}/customers/${selectedCustomer.accountNo}`, {
        method: 'PUT',
        body: JSON.stringify({
          customerName: editName.trim(),
          customerAddress: editAddress.trim(),
          mobileNo: editMobile.trim(),
          agreementDate: editAgreementDate ? editAgreementDate : null,
          panelCapacity: editCapacity ? parseFloat(editCapacity) : null,
          solarType: editSolarType,
          bankCode: editBankCode.trim(),
          branchCode: editBranchCode.trim(),
          bankAccountNo: editBankAccountNo.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update customer details.');
      }

      if (data.status === 'PENDING') {
        setEditMessage('Success: Edits submitted successfully and are pending administrator approval.');
        setIsEditing(false);
      } else {
        setSelectedCustomer(data);
        setIsEditing(false);
        setEditMessage('Success: Customer details updated successfully.');
        fetchCustomers(currentPage, searchQuery);
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update customer details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenBillEdit = (bill) => {
    setEditingBill(bill);
    setBillRefNo(bill.refNo);
    setBillFromDate(bill.fromDate);
    setBillToDate(bill.toDate);
    setBillImportUnits(bill.importUnits);
    setBillExportUnits(bill.exportUnits);
    setBillUnitCost(bill.unitCost);
    setBillMode(bill.billingMode || 'Fixed');
    setBillCycle(bill.billCycle != null ? bill.billCycle : '');
    setBillSetOff(bill.billSetOff != null ? bill.billSetOff : '');
    setBillRetentionMoney(bill.retentionMoney != null ? bill.retentionMoney : '');
    setBillPayment(bill.payment != null ? bill.payment : '');
    setBillEditError(null);
    setBillEditSuccess(null);
  };

  const handleBillEditSubmit = async (e) => {
    e.preventDefault();
    if (!billRefNo.trim() || !billFromDate || !billToDate || billImportUnits === '' || billExportUnits === '' || billUnitCost === '') {
      setBillEditError('All billing fields are required.');
      return;
    }

    try {
      setBillEditLoading(true);
      setBillEditError(null);
      setBillEditSuccess(null);

      const editPrefix = user.role === 'ADMIN' ? 'admin' : 'officer';
      const res = await authFetch(`/api/${editPrefix}/billing/${editingBill.billingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          refNo: billRefNo.trim(),
          fromDate: billFromDate,
          toDate: billToDate,
          importUnits: parseFloat(billImportUnits),
          exportUnits: parseFloat(billExportUnits),
          unitCost: parseFloat(billUnitCost),
          billingMode: billMode,
          billCycle: billCycle !== '' ? parseInt(billCycle) : null,
          billSetOff: billSetOff !== '' ? parseFloat(billSetOff) : null,
          retentionMoney: billRetentionMoney !== '' ? parseFloat(billRetentionMoney) : null,
          payment: billPayment !== '' ? parseFloat(billPayment) : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update billing record.');
      }

      if (data.status === 'PENDING') {
        setBillEditSuccess('Success: Billing updates submitted and are pending Admin approval.');
        setTimeout(() => setEditingBill(null), 2500);
      } else {
        setBillEditSuccess('Success: Billing record updated successfully.');
        fetchBillingHistory(selectedCustomer.accountNo);
        setTimeout(() => setEditingBill(null), 1500);
      }
    } catch (err) {
      setBillEditError(err.message || 'Failed to edit billing record.');
    } finally {
      setBillEditLoading(false);
    }
  };

  const formatLKR = (val) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Directory</h1>
          <p className="page-subtitle">Search customer electricity accounts, edit profiles, and view ledger details.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'center', color: 'var(--danger)', marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} className="search-filter-bar">
          <div className="input-group">
            <Search className="input-icon" size={18} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by Account Number or Customer Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {searchQuery && (
            <button type="button" className="btn btn-secondary" onClick={handleSearchClear}>
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Customer List Table */}
      <div className="card">
        <div className="table-container">
          {loading ? (
            <div style={{ padding: '3rem 0', textAlignment: 'center', color: 'var(--text-secondary)' }}>
              Querying Customer Database...
            </div>
          ) : customers.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>
              No customers found. Try a different search query or import a billing file.
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Account No</th>
                  <th>Customer Name</th>
                  <th>Solar Type</th>
                  <th>Panel Cap</th>
                  <th>Agreement Date</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((cust) => (
                  <tr key={cust.accountNo}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{cust.accountNo}</td>
                    <td style={{ fontWeight: 500 }}>{cust.customerName}</td>
                    <td><span className="badge info">{cust.solarType || 'Net Plus'}</span></td>
                    <td style={{ fontWeight: 600 }}>{cust.panelCapacity ? `${cust.panelCapacity} kW` : '—'}</td>
                    <td>{cust.agreementDate || '—'}</td>
                    <td>{cust.customerAddress || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleViewDetails(cust)}
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
              disabled={currentPage === 0 || loading}
            >
              <ChevronLeft size={16} />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => (
              <button 
                key={i} 
                className={`pagination-btn ${currentPage === i ? 'active' : ''}`}
                onClick={() => setCurrentPage(i)}
                disabled={loading}
              >
                {i + 1}
              </button>
            ))}

            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
              disabled={currentPage === totalPages - 1 || loading}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Details Slide-out Drawer */}
      <div className={`slide-drawer ${drawerOpen ? 'open' : ''}`} style={{ width: '680px' }}>
        <div className="drawer-header">
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} className="text-primary" />
            Customer Profile Details
          </h2>
          <button 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            onClick={() => setDrawerOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {selectedCustomer && (
          <div className="drawer-body">
            
            {editMessage && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', borderLeft: '3px solid var(--success)', fontSize: '0.85rem' }}>
                {editMessage}
              </div>
            )}

            {/* Profile Block */}
            <div className="card" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Account Number</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.1rem' }}>{selectedCustomer.accountNo}</div>
                </div>
                {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && !isEditing && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => {
                      setIsEditing(true);
                      setEditMessage(null);
                      setEditError(null);
                    }}
                  >
                    <Edit size={14} />
                    Edit Profile
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleEditSubmit} className="login-form">
                  {editError && <div className="login-error">{editError}</div>}
                  
                  <div className="form-group">
                    <label className="form-label">Customer Name</label>
                    <input 
                      type="text" 
                      className="login-form-input" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Customer Address</label>
                    <input 
                      type="text" 
                      className="login-form-input" 
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Mobile Number</label>
                      <input 
                        type="text" 
                        className="login-form-input" 
                        value={editMobile}
                        onChange={(e) => setEditMobile(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Solar Type</label>
                      <select 
                        className="login-form-input" 
                        value={editSolarType}
                        onChange={(e) => setEditSolarType(e.target.value)}
                        style={{ appearance: 'auto' }}
                      >
                        <option value="Net Plus">Net Plus</option>
                        <option value="Net Plus Plus">Net Plus Plus</option>
                        <option value="Net Metering">Net Metering</option>
                        <option value="Net Accounting">Net Accounting</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Panel Capacity (kW)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="login-form-input" 
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Agreement Date</label>
                      <input 
                        type="date" 
                        className="login-form-input" 
                        value={editAgreementDate}
                        onChange={(e) => setEditAgreementDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Bank Code</label>
                      <input 
                        type="text" 
                        className="login-form-input" 
                        value={editBankCode}
                        onChange={(e) => setEditBankCode(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Branch Code</label>
                      <input 
                        type="text" 
                        className="login-form-input" 
                        value={editBranchCode}
                        onChange={(e) => setEditBranchCode(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bank Account No</label>
                      <input 
                        type="text" 
                        className="login-form-input" 
                        value={editBankAccountNo}
                        onChange={(e) => setEditBankAccountNo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => { setIsEditing(false); setEditError(null); }}
                      disabled={editLoading}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={editLoading}
                    >
                      {editLoading ? 'Submitting...' : 'Save Profile'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customer Name</span>
                      <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{selectedCustomer.customerName}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Solar System Type</span>
                      <div style={{ fontWeight: 600, marginTop: '0.1rem', color: 'var(--success)' }}>
                        {selectedCustomer.solarType || 'Net Plus'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customer Address</span>
                      <div style={{ fontWeight: 500 }}>{selectedCustomer.customerAddress || '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mobile No</span>
                      <div style={{ fontWeight: 500 }}>{selectedCustomer.mobileNo || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Panel Capacity</span>
                      <div style={{ fontWeight: 600 }}>{selectedCustomer.panelCapacity ? `${selectedCustomer.panelCapacity} kW` : '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Agreement Date</span>
                      <div style={{ fontWeight: 600 }}>
                        {selectedCustomer.agreementDate ? new Date(selectedCustomer.agreementDate).toLocaleDateString('en-LK') : '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bank Code</span>
                      <div style={{ fontWeight: 500 }}>{selectedCustomer.bankCode || '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Branch Code</span>
                      <div style={{ fontWeight: 500 }}>{selectedCustomer.branchCode || '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bank Account No</span>
                      <div style={{ fontWeight: 500 }}>{selectedCustomer.bankAccountNo || '—'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Billing Ledger Block */}
            <div>
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <History size={16} className="text-accent" style={{ color: 'var(--accent-teal)' }} />
                Monthly Billing Ledger
              </h3>
              
              <div style={{ maxHeight: '350px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                {historyLoading ? (
                  <div style={{ padding: '2rem', textAlignment: 'center', color: 'var(--text-secondary)' }}>
                    Loading customer records...
                  </div>
                ) : billingHistory.length === 0 ? (
                  <div style={{ padding: '2rem', textAlignment: 'center', color: 'var(--text-muted)' }}>
                    No bills logged for this customer.
                  </div>
                ) : (
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                      <tr>
                        <th>Period</th>
                        <th>Ref No</th>
                        <th>Bill Cycle</th>
                        <th>Imports</th>
                        <th>Exports</th>
                        <th>Net (kWh)</th>
                        <th>Total Amount</th>
                        <th>Bill Set Off</th>
                        <th>Retention Mo</th>
                        <th>Payment</th>
                        <th>Mode</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory.map((bill) => (
                        <tr key={bill.billingId}>
                          <td>
                            {new Date(bill.fromDate).toLocaleDateString('en-LK', { month: 'short', year: '2-digit' })}
                          </td>
                          <td style={{ fontWeight: 500 }}>{bill.refNo}</td>
                          <td style={{ fontWeight: 600 }}>{bill.billCycle || '—'}</td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning)' }}>
                              <TrendingDown size={12} />
                              {bill.importUnits}
                            </span>
                          </td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                              <TrendingUp size={12} />
                              {bill.exportUnits}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: bill.netUnit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {bill.netUnit > 0 ? `+${bill.netUnit}` : bill.netUnit}
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {formatLKR(bill.totalAmount)}
                          </td>
                          <td style={{ color: 'var(--warning)', fontWeight: 500 }}>
                            {bill.billSetOff != null ? formatLKR(bill.billSetOff) : '—'}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {bill.retentionMoney != null ? formatLKR(bill.retentionMoney) : '—'}
                          </td>
                          <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                            {bill.payment != null ? formatLKR(bill.payment) : '—'}
                          </td>
                          <td><span className="badge success" style={{ fontSize: '0.65rem' }}>{bill.billingMode || 'Fixed'}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleOpenBillEdit(bill)}
                            >
                              Edit Bill
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bill Edit Modal */}
      {editingBill && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyRef: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div className="card animate-fade-in" style={{ width: '500px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
              <h3 className="panel-title">Edit Billing Record ({editingBill.refNo})</h3>
              <button 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => setEditingBill(null)}
              >
                <X size={18} />
              </button>
            </div>

            {billEditError && <div className="login-error" style={{ marginBottom: '1rem' }}>{billEditError}</div>}
            {billEditSuccess && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', borderLeft: '3px solid var(--success)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {billEditSuccess}
              </div>
            )}

            <form onSubmit={handleBillEditSubmit} className="login-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Reference Number</label>
                  <input 
                    type="text" 
                    className="login-form-input" 
                    value={billRefNo}
                    onChange={(e) => setBillRefNo(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bill Cycle</label>
                  <input 
                    type="number" 
                    className="login-form-input" 
                    placeholder="e.g. 445"
                    value={billCycle}
                    onChange={(e) => setBillCycle(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input 
                    type="date" 
                    className="login-form-input" 
                    value={billFromDate}
                    onChange={(e) => setBillFromDate(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input 
                    type="date" 
                    className="login-form-input" 
                    value={billToDate}
                    onChange={(e) => setBillToDate(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Import Units (kWh)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="login-form-input" 
                    value={billImportUnits}
                    onChange={(e) => setBillImportUnits(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Export Units (kWh)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="login-form-input" 
                    value={billExportUnits}
                    onChange={(e) => setBillExportUnits(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Unit Cost (LKR)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="login-form-input" 
                    value={billUnitCost}
                    onChange={(e) => setBillUnitCost(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Mode</label>
                  <select 
                    className="login-form-input" 
                    value={billMode}
                    onChange={(e) => setBillMode(e.target.value)}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="Fixed">Fixed</option>
                    <option value="Variable">Variable</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Bill Set Off (LKR)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="login-form-input" 
                    placeholder="e.g. 1000.00"
                    value={billSetOff}
                    onChange={(e) => setBillSetOff(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Retention Money (LKR)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="login-form-input" 
                    placeholder="e.g. 1000.00"
                    value={billRetentionMoney}
                    onChange={(e) => setBillRetentionMoney(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment (LKR)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="login-form-input" 
                    placeholder="e.g. 50000.00"
                    value={billPayment}
                    onChange={(e) => setBillPayment(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditingBill(null)}
                  disabled={billEditLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={billEditLoading}
                >
                  {billEditLoading ? 'Submitting...' : 'Save Statement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerDetails;
