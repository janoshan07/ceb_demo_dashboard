import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Search, 
  User, 
  CreditCard, 
  History, 
  Edit,
  X,
  XCircle,
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
  ChevronUp,
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
  Building,
  LayoutGrid,
  List,
  RefreshCw,
  ArrowRight
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
      { label: 'Address', keys: ['customerAddress', 'masterAddress', 'address'] },
      { label: 'Mobile Number', keys: ['mobileNo', 'masterMobile', 'telephone', 'phone'] },
      { label: 'Agreement Date', keys: ['agreementDate', 'masterAgreementDate', 'masterAgrDate'] },
      { label: 'Net Type', keys: ['masterNetType', 'solarType', 'ngenNetType', 'npayNetType'] },
      { label: 'Unit Rate', keys: ['masterUnitRate', 'unitRate', 'ngenUnitRate'] },
      { label: 'Tariff Type', keys: ['tariffType', 'masterTariffType'] },
      { label: 'Cost Code', keys: ['costCode', 'masterCostCode', 'cost_code'] },
      { label: 'L-Code', keys: ['billingMode', 'expenseCode', 'lCode', 'masterBillingMode', 'masterExpenseCode', 'masterLCode', 'expCode'] },
      { label: 'Bank Details', bank: true },
      { label: 'Panel Capacity', keys: ['panelCapacity', 'masterPanelCapacity', 'masterPanelCap', 'capacity'] },
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
  const location = useLocation();
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
    nameMismatchesCount: 0,
    unitRateMismatchesCount: 0,
    netTypeMismatchesCount: 0,
    validationErrorsCount: 0,
    outstandingCustomersCount: 0,
    rejectedCount: 0,
    expiredAgreementsCount: 0,
    expiringSoonAgreementsCount: 0,
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
      
      const isNew = directory.masterDataFound === false || directory.isNewCustomer === true;
      const isPaymentHold = directory.paymentHold === true;
      const isNoBillOnly = directory.masterOnly === true || directory.noBillingData === true;
      const isPaymentMismatch = directory.mergedPayment?.mismatch === true;
      
      isOutstanding = isNew || isPaymentHold || isNoBillOnly || isPaymentMismatch;
    }

    if (hasNameMismatch) missing.push('Name Mismatch');
    if (hasUnitRateMismatch) missing.push('Unit Rate Mismatch');
    if (hasNetTypeMismatch) missing.push('Net Type Mismatch');

    return { isComplete: missing.length === 0 && !isOutstanding, missingFields: missing };
  };

  const renderValOrMissing = (val, formatter) => {
    if (val && typeof val === 'object' && 'value' in val) {
      val = val.value;
    }
    if (val === null || val === undefined || String(val).trim() === '' || String(val).trim() === '—' || String(val).trim().toLowerCase() === 'null' || String(val).trim().toLowerCase() === 'undefined') {
      return <span style={{ color: '#ef4444', fontWeight: 600 }}>Missing</span>;
    }
    return formatter ? formatter(val) : val;
  };

  // Selected Customer Details State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, billing, analytics, payment

  // Redesigned Billing History UI State
  const [billingSearchTerm, setBillingSearchTerm] = useState('');
  const [billingFilterStatus, setBillingFilterStatus] = useState('ALL'); // ALL, OUTSTANDING, SETTLED, MULTI_PAYMENT
  const [billingViewMode, setBillingViewMode] = useState('cards'); // cards, table
  const [billingSortOrder, setBillingSortOrder] = useState('DESC');
  const [expandedBillIds, setExpandedBillIds] = useState({});

  // Payment Control State
  const [paymentDossier, setPaymentDossier] = useState(null);
  const [paymentDossierLoading, setPaymentDossierLoading] = useState(false);
  const [selectedDossierMonth, setSelectedDossierMonth] = useState(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({});
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveTargetMonth, setResolveTargetMonth] = useState(null);

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

  const fetchSummaryStats = async (loc = locationFilter, bm = selectedBillingMonth) => {
    try {
      let url = '/api/officer/customers/summary';
      const params = [];
      if (bm && bm !== 'ALL') {
        params.push(`billingMonth=${encodeURIComponent(bm)}`);
      }
      if (loc && loc.trim().toUpperCase() !== 'ALL') {
        params.push(`location=${encodeURIComponent(loc.trim())}`);
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      const summaryRes = await authFetch(url);
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummaryStats({
          totalCustomers: data.total ?? 0,
          completeCustomers: data.complete ?? 0,
          missingCustomers: data.missing ?? 0,
          validationErrorsCount: data.errors ?? 0,
          nameMismatchesCount: data.nameMismatch ?? 0,
          unitRateMismatchesCount: data.unitRateMismatch ?? 0,
          netTypeMismatchesCount: data.netTypeMismatch ?? 0,
          otherMismatchesCount: data.otherMismatch ?? 0,
          outstandingCustomersCount: data.outstanding ?? 0,
          rejectedCount: data.rejected ?? 0,
          expiredAgreementsCount: data.expired ?? 0,
          expiringSoonAgreementsCount: data.expiringSoon ?? 0,
          locationsCount: (loc && loc.trim().toUpperCase() !== 'ALL') ? 1 : DIRECTORY_DIVISIONS.length
        });
        return;
      }
      
      let fallbackParams = [];
      if (bm && bm !== 'ALL') fallbackParams.push(`billingMonth=${encodeURIComponent(bm)}`);
      if (loc && loc.trim().toUpperCase() !== 'ALL') fallbackParams.push(`location=${encodeURIComponent(loc.trim())}`);
      const extraQuery = fallbackParams.length > 0 ? `&${fallbackParams.join('&')}` : '';

      const [totalRes, completeRes, missingRes, errorRes] = await Promise.all([
        authFetch(`/api/officer/customers?page=0&size=1${extraQuery}`),
        authFetch(`/api/officer/customers?page=0&size=1&completeness=COMPLETE${extraQuery}`),
        authFetch(`/api/officer/customers?page=0&size=1000&completeness=MISSING${extraQuery}`),
        authFetch(`/api/officer/customers?page=0&size=1&validationStatus=ERROR${extraQuery}`)
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
      
      setSummaryStats(prev => ({
        ...prev,
        totalCustomers: total,
        completeCustomers: total - missing > 0 ? total - missing : complete,
        missingCustomers: missing,
        validationErrorsCount: errors,
        locationsCount: (loc && loc.trim().toUpperCase() !== 'ALL') ? 1 : DIRECTORY_DIVISIONS.length
      }));
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
      if (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') {
        url += `&location=${encodeURIComponent(locationFilter.trim())}`;
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
      fetchSummaryStats(locationFilter, selectedBillingMonth);
    } catch (err) {
      setError(err.message || 'Error occurred while loading customers.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [ccRes, ntRes, ecRes, monthsRes, pcMonthsRes] = await Promise.all([
        authFetch('/api/lookup/cost-codes'),
        authFetch('/api/lookup/net-types'),
        authFetch('/api/lookup/expense-codes'),
        authFetch('/api/officer/monthly-directory/months'),
        authFetch('/api/payment-control/months')
      ]);
      if (ccRes.ok) setCostCodesList(await ccRes.json());
      if (ntRes.ok) setNetTypesList(await ntRes.json());
      if (ecRes.ok) setExpenseCodesList(await ecRes.json());
      
      const monthSet = new Set();
      if (monthsRes.ok) {
        const mData = await monthsRes.json();
        if (mData && mData.months) {
          mData.months.forEach(m => {
            if (m.billingMonth && m.billingMonth.trim()) monthSet.add(m.billingMonth.trim());
          });
        }
      }
      if (pcMonthsRes && pcMonthsRes.ok) {
        const pcMonths = await pcMonthsRes.json();
        if (Array.isArray(pcMonths)) {
          pcMonths.forEach(m => {
            if (m && typeof m === 'string' && m.trim()) monthSet.add(m.trim());
          });
        }
      }
      const uniqueMonths = Array.from(monthSet);
      setBillingMonths(uniqueMonths);
      setSelectedBillingMonth(prev => {
        if (prev && prev !== 'ALL' && uniqueMonths.includes(prev)) {
          return prev;
        }
        return uniqueMonths.length > 0 ? uniqueMonths[0] : 'ALL';
      });
    } catch (e) {
      console.error('Failed to load lookup lists:', e);
    }
  };

  // Mount-only fetch for lookup options
  useEffect(() => {
    fetchLookups();
  }, []);

  // Filter effect for customer listing and summary stats
  useEffect(() => {
    fetchCustomers(currentPage, appliedQuery);
    fetchSummaryStats(locationFilter, selectedBillingMonth);
  }, [currentPage, appliedQuery, statusFilter, locationFilter, completenessFilter, selectedBillingMonth, agreementStatusFilter, netTypeFilter, sortBy, sortDir, pageSize]);

  // Handle URL query parameters to open Customer 360 & Payment Control directly (e.g. from Payment Control Center)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetAccount = params.get('accountNo');
    const targetTab = params.get('tab') || 'overview';
    if (targetAccount) {
      const found = customers.find(c => String(c.accountNo).trim() === String(targetAccount).trim());
      if (found) {
        handleViewDetails(found, targetTab);
      } else {
        authFetch(`/api/payments/customers/${encodeURIComponent(targetAccount)}/dossier`)
          .then(res => res.ok ? res.json() : null)
          .then(dossier => {
            if (dossier) {
              const custObj = {
                accountNo: dossier.accountNo,
                customerName: dossier.customerName,
                solarType: dossier.solarType,
                division: dossier.division,
                paymentStatus: dossier.latestPaymentStatus,
                isPaymentEligible: dossier.isPaymentEligible,
                currentPayment: dossier.currentPayment,
                totalPayable: dossier.totalPayable,
                outstandingBalance: dossier.outstandingBalance,
                directory: dossier.months?.[0]?.record || {}
              };
              handleViewDetails(custObj, targetTab);
            }
          })
          .catch(console.error);
      }
    }
  }, [location.search, customers.length]);

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

  // Fetch Month-Wise Payment Dossier
  const fetchPaymentDossier = async (accountNo) => {
    if (!accountNo) return;
    setPaymentDossierLoading(true);
    try {
      const res = await authFetch(`/api/payments/customers/${encodeURIComponent(accountNo)}/dossier`);
      if (res.ok) {
        const data = await res.json();
        setPaymentDossier(data);
        if (data.months && data.months.length > 0) {
          setSelectedDossierMonth(data.months[0].billingMonth);
        }
      }
    } catch (err) {
      console.error('Failed to load payment dossier', err);
    } finally {
      setPaymentDossierLoading(false);
    }
  };

  const handleOpenResolveModal = (monthDossier) => {
    setResolveTargetMonth(monthDossier);
    const rec = monthDossier?.record || {};
    setResolveForm({
      snapshotId: monthDossier?.snapshotId,
      customerName: rec.customerName || rec.masterName || '',
      solarType: rec.solarType || rec.masterNetType || 'Net Plus',
      unitRate: rec.unitRate ?? rec.masterUnitRate ?? '',
      bankCode: rec.bankCode || rec.masterBankCode || '',
      branchCode: rec.branchCode || rec.masterBranchCode || '',
      bankAccountNo: rec.bankAccountNo || rec.masterBankAccountNo || '',
      mobileNo: rec.mobileNo || rec.masterMobile || '',
      agreementDate: rec.agreementDate || rec.masterAgreementDate || '',
      panelCapacity: rec.panelCapacity ?? rec.masterPanelCapacity ?? ''
    });
    setResolveModalOpen(true);
  };

  const handleSaveCorrection = async () => {
    if (!selectedCustomer?.accountNo || !resolveTargetMonth) return;
    setResolveLoading(true);
    try {
      const res = await authFetch(`/api/payments/customers/${encodeURIComponent(selectedCustomer.accountNo)}/correct?billingPeriod=${encodeURIComponent(resolveTargetMonth.billingMonth || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolveForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Correction saved! Record re-validated successfully.', 'success');
        setResolveModalOpen(false);
        await fetchPaymentDossier(selectedCustomer.accountNo);
        // Also refresh customer directory list so table badge updates
        if (typeof fetchCustomers === 'function') fetchCustomers();
      } else {
        showToast(data.message || 'Failed to save correction', 'error');
      }
    } catch (err) {
      showToast('Network error while saving correction: ' + err.message, 'error');
    } finally {
      setResolveLoading(false);
    }
  };

  const handleViewDetails = (customer, initialTab = 'overview') => {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
    setIsEditing(false);
    setEditError(null);
    setEditMessage(null);
    setEditingBill(null);
    setActiveTab(initialTab);
    fetchPaymentDossier(customer.accountNo);
    
    // Prep Edit Fields
    const cName = customer.customerName || customer.directory?.customerName || customer.directory?.masterName || '';
    setEditName(cName);
    setEditAddress(customer.customerAddress || customer.directory?.customerAddress || customer.directory?.address || '');
    setEditMobile(customer.mobileNo || customer.directory?.mobileNo || customer.directory?.telephone || customer.directory?.phone || '');
    setEditAgreementDate(customer.agreementDate || customer.directory?.agreementDate || '');
    setEditCapacity(customer.panelCapacity ?? customer.directory?.panelCapacity ?? '');
    const sType = customer.solarType || customer.netTypeName || customer.directory?.solarType || customer.directory?.masterNetType || 'Net Plus';
    setEditSolarType(sType);
    setEditBankCode(customer.bankCode || customer.directory?.bankCode || customer.directory?.masterBankCode || '');
    setEditBranchCode(customer.branchCode || customer.directory?.branchCode || customer.directory?.masterBranchCode || '');
    setEditBankAccountNo(customer.bankAccountNo || customer.directory?.bankAccountNo || customer.directory?.masterBankAccountNo || '');
    setEditRefNo(customer.refNo || customer.directory?.refNo || customer.directory?.masterRefNo || '');
    setEditUnitRate(customer.unitRate ?? customer.directory?.unitRate ?? customer.directory?.masterUnitRate ?? '');
    const tType = customer.tariffType || customer.directory?.tariffType || customer.directory?.masterTariffType || '';
    setEditTariffType(tType);

    // Resolve Cost Code ID
    let ccId = customer.costCodeId;
    if (!ccId && costCodesList.length > 0) {
      const cCode = customer.costCode || customer.directory?.costCode || customer.directory?.masterCostCode;
      if (cCode) {
        const found = costCodesList.find(c => String(c.costCode).trim() === String(cCode).trim() || String(c.id) === String(cCode).trim());
        if (found) ccId = found.id;
      }
    }
    setEditCostCodeId(ccId || '');

    // Resolve Net Type ID
    let ntId = customer.netTypeId;
    if (!ntId && netTypesList.length > 0 && sType) {
      const found = netTypesList.find(n => n.name.trim().toLowerCase() === sType.trim().toLowerCase());
      if (found) ntId = found.id;
    }
    setEditNetTypeId(ntId || '');

    // Resolve Expense Code (L-Code) ID
    let ecId = customer.expenseCodeId;
    const lCode = customer.expenseCode || customer.directory?.billingMode || customer.directory?.expenseCode || customer.directory?.lCode || customer.directory?.masterBillingMode || customer.directory?.masterExpenseCode || deriveLCode(sType, tType);
    if (!ecId && expenseCodesList.length > 0 && lCode) {
      const found = expenseCodesList.find(e => 
        String(e.expCode).trim().toLowerCase() === String(lCode).trim().toLowerCase() ||
        String(e.exp).trim().toLowerCase() === String(lCode).trim().toLowerCase() ||
        String(e.id) === String(lCode).trim()
      );
      if (found) ecId = found.id;
    }
    setEditExpenseCodeId(ecId || '');

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
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {locationFilter && locationFilter.trim().toUpperCase() !== 'ALL' ? `Total (${locationFilter})` : 'Total Customers'}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', marginTop: '0.15rem' }}>{summaryStats.totalCustomers.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? '#38bdf8' : '#10b981', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {(locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? (
                  <span>📍 {locationFilter} Division active</span>
                ) : (
                  <span>All 5 Eastern Province divisions</span>
                )}
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
        <div className="card" onClick={() => { setCompletenessFilter('MISSING'); setCurrentPage(0); }} style={{ padding: '1.25rem', borderRadius: '12px', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', borderLeft: (completenessFilter === 'MISSING' || completenessFilter === 'NAME_MISMATCH' || completenessFilter === 'UNIT_RATE_MISMATCH' || completenessFilter === 'NET_TYPE_MISMATCH') ? '3px solid #f59e0b' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.2)', cursor: 'pointer' }}>
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
        <div 
          className="card" 
          onClick={() => {
            if (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') {
              setLocationFilter('ALL');
              setCurrentPage(0);
              fetchSummaryStats('ALL', selectedBillingMonth);
            }
          }}
          style={{ 
            padding: '1.25rem', 
            borderRadius: '12px', 
            border: (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? '1px solid rgba(56,189,248,0.6)' : '1px solid var(--border-color)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            background: (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? 'rgba(56,189,248,0.08)' : 'rgba(30,41,59,0.2)',
            cursor: (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? 'pointer' : 'default',
            boxShadow: (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? '0 0 12px rgba(56,189,248,0.15)' : 'none',
            transition: 'all 0.2s ease'
          }}
          title={(locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? 'Click to reset to All Locations' : 'Locations'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={24} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {(locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? `Location: ${locationFilter}` : 'Locations'}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', marginTop: '0.15rem' }}>
                {(locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? summaryStats.totalCustomers.toLocaleString() : summaryStats.locationsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: (locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? '#38bdf8' : 'var(--text-muted)', marginTop: '0.15rem' }}>
                {(locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? `${locationFilter} Customers (Click to reset)` : 'Eastern Province'}
              </div>
            </div>
          </div>
          {(locationFilter && locationFilter.trim().toUpperCase() !== 'ALL') ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setLocationFilter('ALL'); setCurrentPage(0); fetchSummaryStats('ALL', selectedBillingMonth); }}
              title="Reset location filter"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}
            >
              <X size={12} /> All
            </button>
          ) : (
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <MoreVertical size={16} />
            </button>
          )}
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
            <span style={{ marginLeft: '0.35rem', background: '#3b82f6', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.totalCustomers ?? 0}
            </span>
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
            <span style={{ marginLeft: '0.35rem', background: '#10b981', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.completeCustomers ?? 0}
            </span>
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
            <AlertTriangle size={14} /> Missing Details
            <span style={{ marginLeft: '0.35rem', background: '#f59e0b', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.missingCustomers ?? 0}
            </span>
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
            <span style={{ marginLeft: '0.35rem', background: '#fb7185', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.nameMismatchesCount ?? 0}
            </span>
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
            <span style={{ marginLeft: '0.35rem', background: '#fbbf24', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.unitRateMismatchesCount ?? 0}
            </span>
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
            <span style={{ marginLeft: '0.35rem', background: '#a78bfa', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.netTypeMismatchesCount ?? 0}
            </span>
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
            <span style={{ marginLeft: '0.35rem', background: '#38bdf8', color: 'black', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.outstandingCustomersCount ?? 0}
            </span>
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
            <span style={{ marginLeft: '0.35rem', background: '#ef4444', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.expiredAgreementsCount ?? 0}
            </span>
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
            <span style={{ marginLeft: '0.35rem', background: '#f97316', color: 'white', borderRadius: '999px', padding: '0.05rem 0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
              {summaryStats.expiringSoonAgreementsCount ?? 0}
            </span>
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
              onChange={(e) => { 
                const newMonth = e.target.value;
                setSelectedBillingMonth(newMonth); 
                setCurrentPage(0); 
                fetchSummaryStats(locationFilter, newMonth);
              }}
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
              const active = (locationFilter || 'ALL').trim().toUpperCase() === loc.trim().toUpperCase();
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => { 
                    setLocationFilter(loc); 
                    setCurrentPage(0);
                    fetchSummaryStats(loc, selectedBillingMonth);
                  }}
                  style={{
                    padding: '0.38rem 0.95rem',
                    fontSize: '0.78rem',
                    fontWeight: active ? 700 : 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: active ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    background: active ? 'rgba(59,130,246,0.18)' : '#111827',
                    color: active ? '#60a5fa' : 'var(--text-secondary)',
                    boxShadow: active ? '0 0 10px rgba(59,130,246,0.25)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {active && loc !== 'ALL' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />}
                  <span>{loc === 'ALL' ? 'All Locations' : loc}</span>
                </button>
              );
            })}
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
                    <th style={{ textAlign: 'center' }}>PAYMENT STATUS</th>
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
                      <td><div className="skeleton" style={{ height: '24px', width: '85px', borderRadius: '4px', margin: '0 auto' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '120px' }}></div></td>
                      <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: '28px', width: '90px', borderRadius: '4px', marginLeft: 'auto' }}></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : customers.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <MapPin size={42} style={{ opacity: 0.4, marginBottom: '0.75rem', color: '#38bdf8' }} />
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>
                  {locationFilter && locationFilter.trim().toUpperCase() !== 'ALL'
                    ? `No Customers Found for Location: ${locationFilter}`
                    : (appliedQuery ? `No Customers Matching "${appliedQuery}"` : 'No Customer Records Found')}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.4rem', maxWidth: '520px', margin: '0.4rem auto 0' }}>
                  {locationFilter && locationFilter.trim().toUpperCase() !== 'ALL'
                    ? `There are no customer records belonging to "${locationFilter}" under the selected filters.`
                    : (appliedQuery
                      ? 'No customer records matched your search query. Try checking for typos or searching by account number.'
                      : 'The Customer Directory is empty. Records will automatically populate here when new billing data is uploaded and approved by an Admin.')}
                </div>
                {(locationFilter !== 'ALL' || appliedQuery || statusFilter !== 'ALL' || completenessFilter !== 'ALL' || agreementStatusFilter !== 'ALL' || netTypeFilter !== 'ALL') && (
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
                    style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', background: 'rgba(56,189,248,0.08)', borderRadius: '8px', padding: '0.45rem 1.2rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    Reset Location & Filters
                  </button>
                )}
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
                    <th style={{ textAlign: 'center' }}>PAYMENT STATUS</th>
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
                        <td style={{ textAlign: 'center' }}>
                          {(() => {
                            const status = cust.paymentStatus || 'ON_HOLD';
                            let bg = 'rgba(245, 158, 11, 0.15)';
                            let color = '#f59e0b';
                            let border = '1px solid rgba(245, 158, 11, 0.3)';
                            if (status === 'READY') {
                              bg = 'rgba(16, 185, 129, 0.15)';
                              color = '#10b981';
                              border = '1px solid rgba(16, 185, 129, 0.3)';
                            } else if (status === 'PAID') {
                              bg = 'rgba(5, 150, 105, 0.15)';
                              color = '#059669';
                              border = '1px solid rgba(5, 150, 105, 0.3)';
                            } else if (status === 'PROCESSING' || status === 'APPROVED') {
                              bg = 'rgba(99, 102, 241, 0.15)';
                              color = '#818cf8';
                              border = '1px solid rgba(99, 102, 241, 0.3)';
                            } else if (status === 'REVIEW') {
                              bg = 'rgba(168, 85, 247, 0.15)';
                              color = '#c084fc';
                              border = '1px solid rgba(168, 85, 247, 0.3)';
                            } else if (status === 'REJECTED') {
                              bg = 'rgba(239, 68, 68, 0.15)';
                              color = '#ef4444';
                              border = '1px solid rgba(239, 68, 68, 0.3)';
                            }
                            return (
                              <span
                                className="badge"
                                onClick={() => handleViewDetails(cust, 'payment')}
                                title="Click to inspect Payment Control & Dossier"
                                style={{
                                  background: bg,
                                  color: color,
                                  border: border,
                                  padding: '0.22rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <CreditCard size={11} />
                                {status.replace('_', ' ')}
                              </span>
                            );
                          })()}
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
                              title="Payment Control & Dossier"
                              style={{ padding: '0.35rem', borderRadius: '6px', background: '#1e293b', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}
                              onClick={() => handleViewDetails(cust, 'payment')}
                            >
                              <CreditCard size={14} />
                            </button>
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
      ) : customers.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(30,41,59,0.2)' }}>
          <MapPin size={42} style={{ opacity: 0.4, marginBottom: '0.75rem', color: '#38bdf8' }} />
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>
            {locationFilter && locationFilter.trim().toUpperCase() !== 'ALL'
              ? `No Customers Found for Location: ${locationFilter}`
              : (appliedQuery ? `No Customers Matching "${appliedQuery}"` : 'No Customer Records Found')}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.4rem', maxWidth: '520px', margin: '0.4rem auto 0' }}>
            {locationFilter && locationFilter.trim().toUpperCase() !== 'ALL'
              ? `There are no customer records belonging to "${locationFilter}" under the selected filters.`
              : (appliedQuery
                ? 'No customer records matched your search query. Try checking for typos or searching by account number.'
                : 'The Customer Directory is empty. Records will automatically populate here when new billing data is uploaded and approved by an Admin.')}
          </div>
          {(locationFilter !== 'ALL' || appliedQuery || statusFilter !== 'ALL' || completenessFilter !== 'ALL' || agreementStatusFilter !== 'ALL' || netTypeFilter !== 'ALL') && (
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
              style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', background: 'rgba(56,189,248,0.08)', borderRadius: '8px', padding: '0.45rem 1.2rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Reset Location & Filters
            </button>
          )}
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
            
            {/* Rejection Reason Banner */}
            {(selectedCustomer.status === 'REJECTED' || selectedCustomer.validationStatus === 'REJECTED' || selectedCustomer.directory?.status === 'REJECTED' || selectedCustomer.directory?.rejected === true) && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                  <XCircle size={16} style={{ color: '#ef4444' }} />
                  Record Rejected
                </div>
                <div style={{ fontSize: '0.82rem', color: '#f87171' }}>
                  <strong>Rejection Reason / Comments:</strong>
                  <div style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.04)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                    {selectedCustomer.directory?.rejectionReason || selectedCustomer.rejectionReason || 'Rejected during Step 6 review'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Pending Admin Approval Banner */}
            {(selectedCustomer.pendingAdminApproval === true || selectedCustomer.approvalStatus === 'PENDING_APPROVAL' || selectedCustomer.directory?.pendingAdminApproval === true || selectedCustomer.directory?.approvalStatus === 'PENDING_APPROVAL') && (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                  <Clock size={16} style={{ color: '#fbbf24' }} />
                  Pending Admin Approval
                </div>
                <div style={{ fontSize: '0.82rem', color: '#fde68a' }}>
                  An officer has submitted corrections for this customer. Edits are currently awaiting Administrator review and approval before live completion.
                </div>
              </div>
            )}
            
            {/* Validation Issues Banner */}
            {(() => {
              const issues = [];
              if (selectedCustomer.validationStatus === 'ERROR') {
                const parsed = parseErrors(selectedCustomer.validationErrors);
                parsed.forEach(err => {
                  issues.push({
                    type: 'New Customer',
                    reason: err
                  });
                });
              }
              const dir = selectedCustomer.directory || selectedCustomer;
              if (dir) {
                if (dir.nameMatch === 'MISMATCH' || selectedCustomer.nameMatch === 'MISMATCH') {
                  const masterName = dir.masterName || dir.customerName || selectedCustomer.customerName || '—';
                  const mainName = dir.billingName || dir.npayName || dir.ngenName || dir.mainName || '—';
                  issues.push({
                    type: 'Name Mismatch',
                    master: masterName,
                    main: mainName,
                    reason: `Customer name in Directory ('${masterName}') does not match billing data name ('${mainName}').`
                  });
                }
                if (dir.unitRateMatch === 'MISMATCH' || selectedCustomer.unitRateMatch === 'MISMATCH') {
                  const masterRate = dir.masterUnitRate !== undefined && dir.masterUnitRate !== null ? dir.masterUnitRate : (selectedCustomer.unitRate !== undefined && selectedCustomer.unitRate !== null ? selectedCustomer.unitRate : '—');
                  const mainRate = dir.mainUnitRate !== undefined && dir.mainUnitRate !== null ? dir.mainUnitRate : (dir.ngenUnitRate !== undefined && dir.ngenUnitRate !== null ? dir.ngenUnitRate : (dir.billingUnitRate || dir.unitRate || '—'));
                  issues.push({
                    type: 'Unit Rate Mismatch',
                    master: typeof masterRate === 'number' ? `${masterRate.toFixed(2)} LKR` : (masterRate !== '—' && !isNaN(Number(masterRate)) ? `${Number(masterRate).toFixed(2)} LKR` : masterRate),
                    main: typeof mainRate === 'number' ? `${mainRate.toFixed(2)} LKR` : (mainRate !== '—' && !isNaN(Number(mainRate)) ? `${Number(mainRate).toFixed(2)} LKR` : mainRate),
                    reason: `Unit rate in Profile does not match NGEN/NPAY/Main billing rate.`
                  });
                }
                if (dir.netTypeMatch === 'MISMATCH' || selectedCustomer.netTypeMatch === 'MISMATCH') {
                  const masterNet = dir.masterNetType || selectedCustomer.solarType || selectedCustomer.netTypeName || '—';
                  const mainNet = dir.mainNetType || dir.ngenNetType || dir.npayNetType || '—';
                  issues.push({
                    type: 'Net Type Mismatch',
                    master: masterNet,
                    main: mainNet,
                    reason: `Solar/Tariff Net Type in Profile does not match NGEN/NPAY billing net type.`
                  });
                }
                if (dir.mergedPayment?.mismatch || dir.paymentMismatch) {
                  const masterPay = dir.mergedPayment?.ngenPayment !== undefined ? dir.mergedPayment.ngenPayment : (dir.ngenPayment || '—');
                  const mainPay = dir.mergedPayment?.npayPayment !== undefined ? dir.mergedPayment.npayPayment : (dir.npayPayment || '—');
                  issues.push({
                    type: 'Payment Mismatch',
                    master: typeof masterPay === 'number' ? `${masterPay.toLocaleString()} LKR` : masterPay,
                    main: typeof mainPay === 'number' ? `${mainPay.toLocaleString()} LKR` : mainPay,
                    reason: `Payment calculated in NGEN does not match NPAY settlement.`
                  });
                }
              }
              const comp = getCustomerCompleteness(selectedCustomer);
              if (!comp.isComplete) {
                comp.missingFields.forEach(field => {
                  if (field !== 'Name Mismatch' && field !== 'Unit Rate Mismatch' && field !== 'Net Type Mismatch') {
                    issues.push({
                      type: 'Missing Profile Detail',
                      reason: `Required profile field '${field}' is missing or invalid.`
                    });
                  }
                });
              }

              if (issues.length === 0) return null;

              return (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                    <AlertCircle size={16} />
                    Validation Issues Detected
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {issues.map((err, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: '#f87171', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                        <span style={{ fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', fontSize: '0.74rem', letterSpacing: '0.05em' }}>{err.type}</span>
                        {err.master !== undefined && err.main !== undefined ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem', padding: '0.45rem 0.65rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <div>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '0.1rem' }}>Master:</span>
                              <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem', wordBreak: 'break-word' }}>{String(err.master)}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '0.1rem' }}>Main:</span>
                              <span style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem', wordBreak: 'break-word' }}>{String(err.main)}</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.82rem' }}>{err.reason}</span>
                        )}
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
              <button
                type="button"
                className={`btn ${activeTab === 'payment' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  border: activeTab === 'payment' ? '1px solid rgba(16, 185, 129, 0.4)' : undefined,
                  background: activeTab === 'payment' ? 'rgba(16, 185, 129, 0.2)' : undefined,
                  color: activeTab === 'payment' ? '#34d399' : undefined
                }}
                onClick={() => {
                  setActiveTab('payment');
                  if (!paymentDossier || paymentDossier.accountNo !== selectedCustomer?.accountNo) {
                    fetchPaymentDossier(selectedCustomer?.accountNo);
                  }
                }}
              >
                <CreditCard size={14} />
                <span>Payment Control</span>
              </button>
            </div>

            {editMessage && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', borderLeft: '3px solid var(--success)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {editMessage}
              </div>
            )}

            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (() => {
              const dirRecord = selectedCustomer.directory || selectedCustomer;
              const hasNameMismatch = Boolean(dirRecord?.nameMatch === 'MISMATCH' || selectedCustomer.nameMatch === 'MISMATCH');
              const hasUnitRateMismatch = Boolean(dirRecord?.unitRateMatch === 'MISMATCH' || selectedCustomer.unitRateMatch === 'MISMATCH');
              const hasNetTypeMismatch = Boolean(dirRecord?.netTypeMatch === 'MISMATCH' || selectedCustomer.netTypeMatch === 'MISMATCH');

              return (
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label">Customer Name</label>
                          {hasNameMismatch && (
                            <span style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={11} /> Name Mismatch
                            </span>
                          )}
                        </div>
                        <input 
                          type="text" 
                          className="login-form-input" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          style={{
                            border: hasNameMismatch ? '1px solid #ef4444' : undefined,
                            animation: hasNameMismatch ? 'errorPulseBlink 1.5s infinite' : undefined
                          }}
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="form-label">Net Type (Solar Type)</label>
                            {hasNetTypeMismatch && (
                              <span style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertTriangle size={11} /> Net Type Mismatch
                              </span>
                            )}
                          </div>
                          <select 
                            className="login-form-input" 
                            value={editNetTypeId}
                            onChange={(e) => {
                              setEditNetTypeId(e.target.value);
                              const selected = netTypesList.find(n => n.id.toString() === e.target.value);
                              if (selected) setEditSolarType(selected.name);
                            }}
                            style={{
                              appearance: 'auto',
                              border: hasNetTypeMismatch ? '1px solid #ef4444' : undefined,
                              animation: hasNetTypeMismatch ? 'errorPulseBlink 1.5s infinite' : undefined
                            }}
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="form-label">Unit Rate</label>
                            {hasUnitRateMismatch && (
                              <span style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertTriangle size={11} /> Rate Mismatch
                              </span>
                            )}
                          </div>
                          <input 
                            type="number" 
                            step="0.001"
                            className="login-form-input" 
                            value={editUnitRate}
                            onChange={(e) => setEditUnitRate(e.target.value)}
                            style={{
                              border: hasUnitRateMismatch ? '1px solid #ef4444' : undefined,
                              animation: hasUnitRateMismatch ? 'errorPulseBlink 1.5s infinite' : undefined
                            }}
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
                        <div style={{
                          padding: hasNameMismatch ? '0.45rem 0.65rem' : undefined,
                          borderRadius: hasNameMismatch ? 8 : undefined,
                          border: hasNameMismatch ? '1px solid #ef4444' : undefined,
                          background: hasNameMismatch ? 'rgba(239, 68, 68, 0.08)' : undefined,
                          animation: hasNameMismatch ? 'errorPulseBlink 1.5s infinite' : undefined,
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', color: hasNameMismatch ? '#f87171' : 'var(--text-secondary)', fontWeight: hasNameMismatch ? 700 : 500 }}>
                              Customer Name
                            </span>
                            {hasNameMismatch && (
                              <span style={{ fontSize: '0.62rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertTriangle size={10} /> MISMATCH
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', color: hasNameMismatch ? '#fca5a5' : 'inherit' }}>
                            {renderValOrMissing(selectedCustomer.customerName || selectedCustomer.directory?.customerName || selectedCustomer.directory?.masterName || selectedCustomer.directory?.npayName || selectedCustomer.directory?.ngenName)}
                          </div>
                        </div>
                        <div style={{
                          padding: hasNetTypeMismatch ? '0.45rem 0.65rem' : undefined,
                          borderRadius: hasNetTypeMismatch ? 8 : undefined,
                          border: hasNetTypeMismatch ? '1px solid #ef4444' : undefined,
                          background: hasNetTypeMismatch ? 'rgba(239, 68, 68, 0.08)' : undefined,
                          animation: hasNetTypeMismatch ? 'errorPulseBlink 1.5s infinite' : undefined,
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', color: hasNetTypeMismatch ? '#f87171' : 'var(--text-secondary)', fontWeight: hasNetTypeMismatch ? 700 : 500 }}>
                              Solar System Type
                            </span>
                            {hasNetTypeMismatch && (
                              <span style={{ fontSize: '0.62rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertTriangle size={10} /> MISMATCH
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', color: hasNetTypeMismatch ? '#fca5a5' : ((selectedCustomer.solarType || selectedCustomer.netTypeName || selectedCustomer.directory?.solarType || selectedCustomer.directory?.masterNetType) ? 'var(--success)' : 'inherit') }}>
                            {renderValOrMissing(selectedCustomer.solarType || selectedCustomer.netTypeName || selectedCustomer.directory?.solarType || selectedCustomer.directory?.masterNetType || selectedCustomer.directory?.ngenNetType || selectedCustomer.directory?.npayNetType)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Customer Address</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.customerAddress || selectedCustomer.directory?.customerAddress || selectedCustomer.directory?.address)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Mobile No</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.mobileNo || selectedCustomer.directory?.mobileNo || selectedCustomer.directory?.telephone || selectedCustomer.directory?.phone)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Panel Capacity</span>
                          <div style={{ fontWeight: 600 }}>
                            {renderValOrMissing(selectedCustomer.panelCapacity ?? selectedCustomer.directory?.panelCapacity, (v) => `${v} kW`)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Agreement Date</span>
                          <div style={{ fontWeight: 600 }}>
                            {renderValOrMissing(selectedCustomer.agreementDate || selectedCustomer.directory?.agreementDate, (v) => new Date(v).toLocaleDateString('en-LK'))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Bank Code</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.bankCode || selectedCustomer.directory?.bankCode || selectedCustomer.directory?.masterBankCode)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Branch Code</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.branchCode || selectedCustomer.directory?.branchCode || selectedCustomer.directory?.masterBranchCode)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Bank Account No</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.bankAccountNo || selectedCustomer.directory?.bankAccountNo || selectedCustomer.directory?.masterBankAccountNo)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Ref No</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.refNo || selectedCustomer.directory?.refNo || selectedCustomer.directory?.masterRefNo)}
                          </div>
                        </div>
                        <div style={{
                          padding: hasUnitRateMismatch ? '0.45rem 0.65rem' : undefined,
                          borderRadius: hasUnitRateMismatch ? 8 : undefined,
                          border: hasUnitRateMismatch ? '1px solid #ef4444' : undefined,
                          background: hasUnitRateMismatch ? 'rgba(239, 68, 68, 0.08)' : undefined,
                          animation: hasUnitRateMismatch ? 'errorPulseBlink 1.5s infinite' : undefined,
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', color: hasUnitRateMismatch ? '#f87171' : 'var(--text-secondary)', fontWeight: hasUnitRateMismatch ? 700 : 500 }}>
                              Unit Rate
                            </span>
                            {hasUnitRateMismatch && (
                              <span style={{ fontSize: '0.62rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertTriangle size={10} /> MISMATCH
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 500, color: hasUnitRateMismatch ? '#fca5a5' : 'inherit' }}>
                            {renderValOrMissing(selectedCustomer.unitRate ?? selectedCustomer.directory?.unitRate ?? selectedCustomer.directory?.masterUnitRate ?? selectedCustomer.directory?.ngenUnitRate, (v) => `${v} LKR`)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Tariff Type</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.tariffType || selectedCustomer.directory?.tariffType || selectedCustomer.directory?.masterTariffType)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cost Code</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(selectedCustomer.costCode || selectedCustomer.directory?.costCode || selectedCustomer.directory?.masterCostCode)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>L-Code</span>
                          <div style={{ fontWeight: 500 }}>
                            {renderValOrMissing(
                              selectedCustomer.expenseCode ||
                              selectedCustomer.directory?.billingMode ||
                              selectedCustomer.directory?.expenseCode ||
                              selectedCustomer.directory?.lCode ||
                              selectedCustomer.directory?.masterBillingMode ||
                              selectedCustomer.directory?.masterExpenseCode ||
                              deriveLCode(
                                selectedCustomer.solarType || selectedCustomer.netTypeName || selectedCustomer.directory?.solarType || selectedCustomer.directory?.masterNetType,
                                selectedCustomer.tariffType || selectedCustomer.directory?.tariffType || selectedCustomer.directory?.masterTariffType
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Location / Division</span>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: (selectedCustomer.division || selectedCustomer.branchCode || selectedCustomer.directory?.division || selectedCustomer.directory?.location) ? '#38bdf8' : 'inherit' }}>
                            <MapPin size={13} /> {renderValOrMissing(selectedCustomer.division || selectedCustomer.branchCode || selectedCustomer.directory?.division || selectedCustomer.directory?.location)}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Classification Status</span>
                          <div style={{ fontWeight: 600, marginTop: '0.1rem', color: (selectedCustomer.validationStatus === 'ERROR' || selectedCustomer.directory?.status === 'ERROR') ? '#f87171' : 'var(--success)' }}>
                            {(selectedCustomer.validationStatus === 'ERROR' || selectedCustomer.directory?.status === 'ERROR') ? 'New Customer' : 'Valid'}
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
            );
          })()}

            {/* TAB CONTENT: BILLING HISTORY (REDESIGNED MODERN UI) */}
            {activeTab === 'billing' && (() => {
              // Helper: Format raw date into Month Year (e.g. "March 2026")
              const getBillMonth = (bill) => {
                const raw = bill.currReadingDate || bill.fromDate || bill.toDate || bill.prevReadingDate;
                if (raw) {
                  const d = new Date(raw);
                  if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  }
                }
                if (bill.billCycle) return `Cycle ${bill.billCycle}`;
                return 'Billing Cycle';
              };

              // Helper: Determine payment status and styling
              const getBillPaymentStatus = (bill) => {
                const settled = Number(bill.paymentSettled != null ? bill.paymentSettled : bill.payment || 0);
                const outstanding = Number(bill.outstandingBalance || 0);
                if (settled > 0 && outstanding <= 0) {
                  return { key: 'SETTLED', label: 'Settled', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
                }
                if (settled > 0 && outstanding > 0) {
                  return { key: 'PARTIAL', label: 'Partially Settled', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
                }
                if (outstanding > 0) {
                  return { key: 'OUTSTANDING', label: 'Outstanding Balance', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)' };
                }
                return { key: 'LOGGED', label: 'Logged', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.12)', border: 'rgba(129, 140, 248, 0.3)' };
              };

              // Map each month to record count to detect multiple payments in that period
              const monthCounts = {};
              (billingHistory || []).forEach(b => {
                const m = getBillMonth(b);
                monthCounts[m] = (monthCounts[m] || 0) + 1;
              });

              // Overall KPI Metrics for Billing History
              const totalBillsCount = (billingHistory || []).length;
              const totalSettledAmt = (billingHistory || []).reduce((sum, b) => sum + Number(b.paymentSettled != null ? b.paymentSettled : b.payment || 0), 0);
              const totalGrossSales = (billingHistory || []).reduce((sum, b) => sum + Number(b.energyPurchase != null ? b.energyPurchase : b.totalAmount || 0), 0);
              const totalExportUnits = (billingHistory || []).reduce((sum, b) => sum + Number(b.kwhExport != null ? b.kwhExport : b.exportUnits || 0), 0);
              
              // Latest outstanding balance from the most recent record
              const latestBill = (billingHistory || [])[0];
              const latestOutstandingAmt = latestBill ? Number(latestBill.outstandingBalance || 0) : 0;
              const multiPaymentRecordsCount = Object.entries(monthCounts).filter(([_, cnt]) => cnt > 1).reduce((acc, [_, cnt]) => acc + cnt, 0);

              // Filter & Search
              let filtered = [...(billingHistory || [])];
              if (billingSearchTerm.trim()) {
                const q = billingSearchTerm.trim().toLowerCase();
                filtered = filtered.filter(b => {
                  const ref = String(b.refNo || '').toLowerCase();
                  const m = getBillMonth(b).toLowerCase();
                  const pDate = String(b.prevReadingDate || '').toLowerCase();
                  const cDate = String(b.currReadingDate || '').toLowerCase();
                  return ref.includes(q) || m.includes(q) || pDate.includes(q) || cDate.includes(q);
                });
              }

              if (billingFilterStatus === 'OUTSTANDING') {
                filtered = filtered.filter(b => Number(b.outstandingBalance || 0) > 0);
              } else if (billingFilterStatus === 'SETTLED') {
                filtered = filtered.filter(b => Number(b.paymentSettled != null ? b.paymentSettled : b.payment || 0) > 0);
              } else if (billingFilterStatus === 'MULTI_PAYMENT') {
                filtered = filtered.filter(b => (monthCounts[getBillMonth(b)] || 0) > 1);
              }

              // Sort order
              filtered.sort((a, b) => {
                const dateA = new Date(a.currReadingDate || a.fromDate || a.prevReadingDate || 0).getTime();
                const dateB = new Date(b.currReadingDate || b.fromDate || b.prevReadingDate || 0).getTime();
                return billingSortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
              });

              // Group bills by month for modern timeline / cards display
              const monthGroups = [];
              const monthMap = new Map();
              filtered.forEach(bill => {
                const mKey = getBillMonth(bill);
                if (!monthMap.has(mKey)) {
                  const grp = {
                    monthKey: mKey,
                    bills: [],
                    totalSettled: 0,
                    totalSales: 0,
                    isMultiMonth: (monthCounts[mKey] || 0) > 1
                  };
                  monthMap.set(mKey, grp);
                  monthGroups.push(grp);
                }
                const grp = monthMap.get(mKey);
                grp.bills.push(bill);
                grp.totalSettled += Number(bill.paymentSettled != null ? bill.paymentSettled : bill.payment || 0);
                grp.totalSales += Number(bill.energyPurchase != null ? bill.energyPurchase : bill.totalAmount || 0);
              });

              const toggleExpandDetails = (bId) => {
                setExpandedBillIds(prev => ({ ...prev, [bId]: !prev[bId] }));
              };

              return (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                  
                  {/* Top Header & Action Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <History size={18} color="#818cf8" />
                      </div>
                      <div>
                        <h3 className="panel-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Billing & Payment Ledger
                          <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '0.15rem 0.55rem', borderRadius: 20, fontWeight: 700 }}>
                            {totalBillsCount} Records
                          </span>
                        </h3>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Customer payment obligations, solar net settlement, and historical ledger audit
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {/* View Mode Switcher (Cards vs Table) */}
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '0.2rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <button
                          type="button"
                          onClick={() => setBillingViewMode('cards')}
                          style={{
                            background: billingViewMode === 'cards' ? 'rgba(99,102,241,0.25)' : 'transparent',
                            color: billingViewMode === 'cards' ? '#818cf8' : 'var(--text-secondary)',
                            border: billingViewMode === 'cards' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                            borderRadius: 6, padding: '0.28rem 0.6rem', fontSize: '0.74rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                          title="Card & Timeline View"
                        >
                          <LayoutGrid size={13} /> Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingViewMode('table')}
                          style={{
                            background: billingViewMode === 'table' ? 'rgba(99,102,241,0.25)' : 'transparent',
                            color: billingViewMode === 'table' ? '#818cf8' : 'var(--text-secondary)',
                            border: billingViewMode === 'table' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                            borderRadius: 6, padding: '0.28rem 0.6rem', fontSize: '0.74rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                          title="Compact Table View"
                        >
                          <List size={13} /> Table
                        </button>
                      </div>

                      {/* Add Bill Record Button */}
                      {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            padding: '0.42rem 0.85rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer'
                          }}
                          onClick={openAddBillModal}
                        >
                          <Plus size={14} /> Add Bill Record
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KPI Quick Cards (Summary strip above bills) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', width: '100%' }}>
                    {/* Total Settled */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--text-secondary)' }}>Total Settled</span>
                        <CheckCircle size={15} color="#10b981" />
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
                        {formatLKR(totalSettledAmt)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Cumulative payments released
                      </div>
                    </div>

                    {/* Current Outstanding */}
                    <div style={{ background: latestOutstandingAmt > 0 ? 'rgba(245, 158, 11, 0.06)' : 'rgba(16, 185, 129, 0.04)', border: latestOutstandingAmt > 0 ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(16, 185, 129, 0.15)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--text-secondary)' }}>Current Outstanding</span>
                        <AlertCircle size={15} color={latestOutstandingAmt > 0 ? '#f59e0b' : '#10b981'} />
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: latestOutstandingAmt > 0 ? '#f59e0b' : '#10b981', letterSpacing: '-0.02em' }}>
                        {latestOutstandingAmt > 0 ? formatLKR(latestOutstandingAmt) : 'LKR 0.00'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {latestOutstandingAmt > 0 ? 'Pending bill set-off' : 'Account balance cleared'}
                      </div>
                    </div>

                    {/* Total kWh Sales */}
                    <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--text-secondary)' }}>Solar Generation Sold</span>
                        <Zap size={15} color="#38bdf8" />
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.02em' }}>
                        {formatLKR(totalGrossSales)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Exported: {totalExportUnits.toLocaleString()} kWh
                      </div>
                    </div>

                    {/* Multi-Payment Obligations */}
                    <div style={{ background: 'rgba(129, 140, 248, 0.05)', border: '1px solid rgba(129, 140, 248, 0.2)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--text-secondary)' }}>Multiple Payments</span>
                        <Layers size={15} color="#818cf8" />
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#818cf8', letterSpacing: '-0.02em' }}>
                        {multiPaymentRecordsCount} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Obligations</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {multiPaymentRecordsCount > 0 ? 'Multiple payments detected' : 'Standard monthly billing'}
                      </div>
                    </div>
                  </div>

                  {/* Search, Filter Tabs & Sort Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.85rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Search input */}
                    <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '320px' }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Search Ref No, Month, or Date..."
                        value={billingSearchTerm}
                        onChange={(e) => setBillingSearchTerm(e.target.value)}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 7, padding: '0.38rem 0.7rem 0.38rem 2rem',
                          color: 'white', fontSize: '0.78rem'
                        }}
                      />
                      {billingSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setBillingSearchTerm('')}
                          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {[
                        { key: 'ALL', label: 'All Bills', count: totalBillsCount },
                        { key: 'SETTLED', label: 'Settled', count: (billingHistory || []).filter(b => Number(b.paymentSettled || 0) > 0).length },
                        { key: 'OUTSTANDING', label: 'Has Outstanding', count: (billingHistory || []).filter(b => Number(b.outstandingBalance || 0) > 0).length },
                        { key: 'MULTI_PAYMENT', label: 'Multiple Payments', count: multiPaymentRecordsCount, highlight: true }
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setBillingFilterStatus(tab.key)}
                          style={{
                            background: billingFilterStatus === tab.key ? (tab.highlight ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.1)') : 'transparent',
                            color: billingFilterStatus === tab.key ? (tab.highlight ? '#818cf8' : 'white') : 'var(--text-secondary)',
                            border: billingFilterStatus === tab.key ? (tab.highlight ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(255,255,255,0.18)') : '1px solid transparent',
                            borderRadius: 6, padding: '0.3rem 0.65rem', fontSize: '0.74rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                        >
                          <span>{tab.label}</span>
                          <span style={{
                            background: billingFilterStatus === tab.key ? (tab.highlight ? '#818cf8' : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.06)',
                            color: billingFilterStatus === tab.key ? '#000' : 'var(--text-muted)',
                            fontSize: '0.66rem', fontWeight: 700, padding: '0.05rem 0.35rem', borderRadius: 10
                          }}>
                            {tab.count}
                          </span>
                        </button>
                      ))}

                      {/* Sort Order Toggle */}
                      <button
                        type="button"
                        onClick={() => setBillingSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.74rem', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer'
                        }}
                        title={billingSortOrder === 'DESC' ? 'Sorted Newest First' : 'Sorted Oldest First'}
                      >
                        <ArrowUpDown size={12} /> {billingSortOrder === 'DESC' ? 'Newest' : 'Oldest'}
                      </button>
                    </div>
                  </div>

                  {/* Main Content Area: Loading / Empty / Cards / Table */}
                  {historyLoading ? (
                    /* Shimmer Loading Skeleton */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="card skeleton" style={{ height: '140px', borderRadius: 12, border: 'none' }}></div>
                      ))}
                    </div>
                  ) : filtered.length === 0 ? (
                    /* Empty State */
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                      <History size={36} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>No Billing Records Found</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem', maxWidth: 360, margin: '0.3rem auto 1rem' }}>
                        {billingSearchTerm || billingFilterStatus !== 'ALL'
                          ? 'No bills match your current search or filter criteria. Try clearing filters.'
                          : 'No historical billing ledger records have been logged for this customer account.'}
                      </div>
                      {(billingSearchTerm || billingFilterStatus !== 'ALL') ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}
                          onClick={() => { setBillingSearchTerm(''); setBillingFilterStatus('ALL'); }}
                        >
                          Clear Filters
                        </button>
                      ) : (user?.role === 'ADMIN' || user?.role === 'OFFICER') ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}
                          onClick={openAddBillModal}
                        >
                          <Plus size={14} /> Add First Bill Record
                        </button>
                      ) : null}
                    </div>
                  ) : billingViewMode === 'cards' ? (
                    /* ── CARDS & TIMELINE VIEW (Zero Horizontal Scroll) ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {monthGroups.map(grp => (
                        <div key={grp.monthKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          
                          {/* Month Group Header */}
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
                            padding: '0.5rem 0.85rem',
                            background: grp.isMultiMonth ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                            border: grp.isMultiMonth ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 10
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <Calendar size={15} color={grp.isMultiMonth ? '#818cf8' : '#38bdf8'} />
                              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'white' }}>{grp.monthKey}</span>
                              {grp.isMultiMonth && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                  fontSize: '0.7rem', fontWeight: 700,
                                  background: 'rgba(99,102,241,0.18)', color: '#818cf8',
                                  border: '1px solid rgba(99,102,241,0.35)',
                                  padding: '0.15rem 0.5rem', borderRadius: 12
                                }}>
                                  <Layers size={11} /> Multiple Payments ({grp.bills.length} Records)
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.76rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Period Settled: <strong style={{ color: '#10b981' }}>{formatLKR(grp.totalSettled)}</strong>
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>•</span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Gross Sales: <strong style={{ color: '#38bdf8' }}>{formatLKR(grp.totalSales)}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Cards for each obligation in this month */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: grp.isMultiMonth ? '0.75rem' : '0', borderLeft: grp.isMultiMonth ? '2px solid rgba(99,102,241,0.3)' : 'none' }}>
                            {grp.bills.map((bill, idx) => {
                              const perf = calculatePerformanceScore(
                                bill.kwhExport != null ? bill.kwhExport : bill.exportUnits,
                                selectedCustomer?.panelCapacity
                              );
                              const status = getBillPaymentStatus(bill);
                              const settledAmt = bill.paymentSettled != null ? bill.paymentSettled : bill.payment;
                              const outstandingAmt = Number(bill.outstandingBalance || 0);
                              const grossSalesAmt = bill.energyPurchase != null ? bill.energyPurchase : bill.totalAmount;
                              const isMultiObligation = grp.bills.length > 1;
                              const isExpanded = !!expandedBillIds[bill.billingId];

                              return (
                                <div
                                  key={bill.billingId}
                                  style={{
                                    background: 'rgba(255,255,255,0.025)',
                                    border: isMultiObligation ? '1px solid rgba(129,140,248,0.22)' : '1px solid rgba(255,255,255,0.07)',
                                    borderLeft: isMultiObligation ? '4px solid #818cf8' : '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: 12,
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.9rem',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                  }}
                                >
                                  {/* Card Top Strip */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      {/* Obligation index pill if multi-payment */}
                                      {isMultiObligation && (
                                        <span style={{
                                          background: idx === 0 ? 'rgba(99,102,241,0.2)' : 'rgba(168,85,247,0.2)',
                                          color: idx === 0 ? '#818cf8' : '#c084fc',
                                          border: idx === 0 ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(168,85,247,0.35)',
                                          padding: '0.15rem 0.55rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700
                                        }}>
                                          Obligation #{idx + 1} of {grp.bills.length} {idx > 0 ? '• Additional Payment' : ''}
                                        </span>
                                      )}

                                      {/* Ref No */}
                                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: 'white', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                                        Ref: {bill.refNo || '—'}
                                      </span>

                                      {/* Payment / Billing Mode badge */}
                                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontWeight: 600 }}>
                                        {bill.billingMode || 'Fixed'}
                                      </span>

                                      {/* Solar Yield Performance Badge */}
                                      <span className={`badge ${perf.class}`} style={{ textTransform: 'capitalize', fontSize: '0.7rem', fontWeight: 600 }}>
                                        {perf.text} Yield
                                      </span>

                                      {/* Status chip */}
                                      <span style={{
                                        fontSize: '0.7rem', fontWeight: 700,
                                        padding: '0.15rem 0.55rem', borderRadius: 12,
                                        background: status.bg, color: status.color, border: `1px solid ${status.border}`
                                      }}>
                                        {status.label}
                                      </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: 6 }}
                                        onClick={() => handleOpenBillEdit(bill)}
                                      >
                                        <Edit size={12} /> Edit
                                      </button>
                                      {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
                                        <button
                                          type="button"
                                          className="btn btn-primary"
                                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: 6 }}
                                          onClick={() => handleDeleteBill(bill.billingId)}
                                        >
                                          <Trash2 size={12} /> Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Hero Financial Values Strip (The 3 Core Numbers) */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '0.75rem',
                                    background: 'rgba(0,0,0,0.22)',
                                    borderRadius: 10,
                                    padding: '0.85rem 1rem',
                                    border: '1px solid rgba(255,255,255,0.04)'
                                  }}>
                                    {/* 1. Payment Settled (Hero) */}
                                    <div>
                                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                                        <CheckCircle size={13} color="#10b981" /> Payment Settled
                                      </div>
                                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
                                        {settledAmt != null ? formatLKR(settledAmt) : '—'}
                                      </div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                        Disbursed to customer bank
                                      </div>
                                    </div>

                                    {/* 2. Outstanding Balance (Hero) */}
                                    <div>
                                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                                        <AlertCircle size={13} color={outstandingAmt > 0 ? '#f59e0b' : '#10b981'} /> Outstanding Balance
                                      </div>
                                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: outstandingAmt > 0 ? '#f59e0b' : '#10b981', letterSpacing: '-0.02em' }}>
                                        {formatLKR(outstandingAmt)}
                                      </div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                        {outstandingAmt > 0 ? 'Remaining payable set-off' : 'Nil / Fully cleared'}
                                      </div>
                                    </div>

                                    {/* 3. Energy Purchase / Gross Sales */}
                                    <div>
                                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                                        <DollarSign size={13} color="#38bdf8" /> kWh Sales Revenue
                                      </div>
                                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.02em' }}>
                                        {grossSalesAmt != null ? formatLKR(grossSalesAmt) : '—'}
                                      </div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                        Gross energy purchase amount
                                      </div>
                                    </div>
                                  </div>

                                  {/* Secondary Metrics Strip: Reading Interval & Solar Generation (4 Columns, Fluid) */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                    gap: '0.6rem',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-secondary)'
                                  }}>
                                    {/* Reading Period */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Clock size={11} /> Reading Dates
                                      </div>
                                      <div style={{ fontWeight: 600, color: 'white', marginTop: '0.2rem', fontSize: '0.74rem' }}>
                                        {bill.prevReadingDate || '—'} <span style={{ color: 'var(--text-muted)' }}>→</span> {bill.currReadingDate || '—'}
                                      </div>
                                    </div>

                                    {/* kWh Export */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <TrendingUp size={11} color="#10b981" /> kWh Export
                                      </div>
                                      <div style={{ fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
                                        {(bill.kwhExport != null ? bill.kwhExport : bill.exportUnits || 0).toLocaleString()} kWh
                                      </div>
                                    </div>

                                    {/* kWh Import */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <TrendingDown size={11} color="#f59e0b" /> kWh Import
                                      </div>
                                      <div style={{ fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
                                        {(bill.kwhImport != null ? bill.kwhImport : bill.importUnits || 0).toLocaleString()} kWh
                                      </div>
                                    </div>

                                    {/* kWh Sales / Net */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Zap size={11} color="#38bdf8" /> Net Unit Sales
                                      </div>
                                      <div style={{ fontWeight: 700, color: (bill.kwhSales != null ? bill.kwhSales : bill.netUnit || 0) >= 0 ? '#10b981' : '#ef4444', marginTop: '0.2rem' }}>
                                        {(bill.kwhSales != null ? bill.kwhSales : bill.netUnit || 0) > 0 ? '+' : ''}{(bill.kwhSales != null ? bill.kwhSales : bill.netUnit || 0).toLocaleString()} kWh
                                      </div>
                                    </div>
                                  </div>

                                  {/* Deductions & Set-Off Strip (if applicable) */}
                                  {(bill.billSetOff != null || bill.retentionMoney != null) && (
                                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.74rem', padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.015)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
                                      {bill.billSetOff != null && (
                                        <span>
                                          <strong style={{ color: 'var(--text-muted)' }}>Bill Set-Off:</strong>{' '}
                                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{formatLKR(bill.billSetOff)}</span>
                                        </span>
                                      )}
                                      {bill.retentionMoney != null && (
                                        <span>
                                          <strong style={{ color: 'var(--text-muted)' }}>Retention Money:</strong>{' '}
                                          <span style={{ color: '#c084fc', fontWeight: 600 }}>{formatLKR(bill.retentionMoney)}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Expandable Technical Ledger Details Drawer */}
                                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandDetails(bill.billingId)}
                                      style={{
                                        background: 'transparent', border: 'none', color: 'var(--text-muted)',
                                        fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', padding: 0
                                      }}
                                    >
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      <span>{isExpanded ? 'Hide Technical Ledger Details' : 'View Technical Ledger Details'}</span>
                                    </button>

                                    {isExpanded && (
                                      <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem',
                                        padding: '0.65rem 0.85rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.72rem'
                                      }}>
                                        <div>
                                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Unit Rate / Tariff:</span>
                                          <span style={{ color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{bill.unitCost != null ? formatLKR(bill.unitCost) : '—'}</span>
                                        </div>
                                        <div>
                                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Billing Cycle:</span>
                                          <span style={{ color: 'white', fontWeight: 600 }}>{bill.billCycle || '—'}</span>
                                        </div>
                                        <div>
                                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Upload History ID:</span>
                                          <span style={{ color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{bill.uploadHistoryId || 'Manual / Initial'}</span>
                                        </div>
                                        <div>
                                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Logged Timestamp:</span>
                                          <span style={{ color: 'white', fontWeight: 600 }}>{bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : '—'}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* ── COMPACT RESPONSIVE TABLE VIEW (Zero Horizontal Scroll) ── */
                    <div style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', tableLayout: 'auto' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Period & Obligation</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Ref & Mode</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Solar Units (kWh)</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Payment Settled</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Outstanding</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((bill, i) => {
                            const perf = calculatePerformanceScore(
                              bill.kwhExport != null ? bill.kwhExport : bill.exportUnits,
                              selectedCustomer?.panelCapacity
                            );
                            const status = getBillPaymentStatus(bill);
                            const m = getBillMonth(bill);
                            const isMulti = (monthCounts[m] || 0) > 1;
                            const settledAmt = bill.paymentSettled != null ? bill.paymentSettled : bill.payment;
                            const outstandingAmt = Number(bill.outstandingBalance || 0);

                            return (
                              <tr
                                key={bill.billingId}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  borderLeft: isMulti ? '3px solid #818cf8' : '3px solid transparent',
                                  background: isMulti ? 'rgba(129,140,248,0.02)' : (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')
                                }}
                              >
                                {/* Period & Obligation */}
                                <td style={{ padding: '0.6rem 0.85rem' }}>
                                  <div style={{ fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    {m}
                                    {isMulti && (
                                      <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.18)', color: '#818cf8', padding: '0.05rem 0.35rem', borderRadius: 4, fontWeight: 700 }}>
                                        Multi-Pay
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                    {bill.prevReadingDate || '—'} → {bill.currReadingDate || '—'}
                                  </div>
                                </td>

                                {/* Ref & Mode */}
                                <td style={{ padding: '0.6rem 0.85rem' }}>
                                  <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'white' }}>{bill.refNo || '—'}</div>
                                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.15rem' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#38bdf8' }}>{bill.billingMode || 'Fixed'}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>•</span>
                                    <span className={`badge ${perf.class}`} style={{ fontSize: '0.62rem', padding: '0.05rem 0.3rem' }}>
                                      {perf.text}
                                    </span>
                                  </div>
                                </td>

                                {/* Solar Units */}
                                <td style={{ padding: '0.6rem 0.85rem' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ color: '#10b981', fontWeight: 600 }} title="kWh Export">
                                      +{(bill.kwhExport != null ? bill.kwhExport : bill.exportUnits || 0).toLocaleString()}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)' }}>/</span>
                                    <span style={{ color: '#f59e0b', fontWeight: 600 }} title="kWh Import">
                                      -{(bill.kwhImport != null ? bill.kwhImport : bill.importUnits || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                    Net: {(bill.kwhSales != null ? bill.kwhSales : bill.netUnit || 0).toLocaleString()} kWh
                                  </div>
                                </td>

                                {/* Payment Settled */}
                                <td style={{ padding: '0.6rem 0.85rem' }}>
                                  <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.85rem' }}>
                                    {settledAmt != null ? formatLKR(settledAmt) : '—'}
                                  </div>
                                  <span style={{
                                    fontSize: '0.64rem', fontWeight: 700, padding: '0.05rem 0.35rem', borderRadius: 8,
                                    background: status.bg, color: status.color, display: 'inline-block', marginTop: '0.15rem'
                                  }}>
                                    {status.label}
                                  </span>
                                </td>

                                {/* Outstanding */}
                                <td style={{ padding: '0.6rem 0.85rem' }}>
                                  <div style={{ fontWeight: 700, color: outstandingAmt > 0 ? '#f59e0b' : '#10b981' }}>
                                    {formatLKR(outstandingAmt)}
                                  </div>
                                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                    {outstandingAmt > 0 ? 'Due' : 'Cleared'}
                                  </div>
                                </td>

                                {/* Actions */}
                                <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}
                                      onClick={() => handleOpenBillEdit(bill)}
                                    >
                                      Edit
                                    </button>
                                    {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                                        onClick={() => handleDeleteBill(bill.billingId)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

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

            {/* TAB CONTENT: PAYMENT CONTROL */}
            {activeTab === 'payment' && (() => {
              const dossier = paymentDossier;
              const months = dossier?.months || [];
              const selectedMonthObj = months.find(m => m.billingMonth === selectedDossierMonth) || months[0] || null;

              if (paymentDossierLoading) {
                return (
                  <div className="animate-fade-in" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <div className="skeleton" style={{ width: '45px', height: '45px', borderRadius: '50%' }}></div>
                      <div className="skeleton" style={{ width: '240px', height: '20px', borderRadius: '4px' }}></div>
                      <div className="skeleton" style={{ width: '100%', height: '140px', borderRadius: '12px' }}></div>
                      <div className="skeleton" style={{ width: '100%', height: '300px', borderRadius: '12px' }}></div>
                    </div>
                  </div>
                );
              }

              if (!dossier) {
                return (
                  <div className="animate-fade-in" style={{ padding: '3.5rem 1.5rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <CreditCard size={38} style={{ color: '#f59e0b', opacity: 0.8, marginBottom: '0.75rem' }} />
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'white' }}>Payment Control Dossier</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.5rem auto 1.5rem', maxWidth: '440px' }}>
                      Fetch the complete month-wise financial ledger, eligibility checks, and diagnostics for account {selectedCustomer?.accountNo}.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => fetchPaymentDossier(selectedCustomer?.accountNo)}
                      style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                    >
                      Load Payment Control Dossier
                    </button>
                  </div>
                );
              }

              const latestStatus = dossier.latestPaymentStatus || 'ON_HOLD';
              const isEligible = Boolean(dossier.isPaymentEligible);

              return (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Canonical Summary Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%)',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '1.25rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', color: '#38bdf8' }}>
                            {dossier.accountNo}
                          </span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                            {dossier.customerName || selectedCustomer?.customerName}
                          </span>
                          <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0.15rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                            {dossier.solarType || selectedCustomer?.solarType || 'Net Plus'}
                          </span>
                          {dossier.division && (
                            <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '0.15rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                              <MapPin size={11} style={{ marginRight: '3px' }} />
                              {dossier.division.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.35rem' }}>
                          Active Billing Cycle: <strong style={{ color: 'white' }}>{dossier.latestBillingMonth || '—'}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: '0.03em',
                          background: isEligible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isEligible ? '#10b981' : '#f87171',
                          border: `1px solid ${isEligible ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
                        }}>
                          {isEligible ? '✓ PAYMENT ELIGIBLE' : '⚠ PAYMENT ON HOLD'}
                        </span>
                        <span style={{
                          padding: '0.3rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          background: latestStatus === 'READY' ? 'rgba(16, 185, 129, 0.2)' : latestStatus === 'PAID' ? 'rgba(5, 150, 105, 0.2)' : latestStatus === 'REVIEW' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: latestStatus === 'READY' ? '#10b981' : latestStatus === 'PAID' ? '#059669' : latestStatus === 'REVIEW' ? '#c084fc' : '#f59e0b',
                          border: `1px solid ${latestStatus === 'READY' ? 'rgba(16, 185, 129, 0.4)' : latestStatus === 'PAID' ? 'rgba(5, 150, 105, 0.4)' : latestStatus === 'REVIEW' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                        }}>
                          {latestStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Financial KPI 5-Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Current Payment</div>
                        <div style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', marginTop: '0.2rem' }}>
                          LKR {Number(dossier.currentPayment || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Bill Set-Off</div>
                        <div style={{ color: '#fbbf24', fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', marginTop: '0.2rem' }}>
                          LKR {Number(dossier.billSetOff || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Retention Money</div>
                        <div style={{ color: '#c084fc', fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', marginTop: '0.2rem' }}>
                          LKR {Number(dossier.retentionMoney || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding Balance</div>
                        <div style={{ color: '#f87171', fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', marginTop: '0.2rem' }}>
                          LKR {Number(dossier.outstandingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '0.75rem' }}>
                        <div style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Payable</div>
                        <div style={{ color: '#10b981', fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', marginTop: '0.2rem' }}>
                          LKR {Number(dossier.totalPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Month-Wise Payment History Timeline & Strict Isolation */}
                  <div className="card" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                          <Calendar size={16} style={{ color: '#38bdf8' }} />
                          <span>Month-Wise Payment History & Isolation</span>
                        </h4>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                          Each month maintains independent financials, status, and diagnostics.
                        </div>
                      </div>

                      {/* Month pills selector */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {months.map(m => {
                          const isSel = selectedMonthObj?.billingMonth === m.billingMonth;
                          const mStatus = m.paymentStatus || 'ON_HOLD';
                          return (
                            <button
                              key={m.billingMonth + m.snapshotId}
                              onClick={() => setSelectedDossierMonth(m.billingMonth)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                background: isSel ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                border: isSel ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                color: isSel ? 'white' : 'var(--text-secondary)'
                              }}
                            >
                              <span>{m.billingMonth}</span>
                              <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: mStatus === 'READY' ? '#10b981' : mStatus === 'PAID' ? '#059669' : mStatus === 'REVIEW' ? '#c084fc' : '#f59e0b'
                              }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Month Detail View */}
                    {selectedMonthObj ? (() => {
                      const m = selectedMonthObj;
                      const mStatus = m.paymentStatus || 'ON_HOLD';
                      const cat = m.categorizedIssues || {};
                      const hasMismatches = (cat.mismatches || []).length > 0;
                      const hasMissing = (cat.missingDetails || []).length > 0;
                      const hasValErrors = (cat.validationErrors || []).length > 0;
                      const hasHolds = (cat.holds || []).length > 0;
                      const hasOutstanding = (cat.outstanding || []).length > 0;
                      const hasAnyIssues = hasMismatches || hasMissing || hasValErrors || hasHolds || hasOutstanding;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                          {/* Selected Month Header Strip */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                          }}>
                            <div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>
                                {m.billingMonth} • <span style={{ color: '#38bdf8', fontWeight: 500 }}>{m.division} Division</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                Snapshot: {m.datasetName || m.billingMonth} {m.approvalDate ? `• Approved ${String(m.approvalDate).substring(0, 10)}` : ''}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payable for this Month</div>
                                <div style={{ color: '#10b981', fontWeight: 800, fontFamily: 'monospace', fontSize: '1.05rem' }}>
                                  LKR {Number(m.financials?.totalPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <span style={{
                                padding: '0.3rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                background: mStatus === 'READY' ? 'rgba(16, 185, 129, 0.2)' : mStatus === 'PAID' ? 'rgba(5, 150, 105, 0.2)' : mStatus === 'REVIEW' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: mStatus === 'READY' ? '#10b981' : mStatus === 'PAID' ? '#059669' : mStatus === 'REVIEW' ? '#c084fc' : '#f59e0b',
                                border: `1px solid ${mStatus === 'READY' ? 'rgba(16, 185, 129, 0.4)' : mStatus === 'PAID' ? 'rgba(5, 150, 105, 0.4)' : mStatus === 'REVIEW' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                              }}>
                                {mStatus.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          {/* "Why is this payment on hold?" Diagnostics Panel */}
                          {(mStatus !== 'PAID' && (hasAnyIssues || mStatus !== 'READY')) && (
                            <div style={{
                              background: 'rgba(245, 158, 11, 0.05)',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              borderRadius: '12px',
                              padding: '1.1rem'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                                  <h5 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                                    Why is this payment on hold for {m.billingMonth}?
                                  </h5>
                                </div>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => handleOpenResolveModal(m)}
                                  style={{
                                    padding: '0.35rem 0.85rem',
                                    fontSize: '0.78rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    background: '#f59e0b',
                                    color: '#000',
                                    fontWeight: 700,
                                    border: 'none',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <Edit size={13} />
                                  <span>Resolve Issue</span>
                                </button>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                {/* Category 1: MISMATCH */}
                                {hasMismatches && (
                                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
                                    <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                      🔴 Data Mismatch Detected (Master Data vs Billing Source)
                                    </div>
                                    <ul style={{ margin: '0.3rem 0 0 1.1rem', padding: 0, fontSize: '0.8rem', color: '#fca5a5' }}>
                                      {cat.mismatches.map((item, idx) => (
                                        <li key={idx} style={{ marginTop: '0.15rem' }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Category 2: MISSING_DETAILS */}
                                {hasMissing && (
                                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '3px solid #f59e0b', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
                                    <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                      🟡 Missing Required Customer Information
                                    </div>
                                    <ul style={{ margin: '0.3rem 0 0 1.1rem', padding: 0, fontSize: '0.8rem', color: '#fde68a' }}>
                                      {cat.missingDetails.map((item, idx) => (
                                        <li key={idx} style={{ marginTop: '0.15rem' }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Category 3: VALIDATION_ERROR */}
                                {hasValErrors && (
                                  <div style={{ background: 'rgba(249, 115, 22, 0.1)', borderLeft: '3px solid #f97316', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
                                    <div style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                      🟠 Staging / File Validation Error
                                    </div>
                                    <ul style={{ margin: '0.3rem 0 0 1.1rem', padding: 0, fontSize: '0.8rem', color: '#fed7aa' }}>
                                      {cat.validationErrors.map((item, idx) => (
                                        <li key={idx} style={{ marginTop: '0.15rem' }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Category 4: HOLD_ACTIVE */}
                                {hasHolds && (
                                  <div style={{ background: 'rgba(56, 189, 248, 0.1)', borderLeft: '3px solid #38bdf8', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
                                    <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                      🔵 Manual Payment Hold Flag Active
                                    </div>
                                    <ul style={{ margin: '0.3rem 0 0 1.1rem', padding: 0, fontSize: '0.8rem', color: '#bae6fd' }}>
                                      {cat.holds.map((item, idx) => (
                                        <li key={idx} style={{ marginTop: '0.15rem' }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Category 5: OUTSTANDING */}
                                {hasOutstanding && (
                                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', borderLeft: '3px solid #a855f7', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
                                    <div style={{ color: '#c084fc', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                      🟣 Financial / Payable Condition
                                    </div>
                                    <ul style={{ margin: '0.3rem 0 0 1.1rem', padding: 0, fontSize: '0.8rem', color: '#e9d5ff' }}>
                                      {cat.outstanding.map((item, idx) => (
                                        <li key={idx} style={{ marginTop: '0.15rem' }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* If READY: Success Card */}
                          {mStatus === 'READY' && (
                            <div style={{
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '10px',
                              padding: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <CheckCircle size={22} style={{ color: '#10b981' }} />
                                <div>
                                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>
                                    Payment Ready for {m.billingMonth}
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                    All 11 enterprise payment-eligibility rules passed. This record can be included in a payment batch.
                                  </div>
                                </div>
                              </div>
                              <button
                                className="btn btn-secondary"
                                onClick={() => navigate(`/payments?billingPeriod=${encodeURIComponent(m.billingMonth)}`)}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                              >
                                Go to Payment Control Center →
                              </button>
                            </div>
                          )}

                          {/* If PAID: Settlement Info */}
                          {mStatus === 'PAID' && (
                            <div style={{
                              background: 'rgba(5, 150, 105, 0.1)',
                              border: '1px solid rgba(5, 150, 105, 0.3)',
                              borderRadius: '10px',
                              padding: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem'
                            }}>
                              <CheckCircle size={22} style={{ color: '#059669' }} />
                              <div>
                                <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.9rem' }}>
                                  Payment Settled & Disbursed
                                </div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                  Payment settled in Batch #{m.batchInfo?.batchNumber || '—'} on {m.batchInfo?.processedAt ? String(m.batchInfo.processedAt).substring(0, 10) : '—'}. Total: LKR {Number(m.financials?.totalPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}.
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Side-by-Side Comparison Table */}
                          <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', textTransform: 'uppercase' }}>
                                Side-by-Side Comparison: Master Data vs Uploaded Source ({m.billingMonth})
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Evaluated in snapshot #{m.snapshotId}
                              </span>
                            </div>
                            <table className="custom-table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th>FIELD</th>
                                  <th>MASTER DATA VALUE</th>
                                  <th>UPLOADED / BILLING VALUE</th>
                                  <th style={{ textAlign: 'center' }}>STATUS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(m.comparisons || []).map((c, idx) => {
                                  const isMism = c.isMismatch;
                                  return (
                                    <tr key={idx} style={{ background: isMism ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                                      <td style={{ fontWeight: 600, color: 'white' }}>{c.field}</td>
                                      <td style={{ color: 'var(--text-secondary)' }}>{String(c.masterValue || '—')}</td>
                                      <td style={{ color: isMism ? '#f87171' : 'var(--text-secondary)', fontWeight: isMism ? 600 : 400 }}>
                                        {String(c.sourceValue || '—')}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {isMism ? (
                                          <span className="badge danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                            MISMATCH
                                          </span>
                                        ) : (
                                          <span className="badge success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                            MATCH
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Missing Fields Checklist */}
                          {(m.missingFields || []).length > 0 && (
                            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                Missing Required Information for this Month:
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {m.missingFields.map((f, idx) => (
                                  <span key={idx} style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No monthly billing snapshots found for this customer.
                      </div>
                    )}
                  </div>

                  {/* Payment Batch History Table */}
                  {dossier.batchHistory && dossier.batchHistory.length > 0 && (
                    <div className="card" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <History size={15} style={{ color: '#818cf8' }} />
                        <span>Payment Batch History</span>
                      </h4>
                      <div className="table-container" style={{ margin: 0 }}>
                        <table className="custom-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>BATCH NUMBER</th>
                              <th>BILLING PERIOD</th>
                              <th>SETTLED AMOUNT</th>
                              <th>STATUS</th>
                              <th>CREATED DATE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dossier.batchHistory.map((bh, idx) => (
                              <tr key={idx}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8' }}>{bh.batchNumber}</td>
                                <td>{bh.billingPeriod}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>
                                  LKR {Number(bh.totalPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td>
                                  <span className="badge" style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                    {bh.paymentStatus}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {bh.createdAt ? String(bh.createdAt).substring(0, 10) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        )}
      </div>

      {/* Resolve Issue & Re-evaluate Modal */}
      {resolveModalOpen && resolveTargetMonth && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250, padding: '1.5rem' }}>
          <div className="neon-card animate-fade-in" style={{ width: '100%', maxWidth: '640px', padding: '1.75rem', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>
                  Resolve Payment Issue — {resolveTargetMonth.billingMonth}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Account: <strong style={{ color: '#38bdf8' }}>{selectedCustomer?.accountNo}</strong> • Target Snapshot: #{resolveTargetMonth.snapshotId}
                </div>
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => setResolveModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#bae6fd' }}>
                💡 <strong>Automatic Re-validation:</strong> Correcting these values updates the archived {resolveTargetMonth.billingMonth} dataset and immediately re-evaluates all 11 enterprise payment eligibility checks. If all issues are resolved, the payment status automatically promotes to <strong>READY</strong>.
              </div>

              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input
                  type="text"
                  className="login-form-input"
                  value={resolveForm.customerName || ''}
                  onChange={(e) => setResolveForm({ ...resolveForm, customerName: e.target.value })}
                  placeholder="Enter correct customer name"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Solar Net Type</label>
                  <select
                    className="login-form-input"
                    value={resolveForm.solarType || 'Net Plus'}
                    onChange={(e) => setResolveForm({ ...resolveForm, solarType: e.target.value })}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="Net Metering">Net Metering</option>
                    <option value="Net Accounting">Net Accounting</option>
                    <option value="Net Plus">Net Plus</option>
                    <option value="Net Plus Plus">Net Plus Plus</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Rate (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={resolveForm.unitRate ?? ''}
                    onChange={(e) => setResolveForm({ ...resolveForm, unitRate: e.target.value })}
                    placeholder="e.g. 22.00"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Bank Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={resolveForm.bankCode || ''}
                    onChange={(e) => setResolveForm({ ...resolveForm, bankCode: e.target.value })}
                    placeholder="e.g. 7010"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={resolveForm.branchCode || ''}
                    onChange={(e) => setResolveForm({ ...resolveForm, branchCode: e.target.value })}
                    placeholder="e.g. 001"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bank Account Number</label>
                <input
                  type="text"
                  className="login-form-input"
                  value={resolveForm.bankAccountNo || ''}
                  onChange={(e) => setResolveForm({ ...resolveForm, bankAccountNo: e.target.value })}
                  placeholder="Enter bank account number"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={resolveForm.mobileNo || ''}
                    onChange={(e) => setResolveForm({ ...resolveForm, mobileNo: e.target.value })}
                    placeholder="e.g. 0771234567"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Agreement Date</label>
                  <input
                    type="date"
                    className="login-form-input"
                    value={resolveForm.agreementDate || ''}
                    onChange={(e) => setResolveForm({ ...resolveForm, agreementDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResolveModalOpen(false)}
                disabled={resolveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveCorrection}
                disabled={resolveLoading}
                style={{ background: '#10b981', color: 'white', fontWeight: 700, border: 'none' }}
              >
                {resolveLoading ? 'Re-evaluating...' : 'Save & Re-evaluate Eligibility'}
              </button>
            </div>
          </div>
        </div>
      )}

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
