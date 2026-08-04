import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Loader, 
  ArrowLeft, 
  FileText,
  BadgeAlert,
  Edit2,
  Search,
  Eye,
  Edit3,
  History,
  ShieldCheck,
  Check,
  LayoutGrid,
  List
} from 'lucide-react';
import {
  CARD_SECTIONS,
  EDIT_FIELDS,
  STATUS_FILTERS,
  cellText,
  fieldValue,
  recordNetType,
  isDuplicateRecord,
  normalizeNetType,
  RecordStatusBadge,
  pickEditable,
  CustomerCard,
  FilterDropdown
} from './MonthlyCustomerDirectory';
import { computeAgreementExpiry, agreementExpiryStatus } from './UploadPage';

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

// Worst-status wins when several staged source rows are grouped under one Account No.
const STATUS_RANK = { INVALID: 4, DUPLICATE: 3, WARNING: 2, VALID: 1 };

const StagingReview = ({ authFetch, onConfirmAction }) => {
  const { showToast } = useToast();
  const [pendingBatches, setPendingBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Selected batch drill-down
  const [selectedBatch, setSelectedBatch] = useState(null); // UploadHistory object
  const [stagingRows, setStagingRows] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'proposals' | 'corrections'

  // Monthly Directory View layout states
  const [viewMode, setViewMode] = useState('CARDS'); // 'CARDS' | 'TABLE'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [netTypeFilter, setNetTypeFilter] = useState('ALL');
  const [detailsRecord, setDetailsRecord] = useState(null);

  // Operation action states
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Edit Staging Row State
  const [editingStagingRow, setEditingStagingRow] = useState(null);
  const [editStagingLoading, setEditStagingLoading] = useState(false);

  const handleOpenEditModal = (row) => {
    setEditingStagingRow(row);
  };

  const handleCloseEditModal = () => {
    setEditingStagingRow(null);
  };

  const handleSaveStagingRow = async (stagingId, fields) => {
    try {
      setEditStagingLoading(true);
      const res = await authFetch(`/api/admin/staging/row/${stagingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      
      const updatedRow = await res.json();
      
      if (!res.ok) {
        throw new Error(updatedRow.message || 'Failed to update staging row details.');
      }
      
      showToast('Staging row updated and re-validated successfully!', 'success');
      
      // Update local state stagingRows
      setStagingRows(prev => prev.map(r => r.stagingId === stagingId ? {
        ...r,
        ...updatedRow
      } : r));
      
      setEditingStagingRow(null);
    } catch (err) {
      showToast(err.message || 'Failed to update staging row.', 'error');
    } finally {
      setEditStagingLoading(false);
    }
  };

  const handleApproveProposal = async (proposalId) => {
    try {
      setActionProcessing(true);
      const res = await authFetch(`/api/admin/staging/proposal/${proposalId}/approve`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Proposed change approved and applied to staging successfully.', 'success');
        handleSelectBatch(selectedBatch);
      } else {
        const body = await res.json();
        showToast(body.message || 'Failed to approve proposal.', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleRejectProposal = async (proposalId) => {
    const reason = window.prompt("Enter rejection reason for this proposed change:");
    if (reason === null) return;
    
    try {
      setActionProcessing(true);
      const res = await authFetch(`/api/admin/staging/proposal/${proposalId}/reject?reason=${encodeURIComponent(reason)}`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Proposed change rejected successfully.', 'success');
        handleSelectBatch(selectedBatch);
      } else {
        const body = await res.json();
        showToast(body.message || 'Failed to reject proposal.', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleAdminDeleteRow = async (stagingId) => {
    onConfirmAction({
      isOpen: true,
      title: 'Delete Staged Record',
      message: 'Are you sure you want to delete this specific staging record directly? This cannot be undone.',
      confirmText: 'Delete Row',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionProcessing(true);
          const res = await authFetch(`/api/admin/staging/row/${stagingId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            showToast('Staging record deleted successfully.', 'success');
            handleSelectBatch(selectedBatch);
          } else {
            const body = await res.json();
            showToast(body.message || 'Failed to delete record.', 'error');
          }
        } catch (e) {
          showToast('Error: ' + e.message, 'error');
        } finally {
          setActionProcessing(false);
        }
      }
    });
  };

  const fetchPendingBatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/admin/staging/pending');
      if (!res.ok) {
        throw new Error('Failed to load pending staging batches.');
      }
      const data = await res.json();
      setPendingBatches(data);
    } catch (err) {
      setError(err.message || 'An error occurred while loading staging list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBatches();
  }, []);

  const handleSelectBatch = async (batch) => {
    setSelectedBatch(batch);
    setStagingRows([]);
    setProposals([]);
    setActiveTab('records');
    setDetailsError(null);
    setActionSuccess(null);
    setActionError(null);
    
    try {
      setDetailsLoading(true);
      const res = await authFetch(`/api/admin/staging/batch/${batch.id}`);
      if (!res.ok) {
        throw new Error('Failed to load staging batch row details.');
      }
      const data = await res.json();
      
      // Parse staging rows JSON strings
      const parsedRows = data.map((row, index) => {
        let rawData = {};
        let errorsList = [];
        try {
          rawData = JSON.parse(row.rawJson || '{}');
        } catch (e) {
          console.error("Failed to parse row raw_json", e);
        }
        try {
          errorsList = JSON.parse(row.validationErrors || '[]');
        } catch (e) {
          console.error("Failed to parse row validation_errors", e);
        }
        
        // Spread rawData FIRST: staged row JSON may itself carry officer-side `errors`/`warnings`
        // keys (raw string lists) which must not clobber the structured validation fields below.
        return {
          ...rawData,
          stagingId: row.stagingId,
          validationStatus: row.validationStatus,
          rowType: row.rowType,
          errors: errorsList,
          index: index + 1
        };
      });
      
      setStagingRows(parsedRows);
      
      // Fetch proposals
      try {
        const propRes = await authFetch(`/api/officer/staging/batch/${batch.id}/proposals`);
        if (propRes.ok) {
          const propData = await propRes.json();
          setProposals(propData);
        }
      } catch (err) {
        console.error("Failed to fetch proposals", err);
      }
    } catch (err) {
      setDetailsError(err.message || 'Error occurred while retrieving staging data.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApproveBatch = () => {
    if (!selectedBatch) return;
    
    onConfirmAction({
      isOpen: true,
      title: 'Approve Staging Batch',
      message: `Are you sure you want to approve batch "${selectedBatch.filename}"? This will copy all valid and warning rows into live customer and billing records. Invalid/Duplicate rows will be discarded.`,
      type: 'success',
      isAlertOnly: false,
      onConfirm: async () => {
        try {
          setActionProcessing(true);
          setActionError(null);
          setActionSuccess(null);
          
          const res = await authFetch(`/api/admin/staging/batch/${selectedBatch.id}/approve`, {
            method: 'POST'
          });
          const body = await res.json();
          
          if (!res.ok) {
            throw new Error(body.message || 'Failed to approve batch.');
          }
          
          const msg = body.message || 'Batch approved and migrated successfully.';
          setActionSuccess(msg);
          showToast(msg, 'success');
          setSelectedBatch(null);
          fetchPendingBatches();
        } catch (err) {
          const errMsg = err.message || 'Approval operation failed.';
          setActionError(errMsg);
          showToast(errMsg, 'error');
        } finally {
          setActionProcessing(false);
        }
      }
    });
  };

  const handleRejectBatch = () => {
    if (!selectedBatch) return;
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    try {
      setActionProcessing(true);
      setActionError(null);
      setActionSuccess(null);
      setRejectModalOpen(false);
      
      const res = await authFetch(`/api/admin/staging/batch/${selectedBatch.id}/reject?reason=${encodeURIComponent(rejectionReason)}`, {
        method: 'POST'
      });
      const body = await res.json();
      
      if (!res.ok) {
        throw new Error(body.message || 'Failed to reject batch.');
      }
      
      const msg = body.message || 'Batch rejected successfully.';
      setActionSuccess(msg);
      showToast(msg, 'success');
      setSelectedBatch(null);
      fetchPendingBatches();
    } catch (err) {
      const errMsg = err.message || 'Rejection operation failed.';
      setActionError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setActionProcessing(false);
    }
  };

  // ── Grouping: one review row per Account No ───────────────────────────────
  // A batch stages a CUSTOMER_PROFILE row and one or more BILLING rows for the same account;
  // showing them flat displayed each customer twice. Grouping is display-only: every underlying
  // staging row keeps its own validation info and its own Correct/Delete actions, and the
  // grouped view is re-derived from the fetched rows on every refresh (never duplicated).
  const groupedRows = useMemo(() => {
    const map = new Map();
    stagingRows.forEach(row => {
      const acc = row.accountNo !== undefined && row.accountNo !== null && String(row.accountNo).trim() !== ''
        ? String(row.accountNo).trim()
        : `__row_${row.stagingId}`;
      if (!map.has(acc)) map.set(acc, []);
      map.get(acc).push(row);
    });
    return [...map.entries()].map(([groupKey, sources], i) => {
      const profile = sources.find(s => s.rowType === 'CUSTOMER_PROFILE') || null;
      const billings = sources.filter(s => s.rowType !== 'CUSTOMER_PROFILE');
      // Merged display data: first billing row's fields, with the profile's customer fields on top.
      const merged = Object.assign({}, billings[0] || {}, profile || {});
      const status = sources.reduce((worst, s) =>
        (STATUS_RANK[s.validationStatus] || 0) > (STATUS_RANK[worst] || 0) ? s.validationStatus : worst, 'VALID');
      // Union of every source row's validation messages, deduped.
      const seen = new Set();
      const errors = [];
      sources.forEach(s => (s.errors || []).forEach(err => {
        const k = `${err.field}|${err.errorMessage}|${err.warning}`;
        if (!seen.has(k)) { seen.add(k); errors.push(err); }
      }));
      return { ...merged, groupKey, sources, profile, billings, validationStatus: status, errors, index: i + 1 };
    });
  }, [stagingRows]);

  // Summary Metrics calculations (each Account No counted once)
  const totalRows = groupedRows.length;
  const validRows = groupedRows.filter(r => r.validationStatus === 'VALID').length;
  const invalidRows = groupedRows.filter(r => r.validationStatus === 'INVALID').length;
  const duplicateRows = groupedRows.filter(r => r.validationStatus === 'DUPLICATE').length;
  const warningRows = groupedRows.filter(r => r.validationStatus === 'WARNING').length;
  const isCustomerBatch = groupedRows.some(r => r.profile);
  const hasBillingData = groupedRows.some(r => r.billings.length > 0);
  const [rowFilter, setRowFilter] = useState('ALL');

  const groupIsCorrected = useCallback((group) =>
    group.sources.some(s => proposals.some(p => p.stagingId === s.stagingId && p.status === 'APPROVED')),
  [proposals]);

  const billingWindow = useMemo(() => {
    const now = new Date();
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
    };
  }, []);

  const rowExpiry = useCallback((row) =>
    agreementExpiryStatus(computeAgreementExpiry(row.agreementDate), billingWindow.start, billingWindow.end),
  [billingWindow]);

  const isRecordComplete = useCallback((row) => {
    if (!row) return false;
    const name = row.customerName || row.masterName || row.npayName;
    if (!name || !String(name).trim() || name === '—') return false;
    if (!row.customerAddress || !String(row.customerAddress).trim() || row.customerAddress === '—') return false;
    if (!row.mobileNo || !String(row.mobileNo).trim() || row.mobileNo === '—') return false;
    if (!row.agreementDate || row.agreementDate === '—') return false;
    if (row.panelCapacity === null || row.panelCapacity === undefined || row.panelCapacity === '' || row.panelCapacity === '—') return false;
    if (!row.bankCode || !String(row.bankCode).trim() || row.bankCode === '—') return false;
    if (!row.bankAccountNo || !String(row.bankAccountNo).trim() || row.bankAccountNo === '—') return false;
    const solar = row.solarType || row.masterNetType || row.netType;
    if (!solar || !String(solar).trim() || solar === '—') return false;
    if (row.unitRate === null || row.unitRate === undefined || row.unitRate === '' || row.unitRate === '—') return false;
    return true;
  }, []);

  const matchesFilter = useCallback((row, key) => {
    switch (key) {
      case 'ALL': return true;
      case 'COMPLETE': return isRecordComplete(row);
      case 'MISSING': return !isRecordComplete(row);
      case 'DUPLICATE': return isDuplicateRecord(row);
      case 'NAME_MISMATCH': return row.nameMatch === 'MISMATCH';
      case 'UNIT_RATE_MISMATCH': return row.unitRateMatch === 'MISMATCH';
      case 'NET_TYPE_MISMATCH': return row.netTypeMatch === 'MISMATCH';
      case 'CORRECTED': return groupIsCorrected(row);
      case 'EXPIRED': return rowExpiry(row) === 'EXPIRED';
      case 'EXPIRING_SOON': return rowExpiry(row) === 'EXPIRING_SOON';
      default: return String(row.status || row.validationStatus || '').toUpperCase() === key;
    }
  }, [rowExpiry, isRecordComplete, groupIsCorrected]);

  const filterCounts = useMemo(() => {
    const recs = groupedRows || [];
    const counts = { ALL: recs.length };
    STATUS_FILTERS.forEach(f => {
      if (f.key !== 'ALL') counts[f.key] = recs.filter(r => matchesFilter(r, f.key)).length;
    });
    return counts;
  }, [groupedRows, matchesFilter]);

  const displayRecords = useMemo(() => {
    const recs = (groupedRows || []).map((row, idx) => ({ row, idx }));
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
  }, [groupedRows, searchTerm, statusFilter, netTypeFilter, matchesFilter]);

  const netTypeOptions = useMemo(() => {
    const counts = new Map();
    (groupedRows || []).forEach(r => {
      const nt = normalizeNetType(recordNetType(r));
      if (nt) counts.set(nt, (counts.get(nt) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [groupedRows]);

  const filteredRows = groupedRows.filter(row => {
    if (rowFilter === 'ALL') return true;
    if (rowFilter === 'VALID') return row.validationStatus === 'VALID';
    if (rowFilter === 'INVALID') return row.validationStatus === 'INVALID';
    if (rowFilter === 'WARNING') return row.validationStatus === 'WARNING';
    if (rowFilter === 'DUPLICATE') return row.validationStatus === 'DUPLICATE';
    if (rowFilter === 'CORRECTED') {
      return groupIsCorrected(row);
    }
    return true;
  });

  const renderProposalsTab = () => {
    const pendingProposals = proposals.filter(p => p.status === 'PENDING');
    if (pendingProposals.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Activity style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <div>No pending officer changes to review.</div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {pendingProposals.map(prop => {
          let orig = {};
          let mod = {};
          try {
            orig = JSON.parse(prop.originalData || '{}');
            mod = JSON.parse(prop.modifiedData || '{}');
          } catch(e){}

          const changedKeys = Object.keys(mod).filter(k => String(orig[k]) !== String(mod[k]));

          return (
            <div key={prop.id} className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                  {prop.actionType} Proposal (Row #{orig.rowNum || orig.index || '—'}, Account: {orig.accountNo || '—'})
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => handleApproveProposal(prop.id)} 
                    className="btn btn-primary" 
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--success)' }}
                    disabled={actionProcessing}
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleRejectProposal(prop.id)} 
                    className="btn btn-logout" 
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', width: 'auto' }}
                    disabled={actionProcessing}
                  >
                    Reject
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Original Values</div>
                  {changedKeys.map(k => (
                    <div key={k} style={{ marginBottom: '0.25rem' }}>
                      <strong>{k}</strong>: <span style={{ textDecoration: 'line-through', opacity: 0.8 }}>{String(orig[k] ?? '—')}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>Proposed Changes</div>
                  {changedKeys.map(k => (
                    <div key={k} style={{ marginBottom: '0.25rem' }}>
                      <strong>{k}</strong>: <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{String(mod[k] ?? '—')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Proposed by <strong>{prop.performedBy}</strong></span>
                <span>{new Date(prop.performedAt).toLocaleString('en-LK')}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCorrectionsTab = () => {
    const approvedLogs = proposals.filter(p => p.status === 'APPROVED');
    if (approvedLogs.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Activity style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <div>No corrections have been recorded for this batch yet.</div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {approvedLogs.map(log => {
          let orig = {};
          let mod = {};
          try {
            orig = JSON.parse(log.originalData || '{}');
            mod = JSON.parse(log.modifiedData || '{}');
          } catch(e){}

          const matchingRow = stagingRows.find(r => r.stagingId === log.stagingId);
          const currentStatus = matchingRow ? matchingRow.validationStatus : 'UNKNOWN';
          const changedKeys = Object.keys(mod).filter(k => String(orig[k]) !== String(mod[k]));

          return (
            <div key={log.id} className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                  Row #{orig.rowNum || orig.index || '—'} (Account: {orig.accountNo || '—'})
                </span>
                <span className={`badge ${currentStatus === 'VALID' ? 'success' : currentStatus === 'WARNING' ? 'warning' : 'danger'}`} style={{ fontSize: '0.7rem' }}>
                  Status: {currentStatus}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Original Values</div>
                  {changedKeys.map(k => (
                    <div key={k} style={{ marginBottom: '0.25rem' }}>
                      <strong>{k}</strong>: <span style={{ textDecoration: 'line-through', opacity: 0.8 }}>{String(orig[k] ?? '—')}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: '0.5rem' }}>Corrected Values</div>
                  {changedKeys.map(k => (
                    <div key={k} style={{ marginBottom: '0.25rem' }}>
                      <strong>{k}</strong>: <span style={{ color: 'var(--success)', fontWeight: 500 }}>{String(mod[k] ?? '—')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Corrected by <strong>{log.performedBy}</strong></span>
                <span>{new Date(log.performedAt).toLocaleString('en-LK')}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      {actionSuccess && (
        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', borderLeft: '3px solid var(--success)', fontSize: '0.85rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="login-error" style={{ marginBottom: '1.5rem' }}>
          {actionError}
        </div>
      )}

      {actionProcessing && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.5rem', background: 'rgba(59,130,246,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.5rem', color: 'var(--primary)' }}>
          <Loader className="animate-spin" size={18} />
          <span style={{ fontWeight: 600 }}>Executing database migration, please do not close this window...</span>
        </div>
      )}

      {/* Drill-down View */}
      {selectedBatch ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => setSelectedBatch(null)} 
              className="back-btn"
              style={{ margin: 0 }}
            >
              <ArrowLeft size={16} />
              Back to pending list
            </button>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--success)' }}
                onClick={handleApproveBatch}
                disabled={actionProcessing}
              >
                <ThumbsUp size={14} />
                Approve &amp; Commit
              </button>
              <button 
                className="btn btn-logout"
                style={{ width: 'auto' }}
                onClick={handleRejectBatch}
                disabled={actionProcessing}
              >
                <ThumbsDown size={14} />
                Reject &amp; Discard
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Review: {selectedBatch.filename}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Uploaded by <strong>{selectedBatch.uploadedBy}</strong> on {new Date(selectedBatch.uploadTime).toLocaleString('en-LK')}
            </p>
          </div>

          {detailsLoading ? (
            <>
              {/* Summary Cards Skeleton */}
              <div className="upload-summary-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '2rem' }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="summary-tile skeleton" style={{ height: '70px', borderLeft: 'none' }}></div>
                ))}
              </div>
              
              {/* Table Skeleton */}
              <div className="table-container">
                <table className="custom-table" style={{ opacity: 0.8 }}>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Account No</th>
                      <th>Customer Name</th>
                      <th>Billing Period</th>
                      <th>Net (Imp / Exp)</th>
                      <th>Unit Cost</th>
                      <th>Severity</th>
                      <th>Validation Errors / Warnings</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(6)].map((_, i) => (
                      <tr key={i}>
                        <td><div className="skeleton" style={{ height: '16px', width: '30px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '100px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '120px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '140px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '22px', width: '60px', borderRadius: '4px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '16px', width: '200px' }}></div></td>
                        <td><div className="skeleton" style={{ height: '28px', width: '50px', borderRadius: '4px', margin: '0 auto' }}></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : detailsError ? (
            <div style={{ padding: '3rem', textAlignment: 'center', color: 'var(--danger)' }}>
              {detailsError}
            </div>
          ) : (
            <>
              {/* Tab Switcher */}
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.1rem' }}>
                <button
                  onClick={() => setActiveTab('records')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'records' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTab === 'records' ? 'white' : 'var(--text-secondary)',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Staged Records ({totalRows})
                </button>
                <button
                  onClick={() => setActiveTab('proposals')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'proposals' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTab === 'proposals' ? 'white' : 'var(--text-secondary)',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Officer Changes ({proposals.filter(p => p.status === 'PENDING').length})
                </button>
                <button
                  onClick={() => setActiveTab('corrections')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'corrections' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTab === 'corrections' ? 'white' : 'var(--text-secondary)',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Correction History ({proposals.filter(p => p.status === 'APPROVED').length})
                </button>
              </div>

              {activeTab === 'proposals' ? renderProposalsTab() : activeTab === 'corrections' ? renderCorrectionsTab() : (
                <>
                  {/* Clickable Summary Cards (matches Officer Monthly Directory view) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {STATUS_FILTERS.filter(f => f.card !== false).map(f => {
                      const active = statusFilter === f.key;
                      return (
                        <button
                          key={f.key}
                          onClick={() => setStatusFilter(f.key)}
                          title={f.key === 'ALL' ? 'Show all records (clear filter)' : `Show only: ${f.cardLabel}`}
                          style={{
                            textAlign: 'left', cursor: 'pointer', padding: '0.55rem 0.7rem', borderRadius: 10,
                            background: active ? `${f.color}22` : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${active ? f.color : 'var(--border-color)'}`,
                            borderLeft: `3px solid ${f.color}`,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: f.color, fontFamily: 'monospace' }}>{filterCounts[f.key] ?? 0}</div>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: active ? 'white' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.cardLabel}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search and Filters Bar */}
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
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
                        { value: 'ALL', label: 'All Net Types', count: groupedRows.length, color: '#818cf8' },
                        ...netTypeOptions.map(([nt, count]) => ({ value: nt, label: nt, count, color: '#818cf8' })),
                      ]}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.03)', padding: '0.2rem', borderRadius: 8, border: '1px solid var(--border-color)', marginLeft: 'auto' }}>
                      <button
                        onClick={() => setViewMode('CARDS')}
                        title="Customer Cards View"
                        style={{
                          padding: '0.35rem 0.65rem', borderRadius: 6, border: 'none',
                          background: viewMode === 'CARDS' ? 'var(--primary)' : 'transparent',
                          color: viewMode === 'CARDS' ? 'white' : 'var(--text-secondary)',
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                        }}
                      >
                        <LayoutGrid size={13} /> Cards
                      </button>
                      <button
                        onClick={() => setViewMode('TABLE')}
                        title="Tabular View"
                        style={{
                          padding: '0.35rem 0.65rem', borderRadius: 6, border: 'none',
                          background: viewMode === 'TABLE' ? 'var(--primary)' : 'transparent',
                          color: viewMode === 'TABLE' ? 'white' : 'var(--text-secondary)',
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                        }}
                      >
                        <List size={13} /> Table
                      </button>
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Showing <strong style={{ color: 'white' }}>{displayRecords.length}</strong> of {groupedRows.length} records · sorted by Account No
                    </span>
                  </div>

                  {/* Customer Cards Grid View */}
                  {viewMode === 'CARDS' ? (
                    displayRecords.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        No customer records match the selected search or filter criteria.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {displayRecords.map(({ row, idx }) => (
                          <CustomerCard
                            key={idx}
                            row={row}
                            onView={() => setDetailsRecord(row)}
                            onEdit={() => handleOpenEditModal(row.sources?.[0] || row)}
                            onHistory={() => setActiveTab('corrections')}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    /* Tabular View (fallback) */
              <div className="table-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <table className="custom-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {isCustomerBatch ? (
                        [
                          'Row', 'Account No', 'Customer Name', 'Address', 'Ref. No.', 'Cost Code',
                          'Mobile', 'Capacity', 'Agreement Date', 'Bank', 'Branch',
                          'Bank Account', 'Solar Type', 'Unit Rate', 'Fix/Variable', 'L-Code',
                          ...(hasBillingData ? ['Billing Period', 'Net (Imp / Exp)', 'Unit Cost'] : []),
                          'Severity', 'Validation Errors / Warnings', 'Action'
                        ].map(h => (
                          <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                        ))
                      ) : (
                        [
                          'Row', 'Account No', 'Customer Name', 'Billing Period', 'Net (Imp / Exp)', 'Unit Cost', 'Severity', 'Validation Errors / Warnings', 'Action'
                        ].map(h => (
                          <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => {
                      const isWarning = row.validationStatus === 'WARNING';
                      const isDuplicate = row.validationStatus === 'DUPLICATE';
                      const isInvalid = row.validationStatus === 'INVALID';
                      
                      // Corrections may target any of the grouped source rows.
                      const rowCorrections = proposals.filter(p => row.sources.some(s => s.stagingId === p.stagingId) && p.status === 'APPROVED');
                      const isCorrected = rowCorrections.length > 0;

                      let correctedFields = [];
                      if (isCorrected) {
                        rowCorrections.forEach(rc => {
                          try {
                            const orig = JSON.parse(rc.originalData || '{}');
                            const mod = JSON.parse(rc.modifiedData || '{}');
                            Object.keys(mod).forEach(k => {
                              if (String(orig[k]) !== String(mod[k])) {
                                correctedFields.push(k);
                              }
                            });
                          } catch (e) {}
                        });
                      }

                      let correctedBadge = null;
                      if (isCorrected) {
                        correctedBadge = (
                          <span className="badge" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '0.15rem 0.45rem', fontSize: '0.7rem', border: '1px solid rgba(16,185,129,0.2)', marginTop: '0.25rem' }}>
                            Corrected
                          </span>
                        );
                      }
                      
                      let badge = (
                        <span className="badge success" style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}>
                          Valid
                        </span>
                      );
                      let rowBg = 'transparent';
                      
                      if (isInvalid) {
                        badge = (
                          <span className="badge danger" style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}>
                            Invalid
                          </span>
                        );
                        rowBg = 'rgba(239,68,68,0.02)';
                      } else if (isDuplicate) {
                        badge = (
                          <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7', padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}>
                            Duplicate
                          </span>
                        );
                        rowBg = 'rgba(168,85,247,0.02)';
                      } else if (isWarning) {
                        badge = (
                          <span className="badge warning" style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}>
                            Warning
                          </span>
                        );
                        rowBg = 'rgba(234,179,8,0.02)';
                      }

                      const renderCell = (val, fieldKey, prefix = '') => {
                        const isFieldCorrected = correctedFields.includes(fieldKey);
                        const style = isFieldCorrected ? {
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          padding: '0.15rem 0.35rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          fontWeight: 500
                        } : {};

                        if (val === undefined || val === null || String(val).trim() === '') {
                          return <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>;
                        }
                        const displayVal = prefix ? `${prefix}${val}` : String(val);
                        return isFieldCorrected ? <span style={style} title="Value corrected">{displayVal}</span> : displayVal;
                      };
                      
                      return (
                        <tr key={row.groupKey} style={{ backgroundColor: rowBg }}>
                          <td style={{ fontWeight: 600 }}>{row.index}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{renderCell(row.accountNo, 'accountNo')}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.customerName, 'customerName')}</td>
                          
                          {isCustomerBatch ? (
                            <>
                              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renderCell(row.customerAddress, 'customerAddress')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.refNo, 'refNo')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.costCode, 'costCode')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.mobileNo, 'mobileNo')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.panelCapacity, 'panelCapacity')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.agreementDate, 'agreementDate')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.bankCode, 'bankCode')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.branchCode, 'branchCode')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.bankAccountNo, 'bankAccountNo')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.solarType, 'solarType')}</td>
                              <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                {correctedFields.includes('unitRate') ? (
                                  <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)', fontWeight: 500 }} title="Value corrected">
                                    LKR {row.unitRate}
                                  </span>
                                ) : (
                                  row.unitRate !== undefined && row.unitRate !== null && String(row.unitRate).trim() !== '' ? `LKR ${row.unitRate}` : <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>
                                )}
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.tariffType, 'tariffType')}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.billingMode, 'billingMode')}</td>
                              {hasBillingData && (
                                <>
                                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                    {row.fromDate ? `${row.fromDate} to ${row.toDate}` : '—'}
                                  </td>
                                  <td>
                                    {row.importUnits !== undefined ? `${row.importUnits} / ${row.exportUnits}` : '—'}
                                  </td>
                                  <td>{row.unitCost !== undefined ? `LKR ${row.unitCost}` : '—'}</td>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                {row.fromDate ? `${row.fromDate} to ${row.toDate}` : '—'}
                              </td>
                              <td>
                                {row.importUnits !== undefined ? `${row.importUnits} / ${row.exportUnits}` : '—'}
                              </td>
                              <td>{row.unitCost !== undefined ? `LKR ${row.unitCost}` : '—'}</td>
                            </>
                          )}
                          
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {badge}
                              {correctedBadge}
                              {row.billings.length > 1 && (
                                <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7', padding: '0.15rem 0.45rem', fontSize: '0.7rem', border: '1px solid rgba(168,85,247,0.2)' }}>
                                  {row.billings.length} billing rows grouped
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {row.errors && row.errors.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {row.errors.map((err, errIdx) => (
                                  <div key={errIdx} style={{ 
                                    color: err.warning ? '#eab308' : 'var(--danger)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.25rem',
                                    fontSize: '0.8rem'
                                  }}>
                                    {err.warning ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                                    <span>{err.errorMessage}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={12} />
                                Ready to migrate
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {/* One Correct/Delete pair per underlying staging row — grouping never
                                hides a source record or its individual actions. */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                              {row.sources.map((src) => (
                                <div key={src.stagingId} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                                  {row.sources.length > 1 && (
                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 56, textAlign: 'right' }}>
                                      {src.rowType === 'CUSTOMER_PROFILE' ? 'Profile' : (row.billings.length > 1 ? `Billing #${row.billings.indexOf(src) + 1}` : 'Billing')}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                    onClick={() => handleOpenEditModal(src)}
                                  >
                                    <Edit2 size={12} />
                                    Correct
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-logout"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                                    onClick={() => handleAdminDeleteRow(src.stagingId)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </>
    )}

      {/* Detail Record Modal (Full 360 Customer Profile Breakdown) */}
      {detailsRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000000, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '860px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ref No: {cellText(detailsRecord.refNo)}</div>
                <h3 style={{ margin: '0.15rem 0', fontSize: '1.15rem', fontWeight: 700, fontFamily: 'monospace' }}>{cellText(detailsRecord.accountNo)}</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {cellText(detailsRecord.npayName) !== '—' ? cellText(detailsRecord.npayName) : cellText(detailsRecord.customerName)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <RecordStatusBadge row={detailsRecord} />
                <button onClick={() => setDetailsRecord(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XCircle size={18} /></button>
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
                          <span style={{ color: 'white', fontWeight: 600, textAlign: 'right' }}>{fieldValue(detailsRecord, f)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Validation & Errors */}
              <div style={{ marginTop: '1rem', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#f87171', marginBottom: '0.5rem' }}>Validation Status &amp; Errors</div>
                {(detailsRecord.errors || []).map((e, i) => (
                  <div key={`e${i}`} style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                    {typeof e === 'object' ? (e.errorMessage || e.field) : String(e)}
                  </div>
                ))}
                {(detailsRecord.warnings || []).map((w, i) => (
                  <div key={`w${i}`} style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                    {typeof w === 'object' ? (w.warning || w.field) : String(w)}
                  </div>
                ))}
                {(detailsRecord.errors || []).length === 0 && (detailsRecord.warnings || []).length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                    <CheckCircle2 size={12} /> No validation errors or warnings
                  </div>
                )}
                {isDuplicateRecord(detailsRecord) && (
                  <div style={{ fontSize: '0.73rem', color: '#c084fc', marginTop: '0.4rem' }}>
                    Duplicate source records detected across files
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button onClick={() => setDetailsRecord(null)} className="btn btn-secondary" style={{ padding: '0.55rem 1.25rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}

          <EditStagingRowModal
            isOpen={!!editingStagingRow}
            onClose={handleCloseEditModal}
            row={editingStagingRow}
            onSave={handleSaveStagingRow}
            loading={editStagingLoading}
          />
          
          {rejectModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 16, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: '500px', padding: '2rem', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>Reject Staging Batch</h3>
                  <button onClick={() => setRejectModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XCircle size={18} /></button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    Are you sure you want to reject the batch <strong>"{selectedBatch?.filename}"</strong>? All staged rows for this batch will be permanently deleted.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rejection Reason / Comments</label>
                    <textarea
                      style={{ width: '100%', minHeight: '100px', padding: '0.65rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.85rem', resize: 'vertical', lineHeight: 1.4 }}
                      placeholder="Explain why this batch is rejected so the officer knows what corrections to make..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', padding: '0.55rem 1.25rem', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    onClick={() => setRejectModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', padding: '0.55rem 1.25rem', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    onClick={handleConfirmReject}
                  >
                    Reject &amp; Discard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Pending list View */
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet className="text-primary" size={18} />
              Pending Upload Approval Queue
            </h2>
          </div>

          <div className="table-container">
            {loading ? (
              <table className="custom-table" style={{ opacity: 0.8 }}>
                <thead>
                  <tr>
                    <th>Upload Time</th>
                    <th>Filename</th>
                    <th>Uploaded By</th>
                    <th>Status</th>
                    <th>Rows Scanned</th>
                    <th>Staged Warnings / Failures</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(4)].map((_, i) => (
                    <tr key={i}>
                      <td><div className="skeleton" style={{ height: '16px', width: '120px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '220px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '100px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '4px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '60px' }}></div></td>
                      <td><div className="skeleton" style={{ height: '16px', width: '80px' }}></div></td>
                      <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: '28px', width: '100px', borderRadius: '4px', marginLeft: 'auto' }}></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : error ? (
              <div style={{ padding: '2rem', textAlignment: 'center', color: 'var(--danger)' }}>
                {error}
              </div>
            ) : pendingBatches.length === 0 ? (
              <div style={{ padding: '3rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>
                No uploads are currently pending approval. Let officers upload monthly workbooks.
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Upload Time</th>
                    <th>Filename</th>
                    <th>Uploaded By</th>
                    <th>Status</th>
                    <th>Rows Scanned</th>
                    <th>Staged Warnings / Failures</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBatches.map((batch) => (
                    <tr key={batch.id}>
                      <td>{new Date(batch.uploadTime).toLocaleString('en-LK')}</td>
                      <td style={{ fontWeight: 600 }}>{batch.filename}</td>
                      <td>{batch.uploadedBy}</td>
                      <td>
                        <span className="badge warning">
                          {batch.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td>{batch.rowsProcessed}</td>
                      <td style={{ 
                        color: batch.errorsCount > 0 ? 'var(--danger)' : 'inherit',
                        fontWeight: batch.errorsCount > 0 ? 600 : 'normal'
                      }}>
                        {batch.errorsCount} flag{batch.errorsCount !== 1 ? 's' : ''}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-primary"
                          style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                          onClick={() => handleSelectBatch(batch)}
                        >
                          <FileText size={12} />
                          Review Batch
                        </button>
                      </td>
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

const EditStagingRowModal = ({ isOpen, onClose, row, onSave, loading }) => {
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (row) {
      // Create a clean shallow copy of the fields, excluding staging internal metadata keys
      const cleanFields = { ...row };
      delete cleanFields.stagingId;
      delete cleanFields.validationStatus;
      delete cleanFields.errors;
      delete cleanFields.index;
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
      <div className="modal-container" style={{ maxWidth: '650px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Correct Data (Row #{row.rowNum || row.index})
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
                    onChange={(e) => handleChange('accountNo', e.target.value)}
                    required
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
                    onChange={(e) => handleChange('accountNo', e.target.value)}
                    required
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
              style={{ minWidth: '100px' }}
            >
              {loading ? 'Saving...' : 'Save & Re-validate'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default StagingReview;
