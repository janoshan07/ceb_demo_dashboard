import React, { useEffect, useState, useCallback } from 'react';
import {
  Archive, FolderOpen, Pencil, Trash2, Download, X, Loader,
  Calendar, Users, CheckCircle, Clock, RefreshCw, FileSpreadsheet, User,
  Edit3, History, AlertTriangle, ShieldCheck, RotateCcw, Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Curated column set for the "Open/View" records table — mirrors the archived Excel export.
const VIEW_COLUMNS = [
  { key: 'accountNo', label: 'Account No' },
  { key: 'npayName', label: 'Name' },
  { key: 'customerAddress', label: 'Address' },
  { key: 'prevReadingDate', label: 'Prev Reading' },
  { key: 'currReadingDate', label: 'Curr Reading' },
  { key: 'ngenNetType', label: 'Net Type' },
  { key: 'kwhImport', label: 'kWh Import' },
  { key: 'kwhExport', label: 'kWh Export' },
  { key: 'kwhSales', label: 'kWh Sales' },
  { key: 'ngenUnitRate', label: 'Unit Rate' },
  { key: 'energyPurchase', label: 'Energy Purchase' },
  { key: 'payment', label: 'Payment' },
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

const MismatchChip = ({ label }) => (
  <span style={{ padding: '0.1rem 0.4rem', borderRadius: 6, fontSize: '0.6rem', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
    {label}
  </span>
);

const RecordStatusBadge = ({ row }) => {
  const st = String(row.status || 'VALID').toUpperCase();
  const cfg = RECORD_STATUS_STYLE[st] || RECORD_STATUS_STYLE.VALID;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
      {row.recordApproved === true && (
        <span style={{ fontSize: '0.62rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> Approved</span>
      )}
      {(row.nameMatch === 'MISMATCH' || row.unitRateMatch === 'MISMATCH' || row.netTypeMatch === 'MISMATCH') && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {row.nameMatch === 'MISMATCH' && <MismatchChip label="Name" />}
          {row.unitRateMatch === 'MISMATCH' && <MismatchChip label="Rate" />}
          {row.netTypeMatch === 'MISMATCH' && <MismatchChip label="Net" />}
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

  // Audit history modal
  const [showAudit, setShowAudit] = useState(false);

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
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '1050px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
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

            {/* Validation summary */}
            {viewing.validationSummary && (
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', padding: '1rem 1.75rem 0' }}>
                {Object.entries(viewing.validationSummary).map(([k, v]) => (
                  <span key={k} style={{ padding: '0.3rem 0.7rem', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {k}: <strong style={{ color: 'white' }}>{cellText(v)}</strong>
                  </span>
                ))}
              </div>
            )}

            <div style={{ padding: '1rem 1.75rem', overflow: 'auto', flex: 1 }}>
              {viewLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <Loader size={26} className="animate-spin" /><div style={{ marginTop: '0.6rem' }}>Loading dataset…</div>
                </div>
              ) : (viewing.records || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No records in this snapshot.</div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ ...th, padding: '0.5rem 0.7rem' }}>#</th>
                        <th style={{ ...th, padding: '0.5rem 0.7rem' }}>Validation</th>
                        {VIEW_COLUMNS.map(c => <th key={c.key} style={{ ...th, padding: '0.5rem 0.7rem' }}>{c.label}</th>)}
                        <th style={{ ...th, padding: '0.5rem 0.7rem', textAlign: 'right' }}>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewing.records || []).map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                          <td style={{ padding: '0.45rem 0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{i + 1}</td>
                          <td style={{ padding: '0.45rem 0.7rem' }}><RecordStatusBadge row={row} /></td>
                          {VIEW_COLUMNS.map(c => (
                            <td key={c.key} style={{ padding: '0.45rem 0.7rem', whiteSpace: 'nowrap' }}>{cellText(row[c.key])}</td>
                          ))}
                          <td style={{ padding: '0.45rem 0.7rem', textAlign: 'right' }}>
                            <button onClick={() => openEditRecord(row, i)} title="Edit record" style={actionBtn('#818cf8', 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.3)')}>
                              <Edit3 size={12} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={() => setShowAudit(true)} style={{ padding: '0.6rem 1.1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

      {/* Audit history modal */}
      {showAudit && viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '720px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} color="#818cf8" /> Edit &amp; Approval History
              </h3>
              <button onClick={() => setShowAudit(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
              {(viewing.auditLog || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>No edits or approvals recorded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {(viewing.auditLog || []).map((e, i) => (
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
              <button onClick={() => setShowAudit(false)} style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Close</button>
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
