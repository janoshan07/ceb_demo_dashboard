import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Archive, FolderOpen, Pencil, Trash2, Download, X, Loader,
  Calendar, Users, CheckCircle, Clock, RefreshCw, FileSpreadsheet, User,
  Edit3, History, AlertTriangle, ShieldCheck, RotateCcw, Save, Search, Eye,
  ChevronDown, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
// Same agreement-expiry rules as Step 6 (Agreement Date + 7 years, categorized against the
// billing month window) — reused so the directory never invents its own expiry semantics.
import { computeAgreementExpiry, agreementExpiryStatus } from './UploadPage';

// Field groups shown on every Customer Card / detail view — grouped by merged source file,
// exactly as saved from Step 6 (the snapshot is only loaded, never rebuilt or recompared).
const CARD_SECTIONS = [
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

// Fields a user may edit in the post-Step-6 working area. Editing these and revalidating re-runs
// the exact same validation rules server-side (nothing is auto-corrected).
const EDIT_FIELDS = [
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

const cellText = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') {
    if ('value' in val) return val.value ?? '—';
    return '—';
  }
  return String(val);
};

// Resolves one card field from the record, walking fallback keys (or joining bank details).
const fieldValue = (row, f) => {
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
const recordNetType = (row) => {
  for (const k of ['ngenNetType', 'npayNetType', 'masterNetType', 'solarType']) {
    const v = cellText(row[k]);
    if (v !== '—' && v.trim() !== '') return v;
  }
  return null;
};

// Duplicate flags preserved from Step 5/6 — detection only, never resolved here.
const isDuplicateRecord = (row) =>
  String(row.status || '').toUpperCase() === 'DUPLICATE'
  || row.hasDuplicateSources === true
  || Number(row.ngenSourceCount) > 1
  || Number(row.npaySourceCount) > 1;

// Folds raw net type variants ("NET PLUS", "net-plus", …) into one clear display name so the
// Net Type dropdown never shows duplicate options.
const normalizeNetType = (raw) => {
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
const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Statuses', cardLabel: 'Total Customers', color: '#38bdf8' },
  { key: 'VALID', label: 'Valid', cardLabel: 'Valid', color: '#10b981' },
  { key: 'ERROR', label: 'Errors', cardLabel: 'Errors', color: '#f87171' },
  { key: 'WARNING', label: 'Warnings', cardLabel: 'Warnings', color: '#f59e0b' },
  { key: 'DUPLICATE', label: 'Duplicates', cardLabel: 'Duplicates', color: '#c084fc' },
  { key: 'NAME_MISMATCH', label: 'Name Mismatch', cardLabel: 'Name Mismatch', color: '#fb7185' },
  { key: 'UNIT_RATE_MISMATCH', label: 'Unit Rate Mismatch', cardLabel: 'Unit Rate Mismatch', color: '#fbbf24' },
  { key: 'NET_TYPE_MISMATCH', label: 'Net Type Mismatch', cardLabel: 'Net Type Mismatch', color: '#a78bfa' },
  { key: 'REJECTED', label: 'Rejected', cardLabel: 'Rejected', color: '#f87171', card: false },
  { key: 'EXPIRED', label: 'Expired Agreements', cardLabel: 'Expired Agreements', color: '#ef4444' },
  { key: 'EXPIRING_SOON', label: 'Expiring Soon', cardLabel: 'Expiring Soon', color: '#f97316' },
];

const StatusBadge = ({ status }) => {
  const s = status || 'APPROVED';
  const isApproved = s === 'APPROVED';
  return (
    <span style={{
      padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
      background: isApproved ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
      color: isApproved ? '#10b981' : '#f59e0b',
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
    }}>
      {isApproved ? <CheckCircle size={11} /> : <Clock size={11} />}
      {isApproved ? 'Approved' : 'Pending Approval'}
    </span>
  );
};

// Per-record validation status styling (preserved exactly as saved from Step 6).
const RECORD_STATUS_STYLE = {
  VALID: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Valid' },
  WARNING: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Warning' },
  ERROR: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'Error' },
  REJECTED: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'Rejected' },
  DUPLICATE: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', label: 'Duplicate' },
};

const MismatchChip = ({ label, color = '#f87171', bg = 'rgba(239,68,68,0.12)', border = 'rgba(239,68,68,0.3)' }) => (
  <span style={{ padding: '0.1rem 0.4rem', borderRadius: 6, fontSize: '0.6rem', fontWeight: 700, background: bg, color, border: `1px solid ${border}` }}>
    {label}
  </span>
);

const RecordStatusBadge = ({ row }) => {
  const st = String(row.status || 'VALID').toUpperCase();
  const cfg = RECORD_STATUS_STYLE[st] || RECORD_STATUS_STYLE.VALID;
  const dup = isDuplicateRecord(row) && st !== 'DUPLICATE';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
      {row.recordApproved === true && (
        <span style={{ fontSize: '0.62rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> Approved</span>
      )}
      {(row.nameMatch === 'MISMATCH' || row.unitRateMatch === 'MISMATCH' || row.netTypeMatch === 'MISMATCH' || dup) && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {row.nameMatch === 'MISMATCH' && <MismatchChip label="Name" />}
          {row.unitRateMatch === 'MISMATCH' && <MismatchChip label="Rate" />}
          {row.netTypeMatch === 'MISMATCH' && <MismatchChip label="Net" />}
          {dup && <MismatchChip label="Duplicate" color="#c084fc" bg="rgba(168,85,247,0.12)" border="rgba(168,85,247,0.3)" />}
        </div>
      )}
    </div>
  );
};

// Builds an editable form object from a record using the EDIT_FIELDS whitelist.
const pickEditable = (row) => {
  const f = {};
  EDIT_FIELDS.forEach(({ key }) => {
    const v = row[key];
    f[key] = (v === null || v === undefined || typeof v === 'object') ? '' : String(v);
  });
  return f;
};

const cardBtn = (color, bg, border) => ({
  padding: '0.4rem 0.65rem', background: bg, border: `1px solid ${border}`, color, borderRadius: 8,
  fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
});

// One Customer Card — displays every merged Step 6 field for a record, its preserved
// validation state, and the per-record actions of the post-approval working area.
const CustomerCard = ({ row, onView, onEdit, onHistory }) => {
  const errors = row.errors || [];
  const warnings = row.warnings || [];
  const name = cellText(row.npayName) !== '—' ? cellText(row.npayName) : cellText(row.customerName);
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 14, background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column' }}>
      {/* Header: Ref No / Account No / Customer Name */}
      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ref No: {cellText(row.refNo)}</div>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', margin: '0.15rem 0', color: 'white' }}>{cellText(row.accountNo)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        </div>
        <RecordStatusBadge row={row} />
      </div>

      {/* Merged source sections */}
      <div style={{ padding: '0.7rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {CARD_SECTIONS.map(sec => (
          <div key={sec.title}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: sec.color, marginBottom: '0.25rem' }}>{sec.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
              {sec.fields.map(f => (
                <div key={f.label} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '58%' }}>{fieldValue(row, f)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Validation issues (preserved exactly as approved in Step 6) */}
        <div>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#f87171', marginBottom: '0.25rem' }}>Validation</div>
          {errors.length === 0 && warnings.length === 0 ? (
            <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={11} /> No validation issues</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
              {errors.slice(0, 2).map((e, i) => (
                <div key={`e${i}`} style={{ fontSize: '0.68rem', color: '#f87171', display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}><AlertTriangle size={10} style={{ marginTop: 2, flexShrink: 0 }} />{e}</div>
              ))}
              {warnings.slice(0, 2).map((w, i) => (
                <div key={`w${i}`} style={{ fontSize: '0.68rem', color: '#f59e0b', display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}><AlertTriangle size={10} style={{ marginTop: 2, flexShrink: 0 }} />{w}</div>
              ))}
              {(errors.length + warnings.length) > 4 && (
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>+{errors.length + warnings.length - 4} more — open View Details</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card actions */}
      <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onView} title="View full record" style={cardBtn('#38bdf8', 'rgba(56,189,248,0.12)', 'rgba(56,189,248,0.3)')}><Eye size={12} /> View Details</button>
        <button onClick={onEdit} title="Edit / Revalidate / Approve" style={cardBtn('#818cf8', 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.3)')}><Edit3 size={12} /> Edit</button>
        <button onClick={onHistory} title="Audit history of this record" style={cardBtn('#f59e0b', 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.3)')}><History size={12} /> History</button>
      </div>
    </div>
  );
};

// Custom dark-theme dropdown replacing native <select>, whose option popup rendered with
// unreadable browser-default styling. Each option shows a color dot, its label and live count;
// the active option is highlighted, and the panel closes on outside-click or selection.
const FilterDropdown = ({ value, options, onChange, minWidth = 190, placeholderColor }) => {
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
          padding: '0.5rem 0.7rem', borderRadius: 9, background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${open ? 'var(--primary)' : 'var(--border-color)'}`, color: 'white',
          fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dot(selected?.color || placeholderColor || '#64748b')}
          {selected?.label}
          {selected && selected.count !== undefined && (
            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>({selected.count})</span>
          )}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--text-secondary)' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10,
          boxShadow: '0 12px 34px rgba(0,0,0,0.55)', padding: '0.35rem', maxHeight: 320, overflowY: 'auto'
        }}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                  padding: '0.5rem 0.6rem', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: active ? 'white' : 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: active ? 700 : 500
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dot(o.color || placeholderColor || '#64748b')}
                  {o.label}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: active ? 'white' : 'var(--text-muted)' }}>{o.count}</span>
                  {active && <Check size={13} style={{ color: '#818cf8' }} />}
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
  const { authFetch } = useAuth();
  const { showToast, showConfirm } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const res = await authFetch('/api/officer/monthly-directory');
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Failed to load directories.', 'error'); return; }
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast('Failed to load directories: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [authFetch, showToast]);

  useEffect(() => { loadList(); }, [loadList]);

  const handleOpen = async (item) => {
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
      if (!res.ok) { showToast(data.message || 'Failed to open directory.', 'error'); setViewing(null); return; }
      setViewing(data);
    } catch (e) {
      showToast('Failed to open directory: ' + e.message, 'error');
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
    if (!name) { showToast('Dataset name cannot be empty.', 'warning'); return; }
    try {
      setRenameSaving(true);
      const res = await authFetch(`/api/officer/monthly-directory/${renaming.id}/rename?datasetName=${encodeURIComponent(name)}`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Rename failed.', 'error'); return; }
      showToast('Dataset renamed.', 'success');
      setItems(prev => prev.map(it => it.id === renaming.id ? { ...it, datasetName: data.datasetName } : it));
      setRenaming(null);
    } catch (e) {
      showToast('Rename failed: ' + e.message, 'error');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await showConfirm({
      title: 'Delete Dataset',
      message: `Permanently delete "${item.datasetName}"? This removes the archived monthly directory. Customer records are not affected.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;
    try {
      const res = await authFetch(`/api/officer/monthly-directory/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Delete failed.', 'error'); return; }
      showToast('Directory deleted.', 'success');
      setItems(prev => prev.filter(it => it.id !== item.id));
      if (viewing && viewing.id === item.id) setViewing(null);
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    }
  };

  const handleDownload = async (item) => {
    try {
      setDownloadingId(item.id);
      const res = await authFetch(`/api/officer/monthly-directory/${item.id}/download/excel`);
      if (!res.ok) {
        let msg = 'Download failed.';
        try { const d = await res.json(); msg = d.message || msg; } catch (_) {}
        showToast(msg, 'error');
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
      showToast('Download failed: ' + e.message, 'error');
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
      if (!res.ok) { showToast(data.message || 'Update failed.', 'error'); return; }
      // Merge the server's authoritative record + refreshed summary + audit history back into view.
      setViewing(prev => {
        if (!prev) return prev;
        const records = [...(prev.records || [])];
        records[data.recordIndex] = data.record;
        return { ...prev, records, validationSummary: data.validationSummary, auditLog: data.auditLog };
      });
      setEditing({ index: data.recordIndex, record: data.record });
      setEditForm(pickEditable(data.record));
      const msg = action === 'approve' ? '✅ Record approved & saved.'
        : action === 'revalidate' ? '🔄 Record revalidated.'
        : '💾 Record saved.';
      showToast(msg, 'success');
      if (action === 'approve') { setEditing(null); setEditForm({}); }
    } catch (e) {
      showToast('Update failed: ' + e.message, 'error');
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

  // One predicate shared by the clickable summary cards and the Status dropdown.
  const matchesFilter = useCallback((row, key) => {
    switch (key) {
      case 'ALL': return true;
      case 'DUPLICATE': return isDuplicateRecord(row);
      case 'NAME_MISMATCH': return row.nameMatch === 'MISMATCH';
      case 'UNIT_RATE_MISMATCH': return row.unitRateMatch === 'MISMATCH';
      case 'NET_TYPE_MISMATCH': return row.netTypeMatch === 'MISMATCH';
      case 'EXPIRED': return rowExpiry(row) === 'EXPIRED';
      case 'EXPIRING_SOON': return rowExpiry(row) === 'EXPIRING_SOON';
      default: return String(row.status || '').toUpperCase() === key;
    }
  }, [rowExpiry]);

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

  const th = { padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const td = { padding: '0.75rem 0.9rem', fontSize: '0.85rem', verticalAlign: 'middle' };
  const actionBtn = (color, bg, border) => ({
    padding: '0.35rem 0.6rem', background: bg, border: `1px solid ${border}`, color, borderRadius: 7,
    fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
  });

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Archive size={20} color="white" />
            </div>
            Monthly Customer Directory
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Permanent per-month snapshots of approved final Customer Directory datasets. Kept until deleted manually.
          </p>
        </div>
        <button onClick={loadList} style={{ padding: '0.5rem 1.1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="card" style={{ padding: '1.5rem', borderRadius: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader size={28} className="animate-spin" />
            <div style={{ marginTop: '0.75rem' }}>Loading archived directories…</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <Archive size={40} style={{ opacity: 0.4, marginBottom: '0.75rem', color: '#10b981' }} />
            <div style={{ fontWeight: 600 }}>No monthly directories yet.</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Approve a Step 6 import in the Excel Import Wizard to create the first snapshot.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={th}>Dataset Name</th>
                  <th style={th}>Billing Month</th>
                  <th style={th}>Total Records</th>
                  <th style={th}>Created Date</th>
                  <th style={th}>Approved By</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FolderOpen size={15} color="#10b981" /> {item.datasetName}
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                        <Calendar size={13} /> {item.billingMonth || '—'}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Users size={13} color="#818cf8" /> {item.totalRecords ?? 0}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.createdDate || '—'}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                        <User size={13} /> {item.approvedBy || '—'}
                      </span>
                    </td>
                    <td style={td}><StatusBadge status={item.status} /></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button onClick={() => handleOpen(item)} title="Open / View" style={actionBtn('#818cf8', 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.3)')}>
                          <FolderOpen size={12} /> Open
                        </button>
                        <button onClick={() => openRename(item)} title="Rename Dataset" style={actionBtn('#f59e0b', 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.3)')}>
                          <Pencil size={12} /> Rename
                        </button>
                        <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id} title="Download Excel" style={actionBtn('#10b981', 'rgba(16,185,129,0.12)', 'rgba(16,185,129,0.3)')}>
                          {downloadingId === item.id ? <Loader size={12} className="animate-spin" /> : <Download size={12} />} Excel
                        </button>
                        <button onClick={() => handleDelete(item)} title="Delete Dataset" style={actionBtn('#f87171', 'rgba(239,68,68,0.12)', 'rgba(239,68,68,0.3)')}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open / View modal */}
      {viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '1250px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem 1.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileSpreadsheet size={19} color="#10b981" /> {viewing.datasetName}
                </h3>
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <span><strong style={{ color: 'white' }}>Billing Month:</strong> {viewing.billingMonth || '—'}</span>
                  <span><strong style={{ color: 'white' }}>Total Records:</strong> {viewing.totalRecords ?? 0}</span>
                  <span><strong style={{ color: 'white' }}>Approved By:</strong> {viewing.approvedBy || '—'}</span>
                  <span><strong style={{ color: 'white' }}>Approval Date:</strong> {viewing.approvalDate || '—'}</span>
                </div>
              </div>
              <button onClick={() => setViewing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Validation summary — clickable cards; clicking filters the customer list instantly,
                "Total Customers" (ALL) clears the status filter. */}
            {!viewLoading && (viewing.records || []).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))', gap: '0.5rem', padding: '1rem 1.75rem 0' }}>
                {STATUS_FILTERS.filter(f => f.card !== false).map(f => {
                  const active = statusFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      title={f.key === 'ALL' ? 'Show all customers (clear filter)' : `Show only: ${f.cardLabel}`}
                      style={{
                        textAlign: 'left', cursor: 'pointer', padding: '0.55rem 0.7rem', borderRadius: 10,
                        background: active ? `${f.color}22` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? f.color : 'var(--border-color)'}`,
                        borderLeft: `3px solid ${f.color}`,
                      }}
                    >
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: f.color, fontFamily: 'monospace' }}>{filterCounts[f.key] ?? 0}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: active ? 'white' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.cardLabel}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search & filters (Account No / Ref No / Name text search, status + net type filters) */}
            {!viewLoading && (viewing.records || []).length > 0 && (
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', padding: '1rem 1.75rem 0' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search Account No, Ref No or Name…"
                    style={{ width: '100%', padding: '0.5rem 0.7rem 0.5rem 2rem', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.78rem' }}
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
                  placeholderColor="#818cf8"
                  options={[
                    { value: 'ALL', label: 'All Net Types', count: (viewing.records || []).length, color: '#818cf8' },
                    ...netTypeOptions.map(([nt, count]) => ({ value: nt, label: nt, count, color: '#818cf8' })),
                  ]}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Showing <strong style={{ color: 'white' }}>{displayRecords.length}</strong> of {(viewing.records || []).length} records · sorted by Account No
                </span>
              </div>
            )}

            <div style={{ padding: '1rem 1.75rem', overflow: 'auto', flex: 1 }}>
              {viewLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <Loader size={26} className="animate-spin" /><div style={{ marginTop: '0.6rem' }}>Loading dataset…</div>
                </div>
              ) : (viewing.records || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No records in this snapshot.</div>
              ) : displayRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No records match the current search / filters.</div>
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

            <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={() => setAuditScope('ALL')} style={{ padding: '0.6rem 1.1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={15} /> Edit / Approval History ({(viewing.auditLog || []).length})
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => handleDownload(viewing)} disabled={downloadingId === viewing.id} style={{ padding: '0.6rem 1.25rem', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {downloadingId === viewing.id ? <Loader size={15} className="animate-spin" /> : <Download size={15} />} Download Excel
                </button>
                <button onClick={() => setViewing(null)} style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record detail modal — full merged record + preserved validation, from the snapshot only */}
      {detailRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '860px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ref No: {cellText(detailRecord.refNo)}</div>
                <h3 style={{ margin: '0.15rem 0', fontSize: '1.15rem', fontWeight: 700, fontFamily: 'monospace' }}>{cellText(detailRecord.accountNo)}</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {cellText(detailRecord.npayName) !== '—' ? cellText(detailRecord.npayName) : cellText(detailRecord.customerName)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <RecordStatusBadge row={detailRecord} />
                <button onClick={() => setDetailsIdx(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflow: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {CARD_SECTIONS.map(sec => (
                  <div key={sec.title} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: sec.color, marginBottom: '0.5rem' }}>{sec.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {sec.fields.map(f => (
                        <div key={f.label} style={{ fontSize: '0.76rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                          <span style={{ color: 'white', fontWeight: 600, textAlign: 'right' }}>{fieldValue(detailRecord, f)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Validation — status, errors, warnings, duplicates and mismatch history, preserved as approved */}
              <div style={{ marginTop: '1rem', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#f87171', marginBottom: '0.5rem' }}>Validation</div>
                {(detailRecord.errors || []).map((e, i) => (
                  <div key={`e${i}`} style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}><AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />{e}</div>
                ))}
                {(detailRecord.warnings || []).map((w, i) => (
                  <div key={`w${i}`} style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}><AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />{w}</div>
                ))}
                {(detailRecord.errors || []).length === 0 && (detailRecord.warnings || []).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}><CheckCircle size={12} /> No errors or warnings</div>
                )}
                {isDuplicateRecord(detailRecord) && (
                  <div style={{ fontSize: '0.73rem', color: '#c084fc', marginBottom: '0.25rem' }}>
                    Duplicate sources — NGEN: {cellText(detailRecord.ngenSourceCount)} · NPAY: {cellText(detailRecord.npaySourceCount)}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {[['Name Match', 'nameMatch', 'nameApproved'], ['Unit Rate Match', 'unitRateMatch', 'unitRateApproved'], ['Net Type Match', 'netTypeMatch', 'netTypeApproved']].map(([lbl, mk, ak]) => (
                    detailRecord[mk] ? (
                      <div key={mk} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                        {lbl}: <strong style={{ color: detailRecord[mk] === 'MISMATCH' ? '#f87171' : '#10b981' }}>{cellText(detailRecord[mk])}</strong>
                        {detailRecord[ak] === true && <span style={{ color: '#10b981' }}> (reviewer approved)</span>}
                      </div>
                    ) : null
                  ))}
                  {detailRecord.recordApproved === true && (
                    <div style={{ fontSize: '0.73rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ShieldCheck size={12} /> Record approved by {cellText(detailRecord.recordApprovedBy)} {detailRecord.recordApprovedAt ? `on ${cellText(detailRecord.recordApprovedAt)}` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button onClick={() => setAuditScope(detailsIdx)} style={{ padding: '0.6rem 1.1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <History size={14} /> Audit History
              </button>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => openEditRecord(detailRecord, detailsIdx)} style={{ padding: '0.6rem 1.1rem', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Edit3 size={14} /> Edit Record
                </button>
                <button onClick={() => setDetailsIdx(null)} style={{ padding: '0.6rem 1.1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit record modal (post-Step-6 working area) */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '760px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit3 size={18} color="#818cf8" /> Edit Record
                </h3>
                <div style={{ marginTop: '0.35rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Account No: <strong style={{ color: 'white' }}>{cellText(editing.record.accountNo)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <RecordStatusBadge row={editing.record} />
                <button onClick={closeEdit} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
            </div>

            {/* Current validation issues (never auto-removed) */}
            {((editing.record.errors || []).length > 0 || (editing.record.warnings || []).length > 0) && (
              <div style={{ padding: '0.9rem 1.5rem 0' }}>
                {(editing.record.errors || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', color: '#f87171', marginBottom: '0.4rem' }}>
                    <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>{(editing.record.errors || []).join('  •  ')}</div>
                  </div>
                )}
                {(editing.record.warnings || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', color: '#f59e0b' }}>
                    <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>{(editing.record.warnings || []).join('  •  ')}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.85rem' }}>
                {EDIT_FIELDS.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {f.label}
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={editForm[f.key] ?? ''}
                      onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      disabled={!!recordSaving}
                      style={{ padding: '0.55rem 0.7rem', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.82rem' }}
                    />
                  </label>
                ))}
              </div>
              {editing.record.recordApproved === true && (
                <div style={{ marginTop: '1rem', fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={14} /> Approved by {cellText(editing.record.recordApprovedBy)} {editing.record.recordApprovedAt ? `on ${cellText(editing.record.recordApprovedAt)}` : ''}
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button disabled={!!recordSaving} onClick={closeEdit} style={{ padding: '0.6rem 1.1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button disabled={!!recordSaving} onClick={() => handleRecordAction('save')} style={{ padding: '0.6rem 1.1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'white', borderRadius: 10, cursor: recordSaving ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {recordSaving === 'save' ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
              <button disabled={!!recordSaving} onClick={() => handleRecordAction('revalidate')} style={{ padding: '0.6rem 1.1rem', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', color: 'white', borderRadius: 10, cursor: recordSaving ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {recordSaving === 'revalidate' ? <Loader size={14} className="animate-spin" /> : <RotateCcw size={14} />} Revalidate
              </button>
              <button disabled={!!recordSaving} onClick={() => handleRecordAction('approve')} style={{ padding: '0.6rem 1.1rem', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: 'white', borderRadius: 10, cursor: recordSaving ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {recordSaving === 'approve' ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit history modal (full snapshot or scoped to one record) */}
      {auditScope !== null && viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '720px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#818cf8" /> Edit &amp; Approval History
                {typeof auditScope === 'number' && (viewing.records || [])[auditScope] && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>— Account {cellText((viewing.records || [])[auditScope].accountNo)}</span>
                )}
              </h3>
              <button onClick={() => setAuditScope(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
              {auditEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  {typeof auditScope === 'number' ? 'No edits or approvals recorded for this record yet.' : 'No edits or approvals recorded yet.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {auditEntries.map((e, i) => (
                    <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.78rem' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.66rem', fontWeight: 700, background: e.action === 'APPROVE' ? 'rgba(16,185,129,0.15)' : e.action === 'REVALIDATE' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: e.action === 'APPROVE' ? '#10b981' : e.action === 'REVALIDATE' ? '#818cf8' : '#f59e0b' }}>{e.action}</span>
                          Account {cellText(e.accountNo)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cellText(e.timestamp)} · {cellText(e.user)}</span>
                      </div>
                      {(e.statusBefore !== e.statusAfter) && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Status: <strong style={{ color: 'white' }}>{cellText(e.statusBefore) || '—'}</strong> → <strong style={{ color: 'white' }}>{cellText(e.statusAfter) || '—'}</strong>
                        </div>
                      )}
                      {e.changes && Object.keys(e.changes).length > 0 && (
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {Object.entries(e.changes).map(([k, v]) => (
                            <div key={k} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{k}:</span> {cellText(v?.from) || '—'} → <strong style={{ color: 'white' }}>{cellText(v?.to) || '—'}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAuditScope(null)} style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renaming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '460px', padding: '2rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Pencil size={18} color="#f59e0b" /> Rename Dataset</h3>
              <button onClick={() => !renameSaving && setRenaming(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Renaming updates only the dataset name. Customer records are not modified.
            </p>
            <input type="text" autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.9rem', marginBottom: '1.25rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button disabled={renameSaving} onClick={() => setRenaming(null)} style={{ flex: 1, padding: '0.7rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button disabled={renameSaving} onClick={handleRename} style={{ flex: 1, padding: '0.7rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
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
