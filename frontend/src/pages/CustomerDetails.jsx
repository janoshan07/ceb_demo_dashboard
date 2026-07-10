import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  Activity,
  ArrowLeft,
  Sun,
  Zap,
  Calendar,
  DollarSign
} from 'lucide-react';
import SVGLineChart from '../components/charts/SVGLineChart';

const CustomerDetails = () => {
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const { showToast, showConfirm } = useToast();
  
  // Search & Pagination State
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, VALID, ERROR

  // Selected Customer Details State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, billing, analytics

  // Helpers for Customer 360 calculations
  const calculatePerformanceScore = (exportUnits, panelCapacity) => {
    if (!panelCapacity || panelCapacity <= 0 || !exportUnits) {
      return { score: 0, text: 'N/A', class: 'muted', color: 'var(--text-muted)' };
    }
    const score = exportUnits / panelCapacity;
    if (score >= 120) {
      return { score, text: 'Excellent', class: 'success', color: 'var(--success)' };
    } else if (score >= 70) {
      return { score, text: 'Good', class: 'info', color: 'var(--primary)' };
    } else {
      return { score, text: 'Poor', class: 'danger', color: 'var(--danger)' };
    }
  };

  const getAverageExports = (history) => {
    if (!history || history.length === 0) return 0;
    const totalExp = history.reduce((sum, bill) => sum + (bill.exportUnits || 0), 0);
    return totalExp / history.length;
  };

  const getYearlySummary = (history) => {
    const summary = {};
    history.forEach(bill => {
      if (!bill.fromDate) return;
      const d = new Date(bill.fromDate);
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      if (!summary[year]) {
        summary[year] = { exports: 0, imports: 0, revenue: 0 };
      }
      summary[year].exports += bill.exportUnits || 0;
      summary[year].imports += bill.importUnits || 0;
      summary[year].revenue += bill.totalAmount || 0;
    });
    return Object.keys(summary).sort((a, b) => b - a).map(year => ({
      year,
      ...summary[year]
    }));
  };

  const parseDateLabel = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-LK', { month: 'short', year: '2-digit' });
    } catch (e) {
      return '—';
    }
  };

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
  const [editRefNo, setEditRefNo] = useState('');
  const [editUnitRate, setEditUnitRate] = useState('');
  const [editTariffType, setEditTariffType] = useState('');
  const [editCostCodeId, setEditCostCodeId] = useState('');
  const [editNetTypeId, setEditNetTypeId] = useState('');
  const [editExpenseCodeId, setEditExpenseCodeId] = useState('');
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
      if (statusFilter !== 'ALL') {
        url += `&validationStatus=${statusFilter}`;
      }
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

  const fetchLookups = async () => {
    try {
      const [ccRes, ntRes, ecRes] = await Promise.all([
        authFetch('/api/lookup/cost-codes'),
        authFetch('/api/lookup/net-types'),
        authFetch('/api/lookup/expense-codes')
      ]);
      if (ccRes.ok) setCostCodesList(await ccRes.json());
      if (ntRes.ok) setNetTypesList(await ntRes.json());
      if (ecRes.ok) setExpenseCodesList(await ecRes.json());
    } catch (e) {
      console.error('Failed to load lookup lists:', e);
    }
  };

  useEffect(() => {
    fetchCustomers(currentPage, appliedQuery);
    fetchLookups();
  }, [currentPage, appliedQuery, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedQuery(searchQuery);
    setCurrentPage(0);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setAppliedQuery('');
    setCurrentPage(0);
  };

  // Helper to generate professional pagination pages layout
  const getPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(0);
      let start = Math.max(1, currentPage - 1);
      let end = Math.min(totalPages - 2, currentPage + 1);
      
      if (currentPage <= 2) {
        end = 3;
      } else if (currentPage >= totalPages - 3) {
        start = totalPages - 4;
      }
      
      if (start > 1) {
        pageNumbers.push('ellipsis-left');
      }
      
      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }
      
      if (end < totalPages - 2) {
        pageNumbers.push('ellipsis-right');
      }
      
      pageNumbers.push(totalPages - 1);
    }
    return pageNumbers;
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
    setActiveTab('overview');
    
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
    setEditRefNo(customer.refNo || '');
    setEditUnitRate(customer.unitRate || '');
    setEditTariffType(customer.tariffType || '');
    setEditCostCodeId(customer.costCodeId || '');
    setEditNetTypeId(customer.netTypeId || '');
    setEditExpenseCodeId(customer.expenseCodeId || '');

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
          bankAccountNo: editBankAccountNo.trim(),
          refNo: editRefNo.trim(),
          unitRate: editUnitRate ? parseFloat(editUnitRate) : null,
          tariffType: editTariffType.trim(),
          costCodeId: editCostCodeId ? parseInt(editCostCodeId) : null,
          netTypeId: editNetTypeId ? parseInt(editNetTypeId) : null,
          expenseCodeId: editExpenseCodeId ? parseInt(editExpenseCodeId) : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update customer details.');
      }

      if (data.status === 'PENDING') {
        const pendingMsg = 'Edits submitted successfully and are pending administrator approval.';
        setEditMessage(`Success: ${pendingMsg}`);
        showToast(pendingMsg, 'warning');
        setIsEditing(false);
      } else {
        setSelectedCustomer(data);
        setIsEditing(false);
        const successMsg = 'Customer details updated successfully.';
        setEditMessage(`Success: ${successMsg}`);
        showToast(successMsg, 'success');
        fetchCustomers(currentPage, searchQuery);
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to update customer details.';
      setEditError(errMsg);
      showToast(errMsg, 'error');
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
        const pendingMsg = 'Billing updates submitted and are pending Admin approval.';
        setBillEditSuccess(`Success: ${pendingMsg}`);
        showToast(pendingMsg, 'warning');
        setTimeout(() => setEditingBill(null), 2500);
      } else {
        const successMsg = 'Billing record updated successfully.';
        setBillEditSuccess(`Success: ${successMsg}`);
        showToast(successMsg, 'success');
        fetchBillingHistory(selectedCustomer.accountNo);
        setTimeout(() => setEditingBill(null), 1500);
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to edit billing record.';
      setBillEditError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setBillEditLoading(false);
    }
  };

  // --- ADD CUSTOMER HANDLERS ---
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [newCustAccNo, setNewCustAccNo] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustAgreementDate, setNewCustAgreementDate] = useState('');
  const [newCustCapacity, setNewCustCapacity] = useState('');
  const [newCustSolarType, setNewCustSolarType] = useState('Net Plus');
  const [newCustBankCode, setNewCustBankCode] = useState('');
  const [newCustBranchCode, setNewCustBranchCode] = useState('');
  const [newCustBankAccountNo, setNewCustBankAccountNo] = useState('');
  const [newCustRefNo, setNewCustRefNo] = useState('');
  const [newCustUnitRate, setNewCustUnitRate] = useState('');
  const [newCustTariffType, setNewCustTariffType] = useState('');
  const [newCustCostCodeId, setNewCustCostCodeId] = useState('');
  const [newCustNetTypeId, setNewCustNetTypeId] = useState('');
  const [newCustExpenseCodeId, setNewCustExpenseCodeId] = useState('');

  // Lookup options list state
  const [costCodesList, setCostCodesList] = useState([]);
  const [netTypesList, setNetTypesList] = useState([]);
  const [expenseCodesList, setExpenseCodesList] = useState([]);

  const [addCustError, setAddCustError] = useState(null);
  const [addCustLoading, setAddCustLoading] = useState(false);

  const openAddCustomerModal = () => {
    setNewCustAccNo('');
    setNewCustName('');
    setNewCustAddress('');
    setNewCustMobile('');
    setNewCustAgreementDate('');
    setNewCustCapacity('');
    setNewCustSolarType('Net Plus');
    setNewCustBankCode('');
    setNewCustBranchCode('');
    setNewCustBankAccountNo('');
    setNewCustRefNo('');
    setNewCustUnitRate('');
    setNewCustTariffType('');
    setNewCustCostCodeId('');
    setNewCustNetTypeId('');
    setNewCustExpenseCodeId('');
    setAddCustError(null);
    setAddCustomerModalOpen(true);
  };

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!newCustAccNo.trim() || newCustAccNo.trim().length !== 10 || !/^\d+$/.test(newCustAccNo.trim())) {
      setAddCustError('Account number must be exactly 10 digits and numeric.');
      return;
    }
    if (!newCustName.trim()) {
      setAddCustError('Customer name is required.');
      return;
    }

    try {
      setAddCustLoading(true);
      setAddCustError(null);
      const postPrefix = user.role === 'ADMIN' ? 'admin' : 'officer';
      const res = await authFetch(`/api/${postPrefix}/customers`, {
        method: 'POST',
        body: JSON.stringify({
          accountNo: newCustAccNo.trim(),
          customerName: newCustName.trim(),
          customerAddress: newCustAddress.trim(),
          mobileNo: newCustMobile.trim(),
          agreementDate: newCustAgreementDate || null,
          panelCapacity: newCustCapacity ? parseFloat(newCustCapacity) : null,
          solarType: newCustSolarType,
          bankCode: newCustBankCode.trim(),
          branchCode: newCustBranchCode.trim(),
          bankAccountNo: newCustBankAccountNo.trim(),
          refNo: newCustRefNo.trim(),
          unitRate: newCustUnitRate ? parseFloat(newCustUnitRate) : null,
          tariffType: newCustTariffType.trim(),
          costCodeId: newCustCostCodeId ? parseInt(newCustCostCodeId) : null,
          netTypeId: newCustNetTypeId ? parseInt(newCustNetTypeId) : null,
          expenseCodeId: newCustExpenseCodeId ? parseInt(newCustExpenseCodeId) : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create customer.');
      }
      
      if (data.status === 'PENDING') {
        showToast('Customer creation request queued for Admin approval.', 'warning');
      } else {
        showToast('Customer created successfully.', 'success');
      }
      setAddCustomerModalOpen(false);
      fetchCustomers(currentPage, searchQuery);
    } catch (err) {
      setAddCustError(err.message || 'Failed to add customer.');
    } finally {
      setAddCustLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Customer Profile?',
      message: `Are you absolutely sure you want to delete customer ${selectedCustomer.accountNo} (${selectedCustomer.customerName})? This action cannot be undone and will remove their entire history.`,
      confirmText: 'Delete Customer',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      const deletePrefix = user.role === 'ADMIN' ? 'admin' : 'officer';
      const res = await authFetch(`/api/${deletePrefix}/customers/${selectedCustomer.accountNo}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete customer.');
      }
      
      if (data.status === 'PENDING') {
        showToast('Customer deletion request submitted for Admin approval.', 'warning');
      } else {
        showToast('Customer deleted successfully.', 'success');
      }
      setDrawerOpen(false);
      fetchCustomers(currentPage, searchQuery);
    } catch (err) {
      showToast(err.message || 'Failed to delete customer.', 'error');
    }
  };

  // --- DELETE BILL HANDLER ---
  const handleDeleteBill = async (billingId) => {
    const confirmed = await showConfirm({
      title: 'Delete Billing Record?',
      message: 'Are you sure you want to delete this billing record? This action cannot be undone.',
      confirmText: 'Delete Record',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      const deletePrefix = user.role === 'ADMIN' ? 'admin' : 'officer';
      const res = await authFetch(`/api/${deletePrefix}/billing/${billingId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete billing record.');
      }

      if (data.status === 'PENDING') {
        showToast('Billing record deletion queued for Admin approval.', 'warning');
      } else {
        showToast('Billing record deleted successfully.', 'success');
        fetchBillingHistory(selectedCustomer.accountNo);
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete billing record.', 'error');
    }
  };

  // --- ADD BILL HANDLERS ---
  const [addBillModalOpen, setAddBillModalOpen] = useState(false);
  const [newBillRefNo, setNewBillRefNo] = useState('');
  const [newBillFromDate, setNewBillFromDate] = useState('');
  const [newBillToDate, setNewBillToDate] = useState('');
  const [newBillImportUnits, setNewBillImportUnits] = useState('');
  const [newBillExportUnits, setNewBillExportUnits] = useState('');
  const [newBillUnitCost, setNewBillUnitCost] = useState('37.0');
  const [newBillMode, setNewBillMode] = useState('Fixed');
  const [newBillCycle, setNewBillCycle] = useState('');
  const [newBillSetOff, setNewBillSetOff] = useState('');
  const [newBillRetentionMoney, setNewBillRetentionMoney] = useState('');
  const [newBillPayment, setNewBillPayment] = useState('');
  const [addBillError, setAddBillError] = useState(null);
  const [addBillLoading, setAddBillLoading] = useState(false);

  const openAddBillModal = () => {
    setNewBillRefNo('');
    setNewBillFromDate('');
    setNewBillToDate('');
    setNewBillImportUnits('');
    setNewBillExportUnits('');
    setNewBillUnitCost('37.0');
    setNewBillMode('Fixed');
    setNewBillCycle('');
    setNewBillSetOff('');
    setNewBillRetentionMoney('');
    setNewBillPayment('');
    setAddBillError(null);
    setAddBillModalOpen(true);
  };

  const handleAddBillSubmit = async (e) => {
    e.preventDefault();
    if (!newBillFromDate || !newBillToDate || newBillImportUnits === '' || newBillExportUnits === '' || newBillUnitCost === '') {
      setAddBillError('Billing period, units, and unit cost are required.');
      return;
    }

    try {
      setAddBillLoading(true);
      setAddBillError(null);
      const postPrefix = user.role === 'ADMIN' ? 'admin' : 'officer';
      
      let ref = newBillRefNo.trim();
      if (!ref) {
        ref = `REF-${selectedCustomer.accountNo}-${newBillFromDate.replace(/-/g, '')}`;
      }

      const res = await authFetch(`/api/${postPrefix}/billing`, {
        method: 'POST',
        body: JSON.stringify({
          accountNo: selectedCustomer.accountNo,
          refNo: ref,
          fromDate: newBillFromDate,
          toDate: newBillToDate,
          importUnits: parseFloat(newBillImportUnits),
          exportUnits: parseFloat(newBillExportUnits),
          unitCost: parseFloat(newBillUnitCost),
          billingMode: newBillMode,
          billCycle: newBillCycle !== '' ? parseInt(newBillCycle) : null,
          billSetOff: newBillSetOff !== '' ? parseFloat(newBillSetOff) : null,
          retentionMoney: newBillRetentionMoney !== '' ? parseFloat(newBillRetentionMoney) : null,
          payment: newBillPayment !== '' ? parseFloat(newBillPayment) : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create billing record.');
      }
      
      if (data.status === 'PENDING') {
        showToast('Manual bill addition queued for Admin approval.', 'warning');
      } else {
        showToast('Billing record created successfully.', 'success');
        fetchBillingHistory(selectedCustomer.accountNo);
      }
      setAddBillModalOpen(false);
    } catch (err) {
      setAddBillError(err.message || 'Failed to create bill.');
    } finally {
      setAddBillLoading(false);
    }
  };

  const formatLKR = (val) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const parseErrors = (errStr) => {
    if (!errStr) return [];
    try {
      return JSON.parse(errStr);
    } catch (e) {
      if (errStr.includes('[') || errStr.includes(',')) {
        return errStr.replace(/[\[\]"]/g, '').split(',').map(s => s.trim());
      }
      return [errStr];
    }
  };

  return (
    <div className="page-wrapper animate-fade-in">
      <button onClick={() => navigate('/')} className="back-btn">
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Directory</h1>
          <p className="page-subtitle">Search customer electricity accounts, edit profiles, and view ledger details.</p>
        </div>
      </div>

      {/* Directory tabs (All / Valid / Error Records) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => { setStatusFilter('ALL'); setCurrentPage(0); }}
          className={`tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
          style={{
            padding: '0.5rem 1.25rem',
            background: statusFilter === 'ALL' ? 'rgba(99,102,241,0.12)' : 'transparent',
            border: 'none',
            color: statusFilter === 'ALL' ? '#818cf8' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.85rem',
            borderRadius: '6px',
            cursor: 'pointer',
            borderBottom: statusFilter === 'ALL' ? '2.5px solid #6366f1' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          All Customers
        </button>
        <button
          onClick={() => { setStatusFilter('VALID'); setCurrentPage(0); }}
          className={`tab-btn ${statusFilter === 'VALID' ? 'active' : ''}`}
          style={{
            padding: '0.5rem 1.25rem',
            background: statusFilter === 'VALID' ? 'rgba(16,185,129,0.12)' : 'transparent',
            border: 'none',
            color: statusFilter === 'VALID' ? '#10b981' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.85rem',
            borderRadius: '6px',
            cursor: 'pointer',
            borderBottom: statusFilter === 'VALID' ? '2.5px solid #10b981' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          Valid Records
        </button>
        <button
          onClick={() => { setStatusFilter('ERROR'); setCurrentPage(0); }}
          className={`tab-btn ${statusFilter === 'ERROR' ? 'active' : ''}`}
          style={{
            padding: '0.5rem 1.25rem',
            background: statusFilter === 'ERROR' ? 'rgba(239,68,68,0.12)' : 'transparent',
            border: 'none',
            color: statusFilter === 'ERROR' ? '#ef4444' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.85rem',
            borderRadius: '6px',
            cursor: 'pointer',
            borderBottom: statusFilter === 'ERROR' ? '2.5px solid #ef4444' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          Error Records
        </button>
      </div>

      {error && (
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'center', color: 'var(--danger)', marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', width: '100%', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} className="search-filter-bar" style={{ flex: 1, margin: 0 }}>
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
          {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--success)', borderColor: 'var(--success)' }}
              onClick={openAddCustomerModal}
            >
              Add Customer
            </button>
          )}
        </div>
      </div>

      {/* Customer List Table */}
      <div className="card">
        <div className="table-container">
          {loading ? (
            <table className="custom-table" style={{ opacity: 0.8 }}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Account No</th>
                  <th>Customer Name</th>
                  <th>Solar Type</th>
                  <th>Panel Cap</th>
                  <th>Agreement Date</th>
                  <th>Ref No</th>
                  <th>Cost Code</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td><div className="skeleton" style={{ height: '16px', width: '20px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '100px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '150px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '4px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '180px' }}></div></td>
                    <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: '28px', width: '90px', borderRadius: '4px', marginLeft: 'auto' }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : customers.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>
              No customers found. Try a different search query or import a billing file.
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Account No</th>
                  <th>Customer Name</th>
                  <th>Solar Type</th>
                  <th>Panel Cap</th>
                  <th>Agreement Date</th>
                  <th>Ref No</th>
                  <th>Cost Code</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((cust, idx) => (
                  <tr key={cust.accountNo}>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {currentPage * 8 + idx + 1}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{cust.accountNo}</td>
                    <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', minHeight: '38px' }}>
                      {cust.customerName}
                      {cust.validationStatus === 'ERROR' && (
                        <span 
                          className="badge danger" 
                          style={{ 
                            padding: '0.15rem 0.45rem', 
                            borderRadius: '4px', 
                            fontSize: '0.68rem', 
                            fontWeight: 700, 
                            background: 'rgba(239, 68, 68, 0.18)', 
                            color: '#f87171', 
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            cursor: 'help'
                          }}
                          title={cust.validationErrors ? parseErrors(cust.validationErrors).join('; ') : 'Validation errors present'}
                        >
                          Error
                        </span>
                      )}
                    </td>
                    <td><span className="badge info">{cust.solarType || 'Net Plus'}</span></td>
                    <td style={{ fontWeight: 600 }}>{cust.panelCapacity ? `${cust.panelCapacity} kW` : '—'}</td>
                    <td>{cust.agreementDate || '—'}</td>
                    <td>{cust.refNo || '—'}</td>
                    <td>{cust.costCode || '—'}</td>
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
            
            {getPageNumbers().map((item, idx) => {
              if (item === 'ellipsis-left' || item === 'ellipsis-right') {
                return (
                  <span 
                    key={`ellipsis-${idx}`} 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '0 0.5rem', 
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  >
                    ...
                  </span>
                );
              }
              return (
                <button 
                  key={item} 
                  className={`pagination-btn ${currentPage === item ? 'active' : ''}`}
                  onClick={() => setCurrentPage(item)}
                  disabled={loading}
                >
                  {item + 1}
                </button>
              );
            })}

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
      <div className={`slide-drawer ${drawerOpen ? 'open' : ''}`} style={{ width: '850px', maxWidth: '95%' }}>
        <div className="drawer-header">
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} className="text-primary" />
            Customer 360 Profile
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
            
            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                className={`btn ${activeTab === 'billing' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setActiveTab('billing')}
              >
                Billing History
              </button>
              <button
                type="button"
                className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setActiveTab('analytics')}
              >
                Analytics
              </button>
            </div>

            {editMessage && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', borderLeft: '3px solid var(--success)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {editMessage}
              </div>
            )}

            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="animate-fade-in">
                {selectedCustomer.validationStatus === 'ERROR' && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertCircle size={16} />
                      Validation Issues
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#f87171', fontSize: '0.82rem', lineHeight: 1.7 }}>
                      {parseErrors(selectedCustomer.validationErrors).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem', alignItems: 'start' }}>
                  {/* Profile Card */}
                  <div className="card" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Account Number</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.1rem' }}>{selectedCustomer.accountNo}</div>
                    </div>
                    {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && !isEditing && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => {
                            setIsEditing(true);
                            setEditMessage(null);
                            setEditError(null);
                          }}
                        >
                          <Edit size={12} />
                          Edit Profile
                        </button>
                        <button 
                          type="button"
                          className="btn btn-primary" 
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', background: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={handleDeleteCustomer}
                        >
                          <X size={12} />
                          Delete Customer
                        </button>
                      </div>
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
                          <label className="form-label">Net Type (Solar Type)</label>
                          <select 
                            className="login-form-input" 
                            value={editNetTypeId}
                            onChange={(e) => {
                              setEditNetTypeId(e.target.value);
                              const selected = netTypesList.find(n => n.id.toString() === e.target.value);
                              if (selected) setEditSolarType(selected.name);
                            }}
                            style={{ appearance: 'auto' }}
                          >
                            <option value="">Select Net Type</option>
                            {netTypesList.map(n => (
                              <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
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

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Reference No (Ref No)</label>
                          <input 
                            type="text" 
                            className="login-form-input" 
                            value={editRefNo}
                            onChange={(e) => setEditRefNo(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Unit Rate</label>
                          <input 
                            type="number" 
                            step="0.001"
                            className="login-form-input" 
                            value={editUnitRate}
                            onChange={(e) => setEditUnitRate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Tariff Type</label>
                          <input 
                            type="text" 
                            className="login-form-input" 
                            value={editTariffType}
                            onChange={(e) => setEditTariffType(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Cost Code</label>
                          <select 
                            className="login-form-input" 
                            value={editCostCodeId}
                            onChange={(e) => setEditCostCodeId(e.target.value)}
                            style={{ appearance: 'auto' }}
                          >
                            <option value="">Select Cost Code</option>
                            {costCodesList.map(c => (
                              <option key={c.id} value={c.id}>{c.costCode} - {c.areaName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Expense Code</label>
                        <select 
                          className="login-form-input" 
                          value={editExpenseCodeId}
                          onChange={(e) => setEditExpenseCodeId(e.target.value)}
                          style={{ appearance: 'auto' }}
                        >
                          <option value="">Select Expense Code</option>
                          {expenseCodesList.map(e => (
                            <option key={e.id} value={e.id}>{e.expCode} - {e.description}</option>
                          ))}
                        </select>
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
                          <label className="form-label">Branch Code (Auto-detected)</label>
                          <input 
                            type="text" 
                            className="login-form-input" 
                            value={editBranchCode}
                            readOnly
                            disabled
                            style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', opacity: 0.8 }}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Customer Name</span>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{selectedCustomer.customerName}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Solar System Type</span>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', color: 'var(--success)' }}>
                            {selectedCustomer.solarType || 'Net Plus'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Customer Address</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.customerAddress || '—'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Mobile No</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.mobileNo || '—'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Panel Capacity</span>
                          <div style={{ fontWeight: 600 }}>{selectedCustomer.panelCapacity ? `${selectedCustomer.panelCapacity} kW` : '—'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Agreement Date</span>
                          <div style={{ fontWeight: 600 }}>
                            {selectedCustomer.agreementDate ? new Date(selectedCustomer.agreementDate).toLocaleDateString('en-LK') : '—'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Bank Code</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.bankCode || '—'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Branch Code</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.branchCode || '—'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Bank Account No</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.bankAccountNo || '—'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Ref No</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.refNo || '—'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Unit Rate</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.unitRate != null ? `${selectedCustomer.unitRate} LKR` : '—'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Tariff Type</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.tariffType || '—'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cost Code</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.costCode || '—'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Expense Code</span>
                          <div style={{ fontWeight: 500 }}>{selectedCustomer.expenseCode || '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Score & Yearly Summaries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Performance Score Card */}
                  <div className="card" style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>
                    {historyLoading ? (
                      <div className="skeleton" style={{ height: '90px', width: '100%' }}></div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Solar Performance Score</span>
                          {(() => {
                            const avgExp = getAverageExports(billingHistory);
                            const perf = calculatePerformanceScore(avgExp, selectedCustomer.panelCapacity);
                            return (
                              <span className={`badge ${perf.class}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700 }}>
                                {perf.text}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.25rem' }}>
                          {(() => {
                            const avgExp = getAverageExports(billingHistory);
                            const ratio = selectedCustomer.panelCapacity > 0 ? (avgExp / selectedCustomer.panelCapacity) : 0;
                            return (
                              <>
                                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {ratio.toFixed(1)}
                                </span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>kWh / kW</span>
                              </>
                            );
                          })()}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.25' }}>
                          Calculated as average monthly export units divided by solar panel capacity. Represents overall solar yield health.
                        </span>
                      </>
                    )}
                  </div>

                  {/* Yearly Summary Card */}
                  <div className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={14} />
                      Yearly Summary Ledger
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {historyLoading ? (
                        [...Array(2)].map((_, i) => (
                          <div key={i} className="skeleton" style={{ height: '38px', width: '100%' }}></div>
                        ))
                      ) : (
                        <>
                          {getYearlySummary(billingHistory).map(yearData => (
                            <div key={yearData.year} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>
                                <span>Year {yearData.year}</span>
                                <span>{formatLKR(yearData.revenue)}</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <div>Exports: <strong style={{ color: 'var(--success)' }}>{yearData.exports.toLocaleString()} kWh</strong></div>
                                <div style={{ textAlign: 'right' }}>Imports: <strong style={{ color: 'var(--warning)' }}>{yearData.imports.toLocaleString()} kWh</strong></div>
                              </div>
                            </div>
                          ))}
                          {billingHistory.length === 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No statements available to group.</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* TAB CONTENT: BILLING HISTORY */}
            {activeTab === 'billing' && (
              <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1rem' }}>
                    <History size={16} className="text-accent" style={{ color: 'var(--accent-teal)' }} />
                    Monthly Billing Ledger
                  </h3>
                  {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', background: 'var(--success)', borderColor: 'var(--success)' }}
                      onClick={openAddBillModal}
                    >
                      Add Bill Record
                    </button>
                  )}
                </div>
                
                <div style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  {historyLoading ? (
                    <table className="custom-table" style={{ opacity: 0.8 }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                        <tr>
                          <th>Period</th>
                          <th>Ref No</th>
                          <th>Yield Perf</th>
                          <th>Imports</th>
                          <th>Exports</th>
                          <th>Net (kWh)</th>
                          <th>Total Amount</th>
                          <th>Payment</th>
                          <th>Mode</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...Array(5)].map((_, i) => (
                          <tr key={i}>
                            <td><div className="skeleton" style={{ height: '16px', width: '70px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '22px', width: '60px', borderRadius: '4px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '22px', width: '50px', borderRadius: '4px' }}></div></td>
                            <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: '28px', width: '50px', borderRadius: '4px', marginLeft: 'auto' }}></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : billingHistory.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No bills logged for this customer.
                    </div>
                  ) : (
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                        <tr>
                          <th>Period</th>
                          <th>Ref No</th>
                          <th>Yield Perf</th>
                          <th>Imports</th>
                          <th>Exports</th>
                          <th>Net (kWh)</th>
                          <th>Total Amount</th>
                          <th>Payment</th>
                          <th>Mode</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingHistory.map((bill) => {
                          const perf = calculatePerformanceScore(bill.exportUnits, selectedCustomer.panelCapacity);
                          return (
                            <tr key={bill.billingId}>
                              <td>
                                {parseDateLabel(bill.fromDate)}
                              </td>
                              <td style={{ fontWeight: 500 }}>{bill.refNo}</td>
                              <td>
                                <span className={`badge ${perf.class}`} style={{ textTransform: 'capitalize', fontSize: '0.72rem', fontWeight: 600 }}>
                                  {perf.text}
                                </span>
                              </td>
                              <td>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning)' }}>
                                  <TrendingDown size={12} />
                                  {bill.importUnits.toLocaleString()}
                                </span>
                              </td>
                              <td>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                                  <TrendingUp size={12} />
                                  {bill.exportUnits.toLocaleString()}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600, color: bill.netUnit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {bill.netUnit > 0 ? `+${bill.netUnit.toLocaleString()}` : bill.netUnit.toLocaleString()}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                {formatLKR(bill.totalAmount)}
                              </td>
                              <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                                {bill.payment != null ? formatLKR(bill.payment) : '—'}
                              </td>
                              <td><span className="badge success" style={{ fontSize: '0.65rem' }}>{bill.billingMode || 'Fixed'}</span></td>
                              <td style={{ textAlign: 'right' }}>
                                <button 
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.35rem' }}
                                  onClick={() => handleOpenBillEdit(bill)}
                                >
                                  Edit
                                </button>
                                {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
                                  <button 
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                                    onClick={() => handleDeleteBill(bill.billingId)}
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: ANALYTICS */}
            {activeTab === 'analytics' && (() => {
              if (historyLoading) {
                return (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="card skeleton" style={{ height: '320px', border: 'none' }}></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div className="card skeleton" style={{ height: '240px', border: 'none' }}></div>
                      <div className="card skeleton" style={{ height: '240px', border: 'none' }}></div>
                    </div>
                  </div>
                );
              }
              const sortedHistory = billingHistory ? [...billingHistory].reverse() : [];
              return (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Revenue Trend Chart (100% width) */}
                  <div className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <DollarSign size={16} className="text-primary" />
                      Revenue Trend (LKR)
                    </h4>
                    <SVGLineChart
                      data={sortedHistory.map(bill => ({
                        label: parseDateLabel(bill.fromDate),
                        value: bill.totalAmount || 0
                      }))}
                      strokeColor="#3b82f6"
                      fillGradientId="c360-rev-grad"
                      fillColorStart="rgba(59, 130, 246, 0.22)"
                      fillColorEnd="rgba(59, 130, 246, 0)"
                      tooltipSuffix=" LKR"
                      formatter={(val) => formatLKR(val).replace('LKR', '')}
                    />
                  </div>

                  {/* Import / Export Grid (50% / 50% split) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Export units */}
                    <div className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Sun size={16} style={{ color: 'var(--success)' }} />
                        Monthly Solar Export (kWh)
                      </h4>
                      <SVGLineChart
                        data={sortedHistory.map(bill => ({
                          label: parseDateLabel(bill.fromDate),
                          value: bill.exportUnits || 0
                        }))}
                        strokeColor="#10b981"
                        fillGradientId="c360-exp-grad"
                        fillColorStart="rgba(16, 185, 129, 0.2)"
                        fillColorEnd="rgba(16, 185, 129, 0)"
                        tooltipSuffix=" kWh"
                      />
                    </div>

                    {/* Import units */}
                    <div className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <TrendingDown size={16} style={{ color: 'var(--warning)' }} />
                        Monthly Grid Import (kWh)
                      </h4>
                      <SVGLineChart
                        data={sortedHistory.map(bill => ({
                          label: parseDateLabel(bill.fromDate),
                          value: bill.importUnits || 0
                        }))}
                        strokeColor="#f59e0b"
                        fillGradientId="c360-imp-grad"
                        fillColorStart="rgba(245, 158, 11, 0.2)"
                        fillColorEnd="rgba(245, 158, 11, 0)"
                        tooltipSuffix=" kWh"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

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

      {addCustomerModalOpen && (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 1000 }}>
          <div className="modal-content card animate-fade-in" style={{ maxWidth: 650, padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Add Customer Profile</h3>
              <button onClick={() => setAddCustomerModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {addCustError && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {addCustError}
              </div>
            )}

            <form onSubmit={handleAddCustomerSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Account Number (10 digits)*</label>
                  <input
                    type="text"
                    maxLength={10}
                    className="login-form-input"
                    value={newCustAccNo}
                    onChange={(e) => setNewCustAccNo(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Name*</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Customer Address</label>
                <input
                  type="text"
                  className="login-form-input"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Agreement Date</label>
                  <input
                    type="date"
                    className="login-form-input"
                    value={newCustAgreementDate}
                    onChange={(e) => setNewCustAgreementDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Panel Capacity (kW)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={newCustCapacity}
                    onChange={(e) => setNewCustCapacity(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Net Type (Solar Type)</label>
                  <select
                    className="login-form-input"
                    value={newCustNetTypeId}
                    onChange={(e) => {
                      setNewCustNetTypeId(e.target.value);
                      const selected = netTypesList.find(n => n.id.toString() === e.target.value);
                      if (selected) setNewCustSolarType(selected.name);
                    }}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="">Select Net Type</option>
                    {netTypesList.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Reference No (Ref No)</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={newCustRefNo}
                    onChange={(e) => setNewCustRefNo(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Rate</label>
                  <input
                    type="number"
                    step="0.001"
                    className="login-form-input"
                    value={newCustUnitRate}
                    onChange={(e) => setNewCustUnitRate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tariff Type</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={newCustTariffType}
                    onChange={(e) => setNewCustTariffType(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Code</label>
                  <select
                    className="login-form-input"
                    value={newCustCostCodeId}
                    onChange={(e) => setNewCustCostCodeId(e.target.value)}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="">Select Cost Code</option>
                    {costCodesList.map(c => (
                      <option key={c.id} value={c.id}>{c.costCode} - {c.areaName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Expense Code</label>
                <select
                  className="login-form-input"
                  value={newCustExpenseCodeId}
                  onChange={(e) => setNewCustExpenseCodeId(e.target.value)}
                  style={{ appearance: 'auto' }}
                >
                  <option value="">Select Expense Code</option>
                  {expenseCodesList.map(e => (
                    <option key={e.id} value={e.id}>{e.expCode} - {e.description}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Bank Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={newCustBankCode}
                    onChange={(e) => setNewCustBankCode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={newCustBranchCode}
                    onChange={(e) => setNewCustBranchCode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Account No</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={newCustBankAccountNo}
                    onChange={(e) => setNewCustBankAccountNo(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddCustomerModalOpen(false)} disabled={addCustLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addCustLoading}>
                  {addCustLoading ? 'Adding...' : 'Add Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addBillModalOpen && (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 1000 }}>
          <div className="modal-content card animate-fade-in" style={{ maxWidth: 650, padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Add Billing Ledger Entry</h3>
              <button onClick={() => setAddBillModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {addBillError && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {addBillError}
              </div>
            )}

            <form onSubmit={handleAddBillSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">From Date*</label>
                  <input
                    type="date"
                    className="login-form-input"
                    value={newBillFromDate}
                    onChange={(e) => setNewBillFromDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date*</label>
                  <input
                    type="date"
                    className="login-form-input"
                    value={newBillToDate}
                    onChange={(e) => setNewBillToDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Import Units (kWh)*</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={newBillImportUnits}
                    onChange={(e) => setNewBillImportUnits(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Export Units (kWh)*</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={newBillExportUnits}
                    onChange={(e) => setNewBillExportUnits(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Cost (LKR)*</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={newBillUnitCost}
                    onChange={(e) => setNewBillUnitCost(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Reference Number (optional)</label>
                  <input
                    type="text"
                    className="login-form-input"
                    placeholder="Generates if empty"
                    value={newBillRefNo}
                    onChange={(e) => setNewBillRefNo(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Mode</label>
                  <select
                    className="login-form-input"
                    value={newBillMode}
                    onChange={(e) => setNewBillMode(e.target.value)}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="Fixed">Fixed</option>
                    <option value="Variable">Variable</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Bill Cycle</label>
                  <input
                    type="number"
                    className="login-form-input"
                    value={newBillCycle}
                    onChange={(e) => setNewBillCycle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bill Set Off (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={newBillSetOff}
                    onChange={(e) => setNewBillSetOff(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Retention Money</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={newBillRetentionMoney}
                    onChange={(e) => setNewBillRetentionMoney(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Payment Received (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  className="login-form-input"
                  value={newBillPayment}
                  onChange={(e) => setNewBillPayment(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddBillModalOpen(false)} disabled={addBillLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addBillLoading}>
                  {addBillLoading ? 'Adding...' : 'Add Ledger Entry'}
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
