import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  FileText, Loader, Trash2, Eye,
  Check, RefreshCw, Layers, Zap, User, Info,
  Database, Clock, CloudUpload, Pencil, X, Save, ArrowLeft
} from 'lucide-react';

// Helper to automatically derive L-Code based on solarType and tariffType
export const deriveLCode = (solarType, tariffType) => {
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

  const renderCell = (val, prefix = '') => {
    if (val === undefined || val === null || String(val).trim() === '') {
      return <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>;
    }
    return prefix ? `${prefix}${val}` : String(val);
  };

  if (!displayed.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
      <CheckCircle size={40} color="#10b981" style={{ marginBottom: '0.75rem' }} />
      <div style={{ fontWeight: 600 }}>All records are valid!</div>
    </div>
  );
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color)', maxWidth: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
            {[
              'Row', 'Account No', 'Customer Name', 'Address', 'Ref. No.', 'Cost Code',
              'Mobile Number', 'Panel Capacity', 'Agreement Date', 'Bank Code', 'Branch Code',
              'Bank Account No', 'Type', 'Unit Rate', 'Fix/Variable', 'L-Code', 'Status', 'Actions'
            ].map(h => (
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
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{renderCell(row.accountNo)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.customerName)}</td>
                <td style={{ padding: '0.6rem 0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renderCell(row.customerAddress)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.refNo)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.costCode)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.mobileNo)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.panelCapacity)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.agreementDate)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.bankCode)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.branchCode)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.bankAccountNo)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.solarType)}</td>
                <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.unitRate !== undefined && row.unitRate !== null && String(row.unitRate).trim() !== '' ? `LKR ${row.unitRate}` : <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.tariffType)}</td>
                <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>{renderCell(row.billingMode)}</td>
                <td style={{ padding: '0.6rem 0.85rem' }}><StatusBadge status={row.status} /></td>
                <td style={{ padding: '0.6rem 0.85rem' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onCorrectRow(row)} style={{ padding: '0.25rem 0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                    Correct
                  </button>
                </td>
              </tr>
              {expandedRow === i && row.errors?.length > 0 && (
                <tr style={{ background: 'rgba(239,68,68,0.04)' }}>
                  <td colSpan={18} style={{ padding: '0.75rem 1.5rem' }}>
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
  const { showToast, showConfirm } = useToast();

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

  // ── Staged review (Officer proposing changes) state ───────────────────
  const [selectedReviewBatch, setSelectedReviewBatch] = useState(null);
  const [reviewStagingRows, setReviewStagingRows] = useState([]);
  const [reviewProposals, setReviewProposals] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  
  // Staging row edit proposal modal state
  const [editingStagingRow, setEditingStagingRow] = useState(null);
  const [proposeEditStagingLoading, setProposeEditStagingLoading] = useState(false);

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

  const latestRejected = uploadHistory.find(h => h.status === 'REJECTED');

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

  // ── Batch Editing & Deleting states ────────────────────────────────────
  const [editingBatch, setEditingBatch] = useState(null); // UploadHistory record being renamed
  const [editBatchName, setEditBatchName] = useState('');
  const [batchDetails, setBatchDetails] = useState(null); // UploadHistory record for info modal

  // ── Row Correction Modal State ─────────────────────────────────────────
  const [correctingRow, setCorrectingRow] = useState(null); 
  const [correctingFields, setCorrectingFields] = useState({}); 
  const [rowCorrections, setRowCorrections] = useState({}); 

  const handleCorrectRow = (row) => {
    setCorrectingRow(row);
    setCorrectingFields({ ...row });
  };

  const handleSaveCorrection = () => {
    if (!correctingRow) return;
    const key = correctingRow.rowNum || correctingRow.accountNo;
    const updated = { ...correctingFields };

    if (wizardStep === 3) {
      const imp = parseFloat(updated.kwhImport) || 0;
      const exp = parseFloat(updated.kwhExport) || 0;
      const rate = parseFloat(updated.unitRate || updated.effectiveUnitRate) || 0;
      const sales = exp - imp;
      updated.kwhSales = sales;
      updated.paymentSettled = sales * rate - (parseFloat(updated.billSetOff) || 0);
    }

    setPreview(prev => {
      if (!prev || !prev.rows) return prev;
      const newRows = prev.rows.map(r => {
        const rKey = r.rowNum || r.accountNo;
        if (rKey === key) {
          let errors = [...(r.errors || [])];
          let status = r.status;

          if (wizardStep === 1) {
            const acc = updated.accountNo || '';
            const newErrs = [];
            if (!acc.trim()) newErrs.push("Account No is missing");
            else if (acc.trim().length !== 10 || !/^\d+$/.test(acc.trim())) {
              newErrs.push("Account No must be a 10-digit numeric value");
            }
            if (!(updated.customerName || '').trim()) {
              newErrs.push("Customer Name is missing");
            }
            if (!(updated.customerAddress || '').trim()) {
              newErrs.push("Address is missing");
            }
            if (!(updated.refNo || '').trim()) {
              newErrs.push("Ref. No. is missing");
            }
            if (!(updated.costCode || '').trim()) {
              newErrs.push("Cost Code is missing");
            }
            if (!(updated.mobileNo || '').trim()) {
              newErrs.push("Mobile Number is missing");
            }
            if (updated.panelCapacity === undefined || updated.panelCapacity === null || String(updated.panelCapacity).trim() === '') {
              newErrs.push("PANEL CAPACITY is missing");
            }
            if (!(updated.agreementDate || '').trim()) {
              newErrs.push("AGREEMENT DATE is missing");
            }
            if (!(updated.bankCode || '').trim()) {
              newErrs.push("Bank Code is missing");
            }
            if (!(updated.branchCode || '').trim()) {
              newErrs.push("Branch Code is missing");
            }
            if (!(updated.bankAccountNo || '').trim()) {
              newErrs.push("Bank Account No is missing");
            }
            if (!(updated.solarType || '').trim()) {
              newErrs.push("TYPE (Solar Type) is missing");
            }
            if (updated.unitRate === undefined || updated.unitRate === null || String(updated.unitRate).trim() === '') {
              newErrs.push("UNIT RATE is missing");
            }
            if (!(updated.tariffType || '').trim()) {
              newErrs.push("FIX/VARIABLE is missing");
            }
            if (!(updated.billingMode || '').trim()) {
              newErrs.push("Exp (Billing Mode) is missing");
            }
            errors = newErrs;
            status = errors.length === 0 ? 'VALID' : 'ERROR';
          } else if (wizardStep === 2) {
            const newErrs = [];
            if (!updated.prevReadingDate) newErrs.push("Previous Reading Date is missing");
            if (!updated.currReadingDate) newErrs.push("Current Reading Date is missing");
            errors = newErrs;
            status = errors.length === 0 ? 'VALID' : 'ERROR';
          } else if (wizardStep === 3) {
            const newErrs = [];
            if (updated.kwhImport === undefined || updated.kwhImport === '') newErrs.push("kwhImport is missing");
            if (updated.kwhExport === undefined || updated.kwhExport === '') newErrs.push("kwhExport is missing");
            errors = newErrs;
            status = errors.length === 0 ? 'VALID' : 'ERROR';
          }

          return {
            ...r,
            ...updated,
            errors,
            status
          };
        }
        return r;
      });

      const errorCount = newRows.filter(r => r.status === 'ERROR').length;
      return {
        ...prev,
        rows: newRows,
        errorCount
      };
    });

    setRowCorrections(prev => ({
      ...prev,
      [key]: updated
    }));

    setCorrectingRow(null);
    showToast('Row correction stored. Revalidation will run upon approval.', 'success');
  };

  const handleEditBatch = async (batch) => {
    setEditingBatch(batch);
    setEditBatchName(batch.filename || '');
  };

  const handleSaveBatchRename = async (e) => {
    e.preventDefault();
    if (!editBatchName.trim()) {
      showToast('Filename cannot be empty.', 'warning');
      return;
    }
    try {
      const res = await authFetch(`/api/officer/billing/uploads/${editingBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: editBatchName.trim() })
      });
      if (res.ok) {
        showToast('Batch renamed successfully.', 'success');
        setEditingBatch(null);
        fetchHistory();
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to rename batch.', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleDeleteBatch = async (batch) => {
    const confirmed = await showConfirm({
      title: 'Rollback Excel Batch?',
      message: `Are you absolutely sure you want to delete batch #${batch.id} ("${batch.filename}")?\n\nThis will remove all billing records created by this batch. Newly added customers from this batch will be removed if they don't have other active records. This cannot be undone.`,
      confirmText: 'Rollback Batch',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await authFetch(`/api/officer/billing/uploads/${batch.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Rollback complete: ${data.message || 'Batch removed.'}`, 'success');
        fetchHistory();
        if (selectedReviewBatch?.id === batch.id) {
          setSelectedReviewBatch(null);
          setActiveView('history');
        }
      } else {
        showToast(data.message || 'Failed to delete batch.', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleSelectReviewBatch = async (batch) => {
    setSelectedReviewBatch(batch);
    setReviewStagingRows([]);
    setReviewProposals([]);
    setReviewError(null);
    setActiveView('staged-review');
    
    try {
      setReviewLoading(true);
      
      // 1. Fetch staging rows
      const rowsRes = await authFetch(`/api/officer/staging/batch/${batch.id}/rows`);
      if (!rowsRes.ok) throw new Error('Failed to load staging rows.');
      const rowsData = await rowsRes.json();
      
      // 2. Fetch proposals
      const propRes = await authFetch(`/api/officer/staging/batch/${batch.id}/proposals`);
      if (!propRes.ok) throw new Error('Failed to load proposals.');
      const propData = await propRes.json();
      
      setReviewProposals(propData);
      
      const parsedRows = rowsData.map((row, index) => {
        let rawData = {};
        let errorsList = [];
        try {
          rawData = JSON.parse(row.rawJson || '{}');
        } catch (e) {
          console.error("Failed to parse row raw_json", e);
        }
        try {
          const parsed = JSON.parse(row.validationErrors || '[]');
          errorsList = parsed.map(item => {
            if (typeof item === 'string') {
              return { field: 'Validation', errorMessage: item, warning: false };
            }
            return item;
          });
        } catch (e) {
          console.error("Failed to parse row validation_errors", e);
        }
        
        // Find if there is any pending proposal for this row
        const pendingProp = propData.find(p => p.stagingId === row.stagingId && p.status === 'PENDING');
        
        return {
          stagingId: row.stagingId,
          validationStatus: row.validationStatus,
          errors: errorsList,
          index: index + 1,
          rowType: row.rowType,
          pendingProposal: pendingProp,
          ...rawData
        };
      });
      
      setReviewStagingRows(parsedRows);
    } catch (err) {
      setReviewError(err.message || 'Error occurred while loading staging data.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleProposeDelete = async (rowStagingId) => {
    const confirmed = await showConfirm({
      title: 'Propose Row Deletion?',
      message: 'Are you sure you want to propose deleting this staging record? This proposal will be submitted to the Admin for review.',
      confirmText: 'Propose Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;
    
    try {
      const res = await authFetch(`/api/officer/staging/batch/${selectedReviewBatch.id}/row/${rowStagingId}/propose-delete`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Deletion proposal submitted to Admin successfully.', 'success');
        handleSelectReviewBatch(selectedReviewBatch);
      } else {
        const body = await res.json();
        showToast(body.message || 'Failed to submit deletion proposal.', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleSaveProposeEdit = async (stagingId, fields) => {
    try {
      setProposeEditStagingLoading(true);
      const res = await authFetch(`/api/officer/staging/batch/${selectedReviewBatch.id}/row/${stagingId}/propose-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || 'Failed to submit edit proposal.');
      }
      
      showToast('Edit proposal submitted to Admin successfully!', 'success');
      setEditingStagingRow(null);
      handleSelectReviewBatch(selectedReviewBatch);
    } catch (err) {
      showToast(err.message || 'Failed to propose staging row update.', 'error');
    } finally {
      setProposeEditStagingLoading(false);
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
      fd.append('correctionsJson', JSON.stringify(rowCorrections));
      const res = await authFetch('/api/officer/import/master-data/approve', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Approval failed.', 'error'); return; }
      showToast(`✅ Master Data approved! ${data.newCustomers} new, ${data.updatedCustomers} updated.`, 'success');
      setSession({ hasActiveSession: true, sessionId: data.sessionId, stage: 'MASTER_APPROVED', masterCustomerCount: data.totalImported });
      setWizardStep(2);
      setFile(null);
      setPreview(null);
      setRowCorrections({});
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
      fd.append('correctionsJson', JSON.stringify(rowCorrections));
      const res = await authFetch(`/api/officer/import/ceb-assist/${session.sessionId}/approve`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Approval failed.', 'error'); return; }
      showToast(`✅ CEB Assist merged! ${data.updatedCount} accounts updated.`, 'success');
      setSession(prev => ({ ...prev, stage: 'CEB_APPROVED', cebAssistCount: data.updatedCount }));
      setWizardStep(3);
      setFile(null);
      setPreview(null);
      setRowCorrections({});
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
      fd.append('correctionsJson', JSON.stringify(rowCorrections));
      const res = await authFetch(`/api/officer/import/ngen/${session.sessionId}/approve`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Approval failed.', 'error'); return; }
      showToast(`🎉 Import Complete! ${data.billingRecordsCreated} billing records created. Customers added to directory.`, 'success');
      setSession(null);
      setWizardStep(1);
      setFile(null);
      setPreview(null);
      setRowCorrections({});
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
        {preview && (
          <button className="btn" onClick={handleMasterApprove} disabled={approving}
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {approving ? <><Loader size={15} className="animate-spin" /> Importing…</> : <><Check size={15} /> {isAdmin ? 'Approve & Import' : 'Stage & Proceed'}</>}
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
          <MasterDataTable rows={preview.rows || []} filterErrors={filterErrors} onCorrectRow={handleCorrectRow} />
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
        {preview && (
          <button className="btn" onClick={handleCebApprove} disabled={approving}
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {approving ? <><Loader size={15} className="animate-spin" /> Merging…</> : <><Check size={15} /> {isAdmin ? 'Approve & Merge' : 'Stage & Proceed'}</>}
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
          <CebAssistTable rows={preview.rows || []} filterErrors={filterErrors} onCorrectRow={handleCorrectRow} />
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
        {preview && (
          <button className="btn" onClick={handleNgenApprove} disabled={approving}
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', fontWeight: 600, padding: '0.6rem 1.75rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none' }}>
            {approving ? <><Loader size={15} className="animate-spin" /> Submitting…</> : <><Zap size={15} /> {isAdmin ? 'Approve & Finalize' : 'Submit for Admin Approval'}</>}
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
          <NgenTable rows={preview.rows || []} filterErrors={filterErrors} onCorrectRow={handleCorrectRow} />
        </div>
      )}
    </div>
  );

  const renderStagedReview = () => {
    if (!selectedReviewBatch) return null;

    const isCustomerBatch = reviewStagingRows.some(r => r.rowType === 'CUSTOMER_PROFILE');

    const renderCell = (val, prefix = '') => {
      if (val === undefined || val === null || String(val).trim() === '') {
        return <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>;
      }
      return prefix ? `${prefix}${val}` : String(val);
    };

    return (
      <div>
        <button
          onClick={() => { setActiveView('history'); setSelectedReviewBatch(null); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            marginBottom: '1rem',
            fontSize: '0.88rem',
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> Back to History
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Review Staging Batch: {selectedReviewBatch.filename}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Batch ID: #{selectedReviewBatch.id} · Uploaded By: {selectedReviewBatch.uploadedBy} · Status: <span style={{ color: '#ef4444', fontWeight: 600 }}>{selectedReviewBatch.status}</span>
            </div>
          </div>
          <button
            onClick={() => handleSelectReviewBatch(selectedReviewBatch)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '0.45rem 1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {reviewLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader size={24} className="animate-spin" />
          </div>
        ) : reviewError ? (
          <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10 }}>
            {reviewError}
          </div>
        ) : reviewStagingRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No staging rows found for this batch.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color)', maxWidth: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                  {isCustomerBatch ? (
                    [
                      'Row', 'Account No', 'Customer Name', 'Address', 'Ref. No.', 'Cost Code',
                      'Mobile', 'Capacity', 'Agreement Date', 'Bank', 'Branch',
                      'Bank Account', 'Solar Type', 'Unit Rate', 'Fix/Variable', 'L-Code', 'Status', 'Errors', 'Actions'
                    ].map(h => (
                      <th key={h} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                  ) : (
                    [
                      'Row', 'Account No', 'Customer Name', 'From Date', 'To Date', 'Import Units', 'Export Units', 'Unit Cost', 'Status', 'Errors', 'Actions'
                    ].map(h => (
                      <th key={h} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {reviewStagingRows.map((row, i) => {
                  const isPending = !!row.pendingProposal;
                  const proposalType = isPending ? row.pendingProposal.actionType : '';
                  const hasErrors = row.errors && row.errors.length > 0;

                  return (
                    <tr key={row.stagingId || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)' }}>{row.index}</td>
                      <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{renderCell(row.accountNo)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.customerName)}</td>
                      
                      {isCustomerBatch ? (
                        <>
                          <td style={{ padding: '0.6rem 0.9rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renderCell(row.customerAddress)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.refNo)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.costCode)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.mobileNo)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.panelCapacity)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.agreementDate)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.bankCode)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.branchCode)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.bankAccountNo)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.solarType)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.unitRate !== undefined && row.unitRate !== null && String(row.unitRate).trim() !== '' ? `LKR ${row.unitRate}` : <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.tariffType)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.billingMode)}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.fromDate)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>{renderCell(row.toDate)}</td>
                          <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace' }}>{row.importUnits ?? '—'}</td>
                          <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace' }}>{row.exportUnits ?? '—'}</td>
                          <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.unitCost !== undefined ? `LKR ${row.unitCost}` : '—'}</td>
                        </>
                      )}

                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <span style={{
                          padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                          background: row.validationStatus === 'VALID' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: row.validationStatus === 'VALID' ? '#10b981' : '#ef4444'
                        }}>{row.validationStatus}</span>
                      </td>

                      <td style={{ padding: '0.6rem 0.9rem', maxWidth: '250px' }}>
                        {hasErrors ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            {row.errors.map((err, errIdx) => (
                              <div key={errIdx} style={{ color: '#ef4444', fontSize: '0.75rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                                <span>{err.errorMessage || err.message || err}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#10b981', fontSize: '0.75rem', display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                            <Check size={12} /> Ready
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        {isPending ? (
                          <span style={{
                            padding: '0.15rem 0.55rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                            background: proposalType === 'DELETE' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: proposalType === 'DELETE' ? '#ef4444' : '#f59e0b'
                          }}>
                            Pending {proposalType}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => setEditingStagingRow(row)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(99,102,241,0.15)',
                                border: '1px solid rgba(99,102,241,0.3)',
                                color: '#818cf8',
                                borderRadius: 4,
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Propose Edit
                            </button>
                            <button
                              onClick={() => handleProposeDelete(row.stagingId)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(239,68,68,0.15)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#ef4444',
                                borderRadius: 4,
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Propose Delete
                            </button>
                          </div>
                        )}
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
  };

  // ════════════════════════════════════════════════════════════════════════
  //  UPLOAD HISTORY VIEW
  // ════════════════════════════════════════════════════════════════════════
  const renderHistory = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Excel Import Batches</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Manage and rollback uploaded data at the batch level</div>
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
                {['ID', 'Filename', 'Uploaded By', 'Records', 'Billing', 'Customers', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploadHistory.map((h, i) => (
                <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{h.id}</td>
                  <td style={{ padding: '0.6rem 0.9rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{h.filename || '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)' }}>{h.uploadedBy || '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace' }}>{h.rowsProcessed ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', color: '#6366f1' }}>{h.billingInserted ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', color: '#10b981' }}>{h.newCustomers ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.9rem' }}>
                    <span style={{
                      padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                      background: h.status === 'SUCCESS' || h.status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : h.status === 'FAILED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: h.status === 'SUCCESS' || h.status === 'COMPLETED' ? '#10b981' : h.status === 'FAILED' ? '#ef4444' : '#f59e0b'
                    }}>{h.status}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {h.uploadTime ? new Date(h.uploadTime).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.9rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setBatchDetails(h)} style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer' }}>Details</button>
                      <button onClick={() => handleEditBatch(h)} style={{ padding: '0.25rem 0.5rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer' }}>Rename</button>
                      {h.status === 'PENDING_APPROVAL' && (
                        <button onClick={() => handleSelectReviewBatch(h)} style={{ padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer' }}>Review</button>
                      )}
                      {(isAdmin || h.status === 'PENDING_APPROVAL') && (
                        <button onClick={() => handleDeleteBatch(h)} style={{ padding: '0.25rem 0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer' }}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Details Modal */}
      {batchDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 16, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '500px', padding: '2rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Batch Details</h3>
              <button onClick={() => setBatchDetails(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Batch ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{batchDetails.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uploaded File</span>
                <span style={{ fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{batchDetails.filename}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uploaded By</span>
                <span>{batchDetails.uploadedBy}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Upload Date/Time</span>
                <span>{batchDetails.uploadTime ? new Date(batchDetails.uploadTime).toLocaleString() : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Rows Processed</span>
                <span style={{ fontFamily: 'monospace' }}>{batchDetails.rowsProcessed}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Billing Records Inserted</span>
                <span style={{ fontFamily: 'monospace', color: '#6366f1', fontWeight: 600 }}>{batchDetails.billingInserted}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>New Customers Created</span>
                <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>{batchDetails.newCustomers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Errors Flagged</span>
                <span style={{ fontFamily: 'monospace', color: batchDetails.errorsCount > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{batchDetails.errorsCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Import Status</span>
                <span style={{
                  padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                  background: batchDetails.status === 'SUCCESS' || batchDetails.status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : (batchDetails.status === 'FAILED' || batchDetails.status === 'REJECTED') ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                  color: batchDetails.status === 'SUCCESS' || batchDetails.status === 'COMPLETED' ? '#10b981' : (batchDetails.status === 'FAILED' || batchDetails.status === 'REJECTED') ? '#ef4444' : '#f59e0b'
                }}>{batchDetails.status}</span>
              </div>
              {batchDetails.rejectionReason && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.78rem' }}>Rejection Reason</span>
                  <span style={{ color: 'var(--text-secondary)', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.82rem', lineHeight: 1.4 }}>{batchDetails.rejectionReason}</span>
                </div>
              )}
            </div>
            <button onClick={() => setBatchDetails(null)} style={{ width: '100%', marginTop: '1.5rem', padding: '0.65rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Close Details</button>
          </div>
        </div>
      )}

      {/* Edit (Rename) Batch Modal */}
      {editingBatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 16, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleSaveBatchRename} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '450px', padding: '2rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Rename Import Batch</h3>
              <button type="button" onClick={() => setEditingBatch(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Batch Name (Filename)</label>
              <input type="text" value={editBatchName} onChange={e => setEditBatchName(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.88rem' }} required placeholder="Enter new filename..." />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setEditingBatch(null)} style={{ flex: 1, padding: '0.65rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="submit" style={{ flex: 1, padding: '0.65rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Save Changes</button>
            </div>
          </form>
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

      {activeView === 'history' ? renderHistory() : activeView === 'staged-review' ? renderStagedReview() : (
        <div className="card" style={{ padding: '2rem', borderRadius: 16 }}>
          {/* Rejection Alert Banner */}
          {latestRejected && wizardStep === 1 && !session && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={18} color="#ef4444" /></div>
                <div>
                  <div style={{ fontWeight: 700, color: 'white', fontSize: '0.92rem' }}>Import Batch Rejected by Admin</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Batch: <strong>{latestRejected.filename}</strong> was rejected.</div>
                </div>
              </div>
              {latestRejected.rejectionReason && (
                <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.12)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong>Reason:</strong> {latestRejected.rejectionReason}
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Please correct the issues in your Excel sheets and start a new import session below.
              </div>
            </div>
          )}

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

            <div />
          </div>
        </div>
      )}

      {/* Row Correction Modal */}
      {correctingRow && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 16, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '650px', padding: '2rem', boxShadow: 'var(--shadow)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Correct Row #{correctingRow.rowNum || correctingRow.accountNo}</h3>
              <button onClick={() => setCorrectingRow(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.75rem' }}>
              {wizardStep === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Account No</label>
                    <input type="text" value={correctingFields.accountNo || ''} onChange={e => setCorrectingFields(p => ({ ...p, accountNo: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Customer Name</label>
                    <input type="text" value={correctingFields.customerName || ''} onChange={e => setCorrectingFields(p => ({ ...p, customerName: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Customer Address</label>
                    <input type="text" value={correctingFields.customerAddress || ''} onChange={e => setCorrectingFields(p => ({ ...p, customerAddress: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Ref. No.</label>
                    <input type="text" value={correctingFields.refNo || ''} onChange={e => setCorrectingFields(p => ({ ...p, refNo: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Cost Code</label>
                    <input type="text" value={correctingFields.costCode || ''} onChange={e => setCorrectingFields(p => ({ ...p, costCode: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Mobile Number</label>
                    <input type="text" value={correctingFields.mobileNo || ''} onChange={e => setCorrectingFields(p => ({ ...p, mobileNo: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Panel Capacity (kW)</label>
                    <input type="number" step="0.01" value={correctingFields.panelCapacity !== undefined && correctingFields.panelCapacity !== null ? correctingFields.panelCapacity : ''} onChange={e => setCorrectingFields(p => ({ ...p, panelCapacity: e.target.value === '' ? '' : parseFloat(e.target.value) }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Agreement Date (YYYY-MM-DD)</label>
                    <input type="date" value={correctingFields.agreementDate || ''} onChange={e => setCorrectingFields(p => ({ ...p, agreementDate: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Bank Code</label>
                    <input type="text" value={correctingFields.bankCode || ''} onChange={e => setCorrectingFields(p => ({ ...p, bankCode: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Branch Code</label>
                    <input type="text" value={correctingFields.branchCode || ''} onChange={e => setCorrectingFields(p => ({ ...p, branchCode: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Bank Account No</label>
                    <input type="text" value={correctingFields.bankAccountNo || ''} onChange={e => setCorrectingFields(p => ({ ...p, bankAccountNo: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Solar Type</label>
                    <input type="text" value={correctingFields.solarType || ''} onChange={e => setCorrectingFields(p => { const next = { ...p, solarType: e.target.value }; next.billingMode = deriveLCode(next.solarType || '', next.tariffType || ''); return next; })} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Unit Rate (LKR)</label>
                    <input type="number" step="0.001" value={correctingFields.unitRate !== undefined && correctingFields.unitRate !== null ? correctingFields.unitRate : ''} onChange={e => setCorrectingFields(p => ({ ...p, unitRate: e.target.value === '' ? '' : parseFloat(e.target.value) }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Fix/Variable</label>
                    <input type="text" value={correctingFields.tariffType || ''} onChange={e => setCorrectingFields(p => { const next = { ...p, tariffType: e.target.value }; next.billingMode = deriveLCode(next.solarType || '', next.tariffType || ''); return next; })} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>L-Code</label>
                    <input type="text" value={correctingFields.billingMode || ''} disabled readOnly style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'not-allowed' }} />
                  </div>
                </div>
              )}
              
              {wizardStep === 2 && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Account No</label>
                    <input type="text" value={correctingFields.accountNo || ''} readOnly style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'not-allowed' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Previous Reading Date</label>
                      <input type="date" value={correctingFields.prevReadingDate || ''} onChange={e => setCorrectingFields(p => ({ ...p, prevReadingDate: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Current Reading Date</label>
                      <input type="date" value={correctingFields.currReadingDate || ''} onChange={e => setCorrectingFields(p => ({ ...p, currReadingDate: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                </>
              )}
              
              {wizardStep === 3 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Account No</label>
                      <input type="text" value={correctingFields.accountNo || ''} readOnly style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'not-allowed' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Unit Rate (LKR)</label>
                      <input type="number" step="0.01" value={correctingFields.unitRate || correctingFields.effectiveUnitRate || ''} onChange={e => setCorrectingFields(p => ({ ...p, unitRate: e.target.value, effectiveUnitRate: parseFloat(e.target.value) }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>kWh Import</label>
                      <input type="number" step="1" value={correctingFields.kwhImport ?? ''} onChange={e => setCorrectingFields(p => ({ ...p, kwhImport: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>kWh Export</label>
                      <input type="number" step="1" value={correctingFields.kwhExport ?? ''} onChange={e => setCorrectingFields(p => ({ ...p, kwhExport: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Bill Outstanding Set Off (Charges)</label>
                    <input type="number" step="0.01" value={correctingFields.billSetOff ?? ''} onChange={e => setCorrectingFields(p => ({ ...p, billSetOff: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem' }} />
                  </div>
                </>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setCorrectingRow(null)} style={{ flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSaveCorrection} style={{ flex: 1, padding: '0.65rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Save Edits</button>
            </div>
          </div>
        </div>
      )}

      <ProposeEditStagingRowModal
        isOpen={!!editingStagingRow}
        onClose={() => setEditingStagingRow(null)}
        row={editingStagingRow}
        onSave={handleSaveProposeEdit}
        loading={proposeEditStagingLoading}
      />
    </div>
  );
};

const ProposeEditStagingRowModal = ({ isOpen, onClose, row, onSave, loading }) => {
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (row) {
      const cleanFields = { ...row };
      delete cleanFields.stagingId;
      delete cleanFields.validationStatus;
      delete cleanFields.errors;
      delete cleanFields.index;
      delete cleanFields.rowType;
      delete cleanFields.pendingProposal;
      setFields(cleanFields);
    }
  }, [row]);

  if (!isOpen || !row) return null;

  const handleChange = (key, value) => {
    setFields(prev => {
      const updated = {
        ...prev,
        [key]: value
      };
      if (key === 'solarType' || key === 'tariffType') {
        updated.billingMode = deriveLCode(updated.solarType || '', updated.tariffType || '');
      }
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(row.stagingId, fields);
  };

  const isBilling = row.rowType !== 'CUSTOMER_PROFILE';

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '650px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Propose Row Correction (Row #{row.rowNum || row.index})
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
          
          {row.errors && row.errors.length > 0 && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} />
                Validation Errors:
              </div>
              {row.errors.map((err, idx) => {
                const message = typeof err === 'string' ? err : (err.errorMessage || err.message || '');
                const field = typeof err === 'string' ? '' : (err.field ? `[${err.field}] ` : '');
                return (
                  <div key={idx} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                    • {field}{message}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {isBilling ? (
              <>
                <div className="form-group">
                  <label className="form-label">Account No</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.accountNo || ''}
                    readOnly
                    style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.customerName || ''}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">From Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="login-form-input"
                    value={fields.fromDate || ''}
                    onChange={(e) => handleChange('fromDate', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="login-form-input"
                    value={fields.toDate || ''}
                    onChange={(e) => handleChange('toDate', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Import Units (kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={fields.importUnits !== undefined && fields.importUnits !== null ? fields.importUnits : ''}
                    onChange={(e) => handleChange('importUnits', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Export Units (kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={fields.exportUnits !== undefined && fields.exportUnits !== null ? fields.exportUnits : ''}
                    onChange={(e) => handleChange('exportUnits', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Cost (LKR)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="login-form-input"
                    value={fields.unitCost !== undefined && fields.unitCost !== null ? fields.unitCost : ''}
                    onChange={(e) => handleChange('unitCost', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.bankCode || ''}
                    onChange={(e) => handleChange('bankCode', e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Account No</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.accountNo || ''}
                    readOnly
                    style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.customerName || ''}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Customer Address</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.customerAddress || ''}
                    onChange={(e) => handleChange('customerAddress', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.mobileNo || ''}
                    onChange={(e) => handleChange('mobileNo', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Panel Capacity (kW)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="login-form-input"
                    value={fields.panelCapacity !== undefined && fields.panelCapacity !== null ? fields.panelCapacity : ''}
                    onChange={(e) => handleChange('panelCapacity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Agreement Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="login-form-input"
                    value={fields.agreementDate || ''}
                    onChange={(e) => handleChange('agreementDate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Solar Type (Net Plus/Net Metering/Net Accounting)</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.solarType || ''}
                    onChange={(e) => handleChange('solarType', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.bankCode || ''}
                    onChange={(e) => handleChange('bankCode', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.branchCode || ''}
                    onChange={(e) => handleChange('branchCode', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Account No</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.bankAccountNo || ''}
                    onChange={(e) => handleChange('bankAccountNo', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Rate (LKR)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="login-form-input"
                    value={fields.unitRate !== undefined && fields.unitRate !== null ? fields.unitRate : ''}
                    onChange={(e) => handleChange('unitRate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ref. No.</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.refNo || ''}
                    onChange={(e) => handleChange('refNo', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.costCode || ''}
                    onChange={(e) => handleChange('costCode', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fix/Variable</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.tariffType || ''}
                    onChange={(e) => handleChange('tariffType', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">L-Code</label>
                  <input
                    type="text"
                    className="login-form-input"
                    value={fields.billingMode || ''}
                    disabled
                    readOnly
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                  />
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ minWidth: '130px' }}
            >
              {loading ? <Loader size={14} className="animate-spin" /> : 'Propose Edits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadPage;
