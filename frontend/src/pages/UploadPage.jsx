import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  FileText, Loader, Trash2, Eye,
  Check, RefreshCw, Layers, Zap, User, Info,
  Database, Clock, CloudUpload, Pencil, X, Save
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
//  WIZARD STEP INDICATOR
// ═══════════════════════════════════════════════════════════════════════════
const WizardStepBar = ({ currentStep, steps, sessionStage }) => {
  const stageOrder = ['PENDING_MASTER', 'MASTER_APPROVED', 'CEB_APPROVED', 'COMPLETED'];
  const completedUpTo = stageOrder.indexOf(sessionStage);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '2rem', padding: '0 0.5rem' }}>
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone = completedUpTo >= stepNum;
        const isLocked = !isDone && currentStep < stepNum;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: isDone ? 'linear-gradient(135deg,#10b981,#059669)'
                  : isActive ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                  : 'rgba(255,255,255,0.06)',
                border: isActive ? '2.5px solid #818cf8' : isDone ? '2.5px solid #10b981' : '2px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isDone || isActive ? 'white' : 'var(--text-muted)',
                fontWeight: 700, fontSize: '1rem',
                boxShadow: isActive ? '0 0 20px rgba(99,102,241,0.4)' : isDone ? '0 0 12px rgba(16,185,129,0.3)' : 'none',
                transition: 'all 0.3s ease'
              }}>
                {isDone ? <Check size={20} /> : stepNum}
              </div>
              <div style={{
                marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 600, textAlign: 'center',
                color: isActive ? '#818cf8' : isDone ? '#10b981' : 'var(--text-muted)',
                maxWidth: 80
              }}>{step.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 2, flex: 2, maxWidth: 80,
                background: isDone ? 'linear-gradient(90deg,#10b981,#059669)' : 'rgba(255,255,255,0.08)',
                marginTop: -20, transition: 'all 0.4s ease'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  FILE DROP ZONE
// ═══════════════════════════════════════════════════════════════════════════
const FileDropZone = ({ onFileSelected, file, hint, accept = '.xlsx,.xls', disabled = false }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFileSelected(f);
  };
  const handleDragOver = (e) => { e.preventDefault(); if (!disabled) setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${dragging ? '#6366f1' : file ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 14, padding: '2.5rem 2rem', textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging ? 'rgba(99,102,241,0.06)' : file ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
        transition: 'all 0.25s ease', opacity: disabled ? 0.5 : 1
      }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => e.target.files[0] && onFileSelected(e.target.files[0])} />
      {file ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileSpreadsheet size={26} color="#10b981" />
          </div>
          <div style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>{file.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloudUpload size={28} color="#6366f1" />
          </div>
          <div style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>Drop your Excel file here</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>or click to browse · .xlsx / .xls</div>
          {hint && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.5, marginTop: '0.25rem' }}>{hint}</div>}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════
const StatusBadge = ({ status }) => {
  const cfg = {
    VALID:   { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Valid' },
    ERROR:   { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'Error' },
    WARNING: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Warning' },
  }[status] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', label: status };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PREVIEW TABLE — Master Data
// ═══════════════════════════════════════════════════════════════════════════
const MasterDataTable = ({ rows, filterErrors, onCorrectRow }) => {
  const [expandedRow, setExpandedRow] = useState(null);
  const displayed = filterErrors ? rows.filter(r => r.status !== 'VALID') : rows;
  if (!displayed.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
      <CheckCircle size={40} color="#10b981" style={{ marginBottom: '0.75rem' }} />
      <div style={{ fontWeight: 600 }}>All records are valid!</div>
    </div>
  );
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
            {['Row','Account No','Customer Name','Mobile No','Solar Type','Unit Rate','Status','Actions'].map(h => (
              <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <React.Fragment key={i}>
              <tr
                onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: expandedRow === i ? 'rgba(99,102,241,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
              >
                <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)' }}>{row.rowNum}</td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>{row.accountNo}</td>
                <td style={{ padding: '0.6rem 0.85rem' }}>{row.customerName}</td>
                <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)' }}>{row.mobileNo}</td>
                <td style={{ padding: '0.6rem 0.85rem' }}>{row.solarType}</td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace' }}>{row.unitRate != null ? `LKR ${row.unitRate}` : '—'}</td>
                <td style={{ padding: '0.6rem 0.85rem' }}><StatusBadge status={row.status} /></td>
                <td style={{ padding: '0.6rem 0.85rem' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onCorrectRow(row)} style={{ padding: '0.25rem 0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                    Correct
                  </button>
                </td>
              </tr>
              {expandedRow === i && row.errors?.length > 0 && (
                <tr style={{ background: 'rgba(239,68,68,0.04)' }}>
                  <td colSpan={8} style={{ padding: '0.75rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <AlertTriangle size={15} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                      <ul style={{ margin: 0, paddingLeft: '1rem', color: '#ef4444', fontSize: '0.78rem', lineHeight: 1.7 }}>
                        {row.errors.map((e, ei) => <li key={ei}>{e}</li>)}
                      </ul>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PREVIEW TABLE — CEB Assist
// ═══════════════════════════════════════════════════════════════════════════
const CebAssistTable = ({ rows, filterErrors, onCorrectRow }) => {
  const displayed = filterErrors ? rows.filter(r => r.status !== 'VALID') : rows;
  if (!displayed.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
      <CheckCircle size={40} color="#10b981" style={{ marginBottom: '0.75rem' }} />
      <div style={{ fontWeight: 600 }}>All records matched!</div>
    </div>
  );
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
            {['Row','Account No','Customer Name','Prv. Rdg. Date','Crnt. Rdg. Date','Matched','Status','Actions'].map(h => (
              <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
              <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)' }}>{row.rowNum}</td>
              <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>{row.accountNo}</td>
              <td style={{ padding: '0.6rem 0.85rem' }}>{row.customerName || <span style={{ color: 'var(--text-muted)' }}>Not found</span>}</td>
              <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace' }}>{row.prevReadingDate || '—'}</td>
              <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace' }}>{row.currReadingDate || '—'}</td>
              <td style={{ padding: '0.6rem 0.85rem' }}>
                <span style={{ color: row.customerExists ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.75rem' }}>
                  {row.customerExists ? '✓ Yes' : '✗ No'}
                </span>
              </td>
              <td style={{ padding: '0.6rem 0.85rem' }}><StatusBadge status={row.status} /></td>
              <td style={{ padding: '0.6rem 0.85rem' }}>
                <button onClick={() => onCorrectRow(row)} style={{ padding: '0.25rem 0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                  Correct
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PREVIEW TABLE — NGEN
// ═══════════════════════════════════════════════════════════════════════════
const NgenTable = ({ rows, filterErrors, onCorrectRow }) => {
  const [expandedRow, setExpandedRow] = useState(null);
  const displayed = filterErrors ? rows.filter(r => r.status !== 'VALID') : rows;
  if (!displayed.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
      <CheckCircle size={40} color="#10b981" style={{ marginBottom: '0.75rem' }} />
      <div style={{ fontWeight: 600 }}>All records are valid!</div>
    </div>
  );
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
            {['Row','Account No','Customer','kWh Import','kWh Export','kWh Sales','Rate (LKR)','Bill Set Off','Payment Settled','Status','Actions'].map(h => (
              <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <React.Fragment key={i}>
              <tr 
                onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: expandedRow === i ? 'rgba(99,102,241,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
              >
                <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)' }}>{row.rowNum}</td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>{row.accountNo}</td>
                <td style={{ padding: '0.6rem 0.85rem' }}>{row.customerName || '—'}</td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace' }}>{row.kwhImport ?? '—'}</td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace' }}>{row.kwhExport ?? '—'}</td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: 600, color: (row.kwhSales ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {row.kwhSales != null ? row.kwhSales.toFixed(2) : '—'}
                </td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace' }}>
                  {row.effectiveUnitRate != null ? row.effectiveUnitRate.toFixed(2) : '—'}
                  {row.warnings?.some(w => w.includes('mismatch')) && (
                    <span title={row.warnings.find(w => w.includes('mismatch'))} style={{ marginLeft: 4, color: '#f59e0b', cursor: 'help' }}>⚠</span>
                  )}
                </td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', color: '#ef4444' }}>
                  {row.billSetOff != null ? `LKR ${row.billSetOff.toLocaleString()}` : '—'}
                </td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#6366f1' }}>
                  {row.paymentSettled != null ? `LKR ${row.paymentSettled.toLocaleString()}` : '—'}
                </td>
                <td style={{ padding: '0.6rem 0.85rem' }}><StatusBadge status={row.status} /></td>
                <td style={{ padding: '0.6rem 0.85rem' }}>
                  {onCorrectRow && <button onClick={(e) => { e.stopPropagation(); onCorrectRow(row); }} style={{ padding: '0.22rem 0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 5, fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>Edit</button>}
                </td>
              </tr>
              {expandedRow === i && (
                <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <td colSpan={11} style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div><strong>Address:</strong> {row.customerAddress || '—'}</div>
                      <div><strong>Ref No:</strong> {row.refNo || '—'}</div>
                      <div><strong>Mobile:</strong> {row.mobileNo || '—'}</div>
                      <div><strong>Prev Reading Date:</strong> {row.prevReadingDate || '—'}</div>
                      <div><strong>Curr Reading Date:</strong> {row.currReadingDate || '—'}</div>
                      <div><strong>Sales Amount:</strong> {row.salesAmount != null ? `LKR ${Number(row.salesAmount).toLocaleString()}` : '—'}</div>
                    </div>
                    {row.errors?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <XCircle size={13} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ color: '#ef4444', fontSize: '0.76rem' }}>{row.errors.join(' · ')}</span>
                      </div>
                    )}
                    {row.warnings?.length > 0 && (
                      <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <AlertTriangle size={13} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ color: '#f59e0b', fontSize: '0.73rem' }}>{row.warnings.join(' · ')}</span>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  STAT CARD
// ═══════════════════════════════════════════════════════════════════════════
const StatCard = ({ label, value, color = 'var(--text-secondary)', icon }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
    {icon && <div style={{ color }}>{icon}</div>}
    <div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  SESSION BADGE (top of page when session is active)
// ═══════════════════════════════════════════════════════════════════════════
const SessionBanner = ({ session, onDiscard }) => (
  <div style={{
    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '1.5rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Layers size={18} color="#818cf8" />
      </div>
      <div>
        <div style={{ fontWeight: 700, color: 'white', fontSize: '0.92rem' }}>Active Import Session</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {session.masterCustomerCount} customers imported · Stage: <strong style={{ color: '#818cf8' }}>
            {session.stage === 'MASTER_APPROVED' ? 'Awaiting CEB Assist' : session.stage === 'CEB_APPROVED' ? 'Awaiting NGEN' : session.stage}
          </strong>
        </div>
      </div>
    </div>
    <button onClick={onDiscard} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: 8, padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
      Discard &amp; Start Over
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const UploadPage = () => {
  const { authFetch, user } = useAuth();
  const { showToast } = useToast();

  // ── Wizard state ──────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState('wizard'); // 'wizard' | 'history'
  const [wizardStep, setWizardStep] = useState(1); // 1, 2, 3

  // ── Session state ─────────────────────────────────────────────────────
  const [session, setSession] = useState(null); // { sessionId, stage, masterCustomerCount, cebAssistCount, ngenCount }
  const [sessionLoading, setSessionLoading] = useState(true);

  // ── Step state (per step) ─────────────────────────────────────────────
  const [file, setFile] = useState(null);          // currently selected file for active step
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [preview, setPreview] = useState(null);    // preview data from backend
  const [filterErrors, setFilterErrors] = useState(false);

  // ── Upload history ────────────────────────────────────────────────────
  const [uploadHistory, setUploadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileInputRef = useRef(null);

  const WIZARD_STEPS = [
    { label: 'Master Data',  icon: <User size={16} /> },
    { label: 'CEB Assist',   icon: <Database size={16} /> },
    { label: 'NGEN Sheet',   icon: <Zap size={16} /> },
  ];

  // Stage → step mapping
  const stageToStep = (stage) => {
    if (!stage || stage === 'PENDING_MASTER') return 1;
    if (stage === 'MASTER_APPROVED') return 2;
    if (stage === 'CEB_APPROVED') return 3;
    return 1;
  };

  // ── On mount: check active session ───────────────────────────────────
  useEffect(() => {
    fetchActiveSession();
    fetchHistory();
  }, []);

  const fetchActiveSession = async () => {
    try {
      setSessionLoading(true);
      const res = await authFetch('/api/officer/import/session/active');
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveSession) {
          setSession(data);
          setWizardStep(stageToStep(data.stage));
        } else {
          setSession(null);
        }
      }
    } catch (e) {
      console.error('Failed to fetch session:', e);
    } finally {
      setSessionLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await authFetch('/api/officer/billing/uploads');
      if (res.ok) {
        const data = await res.json();
        setUploadHistory(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDiscardSession = async () => {
    if (!session) return;
    const confirmed = await showConfirm({
      title: 'Discard Session?',
      message: 'Are you sure you want to discard the current import session? All staging progress will be permanently deleted and you will need to restart from Step 1.',
      confirmText: 'Discard',
      cancelText: 'Keep Session',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      await authFetch(`/api/officer/import/session/${session.sessionId}`, { method: 'DELETE' });
      setSession(null);
      setWizardStep(1);
      setPreview(null);
      setFile(null);
      showToast('Import session discarded.', 'info');
    } catch (e) {
      showToast('Failed to discard session.', 'error');
    }
  };

  // ── File selection ────────────────────────────────────────────────────
  const handleFileSelect = (f) => {
    setFile(f);
    setPreview(null);
  };

  // ── Step 1: Master Data ───────────────────────────────────────────────
  const handleMasterPreview = async () => {
    if (!file) { showToast('Please select a Master Data file first.', 'warning'); return; }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch('/api/officer/import/master-data/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Preview failed.', 'error'); return; }
      setPreview(data);
      showToast(`Preview loaded: ${data.totalRows} rows, ${data.errorCount} errors.`, data.errorCount > 0 ? 'warning' : 'success');
    } catch (e) {
      showToast('Preview failed: ' + e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleMasterApprove = async () => {
    if (!file || !preview) { showToast('Please preview the file first.', 'warning'); return; }
    const validRows = preview.rows.filter(r => r.status === 'VALID').length;
    if (validRows === 0) { showToast('No valid rows to import.', 'error'); return; }
    try {
      setApproving(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('correctionsJson', '{}');
      const res = await authFetch('/api/admin/import/master-data/approve', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Approval failed.', 'error'); return; }
      showToast(`✅ Master Data approved! ${data.newCustomers} new, ${data.updatedCustomers} updated.`, 'success');
      setSession({ hasActiveSession: true, sessionId: data.sessionId, stage: 'MASTER_APPROVED', masterCustomerCount: data.totalImported });
      setWizardStep(2);
      setFile(null);
      setPreview(null);
      fetchHistory();
    } catch (e) {
      showToast('Approval failed: ' + e.message, 'error');
    } finally {
      setApproving(false);
    }
  };

  // ── Step 2: CEB Assist ────────────────────────────────────────────────
  const handleCebPreview = async () => {
    if (!file) { showToast('Please select a CEB Assist file first.', 'warning'); return; }
    if (!session?.sessionId) { showToast('No active import session. Please complete Step 1 first.', 'error'); return; }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sessionId', String(session.sessionId)); // CRITICAL: backend requires sessionId to look up staged master data
      const res = await authFetch('/api/officer/import/ceb-assist/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Preview failed.', 'error'); return; }
      setPreview(data);
      showToast(`Preview loaded: ${data.totalRows} rows, ${data.matchedCount} matched, ${data.unmatchedCount} unmatched.`,
        data.unmatchedCount > 0 ? 'warning' : 'success');
    } catch (e) {
      showToast('Preview failed: ' + e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCebApprove = async () => {
    if (!file || !preview) { showToast('Please preview the file first.', 'warning'); return; }
    if (!session?.sessionId) { showToast('No active import session. Please start from Step 1.', 'error'); return; }
    try {
      setApproving(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('correctionsJson', '{}');
      const res = await authFetch(`/api/admin/import/ceb-assist/${session.sessionId}/approve`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Approval failed.', 'error'); return; }
      showToast(`✅ CEB Assist merged! ${data.updatedCount} accounts updated.`, 'success');
      setSession(prev => ({ ...prev, stage: 'CEB_APPROVED', cebAssistCount: data.updatedCount }));
      setWizardStep(3);
      setFile(null);
      setPreview(null);
    } catch (e) {
      showToast('Approval failed: ' + e.message, 'error');
    } finally {
      setApproving(false);
    }
  };

  // ── Step 3: NGEN ──────────────────────────────────────────────────────
  const handleNgenPreview = async () => {
    if (!file) { showToast('Please select an NGEN file first.', 'warning'); return; }
    if (!session?.sessionId) { showToast('No active import session.', 'error'); return; }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sessionId', String(session.sessionId));
      const res = await authFetch('/api/officer/import/ngen/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Preview failed.', 'error'); return; }
      setPreview(data);
      showToast(`Preview loaded: ${data.totalRows} rows, ${data.warningCount} unit rate warnings.`,
        data.warningCount > 0 ? 'warning' : 'success');
    } catch (e) {
      showToast('Preview failed: ' + e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleNgenApprove = async () => {
    if (!file || !preview) { showToast('Please preview the file first.', 'warning'); return; }
    if (!session?.sessionId) { showToast('No active import session.', 'error'); return; }
    try {
      setApproving(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('correctionsJson', '{}');
      const res = await authFetch(`/api/admin/import/ngen/${session.sessionId}/approve`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Approval failed.', 'error'); return; }
      showToast(`🎉 Import Complete! ${data.billingRecordsCreated} billing records created. Customers added to directory.`, 'success');
      setSession(null);
      setWizardStep(1);
      setFile(null);
      setPreview(null);
      fetchHistory();
      setActiveView('history');
    } catch (e) {
      showToast('Approval failed: ' + e.message, 'error');
    } finally {
      setApproving(false);
    }
  };

  const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.role === 'ADMIN';

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER HELPERS
  // ════════════════════════════════════════════════════════════════════════

  const renderStep1 = () => (
    <div>
      {/* Info box */}
      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <Info size={16} color="#818cf8" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'white' }}>Step 1 — Master Data Upload</strong>
            <br />
            Upload the customer master data Excel sheet. Required columns:&nbsp;
            <span style={{ color: '#818cf8' }}>Account No, Customer Name, Address, Ref. No., Cost Code, Mobile Number, Panel Capacity, Agreement Date, Bank Code, Branch Code, Bank Account No, Type, Unit Rate, Fix/Variable, Exp</span>
          </div>
        </div>
      </div>

      <FileDropZone file={file} onFileSelected={handleFileSelect}
        hint="Must contain all 15 required customer profile columns. Each Account No must be a unique 10-digit number." />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        {file && !preview && (
          <button className="btn" onClick={handleMasterPreview} disabled={uploading}
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {uploading ? <><Loader size={15} className="animate-spin" /> Analysing…</> : <><Eye size={15} /> Preview Data</>}
          </button>
        )}
        {preview && isAdmin && (
          <button className="btn" onClick={handleMasterApprove} disabled={approving}
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {approving ? <><Loader size={15} className="animate-spin" /> Importing…</> : <><Check size={15} /> Approve &amp; Import</>}
          </button>
        )}
      </div>

      {/* Preview section */}
      {preview && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <StatCard label="Total Rows" value={preview.totalRows} color="white" icon={<FileText size={18} />} />
            <StatCard label="Valid" value={preview.totalRows - preview.errorCount} color="#10b981" icon={<CheckCircle size={18} />} />
            <StatCard label="Errors" value={preview.errorCount} color={preview.errorCount > 0 ? '#ef4444' : '#10b981'} icon={<XCircle size={18} />} />
          </div>

          {preview.globalErrors?.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><XCircle size={15} /> Schema Errors</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#ef4444', fontSize: '0.82rem', lineHeight: 1.8 }}>
                {preview.globalErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Row Preview</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterErrors} onChange={e => setFilterErrors(e.target.checked)} />
              Show errors only
            </label>
          </div>
          <MasterDataTable rows={preview.rows || []} filterErrors={filterErrors} />
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div>
      {session && (
        <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <CheckCircle size={17} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'white' }}>Step 1 Complete — {session.masterCustomerCount} customers imported.</strong>
            <br />
            Now upload the <strong style={{ color: '#10b981' }}>CEB Assist Sheet</strong>. Required columns: <span style={{ color: '#10b981' }}>Account No, Prv. Rdg. Date, Crnt. Rdg. Date</span>
          </div>
        </div>
      )}

      <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <Info size={16} color="#818cf8" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'white' }}>CEB Assist Sheet</strong>
            <br />
            This sheet adds <strong>Previous Reading Date</strong> and <strong>Current Reading Date</strong> to each customer record, matched by Account No.
          </div>
        </div>
      </div>

      <FileDropZone file={file} onFileSelected={handleFileSelect}
        hint="Requires columns: Account No, Prv. Rdg. Date (or Previous Reading Date), Crnt. Rdg. Date (or Current Reading Date)" />

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        {file && !preview && (
          <button className="btn" onClick={handleCebPreview} disabled={uploading}
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {uploading ? <><Loader size={15} className="animate-spin" /> Analysing…</> : <><Eye size={15} /> Preview Data</>}
          </button>
        )}
        {preview && isAdmin && (
          <button className="btn" onClick={handleCebApprove} disabled={approving}
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {approving ? <><Loader size={15} className="animate-spin" /> Merging…</> : <><Check size={15} /> Approve &amp; Merge</>}
          </button>
        )}
      </div>

      {preview && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <StatCard label="Total Rows" value={preview.totalRows} color="white" icon={<FileText size={18} />} />
            <StatCard label="Matched" value={preview.matchedCount} color="#10b981" icon={<CheckCircle size={18} />} />
            <StatCard label="Unmatched" value={preview.unmatchedCount} color={preview.unmatchedCount > 0 ? '#f59e0b' : '#10b981'} icon={<AlertTriangle size={18} />} />
            <StatCard label="Errors" value={preview.errorCount} color={preview.errorCount > 0 ? '#ef4444' : '#10b981'} icon={<XCircle size={18} />} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Row Preview</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterErrors} onChange={e => setFilterErrors(e.target.checked)} />
              Show errors / unmatched only
            </label>
          </div>
          <CebAssistTable rows={preview.rows || []} filterErrors={filterErrors} />
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div>
      {session && (
        <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <CheckCircle size={17} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'white' }}>Steps 1 &amp; 2 Complete</strong> — {session.masterCustomerCount} customers imported, {session.cebAssistCount ?? '?'} reading dates merged.
            <br />
            Now upload the <strong style={{ color: '#f59e0b' }}>NGEN Sheet</strong> to complete the import.
          </div>
        </div>
      )}

      <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <Info size={16} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'white' }}>NGEN Sheet</strong>
            <br />
            Required columns: <span style={{ color: '#f59e0b' }}>Account No, kWh Import, kWh Export, Unit Rate, Bi</span>
            <br />
            The system will automatically calculate: <em>kWh Sales = kWh Export − kWh Import</em> and <em>Payment Settled = kWh Sales × Unit Rate</em> (from Master Data).
            <br />
            <span style={{ color: '#f59e0b' }}>⚠ Unit Rate mismatches between NGEN and Master Data will be flagged as warnings.</span>
          </div>
        </div>
      </div>

      <FileDropZone file={file} onFileSelected={handleFileSelect}
        hint="Requires: Account No, kWh Import, kWh Export, Unit Rate, Bi" />

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        {file && !preview && (
          <button className="btn" onClick={handleNgenPreview} disabled={uploading}
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {uploading ? <><Loader size={15} className="animate-spin" /> Analysing…</> : <><Eye size={15} /> Preview &amp; Calculate</>}
          </button>
        )}
        {preview && isAdmin && (
          <button className="btn" onClick={handleNgenApprove} disabled={approving}
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {approving ? <><Loader size={15} className="animate-spin" /> Finalizing…</> : <><Zap size={15} /> Approve &amp; Finalize</>}
          </button>
        )}
      </div>

      {preview && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <StatCard label="Total Rows" value={preview.totalRows} color="white" icon={<FileText size={18} />} />
            <StatCard label="Matched" value={preview.matchedCount} color="#10b981" icon={<CheckCircle size={18} />} />
            <StatCard label="Warnings" value={preview.warningCount} color="#f59e0b" icon={<AlertTriangle size={18} />} />
            <StatCard label="Errors" value={preview.errorCount} color={preview.errorCount > 0 ? '#ef4444' : '#10b981'} icon={<XCircle size={18} />} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Calculated Preview</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterErrors} onChange={e => setFilterErrors(e.target.checked)} />
              Show errors / warnings only
            </label>
          </div>
          <NgenTable rows={preview.rows || []} filterErrors={filterErrors} />
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  //  UPLOAD HISTORY VIEW
  // ════════════════════════════════════════════════════════════════════════
  const renderHistory = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Upload History</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>All previous Excel import records</div>
        </div>
        <button onClick={fetchHistory} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.45rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {historyLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><Loader size={24} className="animate-spin" /></div>
      ) : uploadHistory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <FileSpreadsheet size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <div>No upload history found.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                {['ID', 'Filename', 'Uploaded By', 'Records', 'Billing', 'Customers', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploadHistory.map((h, i) => (
                <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{h.id}</td>
                  <td style={{ padding: '0.6rem 0.9rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.filename || '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)' }}>{h.uploadedBy || '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace' }}>{h.rowsProcessed ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', color: '#6366f1' }}>{h.billingInserted ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', color: '#10b981' }}>{h.newCustomers ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem' }}>
                    <span style={{
                      padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                      background: h.status === 'SUCCESS' ? 'rgba(16,185,129,0.15)' : h.status === 'FAILED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: h.status === 'SUCCESS' ? '#10b981' : h.status === 'FAILED' ? '#ef4444' : '#f59e0b'
                    }}>{h.status}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {h.uploadedAt ? new Date(h.uploadedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={20} color="white" />
            </div>
            Excel Import Wizard
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            3-step sequential data import: Master Data → CEB Assist → NGEN
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => { setActiveView('wizard'); }} style={{
            padding: '0.5rem 1.1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            background: activeView === 'wizard' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${activeView === 'wizard' ? 'rgba(99,102,241,0.4)' : 'var(--border-color)'}`,
            color: activeView === 'wizard' ? '#818cf8' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}>
            <Layers size={14} /> Import Wizard
          </button>
          <button onClick={() => { setActiveView('history'); fetchHistory(); }} style={{
            padding: '0.5rem 1.1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            background: activeView === 'history' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${activeView === 'history' ? 'rgba(99,102,241,0.4)' : 'var(--border-color)'}`,
            color: activeView === 'history' ? '#818cf8' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}>
            <Clock size={14} /> Upload History
          </button>
        </div>
      </div>

      {activeView === 'history' ? renderHistory() : (
        <div className="card" style={{ padding: '2rem', borderRadius: 16 }}>
          {/* Session banner */}
          {session && session.hasActiveSession && (
            <SessionBanner session={session} onDiscard={handleDiscardSession} />
          )}

          {/* Step indicator */}
          <WizardStepBar
            currentStep={wizardStep}
            steps={WIZARD_STEPS}
            sessionStage={session?.stage || 'PENDING_MASTER'}
          />

          {/* Step content */}
          {wizardStep === 1 && renderStep1()}
          {wizardStep === 2 && renderStep2()}
          {wizardStep === 3 && renderStep3()}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {wizardStep > 1 && session && (
                <button onClick={() => { setWizardStep(w => w - 1); setPreview(null); setFile(null); setFilterErrors(false); }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, padding: '0.5rem 1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                  ← Back
                </button>
              )}
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Step {wizardStep} of 3 — {WIZARD_STEPS[wizardStep - 1].label}
            </div>

            <div>
              {/* Advance button (for officers who can preview but not approve) */}
              {!isAdmin && preview && wizardStep < 3 && (
                <div style={{ fontSize: '0.78rem', color: '#f59e0b' }}>Awaiting admin approval to proceed.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
