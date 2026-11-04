import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, FolderOpen, Pencil, Trash2, Download, X, Loader, XCircle,
  Calendar, Users, CheckCircle, Clock, RefreshCw, FileSpreadsheet,
  Edit3, History, AlertTriangle, ShieldCheck, RotateCcw, Save, Search, Eye,
  ChevronDown, Check, MapPin, ArrowLeft, Plus, CloudUpload,
  Sun, TrendingUp, ZapOff, Layers, UserX, ArrowUpDown, AlertCircle, Phone,
  Zap, DollarSign, Landmark, User, Copy, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
// Same agreement-expiry rules as Step 6 (Agreement Date + 7 years, categorized against the
// billing month window) — reused so the directory never invents its own expiry semantics.
import { computeAgreementExpiry, agreementExpiryStatus } from './UploadPage';

// The 5 fixed Eastern Province divisions every Billing Month is organized into (mirrors the
// backend's MonthlyDirectoryService.DIVISIONS — the server list wins when provided).
const EASTERN_DIVISIONS = ['Ampara', 'Batticaloa', 'Trincomalee', 'Valaichenai', 'Kalmunai'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Per-division upload/approval status shown on the modern division cards.
const DIVISION_STATUS = {
  NOT_UPLOADED: { label: 'Not Uploaded', color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', progress: 0 },
  PENDING: { label: 'Pending', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A', progress: 60 },
  APPROVED: { label: 'Approved', color: '#166534', bg: '#DCFCE7', border: '#BBF7D0', progress: 100 },
};

// Field groups shown on every Customer Card / detail view — grouped by merged source file,
// exactly as saved from Step 6 (the snapshot is only loaded, never rebuilt or recompared).
export const CARD_SECTIONS = [
  {
    title: 'Customer Data', color: '#38bdf8',
    fields: [
      { label: 'Address', keys: ['customerAddress'] },
      { label: 'Mobile', keys: ['mobileNo'] },
      { label: 'Agreement Date', keys: ['agreementDate'] },
      { label: 'Net Type', keys: ['masterNetType', 'solarType'] },
      { label: 'Unit Rate', keys: ['masterUnitRate', 'unitRate'] },
      { label: 'Bank Code/Acct', bank: true },
      { label: 'Panel Capacity', keys: ['panelCapacity'] },
    ],
  },
  {
    title: 'CEB Utility', color: '#f59e0b',
    fields: [
      { label: 'Previous Reading', keys: ['prevReadingDate'] },
      { label: 'Current Reading', keys: ['currReadingDate'] },
    ],
  },
  {
    title: 'NGEN Data', color: '#818cf8',
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
    title: 'NPAY Data', color: '#c084fc',
    fields: [
      { label: 'Energy Purchase', keys: ['npayEnergyPurchase'] },
      { label: 'Bill Set Off', keys: ['npayBillSetOff'] },
      { label: 'Retention Money', keys: ['npayRetentionMoney'] },
      { label: 'Payment', keys: ['npayPayment'] },
    ],
  },
];

export const getFieldIcon = (label) => {
  const l = (label || '').toLowerCase();
  if (l.includes('address')) return MapPin;
  if (l.includes('mobile') || l.includes('phone')) return Phone;
  if (l.includes('date') || l.includes('agreement')) return Calendar;
  if (l.includes('net') || l.includes('solar')) return Sun;
  if (l.includes('rate') || l.includes('amount') || l.includes('purchase')) return DollarSign;
  if (l.includes('bank')) return Landmark;
  if (l.includes('panel') || l.includes('capacity') || l.includes('kwh') || l.includes('energy') || l.includes('sales')) return Zap;
  if (l.includes('reading')) return Clock;
  return FileText;
};

// Fields a user may edit in the post-Step-6 working area. Editing these and revalidating re-runs
// the exact same validation rules server-side (nothing is auto-corrected).
export const EDIT_FIELDS = [
  { key: 'npayName', label: 'Name' },
  { key: 'customerAddress', label: 'Address' },
  { key: 'refNo', label: 'Ref No' },
  { key: 'mobileNo', label: 'Mobile No' },
  { key: 'prevReadingDate', label: 'Prev Reading Date' },
  { key: 'currReadingDate', label: 'Curr Reading Date' },
  { key: 'ngenNetType', label: 'Net Type (NGEN)' },
  { key: 'npayNetType', label: 'Net Type (NPAY)' },
  { key: 'kwhImport', label: 'kWh Import', type: 'number' },
  { key: 'kwhExport', label: 'kWh Export', type: 'number' },
  { key: 'kwhSales', label: 'kWh Sales', type: 'number' },
  { key: 'ngenUnitRate', label: 'Unit Rate', type: 'number' },
  { key: 'salesAmount', label: 'kWh Sales Amount', type: 'number' },
  { key: 'npayEnergyPurchase', label: 'Energy Purchase', type: 'number' },
];

export const cellText = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') {
    if ('value' in val) return val.value ?? '—';
    return '—';
  }
  return String(val);
};

// Resolves one card field from the record, walking fallback keys (or joining bank details).
export const fieldValue = (row, f) => {
  if (f.bank) {
    const parts = ['bankCode', 'branchCode', 'bankAccountNo'].map(k => cellText(row[k])).filter(v => v && v !== '—');
    return parts.length ? parts.join(' / ') : '—';
  }
  for (const k of f.keys) {
    const v = cellText(row[k]);
    if (v !== '—' && v.trim() !== '') return v;
  }
  return '—';
};

// Display net type of a record: NGEN first, then NPAY, then Master Data.
export const recordNetType = (row) => {
  for (const k of ['ngenNetType', 'npayNetType', 'masterNetType', 'solarType']) {
    const v = cellText(row[k]);
    if (v !== '—' && v.trim() !== '') return v;
  }
  return null;
};

// Duplicate flags preserved from Step 5/6 — detection only, never resolved here.
export const isDuplicateRecord = (row) =>
  String(row.status || row.validationStatus || '').toUpperCase() === 'DUPLICATE'
  || row.hasDuplicateSources === true
  || Number(row.ngenSourceCount) > 1
  || Number(row.npaySourceCount) > 1;

// Folds raw net type variants ("NET PLUS", "net-plus", …) into one clear display name so the
// Net Type dropdown never shows duplicate options.
export const normalizeNetType = (raw) => {
  if (raw === null || raw === undefined) return null;
  const c = String(raw).trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  if (!c) return null;
  if (c.includes('plus plus') || c.includes('plusplus')) return 'Net Plus Plus';
  if (c.includes('plus')) return 'Net Plus';
  if (c.includes('metering')) return 'Net Metering';
  if (c.includes('accounting')) return 'Net Accounting';
  return c.replace(/\b\w/g, ch => ch.toUpperCase());
};

// Every filter the summary cards / Status dropdown can apply. Filtering is display-only —
// records themselves are never changed. `card: false` keeps an option dropdown-only.
export const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Statuses', cardLabel: 'Total Customers', color: '#38bdf8', icon: Sun },
  { key: 'VALID', label: 'Valid', cardLabel: 'Valid', color: '#10b981', icon: CheckCircle },
  { key: 'MISSING', label: 'Missing Details / Validation', cardLabel: 'Missing Details / Validation', color: '#f43f5e', icon: AlertTriangle },
  { key: 'NAME_MISMATCH', label: 'Name Mismatch', cardLabel: 'Name Mismatch', color: '#fb7185', icon: UserX },
  { key: 'UNIT_RATE_MISMATCH', label: 'Unit Rate Mismatch', cardLabel: 'Unit Rate Mismatch', color: '#D97706', icon: DollarSign },
  { key: 'NET_TYPE_MISMATCH', label: 'Net Type Mismatch', cardLabel: 'Net Type Mismatch', color: '#a78bfa', icon: ArrowUpDown },
  { key: 'OTHER_MISMATCHES', label: 'Other Mismatches', cardLabel: 'Other Mismatches', color: '#f97316', icon: AlertCircle },
  { key: 'NO_BILLING_DATA', label: 'Outstanding Customers', cardLabel: 'Outstanding Customers', color: '#38bdf8', icon: Clock },
  { key: 'DUPLICATE', label: 'Duplicates', cardLabel: 'Duplicates', color: '#c084fc', icon: Layers },
  { key: 'EXPIRED', label: 'Expired Agreements', cardLabel: 'Expired', color: '#ef4444', icon: AlertCircle },
  { key: 'EXPIRING_SOON', label: 'Expiring Soon', cardLabel: 'Expiring Soon', color: '#f97316', icon: Clock },
];

export const STAGING_STATUS_FILTERS = [
  { key: 'ALL', label: 'All Statuses', cardLabel: 'Total Customers', color: '#38bdf8', icon: Sun },
  { key: 'VALID', label: 'Valid', cardLabel: 'Valid', color: '#10b981', icon: CheckCircle },
  { key: 'MISSING', label: 'Missing Details / Validation', cardLabel: 'Missing Details / Validation', color: '#f43f5e', icon: AlertTriangle },
  { key: 'NAME_MISMATCH', label: 'Name Mismatch', cardLabel: 'Name Mismatch', color: '#fb7185', icon: UserX },
  { key: 'UNIT_RATE_MISMATCH', label: 'Unit Rate Mismatch', cardLabel: 'Unit Rate Mismatch', color: '#D97706', icon: DollarSign },
  { key: 'NET_TYPE_MISMATCH', label: 'Net Type Mismatch', cardLabel: 'Net Type Mismatch', color: '#a78bfa', icon: ArrowUpDown },
  { key: 'OTHER_MISMATCHES', label: 'Other Mismatches', cardLabel: 'Other Mismatches', color: '#f97316', icon: AlertCircle },
  { key: 'NO_BILLING_DATA', label: 'Outstanding Customers', cardLabel: 'Outstanding Customers', color: '#38bdf8', icon: Clock },
  { key: 'REJECTED', label: 'Rejected Records', cardLabel: 'Rejected', color: '#f43f5e', icon: XCircle },
  { key: 'DUPLICATE', label: 'Duplicates', cardLabel: 'Duplicates', color: '#c084fc', icon: Layers },
  { key: 'EXPIRED', label: 'Expired Agreements', cardLabel: 'Expired', color: '#ef4444', icon: AlertCircle },
  { key: 'EXPIRING_SOON', label: 'Expiring Soon', cardLabel: 'Expiring Soon', color: '#f97316', icon: Clock },
];

export const StatusBadge = ({ status }) => {
  const s = status || 'APPROVED';
  const isApproved = s === 'APPROVED';
  return (
    <span style={{
      padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
      background: isApproved ? '#DCFCE7' : '#FEF3C7',
      border: `1px solid ${isApproved ? '#BBF7D0' : '#FDE68A'}`,
      color: isApproved ? '#166534' : '#B45309',
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', letterSpacing: '0.04em'
    }}>
      {isApproved ? <CheckCircle size={12} /> : <Clock size={12} />}
      {isApproved ? 'STATUS: APPROVED' : 'STATUS: PENDING'}
    </span>
  );
};

// Per-record validation status styling (preserved exactly as saved from Step 6).
export const RECORD_STATUS_STYLE = {
  VALID: { bg: '#DCFCE7', color: '#166534', label: 'Valid' },
  WARNING: { bg: '#FEF3C7', color: '#B45309', label: 'Warning' },
  ERROR: { bg: '#FEE2E2', color: '#B91C1C', label: 'Error' },
  REJECTED: { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
  DUPLICATE: { bg: '#F3E8FF', color: '#7E22CE', label: 'Duplicate' },
};

export const MismatchChip = ({ label, color = '#B91C1C', bg = '#FEE2E2', border = '#FECACA' }) => (
  <span style={{ padding: '0.1rem 0.4rem', borderRadius: 6, fontSize: '0.6rem', fontWeight: 700, background: bg, color, border: `1px solid ${border}` }}>
    {label}
  </span>
);

export const RecordStatusBadge = ({ row }) => {
  const isNew = row.masterDataFound === false || row.isNewCustomer === true;
  const isPaymentHold = row.paymentHold === true;
  const isNoBillOnly = row.masterOnly === true || row.noBillingData === true;
  const isPaymentMismatch = row.mergedPayment?.mismatch === true;
  const isNoBill = isNew || isPaymentHold || isNoBillOnly || isPaymentMismatch;
  const dup = isDuplicateRecord(row);
  const st = String(row.status || row.validationStatus || 'VALID').toUpperCase();
  const cfg = RECORD_STATUS_STYLE[st] || RECORD_STATUS_STYLE.VALID;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <span style={{ padding: '0.2rem 0.55rem', borderRadius: 6, fontSize: '0.66rem', fontWeight: 800, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>{cfg.label}</span>
      {row.pendingAdminApproval === true && (
        <span style={{ fontSize: '0.62rem', color: '#B45309', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '0.1rem 0.35rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} /> Pending Admin Approval
        </span>
      )}
      {row.recordApproved === true && (
        <span style={{ fontSize: '0.62rem', color: '#166534', background: '#DCFCE7', border: '1px solid #BBF7D0', padding: '0.1rem 0.35rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> Approved</span>
      )}
      {(row.nameMatch === 'MISMATCH' || row.unitRateMatch === 'MISMATCH' || row.netTypeMatch === 'MISMATCH' || dup || isNoBill) && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isNew && <MismatchChip label="/ New Customer" color="#0369A1" bg="#E0F2FE" border="#BAE6FD" />}
          {isNoBillOnly && <MismatchChip label="/ No Billing" color="#B45309" bg="#FEF3C7" border="#FDE68A" />}
          {isPaymentHold && <MismatchChip label="/ Payment Hold" color="#B45309" bg="#FEF3C7" border="#FDE68A" />}
          {isPaymentMismatch && <MismatchChip label="/ Payment Mismatch" color="#B45309" bg="#FEF3C7" border="#FDE68A" />}
          {dup && <MismatchChip label="/ Duplicate" color="#7E22CE" bg="#F3E8FF" border="#E9D5FF" />}
          {row.nameMatch === 'MISMATCH' && <MismatchChip label="/ Name" color="#BE123C" bg="#FFE4E6" border="#FECDD3" />}
          {row.unitRateMatch === 'MISMATCH' && <MismatchChip label="/ Rate" color="#B45309" bg="#FEF3C7" border="#FDE68A" />}
          {row.netTypeMatch === 'MISMATCH' && <MismatchChip label="/ Net" color="#7E22CE" bg="#F3E8FF" border="#E9D5FF" />}
        </div>
      )}
    </div>
  );
};

// Builds an editable form object from a record using the EDIT_FIELDS whitelist.
export const pickEditable = (row) => {
  const f = {};
  EDIT_FIELDS.forEach(({ key }) => {
    const v = row[key];
    f[key] = (v === null || v === undefined || typeof v === 'object') ? '' : String(v);
  });
  return f;
};

const cardBtn = (color, bg, border) => ({
  padding: '0.4rem 0.65rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color, borderRadius: 8,
  fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
});

// One Customer Card — displays every merged Step 6 field for a record, its preserved
// validation state, and the per-record actions of the post-approval working area.
export const CustomerCard = ({ row, onView, onEdit, onHistory }) => {
  const rawErrors = row.errors || [];
  const errors = rawErrors.map(e => typeof e === 'object' ? (e.errorMessage || e.field) : e);
  const rawWarnings = row.warnings || [];
  const warnings = rawWarnings.map(w => typeof w === 'object' ? (w.warning || w.field) : w);
  const name = cellText(row.npayName) !== '—' ? cellText(row.npayName) : cellText(row.customerName);
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, background: '#FFFFFF', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {/* Header: Ref No / Account No / Customer Name */}
      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', background: '#F8FAFC', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 600 }}>Ref No: {cellText(row.refNo)}</div>
          <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.02rem', margin: '0.12rem 0', color: '#2563EB' }}>{cellText(row.accountNo)}</div>
          <div style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        </div>
        <RecordStatusBadge row={row} />
      </div>

      {/* Merged source sections */}
      <div style={{ padding: '0.75rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {CARD_SECTIONS.map(sec => (
          <div key={sec.title}>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: sec.color, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {sec.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
              {sec.fields.map(f => {
                const IconC = getFieldIcon(f.label);
                return (
                  <div key={f.label} style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <IconC size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                      {f.label}
                    </span>
                    <span style={{ color: '#0F172A', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                      {fieldValue(row, f)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Validation issues (preserved exactly as approved in Step 6) */}
        <div>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#DC2626', marginBottom: '0.35rem' }}>Validation</div>
          {errors.length === 0 && warnings.length === 0 ? (
            <div style={{ fontSize: '0.7rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={11} /> No validation issues</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
              {errors.slice(0, 2).map((e, i) => (
                <div key={`e${i}`} style={{ fontSize: '0.68rem', color: '#DC2626', display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}><AlertTriangle size={10} style={{ marginTop: 2, flexShrink: 0 }} />{String(e)}</div>
              ))}
              {warnings.slice(0, 2).map((w, i) => (
                <div key={`w${i}`} style={{ fontSize: '0.68rem', color: '#D97706', display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}><AlertTriangle size={10} style={{ marginTop: 2, flexShrink: 0 }} />{String(w)}</div>
              ))}
              {(errors.length + warnings.length) > 4 && (
                <div style={{ fontSize: '0.66rem', color: '#64748B' }}>+{errors.length + warnings.length - 4} more — open View Details</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card actions */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap', background: '#F8FAFC', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
        <button onClick={onView} title="View full record" style={cardBtn('#2563EB', '#FFFFFF', '#E2E8F0')}><Eye size={12} /> View Details</button>
        <button onClick={onEdit} title="Edit / Revalidate / Approve" style={cardBtn('#4F46E5', '#FFFFFF', '#E2E8F0')}><Edit3 size={12} /> Edit</button>
        <button onClick={onHistory} title="Audit history of this record" style={cardBtn('#D97706', '#FFFFFF', '#E2E8F0')}><History size={12} /> History</button>
      </div>
    </div>
  );
};

// Custom light-theme dropdown replacing native <select>. Each option shows a color dot,
// its label and live count; the active option is highlighted, and the panel closes on outside-click or selection.
export const FilterDropdown = ({ value, options, onChange, minWidth = 190, placeholderColor }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const dot = (c) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />;

  return (
    <div ref={ref} style={{ position: 'relative', minWidth }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem',
          padding: '0.5rem 0.7rem', borderRadius: 9, background: '#FFFFFF',
          border: `1px solid ${open ? '#2563EB' : '#E2E8F0'}`, color: '#0F172A',
          fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dot(selected?.color || placeholderColor || '#64748b')}
          {selected?.label}
          {selected && selected.count !== undefined && (
            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B' }}>({selected.count})</span>
          )}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', color: '#64748B' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10,
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)', padding: '0.35rem', maxHeight: 320, overflowY: 'auto'
        }}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                  padding: '0.5rem 0.6rem', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? '#EFF6FF' : 'transparent',
                  color: active ? '#2563EB' : '#0F172A', fontSize: '0.78rem', fontWeight: active ? 700 : 500
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dot(o.color || placeholderColor || '#64748b')}
                  {o.label}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: active ? '#2563EB' : '#64748B' }}>{o.count}</span>
                  {active && <Check size={13} style={{ color: '#2563EB' }} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MonthlyCustomerDirectory = () => {
  const { authFetch, user } = useAuth();
  const { showToast, showConfirm } = useToast();

  const navigate = useNavigate();

  // Month → Division organization from GET /monthly-directory/months:
  // { divisions: [5 names], months: [{ billingMonth, divisions[5], ... }], unassigned: [...] }
  const [monthsData, setMonthsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null); // billing month label being viewed, null = overview

  // "Start New Billing Month" picker
  const [newMonthOpen, setNewMonthOpen] = useState(false);
  const [pickYear, setPickYear] = useState(new Date().getFullYear());

  // Open/View modal
  const [viewing, setViewing] = useState(null);      // full snapshot { ...meta, records, validationSummary }
  const [viewLoading, setViewLoading] = useState(false);

  // Rename modal
  const [renaming, setRenaming] = useState(null);     // list item being renamed
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const [downloadingId, setDownloadingId] = useState(null);

  // Per-record editing (post-Step-6 working area)
  const [editing, setEditing] = useState(null);        // { index, record }
  const [editForm, setEditForm] = useState({});
  const [recordSaving, setRecordSaving] = useState(null); // 'save' | 'revalidate' | 'approve' | null

  // Audit history modal — null = closed, 'ALL' = full snapshot history, number = one record's history
  const [auditScope, setAuditScope] = useState(null);

  // Customer Card working area: record detail modal + search & filters
  const [detailsIdx, setDetailsIdx] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [netTypeFilter, setNetTypeFilter] = useState('ALL');

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/officer/monthly-directory/months');
      const data = await res.json();
      if (!res.ok) { 
        showToast({
          title: 'Failed to Load Months',
          message: data.message || 'We could not load the monthly billing directories.',
          type: 'error'
        }); 
        return; 
      }
      setMonthsData(data);
    } catch (e) {
      showToast({
        title: 'Connection Error',
        message: 'Failed to load billing months: ' + e.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [authFetch, showToast]);

  useEffect(() => { loadList(); }, [loadList]);

  const handleApproveSnapshot = async (item) => {
    try {
      const res = await authFetch(`/api/admin/monthly-directory/${item.id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { 
        showToast({
          title: 'Approval Failed',
          message: data.message || 'We could not approve the selected monthly directory.',
          type: 'error'
        }); 
        return; 
      }
      showToast({
        title: 'Monthly Directory Approved',
        message: `"${item.datasetName}" approved and customer details synced to directory.`,
        type: 'success'
      });
      loadList();
    } catch (e) {
      showToast({
        title: 'Approval Failed',
        message: 'Could not approve directory: ' + e.message,
        type: 'error'
      });
    }
  };

  const handleOpen = async (item) => {
    if (!item || !item.id) {
      showToast({
        title: 'Directory Not Found',
        message: 'No directory dataset exists for this slot yet. Please upload billing first.',
        type: 'warning'
      });
      return;
    }
    try {
      setViewLoading(true);
      // Fresh working area each time a snapshot is opened.
      setSearchTerm('');
      setStatusFilter('ALL');
      setNetTypeFilter('ALL');
      setDetailsIdx(null);
      setAuditScope(null);
      setViewing({ ...item, records: [], validationSummary: null });
      const res = await authFetch(`/api/officer/monthly-directory/${item.id}`);
      const data = await res.json();
      if (!res.ok) { 
        showToast({
          title: 'Failed to Open Directory',
          message: data.message || 'Unable to load dataset records.',
          type: 'error'
        }); 
        setViewing(null); 
        return; 
      }
      if (data && Array.isArray(data.records)) {
        data.records = data.records.filter(r => !(String(r.status || '').toUpperCase() === 'REJECTED' || r.rejected === true));
      }
      setViewing(data);
    } catch (e) {
      showToast({
        title: 'Error Opening Directory',
        message: 'Failed to open directory: ' + e.message,
        type: 'error'
      });
      setViewing(null);
    } finally {
      setViewLoading(false);
    }
  };

  const openRename = (item) => {
    setRenaming(item);
    setRenameValue(item.datasetName || '');
  };

  const handleRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) { 
      showToast({
        title: 'Invalid Name',
        message: 'Dataset name cannot be empty.',
        type: 'warning'
      }); 
      return; 
    }
    try {
      setRenameSaving(true);
      const res = await authFetch(`/api/officer/monthly-directory/${renaming.id}/rename?datasetName=${encodeURIComponent(name)}`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) { 
        showToast({
          title: 'Rename Failed',
          message: data.message || 'We could not rename this directory dataset.',
          type: 'error'
        }); 
        return; 
      }
      showToast({
        title: 'Dataset Renamed',
        message: `Monthly directory renamed to "${name}" successfully.`,
        type: 'success'
      });
      setRenaming(null);
      loadList();
    } catch (e) {
      showToast({
        title: 'Rename Failed',
        message: 'Could not rename dataset: ' + e.message,
        type: 'error'
      });
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const isAdmin = user?.role === 'ADMIN';
    const ok = await showConfirm({
      title: isAdmin ? 'Delete Monthly Directory' : 'Submit Deletion Request',
      message: isAdmin 
        ? `Permanently delete "${item.datasetName}"? This will delete the monthly snapshot, associated billing records, and automatically delete or update corresponding customer profiles in the Customer Directory.`
        : `Submit deletion request for "${item.datasetName}"? As a Billing Officer, this deletion request will be sent to the Administrator for approval before any data is removed.`,
      confirmText: isAdmin ? 'Delete Directory' : 'Submit Request',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;
    try {
      const rolePath = isAdmin ? 'admin' : 'officer';
      const res = await authFetch(`/api/${rolePath}/monthly-directory/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { 
        showToast({
          title: 'Deletion Failed',
          message: data.message || "We couldn't delete the selected monthly directory. Please try again.",
          type: 'error'
        }); 
        return; 
      }
      
      if (data.status === 'PENDING') {
        showToast({
          title: 'Deletion Request Submitted',
          message: data.message || 'The deletion request has been queued for Administrator approval.',
          type: 'warning'
        });
      } else {
        showToast({
          title: 'Monthly Directory Deleted',
          message: "The selected month's directory and related customer records were successfully removed.",
          type: 'success'
        });
      }
      
      if (viewing && viewing.id === item.id) setViewing(null);
      loadList();
    } catch (e) {
      showToast({
        title: 'Deletion Failed',
        message: "We couldn't delete the selected monthly directory. " + e.message,
        type: 'error'
      });
    }
  };

  const handleDownload = async (item) => {
    try {
      setDownloadingId(item.id);
      const res = await authFetch(`/api/officer/monthly-directory/${item.id}/download/excel`);
      if (!res.ok) {
        let msg = "We couldn't export the selected monthly directory dataset.";
        try { const d = await res.json(); msg = d.message || msg; } catch (_) {}
        showToast({
          title: 'Download Failed',
          message: msg,
          type: 'error'
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safe = (item.datasetName || 'customer_directory').replace(/[^\w.-]+/g, '_');
      a.href = url;
      a.download = `${safe}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast({
        title: 'Download Failed',
        message: 'Export failed: ' + e.message,
        type: 'error'
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Post-Step-6 record editing / revalidation / approval ─────────────────
  const openEditRecord = (row, index) => {
    setEditing({ index, record: row });
    setEditForm(pickEditable(row));
  };

  const closeEdit = () => {
    if (recordSaving) return;
    setEditing(null);
    setEditForm({});
  };

  // action: 'save' | 'revalidate' | 'approve'
  const handleRecordAction = async (action) => {
    if (!editing || !viewing) return;
    try {
      setRecordSaving(action);
      const payload = {
        recordIndex: editing.index,
        fields: editForm,
        revalidate: action === 'revalidate',
        approve: action === 'approve',
      };
      const res = await authFetch(`/api/officer/monthly-directory/${viewing.id}/record`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { 
        showToast({
          title: 'Update Failed',
          message: data.message || 'We could not update the customer record.',
          type: 'error'
        }); 
        return; 
      }
      // Merge the server's authoritative record + refreshed summary + audit history back into view.
      setViewing(prev => {
        if (!prev) return prev;
        const records = [...(prev.records || [])];
        records[data.recordIndex] = data.record;
        return { ...prev, records, validationSummary: data.validationSummary, auditLog: data.auditLog };
      });
      setEditing({ index: data.recordIndex, record: data.record });
      setEditForm(pickEditable(data.record));
      
      if (action === 'approve') {
        showToast({
          title: 'Record Approved',
          message: 'Customer record approved & synced to directory.',
          type: 'success'
        });
        setEditing(null); 
        setEditForm({});
      } else if (action === 'revalidate') {
        showToast({
          title: 'Record Revalidated',
          message: 'Customer record validation completed.',
          type: 'info'
        });
      } else {
        showToast({
          title: 'Changes Saved',
          message: 'Customer record modifications were saved.',
          type: 'success'
        });
      }
    } catch (e) {
      showToast({
        title: 'Update Failed',
        message: 'Could not update record: ' + e.message,
        type: 'error'
      });
    } finally {
      setRecordSaving(null);
    }
  };

  // ── Display-only filtering helpers (summary cards + dropdowns) ──────────────────
  // Billing month window of the open snapshot, used only to categorize agreement expiry the
  // same way Step 6 does. Falls back to the current month when the label can't be parsed.
  const billingWindow = useMemo(() => {
    const label = viewing?.billingMonth;
    if (label) {
      const d = new Date(`1 ${label}`);
      if (!isNaN(d.getTime())) {
        return {
          start: new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)),
          end: new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)),
        };
      }
    }
    const now = new Date();
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
    };
  }, [viewing]);

  const rowExpiry = useCallback((row) =>
    agreementExpiryStatus(computeAgreementExpiry(row.agreementDate), billingWindow.start, billingWindow.end),
  [billingWindow]);

  const isRecordComplete = useCallback((row) => {
    if (!row) return false;
    const isRejected = String(row.status || '').toUpperCase() === 'REJECTED' || row.rejected === true;
    if (isRejected) return false;

    const isBlank = (val) => {
      if (val === null || val === undefined) return true;
      if (typeof val === 'string') {
        const s = val.trim();
        return s === '' || s === '—' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined';
      }
      return false;
    };

    const accountNo = row.accountNo || row.accountNumber;
    if (isBlank(accountNo)) return false;

    const name = row.customerName || row.masterName || row.npayName || row.name;
    if (isBlank(name)) return false;

    const address = row.customerAddress || row.address || row.masterAddress;
    if (isBlank(address)) return false;

    const refNo = row.refNo || row.referenceNo;
    if (isBlank(refNo)) return false;

    const costCode = row.costCode;
    if (isBlank(costCode)) return false;

    const mobileNo = row.mobileNo || row.mobile || row.mobileNumber || row.contactNo;
    if (isBlank(mobileNo)) return false;

    const agreementDate = row.agreementDate;
    if (isBlank(agreementDate)) return false;

    const panelCapacity = row.panelCapacity ?? row.capacity;
    if (isBlank(panelCapacity)) return false;

    const bankCode = row.bankCode;
    if (isBlank(bankCode)) return false;

    const bankAccountNo = row.bankAccountNo || row.accountNoBank;
    if (isBlank(bankAccountNo)) return false;

    const netType = row.solarType || row.masterNetType || row.netType || row.mainNetType || row.ngenNetType || row.npayNetType;
    if (isBlank(netType)) return false;

    const unitRate = row.unitRate ?? row.masterUnitRate ?? row.mainUnitRate ?? row.ngenUnitRate;
    if (isBlank(unitRate)) return false;

    return true;
  }, []);

  // One predicate shared by the clickable summary cards and the Status dropdown.
  const matchesFilter = useCallback((row, key) => {
    const isNew = row.masterDataFound === false || row.isNewCustomer === true;
    const isPaymentHold = row.paymentHold === true;
    const isNoBillOnly = row.masterOnly === true || row.noBillingData === true;
    const isPaymentMismatch = row.mergedPayment?.mismatch === true;
    const isRejected = String(row.status || '').toUpperCase() === 'REJECTED' || row.rejected === true;
    const isNoBill = (isNew || isPaymentHold || isNoBillOnly || isPaymentMismatch) && !isRejected;
    const dup = isDuplicateRecord(row);

    switch (key) {
      case 'ALL': return true;
      case 'VALID': return String(row.status || '').toUpperCase() === 'VALID' && !isNoBill && !dup && row.nameMatch !== 'MISMATCH' && row.unitRateMatch !== 'MISMATCH' && row.netTypeMatch !== 'MISMATCH' && !isRejected;
      case 'NO_BILLING_DATA': return isNoBill;
      case 'REJECTED': return isRejected;
      case 'DUPLICATE': return dup && !isRejected;
      case 'NAME_MISMATCH': return row.nameMatch === 'MISMATCH' && !isNoBill && !isRejected;
      case 'UNIT_RATE_MISMATCH': return row.unitRateMatch === 'MISMATCH' && !isNoBill && !isRejected;
      case 'NET_TYPE_MISMATCH': return row.netTypeMatch === 'MISMATCH' && !isNoBill && !isRejected;
      case 'OTHER_MISMATCHES': {
        const hasMismatch = row.nameMatch === 'MISMATCH' || row.unitRateMatch === 'MISMATCH' || row.netTypeMatch === 'MISMATCH';
        return !isRecordComplete(row) && !hasMismatch && !isNoBill && !isRejected;
      }
      case 'COMPLETE': {
        const hasMismatch = row.nameMatch === 'MISMATCH' || row.unitRateMatch === 'MISMATCH' || row.netTypeMatch === 'MISMATCH';
        return isRecordComplete(row) && !hasMismatch && !isNoBill && !isRejected;
      }
      case 'MISSING': {
        const hasMismatch = row.nameMatch === 'MISMATCH' || row.unitRateMatch === 'MISMATCH' || row.netTypeMatch === 'MISMATCH';
        return (!isRecordComplete(row) || hasMismatch) && !isNoBill && !isRejected;
      }
      case 'CORRECTED': return (row.step6Corrected === true || row.correctedInDirectory === true) && !isRejected;
      case 'EXPIRED': return rowExpiry(row) === 'EXPIRED' && !isRejected;
      case 'EXPIRING_SOON': return rowExpiry(row) === 'EXPIRING_SOON' && !isRejected;
      default: return String(row.status || '').toUpperCase() === key;
    }
  }, [rowExpiry, isRecordComplete]);

  // Live count per filter, shown on the summary cards and beside each dropdown option.
  const filterCounts = useMemo(() => {
    const recs = viewing?.records || [];
    const counts = { ALL: recs.length };
    STATUS_FILTERS.forEach(f => {
      if (f.key !== 'ALL') counts[f.key] = recs.filter(r => matchesFilter(r, f.key)).length;
    });
    return counts;
  }, [viewing, matchesFilter]);

  // Snapshot records shown as Customer Cards: search + filters applied, always sorted by
  // Account No ascending. `idx` keeps each record's position in the stored snapshot array so
  // edits/revalidation/audit always target the correct record.
  const displayRecords = useMemo(() => {
    const recs = (viewing?.records || []).map((row, idx) => ({ row, idx }));
    const term = searchTerm.trim().toLowerCase();
    let list = recs;
    if (term) {
      list = list.filter(({ row }) =>
        [row.accountNo, row.refNo, row.npayName, row.customerName]
          .some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(term)));
    }
    if (statusFilter !== 'ALL') {
      list = list.filter(({ row }) => matchesFilter(row, statusFilter));
    }
    if (netTypeFilter !== 'ALL') {
      list = list.filter(({ row }) => normalizeNetType(recordNetType(row)) === netTypeFilter);
    }
    return [...list].sort((a, b) =>
      String(a.row.accountNo ?? '').localeCompare(String(b.row.accountNo ?? ''), undefined, { numeric: true }));
  }, [viewing, searchTerm, statusFilter, netTypeFilter, matchesFilter]);

  // Net Type dropdown options: normalized display names, deduped, alphabetical, with counts.
  const netTypeOptions = useMemo(() => {
    const counts = new Map();
    (viewing?.records || []).forEach(r => {
      const nt = normalizeNetType(recordNetType(r));
      if (nt) counts.set(nt, (counts.get(nt) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [viewing]);

  const auditEntries = useMemo(() => {
    const log = viewing?.auditLog || [];
    if (auditScope === null || auditScope === 'ALL') return log;
    return log.filter(e => e.recordIndex === auditScope);
  }, [viewing, auditScope]);

  const detailRecord = (detailsIdx !== null && viewing) ? (viewing.records || [])[detailsIdx] : null;

  // ── Month → Division derived views ────────────────────────────────────────
  const months = monthsData?.months || [];
  const divisionNames = (monthsData?.divisions?.length > 0) ? monthsData.divisions : EASTERN_DIVISIONS;
  const unassigned = monthsData?.unassigned || [];
  const monthObj = selectedMonth
    ? months.find(m => (m.billingMonth || '').toLowerCase() === selectedMonth.toLowerCase())
    : null;
  // A freshly started month has no snapshots yet — synthesize an empty 5-division view for it.
  const monthView = selectedMonth ? (monthObj || {
    billingMonth: selectedMonth,
    divisions: divisionNames.map(d => ({ division: d, status: 'NOT_UPLOADED', totalRecords: 0, lastUpdated: null, snapshotId: null, datasetName: null })),
    divisionCount: divisionNames.length, uploadedCount: 0, approvedCount: 0,
    totalRecords: 0, lastUpdated: null, completed: false, otherDatasets: [],
  }) : null;

  const actionBtn = (color, bg, border) => ({
    padding: '0.35rem 0.6rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color, borderRadius: 7,
    fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
  });

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#0F172A' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Archive size={20} color="#2563EB" />
            </div>
            Monthly Customer Directory
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748B', fontSize: '0.88rem' }}>
            Billing organized by month — each Billing Month holds one approved dataset per Eastern Province division.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {!selectedMonth && (
            <button onClick={() => { setPickYear(new Date().getFullYear()); setNewMonthOpen(true); }}
              style={{ padding: '0.5rem 1.1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', background: '#2563EB', border: '1px solid #2563EB', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(37,99,235,0.2)' }}>
              <Plus size={14} /> Start New Billing Month
            </button>
          )}
          <button onClick={loadList} style={{ padding: '0.5rem 1.1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '3rem', borderRadius: 16, textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <Loader size={28} className="animate-spin" style={{ color: '#2563EB' }} />
          <div style={{ marginTop: '0.75rem', fontWeight: 600 }}>Loading billing months…</div>
        </div>
      ) : !selectedMonth ? (
        <>
          {/* ── Billing Months overview ── */}
          {months.length === 0 ? (
            <div className="card" style={{ padding: '3rem', borderRadius: 16, textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <Calendar size={40} style={{ opacity: 0.4, marginBottom: '0.75rem', color: '#2563EB' }} />
              <div style={{ fontWeight: 700, color: '#0F172A' }}>No billing months yet.</div>
              <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.35rem' }}>
                Click “Start New Billing Month”, pick a month, then upload billing for each division.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
              {months.map(m => {
                const total = m.divisionCount || divisionNames.length;
                const pct = total > 0 ? Math.round((m.approvedCount / total) * 100) : 0;
                return (
                  <button key={m.billingMonth} onClick={() => setSelectedMonth(m.billingMonth)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: '1.2rem 1.3rem', borderRadius: 14,
                      background: '#FFFFFF',
                      border: m.completed ? '1px solid #10b981' : '1px solid #E2E8F0',
                      borderLeft: m.completed ? '4px solid #10b981' : '1px solid #E2E8F0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex', flexDirection: 'column', gap: '0.85rem', color: 'inherit'
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Calendar size={17} color="#2563EB" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0F172A' }}>{m.billingMonth}</div>
                          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>{m.uploadedCount}/{total} divisions uploaded</div>
                        </div>
                      </div>
                      {m.completed && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.22rem 0.6rem', borderRadius: 999, fontSize: '0.66rem', fontWeight: 800, color: '#166534', background: '#DCFCE7', border: '1px solid #BBF7D0', whiteSpace: 'nowrap' }}>
                          <CheckCircle size={11} /> Completed
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>{m.approvedCount}/{total} divisions completed</span>
                        <span style={{ color: m.completed ? '#166534' : '#64748B', fontWeight: 700, fontFamily: 'monospace' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: m.completed ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#2563EB,#3B82F6)', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Users size={12} color="#2563EB" /> {m.totalRecords} records</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#64748B' }}><Clock size={12} /> {m.lastUpdated || '—'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Datasets saved before the division redesign (no billing month) — never hidden */}
          {unassigned.length > 0 && (
            <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem 1.5rem', borderRadius: 16, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.9rem' }}>
                Datasets without a Billing Month
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {unassigned.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <FolderOpen size={15} color="#2563EB" />
                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0F172A' }}>{item.datasetName}</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>{item.totalRecords ?? 0} records</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button onClick={() => handleOpen(item)} title="Open / View" style={actionBtn('#2563EB', '#FFFFFF', '#E2E8F0')}><FolderOpen size={12} /> Open</button>
                      <button onClick={() => openRename(item)} title="Rename Dataset" style={actionBtn('#D97706', '#FFFFFF', '#E2E8F0')}><Pencil size={12} /> Rename</button>
                      <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id} title="Download Excel" style={actionBtn('#16A34A', '#FFFFFF', '#E2E8F0')}>
                        {downloadingId === item.id ? <Loader size={12} className="animate-spin" /> : <Download size={12} />} Excel
                      </button>
                      <button onClick={() => handleDelete(item)} title="Delete Dataset" style={actionBtn('#DC2626', '#FFFFFF', '#E2E8F0')}><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Division view for the selected Billing Month ── */
        <>
          <button onClick={() => setSelectedMonth(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', marginBottom: '1rem', borderRadius: 9, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <ArrowLeft size={14} /> All Billing Months
          </button>

          {/* Month header with overall progress */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: 16, marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Calendar size={20} color="#2563EB" />
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>{monthView.billingMonth}</span>
                {monthView.completed && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.7rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800, color: '#166534', background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
                    <CheckCircle size={12} /> Month Completed
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.35rem' }}>
                {monthView.approvedCount}/{monthView.divisionCount || divisionNames.length} divisions completed · {monthView.totalRecords} total records
              </div>
            </div>
            <div style={{ minWidth: 230, flex: '0 1 260px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Progress</span>
                <span style={{ color: monthView.completed ? '#166534' : '#0F172A', fontWeight: 700, fontFamily: 'monospace' }}>
                  {Math.round((monthView.approvedCount / (monthView.divisionCount || divisionNames.length || 5)) * 100)}%
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                <div style={{ width: `${(monthView.approvedCount / (monthView.divisionCount || divisionNames.length || 5)) * 100}%`, height: '100%', borderRadius: 999, background: monthView.completed ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#2563EB,#3B82F6)', transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>

          {/* 5 fixed Eastern Province division cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {(monthView.divisions || []).map(d => {
              const st = DIVISION_STATUS[d.status] || DIVISION_STATUS.NOT_UPLOADED;
              const hasData = d.snapshotId !== null && d.snapshotId !== undefined;
              const uploadUrl = `/upload?month=${encodeURIComponent(monthView.billingMonth)}&division=${encodeURIComponent(d.division)}`;
              const item = { id: d.snapshotId, datasetName: d.datasetName || `${monthView.billingMonth} – ${d.division} Billing`, billingMonth: monthView.billingMonth, division: d.division };
              return (
                <div key={d.division} style={{ border: `1px solid ${st.border}`, borderRadius: 14, background: '#FFFFFF', padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: st.bg, border: `1px solid ${st.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={16} color={st.color} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0F172A' }}>{d.division}</div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 600 }}>Eastern Province Division</div>
                      </div>
                    </div>
                    <span style={{ padding: '0.22rem 0.6rem', borderRadius: 999, fontSize: '0.64rem', fontWeight: 800, color: st.color, background: st.bg, border: `1px solid ${st.border}`, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Total Records</span>
                      <span style={{ color: '#0F172A', fontWeight: 700, fontFamily: 'monospace' }}>{d.totalRecords ?? 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Last Updated</span>
                      <span style={{ color: '#475569', fontWeight: 600 }}>{d.lastUpdated || '—'}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</span>
                      <span style={{ color: st.color, fontWeight: 700, fontFamily: 'monospace' }}>{st.progress}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ width: `${st.progress}%`, height: '100%', borderRadius: 999, background: st.color, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                    {!hasData ? (
                      <button onClick={() => navigate(uploadUrl)} title={`Upload billing for ${d.division}`} style={actionBtn('#2563EB', '#FFFFFF', '#E2E8F0')}>
                        <CloudUpload size={12} /> Upload Billing
                      </button>
                    ) : (
                      <>
                        {user?.role === 'ADMIN' && d.status === 'PENDING_APPROVAL' && (
                          <button onClick={() => handleApproveSnapshot(item)} title="Approve dataset & sync customers to Customer Directory" style={actionBtn('#16A34A', '#FFFFFF', '#E2E8F0')}>
                            <Check size={12} /> Approve
                          </button>
                        )}
                        <button onClick={() => handleOpen(item)} title="Open / View" style={actionBtn('#2563EB', '#FFFFFF', '#E2E8F0')}><FolderOpen size={12} /> Open</button>
                        <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id} title="Download Excel" style={actionBtn('#16A34A', '#FFFFFF', '#E2E8F0')}>
                          {downloadingId === item.id ? <Loader size={12} className="animate-spin" /> : <Download size={12} />} Excel
                        </button>
                        <button onClick={() => openRename(item)} title="Rename Dataset" style={actionBtn('#D97706', '#FFFFFF', '#E2E8F0')}><Pencil size={12} /> Rename</button>
                        <button onClick={() => navigate(uploadUrl)} title="Re-upload (replaces this division's dataset)" style={actionBtn('#2563EB', '#FFFFFF', '#E2E8F0')}><CloudUpload size={12} /> Re-upload</button>
                        <button onClick={() => handleDelete(item)} title="Delete Dataset" style={actionBtn('#DC2626', '#FFFFFF', '#E2E8F0')}><Trash2 size={12} /> Delete</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Datasets in this month whose division isn't one of the 5 fixed slots */}
          {(monthView.otherDatasets || []).length > 0 && (
            <div className="card" style={{ marginTop: '1.25rem', padding: '1.25rem 1.5rem', borderRadius: 16, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.9rem' }}>
                Other Datasets in {monthView.billingMonth}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {monthView.otherDatasets.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <FolderOpen size={15} color="#2563EB" />
                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0F172A' }}>{item.datasetName}</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>{item.totalRecords ?? 0} records</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button onClick={() => handleOpen(item)} title="Open / View" style={actionBtn('#2563EB', '#FFFFFF', '#E2E8F0')}><FolderOpen size={12} /> Open</button>
                      <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id} title="Download Excel" style={actionBtn('#16A34A', '#FFFFFF', '#E2E8F0')}>
                        {downloadingId === item.id ? <Loader size={12} className="animate-spin" /> : <Download size={12} />} Excel
                      </button>
                      <button onClick={() => handleDelete(item)} title="Delete Dataset" style={actionBtn('#DC2626', '#FFFFFF', '#E2E8F0')}><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* "Start New Billing Month" picker — pick a month + year, then upload per division */}
      {newMonthOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, width: '100%', maxWidth: 430, padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={17} color="#2563EB" /> Start New Billing Month
              </h3>
              <button onClick={() => setNewMonthOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.5 }}>
              Pick the billing month to open. Each month keeps its own independent datasets for all 5 divisions.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <button onClick={() => setPickYear(y => y - 1)} style={actionBtn('#475569', '#FFFFFF', '#E2E8F0')}>‹</button>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'monospace', color: '#0F172A' }}>{pickYear}</span>
              <button onClick={() => setPickYear(y => y + 1)} style={actionBtn('#475569', '#FFFFFF', '#E2E8F0')}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
              {MONTH_NAMES.map(name => {
                const label = `${name} ${pickYear}`;
                const exists = months.some(m => (m.billingMonth || '').toLowerCase() === label.toLowerCase());
                return (
                  <button key={name}
                    onClick={() => { setNewMonthOpen(false); setSelectedMonth(label); }}
                    title={exists ? `${label} already has uploads — opens the existing month` : `Open ${label}`}
                    style={{
                      padding: '0.65rem 0.4rem', borderRadius: 9, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                      background: exists ? '#EFF6FF' : '#FFFFFF',
                      border: `1px solid ${exists ? '#2563EB' : '#E2E8F0'}`,
                      color: exists ? '#2563EB' : '#334155',
                      boxShadow: exists ? '0 1px 2px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}>
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Open / View modal */}
      {viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, width: '100%', maxWidth: '1250px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.75rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.65rem', letterSpacing: '0.01em' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sun size={18} color="#2563EB" />
                  </div>
                  {viewing.datasetName || `${viewing.billingMonth} - ${viewing.division} Division Billing`}
                  <StatusBadge status={viewing.status} />
                </h3>
                <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#64748B', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span><strong style={{ color: '#0F172A' }}>Billing Month:</strong> {viewing.billingMonth || '—'}</span>
                  <span><strong style={{ color: '#0F172A' }}>Division:</strong> {viewing.division || '—'}</span>
                  <span><strong style={{ color: '#0F172A' }}>Total Records:</strong> {viewing.totalRecords ?? 0}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <strong style={{ color: '#0F172A' }}>Approved By:</strong>
                    <User size={13} color="#2563EB" /> {viewing.approvedBy || 'admin'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <strong style={{ color: '#0F172A' }}>Approval Date:</strong> {viewing.approvalDate || '—'}
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {user?.role === 'ADMIN' && viewing.status === 'PENDING_APPROVAL' && (
                  <button
                    onClick={() => handleApproveSnapshot(viewing)}
                    style={{
                      padding: '0.55rem 1.1rem',
                      background: '#16A34A',
                      border: 'none',
                      color: 'white',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                    }}
                  >
                    <Check size={16} /> Approve &amp; Commit Dataset
                  </button>
                )}
                <button onClick={() => setViewing(null)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}><X size={18} /></button>
              </div>
            </div>

            {/* Validation summary — clickable cards matching Image 2 */}
            {!viewLoading && (viewing.records || []).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: '0.55rem', padding: '1rem 1.75rem 0' }}>
                {STATUS_FILTERS.filter(f => f.card !== false).map(f => {
                  const active = statusFilter === f.key;
                  const IconComp = f.icon || Sun;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      title={f.key === 'ALL' ? 'Show all customers (clear filter)' : `Show only: ${f.cardLabel}`}
                      style={{
                        textAlign: 'left', cursor: 'pointer', padding: '0.55rem 0.75rem', borderRadius: 10,
                        background: active ? '#EFF6FF' : '#F8FAFC',
                        border: `1px solid ${active ? '#2563EB' : '#E2E8F0'}`,
                        borderLeft: `3.5px solid ${f.color}`,
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 54,
                        boxShadow: active ? '0 2px 4px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: f.color, fontFamily: 'monospace' }}>{filterCounts[f.key] ?? 0}</span>
                        <IconComp size={16} color={f.color} style={{ opacity: 0.9 }} />
                      </div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, color: active ? '#1D4ED8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>{f.cardLabel}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search & filters (Account No / Ref No / Name text search, status + net type filters) */}
            {!viewLoading && (viewing.records || []).length > 0 && (
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', padding: '1rem 1.75rem 0' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                  <input
                    type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search Account No, Ref No or Name…"
                    style={{ width: '100%', padding: '0.5rem 0.7rem 0.5rem 2rem', borderRadius: 9, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: '0.78rem' }}
                  />
                </div>
                <FilterDropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                  minWidth={210}
                  options={STATUS_FILTERS.map(f => ({ value: f.key, label: f.label, count: filterCounts[f.key] ?? 0, color: f.color }))}
                />
                <FilterDropdown
                  value={netTypeFilter}
                  onChange={setNetTypeFilter}
                  minWidth={200}
                  placeholderColor="#2563EB"
                  options={[
                    { value: 'ALL', label: 'All Net Types', count: (viewing.records || []).length, color: '#2563EB' },
                    ...netTypeOptions.map(([nt, count]) => ({ value: nt, label: nt, count, color: '#2563EB' })),
                  ]}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Showing <strong style={{ color: '#0F172A' }}>{displayRecords.length}</strong> of {(viewing.records || []).length} records · sorted by Account No
                </span>
              </div>
            )}

            <div style={{ padding: '1rem 1.75rem', overflow: 'auto', flex: 1 }}>
              {viewLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                  <Loader size={26} className="animate-spin" /><div style={{ marginTop: '0.6rem' }}>Loading dataset…</div>
                </div>
              ) : (viewing.records || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>No records in this snapshot.</div>
              ) : displayRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>No records match the current search / filters.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1rem' }}>
                  {displayRecords.map(({ row, idx }) => (
                    <CustomerCard
                      key={idx}
                      row={row}
                      onView={() => setDetailsIdx(idx)}
                      onEdit={() => openEditRecord(row, idx)}
                      onHistory={() => setAuditScope(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
              <button onClick={() => setAuditScope('ALL')} style={{ padding: '0.6rem 1.1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#334155', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <History size={15} color="#475569" /> Edit / Approval History ({(viewing.auditLog || []).length})
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => handleDownload(viewing)} disabled={downloadingId === viewing.id} style={{ padding: '0.6rem 1.25rem', background: '#16A34A', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)' }}>
                  {downloadingId === viewing.id ? <Loader size={15} className="animate-spin" /> : <Download size={15} />} Download Excel
                </button>
                <button onClick={() => setViewing(null)} style={{ padding: '0.6rem 1.25rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 10, cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record detail modal — full merged record + preserved validation, from the snapshot only */}
      {detailRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, width: '100%', maxWidth: '860px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Ref No: {cellText(detailRecord.refNo)}</div>
                <h3 style={{ margin: '0.15rem 0', fontSize: '1.15rem', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A' }}>{cellText(detailRecord.accountNo)}</h3>
                <div style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                  {cellText(detailRecord.npayName) !== '—' ? cellText(detailRecord.npayName) : cellText(detailRecord.customerName)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <RecordStatusBadge row={detailRecord} />
                <button onClick={() => setDetailsIdx(null)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}><X size={18} /></button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflow: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {CARD_SECTIONS.map(sec => (
                  <div key={sec.title} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.85rem 1rem', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: sec.color, marginBottom: '0.5rem' }}>{sec.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {sec.fields.map(f => (
                        <div key={f.label} style={{ fontSize: '0.76rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <span style={{ color: '#64748B' }}>{f.label}</span>
                          <span style={{ color: '#0F172A', fontWeight: 600, textAlign: 'right' }}>{fieldValue(detailRecord, f)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Validation — status, errors, warnings, duplicates and mismatch history, preserved as approved */}
              <div style={{ marginTop: '1rem', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.85rem 1rem', background: '#F8FAFC' }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#DC2626', marginBottom: '0.5rem' }}>Validation</div>
                {(detailRecord.status === 'REJECTED' || detailRecord.rejected === true) && (
                  <div style={{ marginTop: '0.25rem', marginBottom: '0.75rem', border: '1px solid #FECACA', borderRadius: 8, padding: '0.6rem 0.8rem', background: '#FEF2F2', color: '#DC2626', fontSize: '0.78rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.15rem' }}>Rejection Reason / Comments:</strong>
                    {detailRecord.rejectionReason || 'Rejected during Step 6 review'}
                  </div>
                )}
                {(detailRecord.errors || []).map((e, i) => (
                  <div key={`e${i}`} style={{ fontSize: '0.75rem', color: '#DC2626', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}><AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />{e}</div>
                ))}
                {(detailRecord.warnings || []).map((w, i) => (
                  <div key={`w${i}`} style={{ fontSize: '0.75rem', color: '#D97706', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}><AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />{w}</div>
                ))}
                {(detailRecord.errors || []).length === 0 && (detailRecord.warnings || []).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}><CheckCircle size={12} /> No errors or warnings</div>
                )}
                {isDuplicateRecord(detailRecord) && (
                  <div style={{ fontSize: '0.73rem', color: '#7E22CE', marginBottom: '0.25rem' }}>
                    Duplicate sources — NGEN: {cellText(detailRecord.ngenSourceCount)} · NPAY: {cellText(detailRecord.npaySourceCount)}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {[['Name Match', 'nameMatch', 'nameApproved'], ['Unit Rate Match', 'unitRateMatch', 'unitRateApproved'], ['Net Type Match', 'netTypeMatch', 'netTypeApproved']].map(([lbl, mk, ak]) => (
                    detailRecord[mk] ? (
                      <div key={mk} style={{ fontSize: '0.73rem', color: '#475569' }}>
                        {lbl}: <strong style={{ color: detailRecord[mk] === 'MISMATCH' ? '#DC2626' : '#16A34A' }}>{cellText(detailRecord[mk])}</strong>
                        {detailRecord[ak] === true && <span style={{ color: '#16A34A' }}> (reviewer approved)</span>}
                      </div>
                    ) : null
                  ))}
                  {detailRecord.recordApproved === true && (
                    <div style={{ fontSize: '0.73rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ShieldCheck size={12} /> Record approved by {cellText(detailRecord.recordApprovedBy)} {detailRecord.recordApprovedAt ? `on ${cellText(detailRecord.recordApprovedAt)}` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
              <button onClick={() => setAuditScope(detailsIdx)} style={{ padding: '0.6rem 1.1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#334155', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <History size={14} color="#475569" /> Audit History
              </button>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => openEditRecord(detailRecord, detailsIdx)} style={{ padding: '0.6rem 1.1rem', background: '#2563EB', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)' }}>
                  <Edit3 size={14} /> Edit Record
                </button>
                <button onClick={() => setDetailsIdx(null)} style={{ padding: '0.6rem 1.1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 10, cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit record modal (post-Step-6 working area) */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, width: '100%', maxWidth: '780px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit3 size={18} color="#2563EB" /> Edit Record
                </h3>
                <div style={{ marginTop: '0.35rem', fontSize: '0.76rem', color: '#64748B' }}>
                  Account No: <strong style={{ color: '#0F172A' }}>{cellText(editing.record.accountNo)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <RecordStatusBadge row={editing.record} />
                <button onClick={closeEdit} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}><X size={18} /></button>
              </div>
            </div>

            {/* Current validation issues (never auto-removed) */}
            {((editing.record.errors || []).length > 0 || (editing.record.warnings || []).length > 0) && (
              <div style={{ padding: '0.9rem 1.5rem 0' }}>
                {(editing.record.errors || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', color: '#DC2626', marginBottom: '0.4rem' }}>
                    <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>{(editing.record.errors || []).join('  •  ')}</div>
                  </div>
                )}
                {(editing.record.warnings || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', color: '#D97706' }}>
                    <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>{(editing.record.warnings || []).join('  •  ')}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.85rem' }}>
                {EDIT_FIELDS.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>
                    {f.label}
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={editForm[f.key] ?? ''}
                      onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      disabled={!!recordSaving}
                      style={{ padding: '0.55rem 0.7rem', borderRadius: 9, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: '0.82rem' }}
                    />
                  </label>
                ))}
              </div>
              {editing.record.recordApproved === true && (
                <div style={{ marginTop: '1rem', fontSize: '0.72rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={14} /> Approved by {cellText(editing.record.recordApprovedBy)} {editing.record.recordApprovedAt ? `on ${cellText(editing.record.recordApprovedAt)}` : ''}
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
              <button disabled={!!recordSaving} onClick={closeEdit} style={{ padding: '0.6rem 1.1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 10, cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>Cancel</button>
              <button disabled={!!recordSaving} onClick={() => handleRecordAction('save')} style={{ padding: '0.6rem 1.1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: 10, cursor: recordSaving ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                {recordSaving === 'save' ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
              <button disabled={!!recordSaving} onClick={() => handleRecordAction('revalidate')} style={{ padding: '0.6rem 1.1rem', background: '#4F46E5', border: 'none', color: 'white', borderRadius: 10, cursor: recordSaving ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(79, 70, 229, 0.2)' }}>
                {recordSaving === 'revalidate' ? <Loader size={14} className="animate-spin" /> : <RotateCcw size={14} />} Revalidate
              </button>
              <button disabled={!!recordSaving} onClick={() => handleRecordAction('approve')} style={{ padding: '0.6rem 1.1rem', background: '#16A34A', border: 'none', color: 'white', borderRadius: 10, cursor: recordSaving ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)' }}>
                {recordSaving === 'approve' ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit history modal (full snapshot or scoped to one record) */}
      {auditScope !== null && viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, width: '100%', maxWidth: '720px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#2563EB" /> Edit &amp; Approval History
                {typeof auditScope === 'number' && (viewing.records || [])[auditScope] && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B' }}>— Account {cellText((viewing.records || [])[auditScope].accountNo)}</span>
                )}
              </h3>
              <button onClick={() => setAuditScope(null)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
              {auditEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                  {typeof auditScope === 'number' ? 'No edits or approvals recorded for this record yet.' : 'No edits or approvals recorded yet.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {auditEntries.map((e, i) => (
                    <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.75rem 0.9rem', background: '#F8FAFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.78rem', color: '#0F172A' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.66rem', fontWeight: 700, background: e.action === 'APPROVE' ? '#DCFCE7' : e.action === 'REVALIDATE' ? '#EFF6FF' : '#FEF3C7', color: e.action === 'APPROVE' ? '#15803D' : e.action === 'REVALIDATE' ? '#2563EB' : '#B45309' }}>{e.action}</span>
                          Account {cellText(e.accountNo)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{cellText(e.timestamp)} · {cellText(e.user)}</span>
                      </div>
                      {(e.statusBefore !== e.statusAfter) && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#475569' }}>
                          Status: <strong style={{ color: '#0F172A' }}>{cellText(e.statusBefore) || '—'}</strong> → <strong style={{ color: '#0F172A' }}>{cellText(e.statusAfter) || '—'}</strong>
                        </div>
                      )}
                      {e.changes && Object.keys(e.changes).length > 0 && (
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {Object.entries(e.changes).map(([k, v]) => (
                            <div key={k} style={{ fontSize: '0.7rem', color: '#475569' }}>
                              <span style={{ color: '#64748B' }}>{k}:</span> {cellText(v?.from) || '—'} → <strong style={{ color: '#0F172A' }}>{cellText(v?.to) || '—'}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
              <button onClick={() => setAuditScope(null)} style={{ padding: '0.6rem 1.25rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 10, cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renaming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, width: '100%', maxWidth: '460px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Pencil size={18} color="#2563EB" /> Rename Dataset</h3>
              <button onClick={() => !renameSaving && setRenaming(null)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.5 }}>
              Renaming updates only the dataset name. Customer records are not modified.
            </p>
            <input type="text" autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: 10, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: '0.9rem', marginBottom: '1.25rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button disabled={renameSaving} onClick={() => setRenaming(null)} style={{ flex: 1, padding: '0.7rem', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 10, cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>Cancel</button>
              <button disabled={renameSaving} onClick={handleRename} style={{ flex: 1, padding: '0.7rem', background: '#2563EB', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)' }}>
                {renameSaving ? <><Loader size={14} className="animate-spin" /> Saving…</> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyCustomerDirectory;
