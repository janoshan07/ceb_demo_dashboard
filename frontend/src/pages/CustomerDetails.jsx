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
  Clock,
  DollarSign,
  MapPin,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Download,
  ChevronDown,
  Plus,
  Eye,
  FileText,
  MoreVertical,
  Filter,
  Layers,
  Phone,
  UserPlus,
  Shield,
  Tag,
  Code,
  Landmark,
  Building
} from 'lucide-react';
import SVGLineChart from '../components/charts/SVGLineChart';

// The 5 fixed Eastern Province divisions/branches the Customer Directory can be filtered by.
const DIRECTORY_DIVISIONS = ['Ampara', 'Batticaloa', 'Trincomalee', 'Valaichenai', 'Kalmunai'];

// Sort options for the Customer Directory list (value maps to the backend `sortBy` param).
const SORT_OPTIONS = [
  { value: 'accountNo', label: 'Account No' },
  { value: 'customerName', label: 'Customer Name' },
  { value: 'agreementDate', label: 'Agreement Date' },
  { value: 'panelCapacity', label: 'Panel Capacity' },
  { value: 'division', label: 'Location' },
  { value: 'createdAt', label: 'Date Added' },
];

// Detail-view sections mirroring the Monthly Directory record modal (Master / CEB Assist / NGEN /
// NPAY). Rendered from the synced `directory` record so the Customer 360 view shows the same detail.
const DETAIL_SECTIONS = [
  {
    title: 'Master Data', color: '#38bdf8',
    fields: [
      { label: 'Address', keys: ['customerAddress'] },
      { label: 'Mobile Number', keys: ['mobileNo'] },
      { label: 'Agreement Date', keys: ['agreementDate'] },
      { label: 'Net Type', keys: ['masterNetType', 'solarType'] },
      { label: 'Unit Rate', keys: ['masterUnitRate', 'unitRate'] },
      { label: 'Bank Details', bank: true },
      { label: 'Panel Capacity', keys: ['panelCapacity'] },
    ],
  },
  {
    title: 'CEB Assist', color: '#f59e0b',
    fields: [
      { label: 'Previous Reading Date', keys: ['prevReadingDate'] },
      { label: 'Current Reading Date', keys: ['currReadingDate'] },
    ],
  },
  {
    title: 'NGEN', color: '#818cf8',
    fields: [
      { label: 'kWh Import', keys: ['kwhImport'] },
      { label: 'kWh Export', keys: ['kwhExport'] },
      { label: 'kWh Unit Sales', keys: ['kwhSales'] },
      { label: 'kWh Sales Amount', keys: ['salesAmount'] },
      { label: 'Bill Outstanding Set Off', keys: ['ngenBillSetOff'] },
      { label: 'Retention Money', keys: ['ngenRetentionMoney'] },
      { label: 'Payment Settled', keys: ['paymentSettled'] },
      { label: 'Outstanding Balance', keys: ['outstandingBalance'] },
    ],
  },
  {
    title: 'NPAY', color: '#c084fc',
    fields: [
      { label: 'Energy Purchase', keys: ['npayEnergyPurchase'] },
      { label: 'Bill Set Off', keys: ['npayBillSetOff'] },
      { label: 'Retention Money', keys: ['npayRetentionMoney'] },
      { label: 'Payment', keys: ['npayPayment'] },
    ],
  },
];

// Unwraps a directory cell value ({value:...} or scalar) to a display string, or '—'.
const dirCell = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return ('value' in val && val.value != null) ? String(val.value) : '—';
  const s = String(val);
  return s.trim() === '' ? '—' : s;
};

// Resolves one detail-section field from a directory record, walking fallback keys (or joining bank).
const dirFieldValue = (rec, f) => {
  if (!rec) return '—';
  if (f.bank) {
    const parts = ['bankCode', 'branchCode', 'bankAccountNo'].map(k => dirCell(rec[k])).filter(v => v && v !== '—');
    return parts.length ? parts.join(' / ') : '—';
  }
  for (const k of f.keys) {
    const v = dirCell(rec[k]);
    if (v !== '—' && v.trim() !== '') return v;
  }
  return '—';
};

// Helper to automatically derive L-Code based on solarType and tariffType
const deriveLCode = (solarType, tariffType) => {
  if (!solarType || !tariffType) return '';
  
  const cleanSolar = solarType.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  let normSolar = '';
  if (cleanSolar.includes('metering') || cleanSolar === 'metering') {
    normSolar = 'Net Metering';
  } else if (cleanSolar.includes('plus plus') || cleanSolar === 'plus plus' || cleanSolar.includes('plusplus') || cleanSolar === 'plusplus') {
    normSolar = 'Net Plus Plus';
  } else if (cleanSolar.includes('plus') || cleanSolar === 'plus') {
    normSolar = 'Net Plus';
  } else if (cleanSolar.includes('accounting') || cleanSolar === 'accounting') {
    normSolar = 'Net Accounting';
  }

  const cleanTariff = tariffType.trim().toUpperCase();
  const isFixed = cleanTariff.includes('FIX');
  const isVariable = cleanTariff.includes('VAR');

  if (isFixed) {
    if (normSolar === 'Net Accounting') return 'L5001';
    if (normSolar === 'Net Plus') return 'L5002';
    if (normSolar === 'Net Plus Plus') return 'L5005';
  } else if (isVariable) {
    if (['Net Accounting', 'Net Plus', 'Net Plus Plus', 'Net Metering'].includes(normSolar)) {
      return 'L5006';
    }
  }
  return '';
};

const CustomerDetails = () => {
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const { showToast, showConfirm } = useToast();
  
  // Search & Pagination State
  const [customers, setCustomers] = useState([]);
  const [costCodesList, setCostCodesList] = useState([]);
  const [netTypesList, setNetTypesList] = useState([]);
  const [expenseCodesList, setExpenseCodesList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [summaryStats, setSummaryStats] = useState({
    totalCustomers: 0,
    completeCustomers: 0,
    missingCustomers: 0,
    validationErrorsCount: 0,
    locationsCount: 5
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, VALID, ERROR
  const [locationFilter, setLocationFilter] = useState('ALL'); // ALL or one of the 5 divisions
  const [completenessFilter, setCompletenessFilter] = useState('ALL'); // ALL, COMPLETE, MISSING
  const [viewMode, setViewMode] = useState('SINGLE'); // SINGLE, GROUPED
  const [sortBy, setSortBy] = useState('accountNo');
  const [sortDir, setSortDir] = useState('asc'); // asc | desc
  const [billingMonths, setBillingMonths] = useState([]);
  const [selectedBillingMonth, setSelectedBillingMonth] = useState('ALL');
  const [agreementStatusFilter, setAgreementStatusFilter] = useState('ALL');
  const [netTypeFilter, setNetTypeFilter] = useState('ALL');

  // Helper to evaluate completeness of customer details
  const getCustomerCompleteness = (cust) => {
    if (!cust) return { isComplete: false, missingFields: [] };
    if (cust.isComplete !== undefined && cust.missingFields !== undefined) {
      return { isComplete: cust.isComplete, missingFields: cust.missingFields || [] };
    }
    const missing = [];
    if (!cust.customerName || !String(cust.customerName).trim() || cust.customerName === '—') missing.push('Customer Name');
    
    const solar = cust.solarType || cust.netTypeName;
    if (!solar || !String(solar).trim() || solar === '—') missing.push('Solar System Type');
    
    if (!cust.customerAddress || !String(cust.customerAddress).trim() || cust.customerAddress === '—') missing.push('Customer Address');
    if (!cust.mobileNo || !String(cust.mobileNo).trim() || cust.mobileNo === '—') missing.push('Mobile No');
    if (cust.panelCapacity === null || cust.panelCapacity === undefined || cust.panelCapacity === '' || cust.panelCapacity === '—') missing.push('Panel Capacity');
    if (!cust.agreementDate || cust.agreementDate === '—') missing.push('Agreement Date');
    if (!cust.bankCode || !String(cust.bankCode).trim() || cust.bankCode === '—') missing.push('Bank Code');
    if (!cust.bankAccountNo || !String(cust.bankAccountNo).trim() || cust.bankAccountNo === '—') missing.push('Bank Account No');
    if (!cust.refNo || !String(cust.refNo).trim() || cust.refNo === '—') missing.push('Ref No');
    if (cust.unitRate === null || cust.unitRate === undefined || cust.unitRate === '' || cust.unitRate === '—') missing.push('Unit Rate');

    const directory = cust.directory;
    let hasNameMismatch = false;
    let hasUnitRateMismatch = false;
    let hasNetTypeMismatch = false;
    let isOutstanding = false;

    if (directory) {
      hasNameMismatch = directory.nameMatch === 'MISMATCH';
      hasUnitRateMismatch = directory.unitRateMatch === 'MISMATCH';
      hasNetTypeMismatch = directory.netTypeMatch === 'MISMATCH';
      isOutstanding = directory.masterOnly === true || directory.noBillingData === true || directory.paymentHold === true;
    }

    if (hasNameMismatch) missing.push('Name Mismatch');
    if (hasUnitRateMismatch) missing.push('Unit Rate Mismatch');
    if (hasNetTypeMismatch) missing.push('Net Type Mismatch');

    return { isComplete: missing.length === 0 && !isOutstanding, missingFields: missing };
  };

  const renderValOrMissing = (val, formatter) => {
    if (val === null || val === undefined || String(val).trim() === '' || String(val).trim() === '—') {
      return <span style={{ color: '#ef4444', fontWeight: 600 }}>Missing</span>;
    }
    return formatter ? formatter(val) : val;
  };

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

  // Auto-recalculate editExpenseCodeId based on editSolarType and editTariffType
  useEffect(() => {
    const lCode = deriveLCode(editSolarType, editTariffType);
    if (lCode) {
      const match = expenseCodesList.find(e => e.expCode === lCode);
      if (match) {
        setEditExpenseCodeId(match.id.toString());
      } else {
        setEditExpenseCodeId('');
      }
    } else {
      setEditExpenseCodeId('');
    }
  }, [editSolarType, editTariffType, expenseCodesList]);

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

  const fetchSummaryStats = async () => {
    try {
      let url = '/api/officer/customers/summary';
      const params = [];
      if (selectedBillingMonth && selectedBillingMonth !== 'ALL') {
        params.push(`billingMonth=${encodeURIComponent(selectedBillingMonth)}`);
      }
      if (appliedQuery.trim()) {
        params.push(`query=${encodeURIComponent(appliedQuery.trim())}`);
      }
      if (locationFilter !== 'ALL') {
        params.push(`location=${encodeURIComponent(locationFilter)}`);
      }
      if (netTypeFilter !== 'ALL') {
        params.push(`netType=${encodeURIComponent(netTypeFilter)}`);
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      const summaryRes = await authFetch(url);
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummaryStats({
          totalCustomers: data.total || 0,
          completeCustomers: data.complete || 0,
          missingCustomers: data.missing || 0,
          validationErrorsCount: data.errors || 0,
          nameMismatchesCount: data.nameMismatch || 0,
          unitRateMismatchesCount: data.unitRateMismatch || 0,
          netTypeMismatchesCount: data.netTypeMismatch || 0,
          otherMismatchesCount: data.otherMismatch || 0,
          outstandingCustomersCount: data.outstanding || 0,
          expiredAgreementsCount: data.expired || 0,
          expiringSoonAgreementsCount: data.expiringSoon || 0,
          locationsCount: DIRECTORY_DIVISIONS.length
        });
        return;
      }
      
      const [totalRes, completeRes, missingRes, errorRes] = await Promise.all([
        authFetch('/api/officer/customers?page=0&size=1'),
        authFetch('/api/officer/customers?page=0&size=1&completeness=COMPLETE'),
        authFetch('/api/officer/customers?page=0&size=1000&completeness=MISSING'),
        authFetch('/api/officer/customers?page=0&size=1&validationStatus=ERROR')
      ]);
      
      let total = 0, complete = 0, missing = 0, errors = 0;
      if (totalRes.ok) {
        const d = await totalRes.json();
        total = d.totalElements || 0;
      }
      if (missingRes.ok) {
        const d = await missingRes.json();
        missing = d.totalElements || 0;
      }
      if (completeRes.ok) {
        const d = await completeRes.json();
        complete = d.totalElements || (total > missing ? total - missing : 0);
      }
      if (errorRes.ok) {
        const d = await errorRes.json();
        errors = d.totalElements || 0;
      }
      
      setSummaryStats({
        totalCustomers: total,
        completeCustomers: total - missing > 0 ? total - missing : complete,
        missingCustomers: missing,
        validationErrorsCount: errors,
        locationsCount: DIRECTORY_DIVISIONS.length
      });
    } catch (e) {
      console.error('Failed to load summary stats:', e);
    }
  };

  // Load Customers list (officer customer search endpoint)
  const fetchCustomers = async (page = 0, query = '') => {
    try {
      setLoading(true);
      setError(null);
      
      let effectiveSize = completenessFilter === 'MISSING' ? 1000 : pageSize;
      let url = `/api/officer/customers?page=${page}&size=${effectiveSize}`;
      if (statusFilter !== 'ALL') {
        url += `&validationStatus=${statusFilter}`;
      }
      if (locationFilter !== 'ALL') {
        url += `&location=${encodeURIComponent(locationFilter)}`;
      }
      if (netTypeFilter !== 'ALL') {
        url += `&netType=${encodeURIComponent(netTypeFilter)}`;
      }
      
      let completenessVal = completenessFilter;
      let agreementStatusVal = agreementStatusFilter;
      if (completenessFilter === 'EXPIRED') {
        completenessVal = 'ALL';
        agreementStatusVal = 'EXPIRED';
      } else if (completenessFilter === 'EXPIRING_SOON') {
        completenessVal = 'ALL';
        agreementStatusVal = 'EXPIRING_SOON';
      }

      if (completenessVal !== 'ALL') {
        url += `&completeness=${completenessVal}`;
      }
      if (selectedBillingMonth && selectedBillingMonth !== 'ALL') {
        url += `&billingMonth=${encodeURIComponent(selectedBillingMonth)}`;
      }
      if (agreementStatusVal && agreementStatusVal !== 'ALL') {
        url += `&agreementStatus=${agreementStatusVal}`;
      }
      if (sortBy) {
        url += `&sortBy=${encodeURIComponent(sortBy)}&direction=${sortDir}`;
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
      setTotalElements(data.totalElements || 0);
      fetchSummaryStats();
    } catch (err) {
      setError(err.message || 'Error occurred while loading customers.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [ccRes, ntRes, ecRes, monthsRes] = await Promise.all([
        authFetch('/api/lookup/cost-codes'),
        authFetch('/api/lookup/net-types'),
        authFetch('/api/lookup/expense-codes'),
        authFetch('/api/officer/monthly-directory/months')
      ]);
      if (ccRes.ok) setCostCodesList(await ccRes.json());
      if (ntRes.ok) setNetTypesList(await ntRes.json());
      if (ecRes.ok) setExpenseCodesList(await ecRes.json());
      if (monthsRes.ok) {
        const mData = await monthsRes.json();
        if (mData && mData.months) {
          const list = mData.months.map(m => m.billingMonth).filter(Boolean);
          const uniqueMonths = Array.from(new Set(list));
          setBillingMonths(uniqueMonths);
          if (uniqueMonths.length > 0) {
            setSelectedBillingMonth(uniqueMonths[0]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load lookup lists:', e);
    }
  };

  useEffect(() => {
    fetchCustomers(currentPage, appliedQuery);
    fetchLookups();
    fetchSummaryStats();
  }, [currentPage, appliedQuery, statusFilter, locationFilter, completenessFilter, selectedBillingMonth, agreementStatusFilter, netTypeFilter, sortBy, sortDir, pageSize]);

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

  const handleClearAllCustomers = async () => {
    const ok = await showConfirm({
      title: 'Clear Customer Directory',
      message: 'Are you sure you want to remove ALL customer records from the Customer Directory? Customer details will be re-populated automatically when new billing sheets are uploaded and approved.',
      confirmText: 'Clear All Customers',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;

    try {
      setLoading(true);
      const res = await authFetch('/api/admin/customers/clear-all', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to clear customer directory.');
      }
      showToast(data.message || 'All customers removed successfully.', 'success');
      fetchCustomers(0, appliedQuery);
    } catch (err) {
      showToast(err.message || 'Error clearing customers.', 'error');
    } finally {
      setLoading(false);
    }
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



  const [addCustError, setAddCustError] = useState(null);
  const [addCustLoading, setAddCustLoading] = useState(false);

  // Auto-recalculate newCustExpenseCodeId based on newCustSolarType and newCustTariffType
  useEffect(() => {
    const lCode = deriveLCode(newCustSolarType, newCustTariffType);
    if (lCode) {
      const match = expenseCodesList.find(e => e.expCode === lCode);
      if (match) {
        setNewCustExpenseCodeId(match.id.toString());
      } else {
        setNewCustExpenseCodeId('');
      }
    } else {
      setNewCustExpenseCodeId('');
    }
  }, [newCustSolarType, newCustTariffType, expenseCodesList]);

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
      <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 500, padding: 0 }}>
        <ArrowLeft size={14} /> Back to Dashboard
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', margin: 0 }}>Customer Directory</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem', margin: 0 }}>Search customer electricity accounts, edit profiles, and view ledger details.</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', padding: '0.55rem 1.1rem', background: '#1e293b', border: '1px solid var(--border-color)', fontWeight: 500, color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
              <Download size={15} /> Export <ChevronDown size={14} />
            </button>
            <button className="btn btn-primary" onClick={openAddCustomerModal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px', padding: '0.55rem 1.1rem', background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 600, color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
              <Plus size={16} /> Add Customer
            </button>
          </div>
        )}
      </div>

      {/* Completeness Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Customers */}
        <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Customers</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', marginTop: '0.15rem' }}>{summaryStats.totalCustomers.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>↑ 12.5% from last month</span>
              </div>
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Complete Details */}
        <div className="card" onClick={() => { setCompletenessFilter('COMPLETE'); setCurrentPage(0); }} style={{ padding: '1.25rem', borderRadius: '12px', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', borderLeft: completenessFilter === 'COMPLETE' ? '3px solid #10b981' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.2)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={24} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complete Details</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', marginTop: '0.15rem' }}>{summaryStats.completeCustomers.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {summaryStats.totalCustomers > 0 ? (summaryStats.completeCustomers / summaryStats.totalCustomers * 100).toFixed(2) : 0}% complete
              </div>
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Missing Details */}
        <div className="card" onClick={() => { setCompletenessFilter('MISSING'); setCurrentPage(0); }} style={{ padding: '1.25rem', borderRadius: '12px', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', borderLeft: (completenessFilter === 'MISSING' || completenessFilter === 'NAME_MISMATCH' || completenessFilter === 'UNIT_RATE_MISMATCH' || completenessFilter === 'NET_TYPE_MISMATCH' || completenessFilter === 'OTHER_MISMATCHES') ? '3px solid #f59e0b' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.2)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={24} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Missing Details / Validation</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', marginTop: '0.15rem' }}>{summaryStats.missingCustomers.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {summaryStats.totalCustomers > 0 ? (summaryStats.missingCustomers / summaryStats.totalCustomers * 100).toFixed(2) : 0}% issues / missing info
              </div>
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Locations */}
        <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={24} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locations</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', marginTop: '0.15rem' }}>{summaryStats.locationsCount}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Eastern Province</div>
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Directory tabs (All / Complete Details / Missing Details / Valid / Error) + View Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setCompletenessFilter('ALL'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: (completenessFilter === 'ALL' && statusFilter === 'ALL') ? 'rgba(59,130,246,0.12)' : '#111827',
              border: (completenessFilter === 'ALL' && statusFilter === 'ALL') ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              color: (completenessFilter === 'ALL' && statusFilter === 'ALL') ? '#60a5fa' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <User size={14} /> All Customers
          </button>

          <button
            onClick={() => { setCompletenessFilter('COMPLETE'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'COMPLETE' ? 'rgba(16,185,129,0.12)' : '#111827',
              border: completenessFilter === 'COMPLETE' ? '1px solid #10b981' : '1px solid var(--border-color)',
              color: completenessFilter === 'COMPLETE' ? '#34d399' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <CheckCircle size={14} /> Complete Details
          </button>

          <button
            onClick={() => { setCompletenessFilter('MISSING'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'MISSING' ? 'rgba(245,158,11,0.12)' : '#111827',
              border: completenessFilter === 'MISSING' ? '1px solid #f59e0b' : '1px solid var(--border-color)',
              color: completenessFilter === 'MISSING' ? '#fbbf24' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <AlertTriangle size={14} /> Missing Details / Validation
          </button>

          <button
            onClick={() => { setCompletenessFilter('NAME_MISMATCH'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'NAME_MISMATCH' ? 'rgba(251,113,133,0.12)' : '#111827',
              border: completenessFilter === 'NAME_MISMATCH' ? '1px solid #fb7185' : '1px solid var(--border-color)',
              color: completenessFilter === 'NAME_MISMATCH' ? '#fb7185' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <User size={14} /> Name Mismatch
            {summaryStats.nameMismatchesCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#fb7185', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.nameMismatchesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setCompletenessFilter('UNIT_RATE_MISMATCH'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'UNIT_RATE_MISMATCH' ? 'rgba(251,191,36,0.12)' : '#111827',
              border: completenessFilter === 'UNIT_RATE_MISMATCH' ? '1px solid #fbbf24' : '1px solid var(--border-color)',
              color: completenessFilter === 'UNIT_RATE_MISMATCH' ? '#fbbf24' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <AlertTriangle size={14} /> Unit Rate Mismatch
            {summaryStats.unitRateMismatchesCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#fbbf24', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.unitRateMismatchesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setCompletenessFilter('NET_TYPE_MISMATCH'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'NET_TYPE_MISMATCH' ? 'rgba(167,139,250,0.12)' : '#111827',
              border: completenessFilter === 'NET_TYPE_MISMATCH' ? '1px solid #a78bfa' : '1px solid var(--border-color)',
              color: completenessFilter === 'NET_TYPE_MISMATCH' ? '#a78bfa' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Zap size={14} /> Net Type Mismatch
            {summaryStats.netTypeMismatchesCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#a78bfa', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.netTypeMismatchesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setCompletenessFilter('OTHER_MISMATCHES'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'OTHER_MISMATCHES' ? 'rgba(249,115,22,0.12)' : '#111827',
              border: completenessFilter === 'OTHER_MISMATCHES' ? '1px solid #f97316' : '1px solid var(--border-color)',
              color: completenessFilter === 'OTHER_MISMATCHES' ? '#f97316' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <AlertCircle size={14} /> Other Mismatches
            {summaryStats.otherMismatchesCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#f97316', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.otherMismatchesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setCompletenessFilter('OUTSTANDING'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'OUTSTANDING' ? 'rgba(56,189,248,0.12)' : '#111827',
              border: completenessFilter === 'OUTSTANDING' ? '1px solid #38bdf8' : '1px solid var(--border-color)',
              color: completenessFilter === 'OUTSTANDING' ? '#38bdf8' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={14} /> Outstanding Customers
            {summaryStats.outstandingCustomersCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#38bdf8', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.outstandingCustomersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setCompletenessFilter('EXPIRED'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'EXPIRED' ? 'rgba(239,68,68,0.12)' : '#111827',
              border: completenessFilter === 'EXPIRED' ? '1px solid #ef4444' : '1px solid var(--border-color)',
              color: completenessFilter === 'EXPIRED' ? '#f87171' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={14} /> Expired Agreements
            {summaryStats.expiredAgreementsCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#ef4444', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.expiredAgreementsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setCompletenessFilter('EXPIRING_SOON'); setStatusFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: completenessFilter === 'EXPIRING_SOON' ? 'rgba(249,115,22,0.12)' : '#111827',
              border: completenessFilter === 'EXPIRING_SOON' ? '1px solid #f97316' : '1px solid var(--border-color)',
              color: completenessFilter === 'EXPIRING_SOON' ? '#f97316' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={14} /> Expiring Soon
            {summaryStats.expiringSoonAgreementsCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#f97316', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.expiringSoonAgreementsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setStatusFilter('ERROR'); setCompletenessFilter('ALL'); setCurrentPage(0); }}
            style={{
              padding: '0.5rem 1.1rem',
              background: statusFilter === 'ERROR' ? 'rgba(239,68,68,0.12)' : '#111827',
              border: statusFilter === 'ERROR' ? '1px solid #ef4444' : '1px solid var(--border-color)',
              color: statusFilter === 'ERROR' ? '#f87171' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <AlertCircle size={14} /> New Customers
            {summaryStats.validationErrorsCount > 0 && (
              <span style={{ marginLeft: '0.35rem', background: '#ef4444', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
                {summaryStats.validationErrorsCount}
              </span>
            )}
          </button>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#111827', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setViewMode('SINGLE')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'SINGLE' ? '#3b82f6' : 'transparent',
              color: viewMode === 'SINGLE' ? 'white' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Layers size={13} /> Unified Table
          </button>
          <button
            onClick={() => setViewMode('GROUPED')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'GROUPED' ? '#3b82f6' : 'transparent',
              color: viewMode === 'GROUPED' ? 'white' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Layers size={13} /> Grouped View
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'center', color: 'var(--danger)', marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(30,41,59,0.15)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', gap: '0.5rem', margin: 0 }}>
            <div className="input-group" style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.5rem', height: '42px', borderRadius: '8px', background: '#0b0f19', border: '1px solid var(--border-color)', color: 'white', width: '100%', fontSize: '0.85rem' }}
                placeholder="Search by Account No, Customer Name, or Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '0 1.5rem', borderRadius: '8px', background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Search size={14} /> Search
            </button>
          </form>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setLocationFilter('ALL');
              setStatusFilter('ALL');
              setCompletenessFilter('ALL');
              setAgreementStatusFilter('ALL');
              setNetTypeFilter('ALL');
              setSearchQuery('');
              setAppliedQuery('');
              setCurrentPage(0);
            }}
            style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)', color: '#f87171', borderRadius: '8px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.85rem' }}
          >
            <Trash2 size={14} /> Clear Filters
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border-color)', background: '#111827', color: 'var(--text-secondary)', borderRadius: '8px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.85rem' }}
          >
            <Filter size={14} /> Filter <ChevronDown size={14} />
          </button>
        </div>

        {/* Billing Month, Agreement Status and Net Type Filter Panel */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference Billing Month:</label>
            <select
              value={selectedBillingMonth}
              onChange={(e) => { setSelectedBillingMonth(e.target.value); setCurrentPage(0); }}
              className="form-input"
              style={{ appearance: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.85rem', background: '#0b0f19', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', height: '40px', width: '100%', cursor: 'pointer' }}
            >
              <option value="ALL">All Billing Months</option>
              {billingMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agreement Status:</label>
            <select
              value={agreementStatusFilter}
              onChange={(e) => { setAgreementStatusFilter(e.target.value); setCurrentPage(0); }}
              className="form-input"
              style={{ appearance: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.85rem', background: '#0b0f19', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', height: '40px', width: '100%', cursor: 'pointer' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="EXPIRED">Expired (7 Years Completed)</option>
              <option value="EXPIRING_SOON">Expiring Soon (7 Years Approaching)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Type:</label>
            <select
              value={netTypeFilter}
              onChange={(e) => { setNetTypeFilter(e.target.value); setCurrentPage(0); }}
              className="form-input"
              style={{ appearance: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.85rem', background: '#0b0f19', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', height: '40px', width: '100%', cursor: 'pointer' }}
            >
              <option value="ALL">All Net Types</option>
              {netTypesList.map((nt) => (
                <option key={nt.id} value={nt.name}>{nt.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Location tags + Sorting controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, marginRight: '0.35rem' }}>
              Locations:
            </span>
            {['ALL', ...DIRECTORY_DIVISIONS].map((loc) => {
              const active = locationFilter === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => { setLocationFilter(loc); setCurrentPage(0); }}
                  style={{
                    padding: '0.35rem 0.95rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: active ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    background: active ? 'rgba(59,130,246,0.12)' : '#111827',
                    color: active ? '#60a5fa' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loc === 'ALL' ? 'All Locations' : loc}
                </button>
              );
            })}
            <button
              type="button"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: '#111827',
                color: '#60a5fa',
                cursor: 'pointer'
              }}
            >
              +2
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(0); }}
              className="form-input"
              style={{ appearance: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.78rem', background: '#111827', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', width: 'auto', minWidth: '130px', height: '36px' }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              onClick={() => { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); setCurrentPage(0); }}
              style={{ padding: '0 0.75rem', height: '36px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--border-color)', background: '#111827', color: 'white', borderRadius: '8px' }}
            >
              <ArrowUpDown size={13} /> {sortDir === 'asc' ? 'A-Z' : 'Z-A'}
            </button>
          </div>
        </div>
      </div>

      {/* Customer List Display: Unified vs Grouped View */}
      {viewMode === 'SINGLE' ? (
        <div className="card" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(30,41,59,0.2)', overflow: 'hidden' }}>
          <div className="table-container">
            {loading ? (
              <table className="custom-table" style={{ opacity: 0.8 }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>#</th>
                    <th>ACCOUNT NO</th>
                    <th>CUSTOMER NAME</th>
                    <th>MOBILE</th>
                    <th>SOLAR TYPE</th>
                    <th>COMPLETENESS</th>
                    <th>AGREEMENT DATE</th>
                    <th>LOCATION</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(pageSize)].map((_, i) => (
                    <tr key={i}>
                      <td><div className="skeleton" style={{ height: '16px', width: '20px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '100px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '150px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '100px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '24px', width: '90px', borderRadius: '4px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '4px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '120px' }}></div></td>
                      <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: '28px', width: '90px', borderRadius: '4px', marginLeft: 'auto' }}></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : customers.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <User size={42} style={{ opacity: 0.35, marginBottom: '0.75rem', color: '#818cf8' }} />
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>No Customer Records Found</div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.4rem', maxWidth: '520px', margin: '0.4rem auto 0' }}>
                  The Customer Directory is empty. Records will automatically populate here when new billing data is uploaded and approved by an Admin.
                </div>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>#</th>
                    <th>ACCOUNT NO</th>
                    <th>CUSTOMER NAME</th>
                    <th>MOBILE</th>
                    <th>SOLAR TYPE</th>
                    <th>COMPLETENESS</th>
                    <th>AGREEMENT DATE</th>
                    <th>LOCATION</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust, idx) => {
                    const comp = getCustomerCompleteness(cust);
                    return (
                      <tr key={cust.accountNo}>
                        <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {currentPage * pageSize + idx + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => handleViewDetails(cust)}>
                            {cust.accountNo}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{cust.customerName}</span>
                            {cust.validationStatus === 'ERROR' && (
                              <span 
                                className="badge danger" 
                                style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'help' }}
                                title={cust.validationErrors ? parseErrors(cust.validationErrors).join('; ') : 'New customer details present'}
                              >
                                New Customer
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {cust.mobileNo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Phone size={12} style={{ opacity: 0.6 }} />
                              <span>{cust.mobileNo}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          {(() => {
                            const st = (cust.solarType || 'Net Plus').toUpperCase();
                            let bg = 'rgba(139,92,246,0.12)';
                            let color = '#a78bfa';
                            let border = '1px solid rgba(139,92,246,0.2)';
                            if (st.includes('ACCOUNTING')) {
                              bg = 'rgba(59,130,246,0.12)';
                              color = '#60a5fa';
                              border = '1px solid rgba(59,130,246,0.2)';
                            } else if (st.includes('METERING')) {
                              bg = 'rgba(16,185,129,0.12)';
                              color = '#34d399';
                              border = '1px solid rgba(16,185,129,0.2)';
                            } else if (st.includes('PLUS PLUS') || st.includes('++')) {
                              bg = 'rgba(245,158,11,0.12)';
                              color = '#fbbf24';
                              border = '1px solid rgba(245,158,11,0.2)';
                            }
                            return (
                              <span className="badge" style={{ background: bg, color: color, border: border, padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                                {st}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          {comp.isComplete ? (
                            <span className="badge success" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <CheckCircle size={12} /> COMPLETE
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className="badge warning" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', width: 'fit-content' }}>
                                <AlertTriangle size={12} /> MISSING ({comp.missingFields.length})
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.15rem' }}>
                                {comp.missingFields.map(f => (
                                  <span key={f} style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{cust.agreementDate || '—'}</td>
                        <td>
                          {(cust.division || cust.branchCode) ? (
                            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                              <MapPin size={11} /> {(cust.division || cust.branchCode).toUpperCase()}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary" 
                              title="View Profile"
                              style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}
                              onClick={() => handleViewDetails(cust)}
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              title="Billing Ledger"
                              style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}
                              onClick={() => handleViewDetails(cust)}
                            >
                              <FileText size={14} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              title="More Options"
                              style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Grouped View: 2 Distinct Groups */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Group 1: Complete Details */}
          <div className="card" style={{ borderLeft: '4px solid #10b981', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={18} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>Complete Customer Details</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>All required customer profile fields are fully filled.</p>
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                {customers.filter(c => getCustomerCompleteness(c).isComplete).length} Customers
              </span>
            </div>

            <div className="table-container">
              {customers.filter(c => getCustomerCompleteness(c).isComplete).length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No customers with complete details in this page view.
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>#</th>
                      <th>ACCOUNT NO</th>
                      <th>CUSTOMER NAME</th>
                      <th>SOLAR TYPE</th>
                      <th>PANEL CAP</th>
                      <th>LOCATION</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.filter(c => getCustomerCompleteness(c).isComplete).map((cust, idx) => (
                      <tr key={cust.accountNo}>
                        <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => handleViewDetails(cust)}>
                            {cust.accountNo}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{cust.customerName}</td>
                        <td>
                          {(() => {
                            const st = (cust.solarType || 'Net Plus').toUpperCase();
                            let bg = 'rgba(139,92,246,0.12)';
                            let color = '#a78bfa';
                            let border = '1px solid rgba(139,92,246,0.2)';
                            if (st.includes('ACCOUNTING')) {
                              bg = 'rgba(59,130,246,0.12)';
                              color = '#60a5fa';
                              border = '1px solid rgba(59,130,246,0.2)';
                            } else if (st.includes('METERING')) {
                              bg = 'rgba(16,185,129,0.12)';
                              color = '#34d399';
                              border = '1px solid rgba(16,185,129,0.2)';
                            } else if (st.includes('PLUS PLUS') || st.includes('++')) {
                              bg = 'rgba(245,158,11,0.12)';
                              color = '#fbbf24';
                              border = '1px solid rgba(245,158,11,0.2)';
                            }
                            return (
                              <span className="badge" style={{ background: bg, color: color, border: border, padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                                {st}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ fontWeight: 600 }}>{cust.panelCapacity ? `${cust.panelCapacity} kW` : '—'}</td>
                        <td>
                          {(cust.division || cust.branchCode) ? (
                            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                              <MapPin size={11} /> {(cust.division || cust.branchCode).toUpperCase()}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary" 
                              title="View Profile"
                              style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}
                              onClick={() => handleViewDetails(cust)}
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              title="Billing Ledger"
                              style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}
                              onClick={() => handleViewDetails(cust)}
                            >
                              <FileText size={14} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              title="More Options"
                              style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Group 2: Missing Details */}
          <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} color="#f59e0b" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>Missing Customer Details</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Customers with one or more missing information fields.</p>
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                {customers.filter(c => !getCustomerCompleteness(c).isComplete).length} Customers
              </span>
            </div>

            <div className="table-container">
              {customers.filter(c => !getCustomerCompleteness(c).isComplete).length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  All loaded customers in this view have complete details! 🎉
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>#</th>
                      <th>ACCOUNT NO</th>
                      <th>CUSTOMER NAME</th>
                      <th>MISSING FIELDS</th>
                      <th>LOCATION</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.filter(c => !getCustomerCompleteness(c).isComplete).map((cust, idx) => {
                      const comp = getCustomerCompleteness(cust);
                      return (
                        <tr key={cust.accountNo}>
                          <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => handleViewDetails(cust)}>
                              {cust.accountNo}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{cust.customerName}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {comp.missingFields.map(f => (
                                <span key={f} style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            {(cust.division || cust.branchCode) ? (
                              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                                <MapPin size={11} /> {(cust.division || cust.branchCode).toUpperCase()}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-secondary" 
                                title="View Profile"
                                style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}
                                onClick={() => handleViewDetails(cust)}
                              >
                                <Eye size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                title="Fill Details"
                                style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}
                                onClick={() => { handleViewDetails(cust); setIsEditing(true); }}
                              >
                                <Edit size={14} />
                              </button>
                            </div>
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
      )}

        {/* Pagination controls */}
        {completenessFilter !== 'MISSING' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements.toLocaleString()} customers
            </div>
            
            {totalPages > 1 ? (
              <div className="pagination" style={{ margin: 0 }}>
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
                  
                  const pageNum = item;
                  return (
                    <button
                      key={pageNum}
                      className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                
                <button 
                  className="pagination-btn" 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
                  disabled={currentPage >= totalPages - 1 || loading}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : <div />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(0);
                }}
                style={{
                  appearance: 'auto',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.8rem',
                  background: '#111827',
                  color: 'white',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {[5, 10, 20, 50].map((sz) => (
                  <option key={sz} value={sz}>{sz}</option>
                ))}
              </select>
            </div>
          </div>
        )}

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
            
            {/* Validation Issues Banner */}
            {(() => {
              const errors = [];
              if (selectedCustomer.validationStatus === 'ERROR') {
                const parsed = parseErrors(selectedCustomer.validationErrors);
                parsed.forEach(err => {
                  errors.push({
                    type: 'New Customer',
                    reason: err
                  });
                });
              }
              const dir = selectedCustomer.directory;
              if (dir) {
                if (dir.nameMatch === 'MISMATCH') {
                  errors.push({
                    type: 'Name Mismatch',
                    reason: `Customer name in Directory ('${selectedCustomer.customerName || '—'}') does not match billing data name ('${dir.billingName || dir.name || '—'}').`
                  });
                }
                if (dir.unitRateMatch === 'MISMATCH') {
                  errors.push({
                    type: 'Unit Rate Mismatch',
                    reason: `Unit rate in Profile (${selectedCustomer.unitRate !== null && selectedCustomer.unitRate !== undefined ? selectedCustomer.unitRate : '—'}) does not match NGEN/NPAY/Main billing rate (${dir.unitRate || dir.billingUnitRate || '—'}).`
                  });
                }
                if (dir.netTypeMatch === 'MISMATCH') {
                  errors.push({
                    type: 'Net Type Mismatch',
                    reason: `Solar/Tariff Net Type in Profile does not match NGEN/NPAY billing net type.`
                  });
                }
              }
              const comp = getCustomerCompleteness(selectedCustomer);
              if (!comp.isComplete) {
                comp.missingFields.forEach(field => {
                  if (field !== 'Name Mismatch' && field !== 'Unit Rate Mismatch' && field !== 'Net Type Mismatch') {
                    errors.push({
                      type: 'Missing Profile Detail',
                      reason: `Required profile field '${field}' is missing or invalid.`
                    });
                  }
                });
              }

              if (errors.length === 0) return null;

              return (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                    <AlertCircle size={16} />
                    Validation Issues Detected
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {errors.map((err, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: '#f87171', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontWeight: 600, color: '#fca5a5', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>{err.type}</span>
                        <span>{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                        <label className="form-label">L-Code</label>
                        <select 
                          className="login-form-input" 
                          value={editExpenseCodeId}
                          disabled
                          style={{ appearance: 'auto', background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
                        >
                          <option value="">Select L-Code</option>
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
                          <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{renderValOrMissing(selectedCustomer.customerName)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Solar System Type</span>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', color: selectedCustomer.solarType ? 'var(--success)' : 'inherit' }}>
                            {renderValOrMissing(selectedCustomer.solarType)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Customer Address</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.customerAddress)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Mobile No</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.mobileNo)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Panel Capacity</span>
                          <div style={{ fontWeight: 600 }}>{renderValOrMissing(selectedCustomer.panelCapacity, (v) => `${v} kW`)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Agreement Date</span>
                          <div style={{ fontWeight: 600 }}>
                            {renderValOrMissing(selectedCustomer.agreementDate, (v) => new Date(v).toLocaleDateString('en-LK'))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Bank Code</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.bankCode)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Branch Code</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.branchCode)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Bank Account No</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.bankAccountNo)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Ref No</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.refNo)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Unit Rate</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.unitRate, (v) => `${v} LKR`)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Tariff Type</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.tariffType)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cost Code</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.costCode)}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>L-Code</span>
                          <div style={{ fontWeight: 500 }}>{renderValOrMissing(selectedCustomer.expenseCode)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Location / Division</span>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: (selectedCustomer.division || selectedCustomer.branchCode) ? '#38bdf8' : 'inherit' }}>
                            <MapPin size={13} /> {renderValOrMissing(selectedCustomer.division || selectedCustomer.branchCode)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Classification Status</span>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', color: selectedCustomer.validationStatus === 'ERROR' ? '#f87171' : 'var(--success)' }}>
                            {selectedCustomer.validationStatus === 'ERROR' ? 'New Customer' : 'Valid'}
                          </div>
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

              {/* Full Monthly Directory record — Master / CEB Assist / NGEN / NPAY / Validation,
                  synced from the approved Monthly Directory so both views show the same detail */}
              {(() => {
                const rec = selectedCustomer.directory || selectedCustomer;
                const fromDirectory = !!selectedCustomer.directory;
                const errors = (fromDirectory && Array.isArray(rec.errors)) ? rec.errors : [];
                const warnings = (fromDirectory && Array.isArray(rec.warnings)) ? rec.warnings : [];
                return (
                  <div className="card" style={{ marginTop: '1.25rem', backgroundColor: 'var(--bg-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ref No: {dirCell(rec.refNo ?? selectedCustomer.refNo)}</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', margin: '0.15rem 0', color: 'white' }}>{selectedCustomer.accountNo}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {dirCell(rec.npayName) !== '—' ? dirCell(rec.npayName) : (selectedCustomer.customerName || '—')}
                        </div>
                      </div>
                      <span className={`badge ${selectedCustomer.validationStatus === 'ERROR' ? 'danger' : 'success'}`} style={{ padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: selectedCustomer.validationStatus === 'ERROR' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: selectedCustomer.validationStatus === 'ERROR' ? '#f87171' : '#10b981', border: `1px solid ${selectedCustomer.validationStatus === 'ERROR' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                        {selectedCustomer.validationStatus === 'ERROR' ? 'New Customer' : 'Valid'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      {DETAIL_SECTIONS.map(sec => (
                        <div key={sec.title} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: sec.color, marginBottom: '0.5rem' }}>{sec.title}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {sec.fields.map(f => (
                              <div key={f.label} style={{ fontSize: '0.76rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                                <span style={{ color: 'white', fontWeight: 600, textAlign: 'right' }}>{dirFieldValue(rec, f)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Validation — preserved exactly as approved in the Monthly Directory */}
                    <div style={{ marginTop: '1rem', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#f87171', marginBottom: '0.5rem' }}>Validation</div>
                      {errors.map((e, i) => (
                        <div key={`e${i}`} style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}><AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />{e}</div>
                      ))}
                      {warnings.map((w, i) => (
                        <div key={`w${i}`} style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}><AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />{w}</div>
                      ))}
                      {errors.length === 0 && warnings.length === 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}><CheckCircle size={12} /> No errors or warnings</div>
                      )}
                      {fromDirectory && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {[['Name Match', 'nameMatch'], ['Unit Rate Match', 'unitRateMatch'], ['Net Type Match', 'netTypeMatch']].map(([lbl, mk]) => (
                            rec[mk] ? (
                              <div key={mk} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                {lbl}: <strong style={{ color: rec[mk] === 'MISMATCH' ? '#f87171' : '#10b981' }}>{dirCell(rec[mk])}</strong>
                              </div>
                            ) : null
                          ))}
                        </div>
                      )}
                      {!fromDirectory && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          No Monthly Directory billing record synced for this customer yet — showing profile data only.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
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
                          <th>Prev Reading</th>
                          <th>Curr Reading</th>
                          <th>Ref No</th>
                          <th>Yield Perf</th>
                          <th>kWh Import</th>
                          <th>kWh Export</th>
                          <th>kWh Unit Sales</th>
                          <th>kWh Sales Amt</th>
                          <th>Set Off</th>
                          <th>Retention</th>
                          <th>Settled</th>
                          <th>Outstanding</th>
                          <th>Mode</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...Array(5)].map((_, i) => (
                          <tr key={i}>
                            <td><div className="skeleton" style={{ height: '16px', width: '70px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '70px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '22px', width: '60px', borderRadius: '4px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                            <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
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
                          <th>Prev Reading</th>
                          <th>Curr Reading</th>
                          <th>Ref No</th>
                          <th>Yield Perf</th>
                          <th>kWh Import</th>
                          <th>kWh Export</th>
                          <th>kWh Unit Sales</th>
                          <th>kWh Sales Amt</th>
                          <th>Set Off</th>
                          <th>Retention</th>
                          <th>Settled</th>
                          <th>Outstanding</th>
                          <th>Mode</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingHistory.map((bill) => {
                          const perf = calculatePerformanceScore(
                            bill.kwhExport != null ? bill.kwhExport : bill.exportUnits,
                            selectedCustomer.panelCapacity
                          );
                          return (
                            <tr key={bill.billingId}>
                              <td>{bill.prevReadingDate || '—'}</td>
                              <td>{bill.currReadingDate || '—'}</td>
                              <td style={{ fontWeight: 500 }}>{bill.refNo}</td>
                              <td>
                                <span className={`badge ${perf.class}`} style={{ textTransform: 'capitalize', fontSize: '0.72rem', fontWeight: 600 }}>
                                  {perf.text}
                                </span>
                              </td>
                              <td>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning)' }}>
                                  <TrendingDown size={12} />
                                  {(bill.kwhImport != null ? bill.kwhImport : bill.importUnits).toLocaleString()}
                                </span>
                              </td>
                              <td>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                                  <TrendingUp size={12} />
                                  {(bill.kwhExport != null ? bill.kwhExport : bill.exportUnits).toLocaleString()}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600, color: (bill.kwhSales != null ? bill.kwhSales : bill.netUnit) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {(bill.kwhSales != null ? bill.kwhSales : bill.netUnit) > 0 
                                  ? `+${(bill.kwhSales != null ? bill.kwhSales : bill.netUnit).toLocaleString()}` 
                                  : (bill.kwhSales != null ? bill.kwhSales : bill.netUnit).toLocaleString()}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                {bill.energyPurchase != null ? formatLKR(bill.energyPurchase) : '—'}
                              </td>
                              <td>
                                {bill.billSetOff != null ? formatLKR(bill.billSetOff) : '—'}
                              </td>
                              <td>
                                {bill.retentionMoney != null ? formatLKR(bill.retentionMoney) : '—'}
                              </td>
                              <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                                {bill.paymentSettled != null ? formatLKR(bill.paymentSettled) : '—'}
                              </td>
                              <td style={{ color: 'var(--warning)', fontWeight: 700 }}>
                                {bill.outstandingBalance != null ? formatLKR(bill.outstandingBalance) : '—'}
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 10, 20, 0.85)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div className="neon-card animate-fade-in" style={{ width: '540px', padding: '1.75rem' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 className="panel-title" style={{ color: 'white', fontWeight: 800, fontSize: '1.15rem' }}>Edit Billing Record ({editingBill.refNo})</h3>
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
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 10000, background: 'rgba(5, 10, 20, 0.85)', backdropFilter: 'blur(14px)' }}>
          <style>{`
            .add-cust-input {
              width: 100%;
              height: 44px;
              padding: 0 14px 0 44px;
              background: rgba(15, 23, 42, 0.75);
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 12px;
              color: #ffffff;
              font-size: 0.88rem;
              outline: none;
              transition: all 0.2s ease;
            }
            .add-cust-input:focus {
              border: 1.5px solid #22d3ee !important;
              box-shadow: 0 0 16px rgba(34, 211, 238, 0.35) !important;
              background: rgba(15, 23, 42, 0.95) !important;
            }
            .add-cust-input::placeholder {
              color: #475569;
            }
            .add-cust-select {
              appearance: none;
              width: 100%;
              height: 44px;
              padding: 0 38px 0 44px;
              background: rgba(15, 23, 42, 0.75);
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 12px;
              color: #ffffff;
              font-size: 0.88rem;
              outline: none;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .add-cust-select:focus {
              border: 1.5px solid #22d3ee !important;
              box-shadow: 0 0 16px rgba(34, 211, 238, 0.35) !important;
              background: rgba(15, 23, 42, 0.95) !important;
            }
            .add-cust-select option {
              background: #0f172a;
              color: #ffffff;
            }
          `}</style>
          <div className="modal-content animate-fade-in" style={{
            maxWidth: 680,
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '2.2rem 2.4rem',
            background: 'linear-gradient(160deg, rgba(16, 26, 46, 0.96), rgba(9, 14, 26, 0.98))',
            border: '1px solid rgba(34, 211, 238, 0.4)',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8), 0 0 35px rgba(34, 211, 238, 0.2)',
            borderRadius: '22px',
            color: '#ffffff'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserPlus size={24} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))' }} />
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em' }}>Add Customer Profile</h3>
              </div>
              <button 
                onClick={() => setAddCustomerModalOpen(false)} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  width: 34, 
                  height: 34, 
                  borderRadius: 10, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#94a3b8', 
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              >
                <X size={18} />
              </button>
            </div>

            {addCustError && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#f87171', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {addCustError}
              </div>
            )}

            <form onSubmit={handleAddCustomerSubmit}>
              {/* Row 1: Account Number & Customer Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    Account Number (10 digits)<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Shield size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      maxLength={10}
                      className="add-cust-input"
                      value={newCustAccNo}
                      onChange={(e) => setNewCustAccNo(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    Customer Name<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="add-cust-input"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Customer Address */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Customer Address</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <MapPin size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="add-cust-input"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 3: Mobile Number & Agreement Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Mobile Number</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Phone size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="add-cust-input"
                      value={newCustMobile}
                      onChange={(e) => setNewCustMobile(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Agreement Date</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="date"
                      className="add-cust-input"
                      style={{ paddingLeft: 14, paddingRight: 40, colorScheme: 'dark' }}
                      value={newCustAgreementDate}
                      onChange={(e) => setNewCustAgreementDate(e.target.value)}
                    />
                    <Calendar size={17} style={{ position: 'absolute', right: 14, color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Row 4: Panel Capacity (kW) & Net Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Panel Capacity (kW)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Sun size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="number"
                      step="0.01"
                      className="add-cust-input"
                      value={newCustCapacity}
                      onChange={(e) => setNewCustCapacity(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Net Type (Solar Type)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <select
                      className="add-cust-select"
                      style={{ paddingLeft: 14 }}
                      value={newCustNetTypeId}
                      onChange={(e) => {
                        setNewCustNetTypeId(e.target.value);
                        const selected = netTypesList.find(n => n.id.toString() === e.target.value);
                        if (selected) setNewCustSolarType(selected.name);
                      }}
                    >
                      <option value="">Select Net Type</option>
                      {netTypesList.map(n => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={17} style={{ position: 'absolute', right: 14, color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Row 5: Reference No & Unit Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Reference No (Ref No)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Tag size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="add-cust-input"
                      value={newCustRefNo}
                      onChange={(e) => setNewCustRefNo(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Unit Rate</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <DollarSign size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="number"
                      step="0.001"
                      className="add-cust-input"
                      value={newCustUnitRate}
                      onChange={(e) => setNewCustUnitRate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Row 6: Tariff Type & Cost Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Tariff Type</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Code size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="add-cust-input"
                      value={newCustTariffType}
                      onChange={(e) => setNewCustTariffType(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Cost Code</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <select
                      className="add-cust-select"
                      style={{ paddingLeft: 14 }}
                      value={newCustCostCodeId}
                      onChange={(e) => setNewCustCostCodeId(e.target.value)}
                    >
                      <option value="">Select Cost Code</option>
                      {costCodesList.map(c => (
                        <option key={c.id} value={c.id}>{c.costCode} - {c.areaName}</option>
                      ))}
                    </select>
                    <ChevronDown size={17} style={{ position: 'absolute', right: 14, color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Row 7: L-Code */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>L-Code</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <select
                    className="add-cust-select"
                    style={{ paddingLeft: 14, background: 'rgba(255,255,255,0.03)', cursor: 'not-allowed', opacity: 0.7 }}
                    value={newCustExpenseCodeId}
                    disabled
                  >
                    <option value="">Select L-Code</option>
                    {expenseCodesList.map(e => (
                      <option key={e.id} value={e.id}>{e.expCode} - {e.description}</option>
                    ))}
                  </select>
                  <ChevronDown size={17} style={{ position: 'absolute', right: 14, color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Section Divider: Banking Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.35rem 0 1rem 0' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Banking Details</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
              </div>

              {/* Row 8: Banking Details (Bank Code, Branch Code, Bank Account No) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.1rem', marginBottom: '1.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Bank Code</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Landmark size={17} style={{ position: 'absolute', left: 14, color: '#64748b', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="add-cust-input"
                      value={newCustBankCode}
                      onChange={(e) => setNewCustBankCode(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Branch Code</label>
                  <input
                    type="text"
                    className="add-cust-input"
                    style={{ paddingLeft: 14 }}
                    value={newCustBranchCode}
                    onChange={(e) => setNewCustBranchCode(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>Bank Account No</label>
                  <input
                    type="text"
                    className="add-cust-input"
                    style={{ paddingLeft: 14 }}
                    value={newCustBankAccountNo}
                    onChange={(e) => setNewCustBankAccountNo(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button
                  type="button"
                  onClick={() => setAddCustomerModalOpen(false)}
                  disabled={addCustLoading}
                  style={{
                    height: 44,
                    padding: '0 1.6rem',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#e2e8f0',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: addCustLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { if (!addCustLoading) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
                  onMouseLeave={e => { if (!addCustLoading) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCustLoading}
                  style={{
                    height: 44,
                    padding: '0 1.8rem',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2, #22d3ee)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: addCustLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 20px rgba(34, 211, 238, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    opacity: addCustLoading ? 0.7 : 1
                  }}
                  onMouseEnter={e => { if (!addCustLoading) { e.currentTarget.style.boxShadow = '0 6px 25px rgba(34, 211, 238, 0.55)'; e.currentTarget.style.filter = 'brightness(1.1)'; } }}
                  onMouseLeave={e => { if (!addCustLoading) { e.currentTarget.style.boxShadow = '0 4px 20px rgba(34, 211, 238, 0.4)'; e.currentTarget.style.filter = 'none'; } }}
                >
                  {addCustLoading ? 'Adding...' : 'Add Profile +'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addBillModalOpen && (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 1000, background: 'rgba(5, 10, 20, 0.85)', backdropFilter: 'blur(14px)' }}>
          <div className="neon-card animate-fade-in" style={{ maxWidth: 650, width: '100%', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white', fontWeight: 800 }}>Add Billing Ledger Entry</h3>
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
