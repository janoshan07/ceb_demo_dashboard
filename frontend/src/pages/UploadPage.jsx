import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  AlertCircle,
  Settings,
  Eye,
  Check,
  RefreshCw,
  Layers,
  ChevronRight,
  ChevronLeft,
  Zap,
  User,
  Info,
  ToggleLeft,
  ToggleRight,
  Download
} from 'lucide-react';

// ────────────────────────────────────────────────────────
//  Confirmation Modal (for rollbacks)
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

const isStandardHeader = (h) => {
  if (!h) return false;
  const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
  const standardAliases = [
    'accountno', 'accountnumber', 'account',
    'customername', 'name', 'cname',
    'refno', 'referenceno', 'referencenumber', 'ref',
    'fromdate', 'startdate', 'billperiod', 'period', 'from',
    'todate', 'enddate', 'to',
    'imports', 'import', 'importunits',
    'exports', 'export', 'exportunits',
    'unitcost', 'rate', 'unitrate', 'rateunit', 'cost', 'sale', 'unitsale'
  ];
  return standardAliases.includes(clean);
};

const CompareDuplicateModal = ({ targetRow, onSelectAction, onCancel }) => {
  if (!targetRow) return null;
  const db = targetRow.dbRecord;

  const renderComparisonRow = (label, excelVal, dbVal, highlightMismatch = true) => {
    const isMismatch = highlightMismatch && excelVal !== undefined && dbVal !== undefined && excelVal?.toString()?.trim() !== dbVal?.toString()?.trim();
    return (
      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</td>
        <td style={{ padding: '0.6rem 0.8rem', color: isMismatch ? '#f59e0b' : 'white', fontSize: '0.85rem', fontWeight: isMismatch ? 700 : 400 }}>
          {excelVal ?? '—'}
          {isMismatch && <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Mismatch</span>}
        </td>
        <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {dbVal ?? '—'}
        </td>
      </tr>
    );
  };

  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        className="modal-content card animate-fade-in"
        style={{ maxWidth: 640, width: '90%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            Duplicate Record Comparison
          </h3>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>

        {db ? (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
              The uploaded sheet contains a record with a billing period that conflicts with an existing entry in the live database for Account Number <strong>{targetRow.accountNo}</strong>. Review the side-by-side details below:
            </p>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Metric</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--primary)' }}>New Excel Value</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Live DB Value</th>
                  </tr>
                </thead>
                <tbody>
                  {renderComparisonRow("Customer Name", targetRow.customerName, db.customerName)}
                  {renderComparisonRow("From Date", targetRow.fromDate, db.fromDate, false)}
                  {renderComparisonRow("To Date", targetRow.toDate, db.toDate, false)}
                  {renderComparisonRow("Imports (kWh)", targetRow.imports, db.imports)}
                  {renderComparisonRow("Exports (kWh)", targetRow.exports, db.exports)}
                  {renderComparisonRow("Unit Cost (LKR)", targetRow.unitCost, db.unitCost)}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={28} color="#f59e0b" />
            <h4 style={{ margin: 0, fontWeight: 600 }}>Sheet-Level Duplicate Conflict</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '400px', lineHeight: 1.5, margin: 0 }}>
              This row is duplicated within the uploaded spreadsheet workbook itself for Account Number <strong>{targetRow.accountNo}</strong> (multiple rows have the same account number and billing period).
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }} onClick={onCancel}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-logout"
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', width: 'auto', border: '1px solid var(--border-color)' }}
            onClick={() => {
              onSelectAction(targetRow, 'IGNORE');
              onCancel();
            }}
          >
            Ignore / Exclude
          </button>
          <button
            type="button"
            className="btn"
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', backgroundColor: 'var(--success)', color: 'white' }}
            onClick={() => {
              onSelectAction(targetRow, 'IMPORT');
              onCancel();
            }}
          >
            Import anyway
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────
//  Main Page Component
// ────────────────────────────────────────────────────────
const UploadPage = () => {
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const { showToast } = useToast();

  // Wizard state variables
  const [activeView, setActiveView] = useState('wizard'); // 'wizard' or 'templates'
  const [wizardStep, setWizardStep] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [batchData, setBatchData] = useState(null);
  const [error, setError] = useState(null);
  const [previewActiveSheet, setPreviewActiveSheet] = useState(null);

  // Step 4 preview management
  const [previewSheets, setPreviewSheets] = useState([]);       // local list (user can delete)
  const [importSelectedSheets, setImportSelectedSheets] = useState(new Set()); // checked for import
  const [sheetPages, setSheetPages] = useState({});             // { sheetName: pageNum }
  const ROWS_PER_PAGE = 50;

  // Redesigned Step 4 preview tabs and action management
  const [previewTab, setPreviewTab] = useState('all'); // 'all', 'errors', 'duplicates'
  const [localCorrections, setLocalCorrections] = useState({}); // { 'sheetName|rowNum': { field: val } }
  const [duplicateActions, setDuplicateActions] = useState({}); // { 'sheetName|rowNum': 'IMPORT' | 'IGNORE' }
  const [editingRowKey, setEditingRowKey] = useState(null); // 'sheetName|rowNum'
  const [editRowState, setEditRowState] = useState({}); // values of the row currently edited
  const [editErrors, setEditErrors] = useState({}); // client side validation errors
  const [compareTarget, setCompareTarget] = useState(null); // row selected for duplicate comparison

  // Template Configurations State
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedSheetConfig, setSelectedSheetConfig] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Registry Registry Log State
  const [uploadHistory, setUploadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete modal state (rollbacks)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch Excel history registry logs
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

  // Fetch active configurations templates
  const fetchTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const res = await authFetch('/api/admin/import/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0]);
          if (data[0].sheets && data[0].sheets.length > 0) {
            setSelectedSheetConfig(data[0].sheets[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load templates mappings', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    if (user?.role === 'ADMIN') {
      fetchTemplates();
    }
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
    const droppedFile = e.dataTransfer.files[0];
    if (validateFile(droppedFile)) {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    setError(null);
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

  // Step 1 -> 2: Upload & Scan workbook
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setWizardStep(2);

      const formData = new FormData();
      formData.append('file', file);

      const response = await authFetch('/api/officer/import/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Validation scanning engine failed.');
      }

      setBatchData(data);

      // Initialise preview sheets — ALL sheets visible
      if (data.preview && data.preview.sheets) {
        const allSheets = data.preview.sheets;
        setPreviewSheets(allSheets);
        // Auto-select all importable sheets
        const importable = new Set(allSheets.filter(s => s.canImport).map(s => s.sheetName));
        setImportSelectedSheets(importable);
        // Set active tab to first importable, or first sheet
        const firstImportable = allSheets.find(s => s.canImport);
        setPreviewActiveSheet(firstImportable ? firstImportable.sheetName : allSheets[0]?.sheetName);
      }

      showToast('Workbook successfully scanned and structures validated.', 'info');

    } catch (err) {
      setError(err.message || 'Error occurred during workbook upload.');
      showToast(err.message || 'Scanning failed.', 'error');
      setWizardStep(1);
    } finally {
      setUploading(false);
    }
  };

  // Step 5: Approve live database import
  const handleApproveBatch = async () => {
    if (!batchData) return;
    const selectedSheets = Array.from(importSelectedSheets);
    if (selectedSheets.length === 0) {
      showToast('Please select at least one sheet to import.', 'warning');
      return;
    }

    // Collect corrections, ignored rows, and import anyway rows
    const correctionsMap = {};
    const ignoredRowsArray = [];
    const importAnywayArray = [];

    previewSheets.forEach(sheet => {
      if (!sheet.rows) return;
      sheet.rows.forEach(row => {
        const key = `${sheet.sheetName}|${row.rowNum}`;

        // Local edit corrections
        if (localCorrections[key]) {
          correctionsMap[key] = localCorrections[key];
        }

        // Duplicate actions
        if (row.validationStatus === 'DUPLICATE') {
          const action = duplicateActions[key] || 'IGNORE'; // default to ignore duplicates
          if (action === 'IGNORE') {
            ignoredRowsArray.push(key);
          } else if (action === 'IMPORT') {
            importAnywayArray.push(key);
          }
        }

        // Ignored error records
        if (row.validationStatus === 'INVALID') {
          const action = duplicateActions[key];
          if (action === 'IGNORE') {
            ignoredRowsArray.push(key);
          }
        }
      });
    });

    try {
      setUploading(true);
      const response = await authFetch(`/api/admin/import/batches/${batchData.batchId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedSheets,
          corrections: correctionsMap,
          importAnywayRows: importAnywayArray,
          ignoredRows: ignoredRowsArray
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Approval process failed.');
      }

      showToast(`Import approved! Migrated ${data.rowsStaged || 0} records (${data.billingRows || 0} bills, ${data.customerProfileRows || 0} profiles) to live database.`, 'success');
      setBatchData(prev => ({ ...prev, status: 'APPROVED', rowsMigrated: data.rowsStaged || 0 }));
      setWizardStep(5);
      fetchHistory();
      setFile(null);
    } catch (err) {
      showToast(err.message || 'Approval failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Step 5: Reject batch configuration
  const handleRejectBatch = async () => {
    if (!batchData) return;
    try {
      setUploading(true);
      const response = await authFetch(`/api/admin/import/batches/${batchData.batchId}/reject`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Rejection process failed.');
      }

      showToast('Validation batch rejected and deleted from cache.', 'warning');
      resetWizard();
    } catch (err) {
      showToast(err.message || 'Rejection failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const resetWizard = () => {
    setFile(null);
    setBatchData(null);
    setWizardStep(1);
    setError(null);
    setPreviewSheets([]);
    setImportSelectedSheets(new Set());
    setSheetPages({});
    setPreviewActiveSheet(null);
    setPreviewTab('all');
    setLocalCorrections({});
    setDuplicateActions({});
    setEditingRowKey(null);
    setEditRowState({});
    setEditErrors({});
  };

  // --- Inline Editing & Interactive Validation Actions ---

  const startEditRow = (row, sheetName) => {
    const key = `${sheetName}|${row.rowNum}`;
    setEditingRowKey(key);
    setEditRowState({
      accountNo: row.accountNo || '',
      customerName: row.customerName || '',
      fromDate: row.fromDate || '',
      toDate: row.toDate || '',
      imports: row.imports ?? '',
      exports: row.exports ?? '',
      unitCost: row.unitCost ?? '',
      billingMode: row.billingMode || 'Variable',
      customerAddress: row.customerAddress || '',
      mobileNo: row.mobileNo || '',
      agreementDate: row.agreementDate || '',
      panelCapacity: row.panelCapacity ?? '',
      solarType: row.solarType || '',
      bankCode: row.bankCode || '',
      branchCode: row.branchCode || '',
      bankAccountNo: row.bankAccountNo || ''
    });
    setEditErrors({});
  };

  const handleEditChange = (field, val) => {
    setEditRowState(prev => ({ ...prev, [field]: val }));
    if (editErrors[field]) {
      setEditErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const cancelEditRow = () => {
    setEditingRowKey(null);
    setEditRowState({});
    setEditErrors({});
  };

  const saveEditedRow = (rowNum, sheetName) => {
    const key = `${sheetName}|${rowNum}`;
    
    // Client-side validation
    const errors = {};
    if (!editRowState.accountNo || !editRowState.accountNo.trim()) {
      errors.accountNo = 'Account number is required';
    }
    
    // Verify sheet type
    const sheet = previewSheets.find(s => s.sheetName === sheetName);
    const isBilling = sheet?.detectedType === 'BILLING';
    
    if (isBilling) {
      if (!editRowState.customerName || !editRowState.customerName.trim()) {
        errors.customerName = 'Customer name is required';
      }
      if (!editRowState.fromDate || !editRowState.fromDate.trim()) {
        errors.fromDate = 'From Date is required';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(editRowState.fromDate)) {
        errors.fromDate = 'Expected format: YYYY-MM-DD';
      }
      if (!editRowState.toDate || !editRowState.toDate.trim()) {
        errors.toDate = 'To Date is required';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(editRowState.toDate)) {
        errors.toDate = 'Expected format: YYYY-MM-DD';
      }
      if (editRowState.imports === '' || isNaN(editRowState.imports) || Number(editRowState.imports) < 0) {
        errors.imports = 'Imports must be a positive number';
      }
      if (editRowState.exports === '' || isNaN(editRowState.exports) || Number(editRowState.exports) < 0) {
        errors.exports = 'Exports must be a positive number';
      }
      if (editRowState.unitCost === '' || isNaN(editRowState.unitCost) || Number(editRowState.unitCost) < 0) {
        errors.unitCost = 'Unit Cost must be a positive number';
      }
    } else {
      // Customer profile
      if (!editRowState.customerName || !editRowState.customerName.trim()) {
        errors.customerName = 'Customer name is required';
      }
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      showToast('Please correct validation errors first.', 'error');
      return;
    }

    // Save correction locally
    setLocalCorrections(prev => ({
      ...prev,
      [key]: {
        ...editRowState,
        importUnits: editRowState.imports !== '' ? Number(editRowState.imports) : null,
        exportUnits: editRowState.exports !== '' ? Number(editRowState.exports) : null,
        unitCost: editRowState.unitCost !== '' ? Number(editRowState.unitCost) : null,
        panelCapacity: editRowState.panelCapacity !== '' ? Number(editRowState.panelCapacity) : null
      }
    }));

    // Update row details in previewSheets state so UI updates the row to VALID
    setPreviewSheets(prev => prev.map(s => {
      if (s.sheetName !== sheetName) return s;
      return {
        ...s,
        rows: s.rows.map(r => {
          if (r.rowNum !== rowNum) return r;
          return {
            ...r,
            ...editRowState,
            imports: editRowState.imports,
            exports: editRowState.exports,
            unitCost: editRowState.unitCost,
            panelCapacity: editRowState.panelCapacity,
            validationStatus: 'VALID', // Force valid status
            errors: [] // Clear all errors list
          };
        })
      };
    }));

    setEditingRowKey(null);
    showToast('Row validation succeeded and marked as valid!', 'success');
  };

  // --- Configurations actions (Admins Only) ---

  const handleToggleIgnoreSheet = async (sheetConfigId) => {
    try {
      const res = await authFetch(`/api/admin/import/sheet-configs/${sheetConfigId}/toggle-ignore`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Sheet ignore status changed.', 'success');
        fetchTemplates();
      }
    } catch (e) {
      showToast('Action failed.', 'error');
    }
  };

  const handleSoftDeleteSheet = async (sheetConfigId) => {
    try {
      const res = await authFetch(`/api/admin/import/sheet-configs/${sheetConfigId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Sheet configuration soft deleted.', 'warning');
        fetchTemplates();
      }
    } catch (e) {
      showToast('Soft delete failed.', 'error');
    }
  };

  const handleRestoreSheet = async (sheetConfigId) => {
    try {
      const res = await authFetch(`/api/admin/import/sheet-configs/${sheetConfigId}/restore`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Sheet configuration restored.', 'success');
        fetchTemplates();
      }
    } catch (e) {
      showToast('Restore failed.', 'error');
    }
  };

  const handleSoftDeleteHeader = async (headerMappingId) => {
    try {
      const res = await authFetch(`/api/admin/import/header-mappings/${headerMappingId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Column mapping soft deleted.', 'warning');
        fetchTemplates();
      }
    } catch (e) {
      showToast('Soft delete failed.', 'error');
    }
  };

  const handleRestoreHeader = async (headerMappingId) => {
    try {
      const res = await authFetch(`/api/admin/import/header-mappings/${headerMappingId}/restore`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Column mapping restored.', 'success');
        fetchTemplates();
      }
    } catch (e) {
      showToast('Restore failed.', 'error');
    }
  };

  // --- Rollback actions ---

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
        throw new Error('Rollback failed.');
      }

      const body = await res.json();
      const msg = body.message || `Upload "${deleteTarget.filename}" deleted successfully.`;
      setDeleteSuccess(msg);
      showToast(msg, 'success');
      setDeleteTarget(null);
      fetchHistory();
    } catch (err) {
      setDeleteError(err.message || 'Failed to rollback upload.');
      showToast(err.message || 'Rollback failed.', 'error');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Find headers for details panel in templates configurator
  useEffect(() => {
    if (selectedTemplate && selectedSheetConfig) {
      // Find matching sheet in latest template config state
      const match = selectedTemplate.sheets.find(s => s.id === selectedSheetConfig.id);
      if (match) {
        setSelectedSheetConfig(match);
      }
    }
  }, [templates]);

  return (
    <div className="page-wrapper animate-fade-in">
      <DeleteConfirmModal
        historyItem={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteModal}
        deleting={deleting}
      />

      <CompareDuplicateModal
        targetRow={compareTarget}
        onSelectAction={(row, action) => {
          const key = `${row.sheetName || previewActiveSheet}|${row.rowNum}`;
          setDuplicateActions(prev => ({ ...prev, [key]: action }));
          showToast(`Duplicate action for Row ${row.rowNum} set to ${action === 'IMPORT' ? 'FORCE IMPORT' : 'IGNORE / EXCLUDE'}`, 'success');
        }}
        onCancel={() => setCompareTarget(null)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate('/')} className="back-btn" style={{ margin: 0 }}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {user?.role === 'ADMIN' && (
          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            onClick={() => {
              setActiveView(activeView === 'wizard' ? 'templates' : 'wizard');
              resetWizard();
            }}
          >
            <Settings size={16} />
            {activeView === 'wizard' ? 'Schema Configurations' : 'Open Import Wizard'}
          </button>
        )}
      </div>

      <div className="page-header" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">
            {activeView === 'wizard' ? 'Excel Import Validation Engine' : 'Template Mappings Configurator'}
          </h1>
          <p className="page-subtitle">
            {activeView === 'wizard' 
              ? 'Multi-stage validation pipeline verifying worksheets, schemas, and values before live ledger push.'
              : 'Soft delete, restore, or ignore sheets and header columns configurations mapped to the database.'}
          </p>
        </div>
      </div>

      {activeView === 'wizard' ? (
        <>
          {/* STEP PROGRESS BAR */}
          <div 
            className="wizard-steps-progress" 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '2rem', 
              padding: '0.85rem 1.5rem', 
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '12px', 
              border: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: wizardStep >= s ? 1 : 0.45, transition: 'all 0.3s' }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: wizardStep === s ? 'var(--primary)' : wizardStep > s ? 'var(--success)' : 'rgba(255,255,255,0.05)',
                  color: wizardStep >= s ? 'white' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.82rem',
                  border: wizardStep === s ? '2px solid var(--primary-glow)' : 'none'
                }}>
                  {wizardStep > s || (wizardStep === 5 && s === 5 && batchData?.status === 'APPROVED') ? '✓' : s}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: wizardStep === s ? 600 : 400, color: wizardStep === s ? 'white' : 'var(--text-secondary)' }}>
                  {s === 1 && 'Upload'}
                  {s === 2 && 'Scan'}
                  {s === 3 && 'Validate'}
                  {s === 4 && 'Preview'}
                  {s === 5 && 'Approve'}
                </span>
              </div>
            ))}
          </div>

          {/* WIZARD CONTENT BLOCKS */}
          <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            
            {/* STEP 1: UPLOAD */}
            {wizardStep === 1 && (
              <div className="animate-fade-in">
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem' }}>Step 1: Select Spreadsheet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Select the EDL monthly billing workbook (.xlsx) to feed to the scanner engine.</p>
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
                    style={{ padding: '3.5rem 2rem' }}
                  >
                    <div className="upload-icon-container" style={{ marginBottom: '1rem' }}>
                      <Upload size={32} />
                    </div>
                    <span className="upload-title" style={{ fontSize: '1rem', fontWeight: 600 }}>
                      {file ? file.name : 'Drag & drop monthly billing Excel sheet here'}
                    </span>
                    <span className="upload-subtitle" style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
                      {file
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : 'or click to browse from local files'}
                    </span>
                  </div>

                  {error && (
                    <div className="login-error" style={{ marginTop: '1rem' }}>
                      {error}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                    {file && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setFile(null)}
                      >
                        Clear Selection
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!file}
                      style={{ minWidth: '150px', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
                    >
                      <Layers size={14} />
                      Scan Workbook
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 2: SCAN WORKBOOK */}
            {wizardStep === 2 && (
              <div className="animate-fade-in" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                {uploading ? (
                  <>
                    <Loader className="animate-spin" size={48} style={{ color: 'var(--primary)', margin: '0 auto 1.5rem' }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Workbook Scanning in Progress...</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Parsing workbook sheets and validating layout templates.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 1.5rem' }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Scan Completed Successfully!</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                      Scanned <strong>{batchData?.totalSheets}</strong> sheets from workbook: <strong style={{ color: 'white' }}>{batchData?.filename}</strong>.
                    </p>

                    <div style={{ maxWidth: '400px', margin: '0 auto 1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <table className="custom-table" style={{ margin: 0, fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <th>Sheet Name</th>
                            <th style={{ textAlign: 'right' }}>Scanned Rows</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchData?.sheetsScan?.map((s) => (
                            <tr key={s.name}>
                              <td style={{ fontWeight: 600 }}>{s.name}</td>
                              <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{s.rowCount} rows</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button className="btn btn-primary" onClick={() => setWizardStep(3)}>
                      Proceed to Validation
                    </button>
                  </>
                )}
              </div>
            )}

            {/* STEP 3: SHEET & HEADER VALIDATION */}
            {wizardStep === 3 && (
              <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Step 3: Validation Engine Analysis</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Workbook checked against template mappings schema rules.</p>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Template: <strong>{batchData?.excelTemplate}</strong></span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="card" style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: batchData?.sheetValidationStatus === 'PASS' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {batchData?.sheetValidationStatus === 'PASS' 
                        ? <CheckCircle size={20} color="var(--success)" />
                        : <XCircle size={20} color="var(--danger)" />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sheets Structure Validation</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: batchData?.sheetValidationStatus === 'PASS' ? 'var(--success)' : 'var(--danger)' }}>
                        {batchData?.sheetValidationStatus === 'PASS' ? 'PASSED' : 'FAILED'}
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: batchData?.headerValidationStatus === 'PASS' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {batchData?.headerValidationStatus === 'PASS' 
                        ? <CheckCircle size={20} color="var(--success)" />
                        : <XCircle size={20} color="var(--danger)" />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Column Headers Mapping Check</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: batchData?.headerValidationStatus === 'PASS' ? 'var(--success)' : 'var(--danger)' }}>
                        {batchData?.headerValidationStatus === 'PASS' ? 'PASSED' : 'FAILED'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation Logs */}
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertCircle size={14} className="text-primary" />
                  Scanner Validation Logs
                </h4>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '2rem' }}>
                  {batchData?.logs?.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={16} />
                      Zero schema validation failures. All mapped worksheets and headers found.
                    </div>
                  ) : (
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                          <th>Check Type</th>
                          <th>Severity</th>
                          <th>Details Log</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchData?.logs?.map((log, i) => (
                          <tr key={i}>
                            <td>
                              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{log.type}</span>
                            </td>
                            <td>
                              <span className={`badge ${log.severity === 'ERROR' ? 'danger' : log.severity === 'WARNING' ? 'warning' : 'info'}`}>
                                {log.severity}
                              </span>
                            </td>
                            <td style={{ color: log.severity === 'ERROR' ? 'var(--danger)' : log.severity === 'WARNING' ? '#eab308' : 'var(--text-secondary)' }}>
                              {log.details}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn btn-secondary" onClick={resetWizard}>
                    Discard &amp; Reupload
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setWizardStep(4)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <span>Proceed to Data Preview</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: DATA PREVIEW & IMPORT SELECTION */}
            {wizardStep === 4 && (() => {
              const activeSheet   = previewSheets.find(s => s.sheetName === previewActiveSheet);
              const currentPage   = sheetPages[previewActiveSheet] || 1;
              const allRows       = activeSheet?.rows || [];
              const totalPages    = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
              const paginatedRows = allRows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
              const selectedCount = importSelectedSheets.size;
              const totalSelectedRows = previewSheets
                .filter(s => importSelectedSheets.has(s.sheetName))
                .reduce((sum, s) => sum + (s.rowCount || 0), 0);

              const handleDeleteSheet = (sheetName) => {
                const remaining = previewSheets.filter(s => s.sheetName !== sheetName);
                setPreviewSheets(remaining);
                setImportSelectedSheets(prev => { const n = new Set(prev); n.delete(sheetName); return n; });
                if (previewActiveSheet === sheetName) {
                  setPreviewActiveSheet(remaining[0]?.sheetName || null);
                }
              };

              const handleToggleSheet = (sheetName) => {
                setImportSelectedSheets(prev => {
                  const n = new Set(prev);
                  if (n.has(sheetName)) n.delete(sheetName); else n.add(sheetName);
                  return n;
                });
              };

              const goToPage = (pg) => {
                const clamped = Math.max(1, Math.min(pg, totalPages));
                setSheetPages(prev => ({ ...prev, [previewActiveSheet]: clamped }));
              };

              const typeColor = (t) => t === 'BILLING' ? 'var(--success)' : t === 'CUSTOMER_PROFILE' ? '#818cf8' : 'var(--text-muted)';
              const typeBg    = (t) => t === 'BILLING' ? 'rgba(16,185,129,0.12)' : t === 'CUSTOMER_PROFILE' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.05)';
              const typeLabel = (t) => t === 'BILLING' ? '⚡ Billing' : t === 'CUSTOMER_PROFILE' ? '👤 Profile' : 'ℹ️ Other';

              // Dynamic count and grouping calculations
              const getErrorsBySheet = () => {
                const results = [];
                previewSheets.forEach(sheet => {
                  if (!sheet.rows) return;
                  const errRows = sheet.rows.filter(r => {
                    const key = `${sheet.sheetName}|${r.rowNum}`;
                    return r.validationStatus === 'INVALID' && duplicateActions[key] !== 'IGNORE';
                  });
                  if (errRows.length > 0) {
                    results.push({
                      sheetName: sheet.sheetName,
                      detectedType: sheet.detectedType,
                      rows: errRows
                    });
                  }
                });
                return results;
              };

              const getDuplicatesBySheet = () => {
                const results = [];
                previewSheets.forEach(sheet => {
                  if (!sheet.rows) return;
                  const dupRows = sheet.rows.filter(r => r.validationStatus === 'DUPLICATE');
                  if (dupRows.length > 0) {
                    results.push({
                      sheetName: sheet.sheetName,
                      detectedType: sheet.detectedType,
                      rows: dupRows
                    });
                  }
                });
                return results;
              };

              const errorsBySheet = getErrorsBySheet();
              const duplicatesBySheet = getDuplicatesBySheet();

              const getSheetStats = (sheet) => {
                let errors = 0;
                let duplicates = 0;
                if (sheet.rows) {
                  sheet.rows.forEach(r => {
                    const key = `${sheet.sheetName}|${r.rowNum}`;
                    if (r.validationStatus === 'INVALID') {
                      if (duplicateActions[key] !== 'IGNORE') errors++;
                    } else if (r.validationStatus === 'DUPLICATE') {
                      const action = duplicateActions[key] || 'IGNORE';
                      if (action === 'IGNORE') duplicates++;
                    }
                  });
                }
                return { errors, duplicates };
              };

              const totalErrors = previewSheets.reduce((sum, s) => sum + getSheetStats(s).errors, 0);
              const totalDuplicates = previewSheets.reduce((sum, s) => sum + getSheetStats(s).duplicates, 0);

              return (
                <div className="animate-fade-in">
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Step 4: Full Data Preview &amp; Validation Panel</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Review all worksheets, resolve duplicate conflicts, correct row validation errors inline.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="badge info">Sheets: {previewSheets.length}</span>
                      <span className="badge success">Selected: {selectedCount}</span>
                      <span className="badge info">Rows to Import: {totalSelectedRows.toLocaleString()}</span>
                      {totalErrors > 0 && (
                        <span className="badge danger">Unresolved Errors: {totalErrors}</span>
                      )}
                      {totalDuplicates > 0 && (
                        <span className="badge warning">Skipped Duplicates: {totalDuplicates}</span>
                      )}
                    </div>
                  </div>

                  {/* Panel Category Tab Switchers */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('all')}
                      className={`btn ${previewTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Layers size={14} />
                      <span>All Sheets Data ({previewSheets.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('errors')}
                      className={`btn ${previewTab === 'errors' ? 'btn-logout' : 'btn-secondary'}`}
                      style={{ 
                        padding: '0.5rem 1.25rem', 
                        fontSize: '0.85rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        backgroundColor: previewTab === 'errors' ? 'var(--danger)' : totalErrors > 0 ? 'rgba(239,68,68,0.1)' : 'transparent',
                        borderColor: totalErrors > 0 ? 'var(--danger)' : 'var(--border-color)',
                        color: totalErrors > 0 ? 'var(--danger)' : 'var(--text-secondary)'
                      }}
                    >
                      <AlertCircle size={14} />
                      <span>Errors ({totalErrors})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('duplicates')}
                      className={`btn ${previewTab === 'duplicates' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        padding: '0.5rem 1.25rem', 
                        fontSize: '0.85rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        backgroundColor: previewTab === 'duplicates' ? '#f59e0b' : totalDuplicates > 0 ? 'rgba(245,158,11,0.1)' : 'transparent',
                        borderColor: totalDuplicates > 0 ? '#f59e0b' : 'var(--border-color)',
                        color: totalDuplicates > 0 ? '#f59e0b' : 'var(--text-secondary)'
                      }}
                    >
                      <Layers size={14} />
                      <span>Duplicates ({totalDuplicates})</span>
                    </button>
                  </div>

                  {/* TAB 1: ALL SHEETS DATA */}
                  {previewTab === 'all' && (
                    <div>
                      {/* Sheet Tabs Selector */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Layers size={12} /> Select sheets to include in import &nbsp;·&nbsp; Click sheet name to preview
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                          {previewSheets.map((s) => {
                            const isActive   = previewActiveSheet === s.sheetName;
                            const isSelected = importSelectedSheets.has(s.sheetName);
                            const stats = getSheetStats(s);
                            return (
                              <div
                                key={s.sheetName}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                                  padding: '0.45rem 0.75rem',
                                  border: `1.5px solid ${isActive ? 'var(--primary)' : isSelected ? 'rgba(99,102,241,0.4)' : 'var(--border-color)'}`,
                                  borderRadius: '8px',
                                  backgroundColor: isActive ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  flexShrink: 0,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSheet(s.sheetName)}
                                  onClick={e => e.stopPropagation()}
                                  style={{ cursor: 'pointer', accentColor: 'var(--primary)', width: '14px', height: '14px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => { setPreviewActiveSheet(s.sheetName); setSheetPages(prev => ({ ...prev, [s.sheetName]: 1 })); }}
                                  style={{ background: 'none', border: 'none', color: isActive ? 'white' : 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                                >
                                  {s.sheetName}
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({(s.rowCount || 0).toLocaleString()})</span>
                                </button>
                                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: typeBg(s.detectedType), color: typeColor(s.detectedType), fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {typeLabel(s.detectedType)}
                                </span>
                                {stats.errors > 0 && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.2)', color: 'var(--danger)', fontWeight: 600 }}>{stats.errors} err</span>}
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); handleDeleteSheet(s.sheetName); }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.1rem', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            );
                          })}
                          {previewSheets.length === 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem' }}>All sheets have been removed.</span>
                          )}
                        </div>
                      </div>

                      {/* Active Sheet Info Bar */}
                      {activeSheet && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activeSheet.sheetName}</span>
                            <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: typeBg(activeSheet.detectedType), color: typeColor(activeSheet.detectedType), fontWeight: 600 }}>
                              {typeLabel(activeSheet.detectedType)}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {(activeSheet.rowCount || 0).toLocaleString()} rows
                              {getSheetStats(activeSheet).errors > 0 && <span style={{ color: 'var(--danger)', marginLeft: '0.5rem' }}>· {getSheetStats(activeSheet).errors} errors</span>}
                              {getSheetStats(activeSheet).duplicates > 0 && <span style={{ color: '#eab308', marginLeft: '0.5rem' }}>· {getSheetStats(activeSheet).duplicates} duplicates (skipped by default)</span>}
                            </span>
                          </div>
                          {/* Pagination controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Rows {((currentPage-1)*ROWS_PER_PAGE+1).toLocaleString()}–{Math.min(currentPage*ROWS_PER_PAGE, allRows.length).toLocaleString()} of {allRows.length.toLocaleString()}
                            </span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                              <ChevronLeft size={14} />
                            </button>
                            <span style={{ fontSize: '0.8rem', minWidth: '80px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              Page {currentPage} / {totalPages}
                            </span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Data Table */}
                      <div style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        {!activeSheet ? (
                          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sheet selected. Choose a sheet tab above to preview its data.</div>
                        ) : activeSheet.detectedType === 'BILLING' ? (
                           <table className="custom-table" style={{ fontSize: '0.76rem', minWidth: '1000px', borderCollapse: 'collapse' }}>
                             <thead>
                               <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                                 <th style={{ width: '45px', padding: '0.35rem 0.5rem' }}>Row</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Account No</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Customer Name</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>From Date</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>To Date</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Imports</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Exports</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Unit Cost</th>
                                 {/* Dynamic extra columns */}
                                 {activeSheet.headers?.filter(h => !isStandardHeader(h)).map((h, hi) => (
                                   <th key={hi} style={{ padding: '0.35rem 0.5rem' }}>{h}</th>
                                 ))}
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Status</th>
                                 <th style={{ width: '22%', padding: '0.35rem 0.5rem' }}>Validation Notes</th>
                               </tr>
                             </thead>
                             <tbody>
                               {paginatedRows.map((row, i) => {
                                 const key = `${activeSheet.sheetName}|${row.rowNum}`;
                                 const isIgnored = duplicateActions[key] === 'IGNORE';
                                 const isAnyway = duplicateActions[key] === 'IMPORT';

                                 let displayStatus = row.validationStatus;
                                 if (row.validationStatus === 'DUPLICATE') {
                                   displayStatus = isAnyway ? 'FORCE IMPORT' : 'DUPLICATE (SKIPPED)';
                                 } else if (row.validationStatus === 'INVALID' && isIgnored) {
                                   displayStatus = 'EXCLUDED';
                                 }

                                 return (
                                   <tr key={i} style={{ 
                                     opacity: isIgnored ? 0.4 : 1,
                                     backgroundColor: displayStatus === 'INVALID' ? 'rgba(239,68,68,0.04)' 
                                       : row.validationStatus === 'DUPLICATE' ? 'rgba(234,179,8,0.04)' : 'transparent' 
                                   }}>
                                     <td style={{ fontWeight: 600, color: 'var(--text-muted)', padding: '0.35rem 0.5rem' }}>{row.rowNum}</td>
                                     <td style={{ fontWeight: 600, color: 'var(--primary)', padding: '0.35rem 0.5rem' }}>{row.accountNo || '—'}</td>
                                     <td style={{ padding: '0.35rem 0.5rem' }}>{row.customerName || '—'}</td>
                                     <td style={{ color: 'var(--text-secondary)', padding: '0.35rem 0.5rem' }}>{row.fromDate || '—'}</td>
                                     <td style={{ color: 'var(--text-secondary)', padding: '0.35rem 0.5rem' }}>{row.toDate || '—'}</td>
                                     <td style={{ color: '#f59e0b', padding: '0.35rem 0.5rem' }}>{row.imports ?? '—'}</td>
                                     <td style={{ color: 'var(--success)', padding: '0.35rem 0.5rem' }}>{row.exports ?? '—'}</td>
                                     <td style={{ padding: '0.35rem 0.5rem' }}>{row.unitCost ?? '—'}</td>
                                     {/* Render values for dynamic extra columns */}
                                     {activeSheet.headers?.filter(h => !isStandardHeader(h)).map((h, hi) => (
                                       <td key={hi} style={{ color: 'var(--text-secondary)', padding: '0.35rem 0.5rem' }}>{row.rawValues?.[h] ?? '—'}</td>
                                     ))}
                                     <td style={{ padding: '0.35rem 0.5rem' }}>
                                       <span className={`badge ${
                                         displayStatus === 'INVALID' ? 'danger' 
                                           : displayStatus === 'EXCLUDED' ? 'secondary'
                                           : displayStatus === 'FORCE IMPORT' ? 'success'
                                           : row.validationStatus === 'DUPLICATE' ? 'warning' : 'success'
                                       }`} style={{ fontSize: '0.68rem' }}>
                                         {displayStatus}
                                       </span>
                                     </td>
                                     <td style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}>
                                       {row.errors && row.errors.length > 0 && displayStatus !== 'EXCLUDED' ? (
                                         <div style={{ color: 'var(--danger)' }}>
                                           {row.errors.map((err, ei) => <div key={ei}>· {err}</div>)}
                                         </div>
                                       ) : displayStatus === 'EXCLUDED' ? (
                                         <span style={{ color: 'var(--text-muted)' }}>Row excluded from import</span>
                                       ) : (
                                         <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                           <Check size={10} /> OK
                                         </span>
                                       )}
                                     </td>
                                   </tr>
                                 );
                               })}
                               {paginatedRows.length === 0 && (
                                 <tr><td colSpan="30" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No data rows in this sheet.</td></tr>
                               )}
                             </tbody>
                           </table>
                         ) : (
                           /* CUSTOMER PROFILE or UNKNOWN sheet */
                           <table className="custom-table" style={{ fontSize: '0.76rem', minWidth: '800px', borderCollapse: 'collapse' }}>
                             <thead>
                               <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                                 <th style={{ width: '45px', padding: '0.35rem 0.5rem' }}>Row</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Account No</th>
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Customer Name</th>
                                 {/* Dynamic extra columns */}
                                 {activeSheet.headers?.filter(h => !isStandardHeader(h)).map((h, hi) => (
                                   <th key={hi} style={{ padding: '0.35rem 0.5rem' }}>{h}</th>
                                 ))}
                                 <th style={{ padding: '0.35rem 0.5rem' }}>Status</th>
                                 <th style={{ width: '22%', padding: '0.35rem 0.5rem' }}>Validation Notes</th>
                               </tr>
                             </thead>
                             <tbody>
                               {paginatedRows.map((row, i) => {
                                 const key = `${activeSheet.sheetName}|${row.rowNum}`;
                                 const isIgnored = duplicateActions[key] === 'IGNORE';
                                 return (
                                   <tr key={i} style={{ opacity: isIgnored ? 0.4 : 1 }}>
                                     <td style={{ fontWeight: 600, color: 'var(--text-muted)', padding: '0.35rem 0.5rem' }}>{row.rowNum}</td>
                                     <td style={{ fontWeight: 600, color: 'var(--primary)', padding: '0.35rem 0.5rem' }}>{row.accountNo || '—'}</td>
                                     <td style={{ padding: '0.35rem 0.5rem' }}>{row.customerName || '—'}</td>
                                     {activeSheet.headers?.filter(h => !isStandardHeader(h)).map((h, hi) => (
                                       <td key={hi} style={{ color: 'var(--text-secondary)', padding: '0.35rem 0.5rem' }}>{row.rawValues?.[h] ?? '—'}</td>
                                     ))}
                                     <td style={{ padding: '0.35rem 0.5rem' }}>
                                       <span className={`badge ${isIgnored ? 'secondary' : row.validationStatus === 'INVALID' ? 'danger' : 'success'}`} style={{ fontSize: '0.68rem' }}>
                                         {isIgnored ? 'EXCLUDED' : row.validationStatus}
                                       </span>
                                     </td>
                                     <td style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}>
                                       {row.errors && row.errors.length > 0 && !isIgnored ? (
                                         <div style={{ color: 'var(--danger)' }}>
                                           {row.errors.map((err, ei) => <div key={ei}>· {err}</div>)}
                                         </div>
                                       ) : (
                                         <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                           <Check size={10} /> OK
                                         </span>
                                       )}
                                     </td>
                                   </tr>
                                 );
                               })}
                               {paginatedRows.length === 0 && (
                                 <tr><td colSpan="30" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No data rows in this sheet.</td></tr>
                               )}
                             </tbody>
                           </table>
                         )}
                      </div>

                      {/* Bottom pagination */}
                      {activeSheet && totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => goToPage(1)} disabled={currentPage <= 1}>
                            « First
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                            <ChevronLeft size={14} /> Prev
                          </button>
                          <span style={{ fontSize: '0.8rem', minWidth: '80px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Page {currentPage} / {totalPages}
                          </span>
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                            Next <ChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: DATA VALIDATION ERRORS PANEL */}
                  {previewTab === 'errors' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {errorsBySheet.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <CheckCircle size={32} />
                          <h4 style={{ fontWeight: 600, margin: 0 }}>All Errors Resolved!</h4>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Zero unresolved formatting or structure errors remaining. All rows are ready to stage.</p>
                        </div>
                      ) : (
                        errorsBySheet.map(({ sheetName, detectedType, rows }) => (
                          <div key={sheetName} className="card" style={{ padding: '1.25rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <AlertTriangle size={15} color="var(--danger)" />
                                Sheet: {sheetName} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({rows.length} error row{rows.length !== 1 ? 's' : ''})</span>
                              </span>
                              <span className="badge danger" style={{ fontSize: '0.65rem' }}>{typeLabel(detectedType)}</span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                              <table className="custom-table" style={{ fontSize: '0.8rem', minWidth: '950px' }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: '50px' }}>Row</th>
                                    <th>Account No</th>
                                    <th>Customer Name</th>
                                    {detectedType === 'BILLING' ? (
                                      <>
                                        <th>From Date</th>
                                        <th>To Date</th>
                                        <th>Imports</th>
                                        <th>Exports</th>
                                        <th>Unit Cost</th>
                                      </>
                                    ) : (
                                      <>
                                        <th>Address</th>
                                        <th>Mobile No</th>
                                        <th>Solar Type</th>
                                        <th>Bank Code</th>
                                      </>
                                    )}
                                    <th style={{ width: '22%' }}>Validation Errors</th>
                                    <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row) => {
                                    const rowKey = `${sheetName}|${row.rowNum}`;
                                    const isEditing = editingRowKey === rowKey;

                                    if (isEditing) {
                                      return (
                                        <tr key={row.rowNum} style={{ backgroundColor: 'rgba(59,130,246,0.04)' }}>
                                          <td colSpan={detectedType === 'BILLING' ? 10 : 9} style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Correcting Row {row.rowNum} Data</span>
                                                {Object.keys(editErrors).length > 0 && <span style={{ color: 'var(--danger)' }}>({Object.keys(editErrors).length} validation error(s))</span>}
                                              </div>
                                              
                                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Account No</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderColor: editErrors.accountNo ? 'var(--danger)' : 'var(--border-color)' }}
                                                    value={editRowState.accountNo}
                                                    onChange={e => handleEditChange('accountNo', e.target.value)}
                                                  />
                                                  {editErrors.accountNo && <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{editErrors.accountNo}</span>}
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Name</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderColor: editErrors.customerName ? 'var(--danger)' : 'var(--border-color)' }}
                                                    value={editRowState.customerName}
                                                    onChange={e => handleEditChange('customerName', e.target.value)}
                                                  />
                                                  {editErrors.customerName && <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{editErrors.customerName}</span>}
                                                </div>

                                                {detectedType === 'BILLING' && (
                                                  <>
                                                    <div>
                                                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>From Date</label>
                                                      <input
                                                        type="text"
                                                        placeholder="YYYY-MM-DD"
                                                        className="form-control"
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderColor: editErrors.fromDate ? 'var(--danger)' : 'var(--border-color)' }}
                                                        value={editRowState.fromDate}
                                                        onChange={e => handleEditChange('fromDate', e.target.value)}
                                                      />
                                                      {editErrors.fromDate && <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{editErrors.fromDate}</span>}
                                                    </div>

                                                    <div>
                                                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>To Date</label>
                                                      <input
                                                        type="text"
                                                        placeholder="YYYY-MM-DD"
                                                        className="form-control"
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderColor: editErrors.toDate ? 'var(--danger)' : 'var(--border-color)' }}
                                                        value={editRowState.toDate}
                                                        onChange={e => handleEditChange('toDate', e.target.value)}
                                                      />
                                                      {editErrors.toDate && <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{editErrors.toDate}</span>}
                                                    </div>

                                                    <div>
                                                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Imports (KWh)</label>
                                                      <input
                                                        type="text"
                                                        className="form-control"
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderColor: editErrors.imports ? 'var(--danger)' : 'var(--border-color)' }}
                                                        value={editRowState.imports}
                                                        onChange={e => handleEditChange('imports', e.target.value)}
                                                      />
                                                      {editErrors.imports && <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{editErrors.imports}</span>}
                                                    </div>

                                                    <div>
                                                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Exports (KWh)</label>
                                                      <input
                                                        type="text"
                                                        className="form-control"
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderColor: editErrors.exports ? 'var(--danger)' : 'var(--border-color)' }}
                                                        value={editRowState.exports}
                                                        onChange={e => handleEditChange('exports', e.target.value)}
                                                      />
                                                      {editErrors.exports && <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{editErrors.exports}</span>}
                                                    </div>

                                                    <div>
                                                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Unit Cost</label>
                                                      <input
                                                        type="text"
                                                        className="form-control"
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderColor: editErrors.unitCost ? 'var(--danger)' : 'var(--border-color)' }}
                                                        value={editRowState.unitCost}
                                                        onChange={e => handleEditChange('unitCost', e.target.value)}
                                                      />
                                                      {editErrors.unitCost && <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>{editErrors.unitCost}</span>}
                                                    </div>
                                                  </>
                                                )}

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Address</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.customerAddress}
                                                    onChange={e => handleEditChange('customerAddress', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Mobile No</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.mobileNo}
                                                    onChange={e => handleEditChange('mobileNo', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Billing Mode (Exp Code)</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.billingMode}
                                                    onChange={e => handleEditChange('billingMode', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Agreement Date</label>
                                                  <input
                                                    type="text"
                                                    placeholder="YYYY-MM-DD"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.agreementDate}
                                                    onChange={e => handleEditChange('agreementDate', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Panel Capacity (KW)</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.panelCapacity}
                                                    onChange={e => handleEditChange('panelCapacity', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Solar Type</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.solarType}
                                                    onChange={e => handleEditChange('solarType', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Bank Code</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.bankCode}
                                                    onChange={e => handleEditChange('bankCode', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Branch Code</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.branchCode}
                                                    onChange={e => handleEditChange('branchCode', e.target.value)}
                                                  />
                                                </div>

                                                <div>
                                                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Bank Account No</label>
                                                  <input
                                                    type="text"
                                                    className="form-control"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                                                    value={editRowState.bankAccountNo}
                                                    onChange={e => handleEditChange('bankAccountNo', e.target.value)}
                                                  />
                                                </div>
                                              </div>
                                              
                                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                                <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 1rem', fontSize: '0.78rem' }} onClick={cancelEditRow}>
                                                  Cancel
                                                </button>
                                                <button type="button" className="btn" style={{ padding: '0.35rem 1.25rem', fontSize: '0.78rem', backgroundColor: 'var(--success)', color: 'white' }} onClick={() => saveEditedRow(row.rowNum, sheetName)}>
                                                  Save Correction
                                                </button>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    }

                                    return (
                                      <tr key={row.rowNum} style={{ backgroundColor: 'rgba(239,68,68,0.02)' }}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{row.rowNum}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{row.accountNo || '—'}</td>
                                        <td>{row.customerName || '—'}</td>
                                        {detectedType === 'BILLING' ? (
                                          <>
                                            <td>{row.fromDate || '—'}</td>
                                            <td>{row.toDate || '—'}</td>
                                            <td style={{ color: '#f59e0b' }}>{row.imports ?? '—'}</td>
                                            <td style={{ color: 'var(--success)' }}>{row.exports ?? '—'}</td>
                                            <td>{row.unitCost ?? '—'}</td>
                                          </>
                                        ) : (
                                          <>
                                            <td>{row.customerAddress || '—'}</td>
                                            <td>{row.mobileNo || '—'}</td>
                                            <td>{row.solarType || '—'}</td>
                                            <td>{row.bankCode || '—'}</td>
                                          </>
                                        )}
                                        <td style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                                          {row.errors?.map((err, ei) => <div key={ei}>· {err}</div>)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                            <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }} onClick={() => startEditRow(row, sheetName)}>
                                              Edit Row
                                            </button>
                                            <button type="button" className="btn btn-logout" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: 'auto', border: '1px solid var(--border-color)' }} onClick={() => setDuplicateActions(prev => ({ ...prev, [rowKey]: 'IGNORE' }))}>
                                              Exclude
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: DUPLICATE RECORDS PANEL */}
                  {previewTab === 'duplicates' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {duplicatesBySheet.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <CheckCircle size={32} />
                          <h4 style={{ fontWeight: 600, margin: 0 }}>Zero Duplicates Found!</h4>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>No conflicting duplicate billing periods detected. Clean data merge is ready.</p>
                        </div>
                      ) : (
                        duplicatesBySheet.map(({ sheetName, detectedType, rows }) => (
                          <div key={sheetName} className="card" style={{ padding: '1.25rem', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <AlertTriangle size={15} color="#f59e0b" />
                                Sheet: {sheetName} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({rows.length} duplicate row{rows.length !== 1 ? 's' : ''})</span>
                              </span>
                              <span className="badge warning" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{typeLabel(detectedType)}</span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                              <table className="custom-table" style={{ fontSize: '0.8rem', minWidth: '950px' }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: '50px' }}>Row</th>
                                    <th>Account No</th>
                                    <th>Customer Name</th>
                                    <th>Billing Period</th>
                                    <th>Imports</th>
                                    <th>Exports</th>
                                    <th>Duplicate Check Message</th>
                                    <th style={{ width: '130px', textAlign: 'center' }}>Import Decision</th>
                                    <th style={{ width: '300px', textAlign: 'center' }}>Conflict Resolution</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row) => {
                                    const rowKey = `${sheetName}|${row.rowNum}`;
                                    const action = duplicateActions[rowKey] || 'IGNORE';

                                    return (
                                      <tr key={row.rowNum} style={{ backgroundColor: action === 'IMPORT' ? 'rgba(16,185,129,0.02)' : 'rgba(245,158,11,0.02)', opacity: action === 'IGNORE' ? 0.75 : 1 }}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{row.rowNum}</td>
                                        <td style={{ fontWeight: 600 }}>{row.accountNo || '—'}</td>
                                        <td>{row.customerName || '—'}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{row.fromDate && row.toDate ? `${row.fromDate} to ${row.toDate}` : '—'}</td>
                                        <td style={{ color: '#f59e0b' }}>{row.imports ?? '—'}</td>
                                        <td style={{ color: 'var(--success)' }}>{row.exports ?? '—'}</td>
                                        <td style={{ color: '#eab308', fontSize: '0.75rem' }}>
                                          {row.errors?.map((err, ei) => <div key={ei}>· {err}</div>)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                          <span className={`badge ${action === 'IMPORT' ? 'success' : 'danger'}`} style={{ fontSize: '0.7rem' }}>
                                            {action === 'IMPORT' ? 'FORCE IMPORT' : 'IGNORE / EXCLUDE'}
                                          </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                            <button 
                                              type="button" 
                                              className="btn btn-secondary" 
                                              style={{ 
                                                padding: '0.25rem 0.5rem', 
                                                fontSize: '0.72rem',
                                                border: '1px solid var(--border-color)'
                                              }} 
                                              onClick={() => setCompareTarget({ ...row, sheetName })}
                                            >
                                              Compare Data
                                            </button>
                                            <button 
                                              type="button" 
                                              className="btn btn-secondary" 
                                              style={{ 
                                                padding: '0.25rem 0.5rem', 
                                                fontSize: '0.72rem',
                                                backgroundColor: action === 'IMPORT' ? 'var(--success)' : 'transparent',
                                                color: action === 'IMPORT' ? 'white' : 'var(--text-secondary)'
                                              }} 
                                              onClick={() => setDuplicateActions(prev => ({ ...prev, [rowKey]: 'IMPORT' }))}
                                            >
                                              Import anyway
                                            </button>
                                            <button 
                                              type="button" 
                                              className="btn btn-logout" 
                                              style={{ 
                                                padding: '0.25rem 0.5rem', 
                                                fontSize: '0.72rem', 
                                                width: 'auto',
                                                backgroundColor: action === 'IGNORE' ? 'var(--danger)' : 'transparent',
                                                color: action === 'IGNORE' ? 'white' : 'var(--text-secondary)',
                                                border: '1px solid var(--border-color)'
                                              }} 
                                              onClick={() => setDuplicateActions(prev => ({ ...prev, [rowKey]: 'IGNORE' }))}
                                            >
                                              Ignore / Exclude
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Step 4 Warnings bar */}
                  {totalErrors > 0 && (
                    <div style={{ padding: '0.85rem 1.25rem', border: '1px solid var(--danger)', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.82rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={15} />
                      <span><strong>Notice:</strong> You have {totalErrors} unresolved row errors. Uncorrected errors will be excluded during database migration step.</span>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setWizardStep(3)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <ChevronLeft size={14} /> Back to Validation
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {selectedCount === 0 && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <AlertCircle size={14} /> Select at least 1 sheet to proceed
                        </span>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={() => setWizardStep(5)}
                        disabled={selectedCount === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <span>Proceed to Import Authorization</span>
                        <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.75rem', fontWeight: 700 }}>{selectedCount} sheet{selectedCount !== 1 ? 's' : ''}</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* STEP 5: APPROVE & IMPORT */}
            {wizardStep === 5 && (
              <div className="animate-fade-in" style={{ textAlign: 'center', padding: '1rem 0' }}>
                {batchData?.status === 'APPROVED' ? (
                  <>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                      <CheckCircle size={36} color="var(--success)" />
                    </div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--success)' }}>
                      Import Successfully Completed!
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                      Spreadsheet file <strong style={{ color: 'white' }}>{batchData?.filename}</strong> has been authorized, validated, staged, and pushed to the live customer profiles ledger and billing records tables.
                    </p>
                    <button className="btn btn-primary" onClick={resetWizard}>
                      Import Another Document
                    </button>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={48} className="text-primary" style={{ margin: '0 auto 1.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Step 5: Admin Authorization</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '550px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
                      You are approving import batch ID <strong style={{ color: 'var(--primary)' }}>#{batchData?.batchId}</strong> ({batchData?.filename}).
                      This action will copy all valid rows into staging, calculate ledger rates, and merge customer parameters directly into production records.
                    </p>

                    {batchData?.preview?.errorCount > 0 && (
                      <div style={{ padding: '1rem', border: '1px solid var(--danger)', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '8px', color: 'var(--danger)', maxWidth: '550px', margin: '0 auto 2rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}>
                        <AlertTriangle size={18} />
                        <span>
                          <strong>Warning:</strong> This file contains {batchData?.preview?.errorCount} row-level data formatting errors. These rows will be skipped during ledger push.
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-logout" 
                        style={{ width: 'auto', padding: '0.75rem 1.5rem' }}
                        onClick={handleRejectBatch}
                        disabled={uploading}
                      >
                        Reject &amp; Discard Batch
                      </button>

                      {user?.role === 'ADMIN' ? (
                        <button 
                          className="btn btn-primary" 
                          style={{ minWidth: '180px', backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
                          onClick={handleApproveBatch}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <>
                              <Loader className="animate-spin" size={15} />
                              <span>Migrating Database...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle size={15} />
                              <span>Approve &amp; Commit Live</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                          <AlertCircle size={15} />
                          <span>Approval Restricted. Officer role can validate, but Admin credentials required to commit.</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </>
      ) : (
        /* TEMPLATE CONFIGURATIONS VIEW (ADMIN ONLY) */
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
          
          {/* Sheets List Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Layers size={15} className="text-primary" />
              Template Sheets
            </h3>

            {templatesLoading ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading configs...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedTemplate?.sheets?.map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: selectedSheetConfig?.id === sheet.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      border: selectedSheetConfig?.id === sheet.id ? '1px solid var(--primary)' : '1px solid transparent',
                      color: sheet.isDeleted ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      textDecoration: sheet.isDeleted ? 'line-through' : 'none'
                    }}
                    onClick={() => setSelectedSheetConfig(sheet)}
                  >
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{sheet.sheetName}</span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {sheet.isIgnored && <span className="badge warning" style={{ padding: '0.1rem 0.35rem', fontSize: '0.62rem' }}>Ignored</span>}
                      {sheet.isRequired && !sheet.isIgnored && <span className="badge danger" style={{ padding: '0.1rem 0.35rem', fontSize: '0.62rem' }}>Req</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sheet Mapping Detail View Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            {selectedSheetConfig ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Sheet: {selectedSheetConfig.sheetName}
                      {selectedSheetConfig.isDeleted && <span className="badge danger">Soft Deleted</span>}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                      Configure parsing properties and mapping details for this worksheet.
                    </p>
                  </div>
                  
                  {/* Actions buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className={`btn ${selectedSheetConfig.isIgnored ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
                      onClick={() => handleToggleIgnoreSheet(selectedSheetConfig.id)}
                      disabled={selectedSheetConfig.isDeleted}
                    >
                      {selectedSheetConfig.isIgnored ? 'Activate Sheet' : 'Ignore Sheet'}
                    </button>

                    {selectedSheetConfig.isDeleted ? (
                      <button 
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', backgroundColor: 'var(--success)' }}
                        onClick={() => handleRestoreSheet(selectedSheetConfig.id)}
                      >
                        Restore Sheet
                      </button>
                    ) : (
                      <button 
                        className="btn btn-logout"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', width: 'auto' }}
                        onClick={() => handleSoftDeleteSheet(selectedSheetConfig.id)}
                      >
                        Soft Delete Sheet
                      </button>
                    )}
                  </div>
                </div>

                {/* Header Columns details table */}
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Column Mapping Registry</h4>
                <div className="table-container">
                  <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Expected Header Column Name</th>
                        <th>Required</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSheetConfig.headers?.map((header) => (
                        <tr key={header.id} style={{ opacity: header.isDeleted ? 0.5 : 1 }}>
                          <td style={{ fontWeight: 600, textDecoration: header.isDeleted ? 'line-through' : 'none' }}>
                            {header.headerName}
                          </td>
                          <td>
                            <span className={`badge ${header.isRequired ? 'danger' : 'info'}`}>
                              {header.isRequired ? 'Mandatory' : 'Optional'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${header.isDeleted ? 'danger' : 'success'}`}>
                              {header.isDeleted ? 'Soft Deleted' : 'Active'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {header.isDeleted ? (
                              <button 
                                className="btn"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', backgroundColor: 'var(--success)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                onClick={() => handleRestoreHeader(header.id)}
                              >
                                Restore
                              </button>
                            ) : (
                              <button 
                                className="btn-logout"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', width: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                                onClick={() => handleSoftDeleteHeader(header.id)}
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Select a sheet configuration from the list to manage maps.
              </div>
            )}
          </div>

        </div>
      )}

      {/* WORKBOOK IMPORT REGISTRY HISTORY LOG */}
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
            <table className="custom-table" style={{ opacity: 0.8 }}>
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
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td><div className="skeleton" style={{ height: '16px', width: '120px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '200px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '100px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '4px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '16px', width: '50px' }}></div></td>
                    <td><div className="skeleton" style={{ height: '28px', width: '70px', borderRadius: '4px', margin: '0 auto' }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
