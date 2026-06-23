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
  BadgeAlert
} from 'lucide-react';

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

  // Operation action states
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

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

    onConfirmAction({
      isOpen: true,
      title: 'Reject Staging Batch',
      message: `Are you sure you want to reject batch "${selectedBatch.filename}"? All staged rows for this file will be permanently deleted.`,
      type: 'danger',
      isAlertOnly: false,
      onConfirm: async () => {
        try {
          setActionProcessing(true);
          setActionError(null);
          setActionSuccess(null);
          
          const res = await authFetch(`/api/admin/staging/batch/${selectedBatch.id}/reject`, {
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
      }
    });
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
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.85rem' }}>
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
                      
                      return (
                        <tr key={row.stagingId} style={{ backgroundColor: rowBg }}>
                          <td style={{ fontWeight: 600 }}>{row.index}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{row.accountNo || '—'}</td>
                          <td>{row.customerName || '—'}</td>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {row.fromDate ? `${row.fromDate} to ${row.toDate}` : '—'}
                          </td>
                          <td>
                            {row.importUnits !== undefined ? `${row.importUnits} / ${row.exportUnits}` : '—'}
                          </td>
                          <td>{row.unitCost !== undefined ? `LKR ${row.unitCost}` : '—'}</td>
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
                                    <span><strong>{err.field}</strong>: {err.errorMessage}</span>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
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

export default StagingReview;
