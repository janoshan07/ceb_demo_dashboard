import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  FileText,
  Loader,
  ArrowLeft,
  Trash2,
  AlertCircle
} from 'lucide-react';

// ────────────────────────────────────────────────────────
//  Confirmation Modal
// ────────────────────────────────────────────────────────
const DeleteConfirmModal = ({ historyItem, onConfirm, onCancel, deleting }) => {
  if (!historyItem) return null;
  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 1000 }}>
      <div
        className="modal-content card animate-fade-in"
        style={{ maxWidth: 480, padding: '2rem', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={28} color="var(--danger)" />
          </div>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Delete Import &amp; Rollback Data?
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          You are about to permanently delete the upload record for{' '}
          <strong style={{ color: 'white' }}>{historyItem.filename}</strong>.
          <br />
          This will also remove all{' '}
          <strong style={{ color: 'var(--danger)' }}>
            {historyItem.billingInserted} billing record{historyItem.billingInserted !== 1 ? 's' : ''}
          </strong>{' '}
          that were imported from this file.
          <br />
          <br />
          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>This action cannot be undone.</span>
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={deleting}
            style={{ minWidth: 110 }}
          >
            Cancel
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              minWidth: 150,
              background: 'var(--danger)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center',
            }}
          >
            {deleting ? (
              <>
                <Loader className="animate-spin" size={15} />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={15} />
                Yes, Delete &amp; Rollback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
//  Main Page
// ────────────────────────────────────────────────────────
const UploadPage = () => {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // UploadHistory item
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null); // success message string
  const [deleteError, setDeleteError] = useState(null);     // error message string

  const fileInputRef = useRef(null);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await authFetch('/api/officer/billing/uploads');
      if (res.ok) {
        const data = await res.json();
        setUploadHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch upload history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    setError(null);
    setResult(null);

    const droppedFile = e.dataTransfer.files[0];
    if (validateFile(droppedFile)) {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    setError(null);
    setResult(null);
    const selectedFile = e.target.files[0];
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const validateFile = (fileToValidate) => {
    if (!fileToValidate) return false;
    const isExcel =
      fileToValidate.name.endsWith('.xlsx') ||
      fileToValidate.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!isExcel) {
      setError('Please upload a valid Excel workbook file (.xlsx).');
      setFile(null);
      return false;
    }
    return true;
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await authFetch('/api/officer/upload/excel', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Excel import failed.');
      }

      setResult(data);
      setFile(null);
      fetchHistory(); // Refresh history
    } catch (err) {
      setError(err.message || 'Error occurred during file upload.');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete handlers ──────────────────────────────────

  const openDeleteModal = (item) => {
    setDeleteTarget(item);
    setDeleteSuccess(null);
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    if (!deleting) setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await authFetch(`/api/officer/billing/uploads/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Delete request failed.');
      }

      const body = await res.json();
      setDeleteSuccess(body.message || `Upload "${deleteTarget.filename}" deleted successfully.`);
      setDeleteTarget(null);
      // If current result card was from this upload, clear it
      if (result && result.filename === deleteTarget.filename) {
        setResult(null);
      }
      fetchHistory();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete upload.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Confirmation Modal */}
      <DeleteConfirmModal
        historyItem={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteModal}
        deleting={deleting}
      />

      <button onClick={() => navigate('/')} className="back-btn">
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Import Billing Workbook</h1>
          <p className="page-subtitle">
            Upload monthly billing Excel workbooks to parse customers and compute energy bills.
          </p>
        </div>
      </div>

      {/* Delete Success / Error Banners */}
      {deleteSuccess && (
        <div
          className="animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid var(--success)',
            borderRadius: 10,
            padding: '0.875rem 1.25rem',
            marginBottom: '1.5rem',
            color: 'var(--success)',
            fontWeight: 500,
          }}
        >
          <CheckCircle size={18} />
          <span style={{ flex: 1 }}>{deleteSuccess}</span>
          <button
            onClick={() => setDeleteSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', lineHeight: 1 }}
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {deleteError && (
        <div
          className="animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid var(--danger)',
            borderRadius: 10,
            padding: '0.875rem 1.25rem',
            marginBottom: '1.5rem',
            color: 'var(--danger)',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={18} />
          <span style={{ flex: 1 }}>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', lineHeight: 1 }}
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      <div className="dashboard-grid" style={{ gridTemplateColumns: result ? '1fr 1fr' : '1fr' }}>
        {/* Upload Form */}
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title">Upload Excel Sheet</h2>
          </div>

          <form onSubmit={handleUploadSubmit}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept=".xlsx"
            />

            <div
              className={`upload-zone ${dragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              <div className="upload-icon-container">
                <Upload size={32} />
              </div>
              <span className="upload-title">
                {file ? file.name : 'Drag & drop monthly billing Excel sheet here'}
              </span>
              <span className="upload-subtitle">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : 'or click to browse from files (Only .xlsx spreadsheets are supported)'}
              </span>
            </div>

            {error && (
              <div className="login-error" style={{ marginTop: '1rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              {file && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  Clear File
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!file || uploading}
                style={{ minWidth: '120px' }}
              >
                {uploading ? (
                  <>
                    <Loader className="animate-spin" size={16} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Process Sheet</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Upload Result Summary */}
        {result && (
          <div className="card animate-fade-in">
            <div className="panel-header">
              <h2
                className="panel-title"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {result.status === 'SUCCESS' && <CheckCircle className="text-success" size={20} />}
                {result.status === 'COMPLETED_WITH_ERRORS' && (
                  <AlertTriangle className="text-warning" size={20} />
                )}
                {result.status === 'FAILED' && <XCircle className="text-danger" size={20} />}
                Upload Processing Report
              </h2>
              <span
                className={`badge ${
                  result.status === 'SUCCESS'
                    ? 'success'
                    : result.status === 'COMPLETED_WITH_ERRORS'
                    ? 'warning'
                    : 'danger'
                }`}
              >
                {result.status.replaceAll('_', ' ')}
              </span>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              File: <strong style={{ color: 'white' }}>{result.filename}</strong> has been imported
              and calculated.
            </p>

            <div className="upload-summary-grid">
              <div className="summary-tile">
                <div className="summary-tile-val">{result.rowsProcessed}</div>
                <div className="summary-tile-label">Rows Scanned</div>
              </div>
              <div className="summary-tile" style={{ borderLeft: '2px solid var(--success)' }}>
                <div className="summary-tile-val" style={{ color: 'var(--success)' }}>
                  {result.newCustomers}
                </div>
                <div className="summary-tile-label">New Customers</div>
              </div>
              <div className="summary-tile" style={{ borderLeft: '2px solid var(--primary)' }}>
                <div className="summary-tile-val" style={{ color: 'var(--primary)' }}>
                  {result.billingInserted}
                </div>
                <div className="summary-tile-label">Bills Persisted</div>
              </div>
              <div className="summary-tile" style={{ borderLeft: '2px solid var(--danger)' }}>
                <div className="summary-tile-val" style={{ color: 'var(--danger)' }}>
                  {result.errorsCount}
                </div>
                <div className="summary-tile-label">Errors Found</div>
              </div>
            </div>

            {/* Validation Errors Detail */}
            {result.errors && result.errors.length > 0 && (
              <div
                style={{
                  marginTop: '1.5rem',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '1.5rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--warning)',
                  }}
                >
                  <AlertTriangle size={16} />
                  Validation Failures / Warning Log
                </h3>
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                  }}
                >
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr
                        style={{
                          position: 'sticky',
                          top: 0,
                          backgroundColor: 'var(--bg-secondary)',
                          zIndex: 1,
                        }}
                      >
                        <th style={{ padding: '0.5rem' }}>Sheet</th>
                        <th style={{ padding: '0.5rem' }}>Row</th>
                        <th style={{ padding: '0.5rem' }}>Field</th>
                        <th style={{ padding: '0.5rem' }}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.65rem 0.5rem' }}>{err.sheetName}</td>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{err.rowNum}</td>
                          <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                            {err.field}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: 'var(--danger)' }}>
                            {err.errorMessage}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Log */}
      <div className="card" style={{ marginTop: '2.5rem' }}>
        <div className="panel-header">
          <h2
            className="panel-title"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FileText size={18} className="text-primary" />
            Workbook Import Registry
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            To undo an incorrect import, click the{' '}
            <Trash2 size={12} style={{ verticalAlign: 'middle' }} /> delete button on that row.
          </p>
        </div>

        <div className="table-container">
          {historyLoading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading Import History Log...
            </div>
          ) : uploadHistory.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No imports have been registered.
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Import Date</th>
                  <th>Filename</th>
                  <th>Uploaded By</th>
                  <th>Status</th>
                  <th>Rows Processed</th>
                  <th>New Customers</th>
                  <th>Bills Logged</th>
                  <th>Errors Count</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploadHistory.map((historyItem) => (
                  <tr key={historyItem.id}>
                    <td>{new Date(historyItem.uploadTime).toLocaleString('en-LK')}</td>
                    <td style={{ fontWeight: 600 }}>{historyItem.filename}</td>
                    <td>{historyItem.uploadedBy}</td>
                    <td>
                      <span
                        className={`badge ${
                          historyItem.status === 'SUCCESS'
                            ? 'success'
                            : historyItem.status === 'COMPLETED_WITH_ERRORS'
                            ? 'warning'
                            : 'danger'
                        }`}
                      >
                        {historyItem.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>{historyItem.rowsProcessed}</td>
                    <td>{historyItem.newCustomers}</td>
                    <td>{historyItem.billingInserted}</td>
                    <td
                      style={{
                        color:
                          historyItem.errorsCount > 0 ? 'var(--danger)' : 'inherit',
                        fontWeight: historyItem.errorsCount > 0 ? 600 : 'normal',
                      }}
                    >
                      {historyItem.errorsCount}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        id={`delete-upload-${historyItem.id}`}
                        title={`Delete import "${historyItem.filename}" and rollback billing records`}
                        onClick={() => openDeleteModal(historyItem)}
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 8,
                          padding: '0.35rem 0.65rem',
                          cursor: 'pointer',
                          color: 'var(--danger)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          transition: 'background 0.2s, border-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                          e.currentTarget.style.borderColor = 'var(--danger)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
                        }}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
