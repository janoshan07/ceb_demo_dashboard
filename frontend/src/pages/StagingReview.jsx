import React, { useState, useEffect } from 'react';
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
  Edit2
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'proposals'

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
        
        return {
          stagingId: row.stagingId,
          validationStatus: row.validationStatus,
          errors: errorsList,
          index: index + 1,
          ...rawData
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

  // Summary Metrics calculations
  const totalRows = stagingRows.length;
  const validRows = stagingRows.filter(r => r.validationStatus === 'VALID').length;
  const invalidRows = stagingRows.filter(r => r.validationStatus === 'INVALID').length;
  const duplicateRows = stagingRows.filter(r => r.validationStatus === 'DUPLICATE').length;
  const warningRows = stagingRows.filter(r => r.validationStatus === 'WARNING').length;

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
                  Officer Changes ({proposals.length})
                </button>
              </div>

              {activeTab === 'proposals' ? renderProposalsTab() : (
                <>
                  {/* Summary Cards */}
              {/* Summary Cards */}
              <div className="upload-summary-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '2rem' }}>
                <div className="summary-tile">
                  <div className="summary-tile-val">{totalRows}</div>
                  <div className="summary-tile-label">Total Staged</div>
                </div>
                <div className="summary-tile" style={{ borderLeft: '2px solid var(--success)' }}>
                  <div className="summary-tile-val" style={{ color: 'var(--success)' }}>{validRows}</div>
                  <div className="summary-tile-label">Valid Rows</div>
                </div>
                <div className="summary-tile" style={{ borderLeft: '2px solid var(--danger)' }}>
                  <div className="summary-tile-val" style={{ color: 'var(--danger)' }}>{invalidRows}</div>
                  <div className="summary-tile-label">Invalid (Skipped)</div>
                </div>
                <div className="summary-tile" style={{ borderLeft: '2px solid #a855f7' }}>
                  <div className="summary-tile-val" style={{ color: '#a855f7' }}>{duplicateRows}</div>
                  <div className="summary-tile-label">Duplicate (Skipped)</div>
                </div>
                <div className="summary-tile" style={{ borderLeft: '2px solid #eab308' }}>
                  <div className="summary-tile-val" style={{ color: '#eab308' }}>{warningRows}</div>
                  <div className="summary-tile-label">Warnings</div>
                </div>
              </div>

              {/* Data Table */}
              <div className="table-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <table className="custom-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {isCustomerBatch ? (
                        [
                          'Row', 'Account No', 'Customer Name', 'Address', 'Ref. No.', 'Cost Code',
                          'Mobile', 'Capacity', 'Agreement Date', 'Bank', 'Branch',
                          'Bank Account', 'Solar Type', 'Unit Rate', 'Fix/Variable', 'L-Code', 'Severity', 'Validation Errors / Warnings', 'Action'
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
                    {stagingRows.map((row, i) => {
                      const isWarning = row.validationStatus === 'WARNING';
                      const isDuplicate = row.validationStatus === 'DUPLICATE';
                      const isInvalid = row.validationStatus === 'INVALID';
                      
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

                      const renderCell = (val, prefix = '') => {
                        if (val === undefined || val === null || String(val).trim() === '') {
                          return <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>;
                        }
                        return prefix ? `${prefix}${val}` : String(val);
                      };
                      
                      return (
                        <tr key={row.stagingId} style={{ backgroundColor: rowBg }}>
                          <td style={{ fontWeight: 600 }}>{row.index}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{renderCell(row.accountNo)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.customerName)}</td>
                          
                          {isCustomerBatch ? (
                            <>
                              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renderCell(row.customerAddress)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.refNo)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.costCode)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.mobileNo)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.panelCapacity)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.agreementDate)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.bankCode)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.branchCode)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.bankAccountNo)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.solarType)}</td>
                              <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.unitRate !== undefined && row.unitRate !== null && String(row.unitRate).trim() !== '' ? `LKR ${row.unitRate}` : <span style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: 600, fontSize: '0.75rem' }}>Empty</span>}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.tariffType)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{renderCell(row.billingMode)}</td>
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
                          
                          <td>{badge}</td>
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
                            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={() => handleOpenEditModal(row)}
                              >
                                <Edit2 size={12} />
                                Correct
                              </button>
                              <button
                                type="button"
                                className="btn btn-logout"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                                onClick={() => handleAdminDeleteRow(row.stagingId)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
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
