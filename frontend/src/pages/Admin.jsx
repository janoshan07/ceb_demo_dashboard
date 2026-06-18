import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  Users, 
  ListTodo, 
  UserPlus, 
  Trash2, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

const Admin = () => {
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState('approvals'); // approvals, users, or logs

  // Users Management State
  const [usersList, setUsersList] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  
  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState('USER');
  const [userError, setUserError] = useState(null);
  const [userSuccess, setUserSuccess] = useState(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);

  // Approvals State
  const [approvalsList, setApprovalsList] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalsError, setApprovalsError] = useState(null);

  // Custom Dialog Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning', // danger, success, warning, info
    onConfirm: null,
    isAlertOnly: false
  });

  const fetchUsers = async () => {
    try {
      setUserLoading(true);
      const res = await authFetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const res = await authFetch('/api/admin/audit-logs');
      if (!res.ok) {
        throw new Error('Failed to retrieve system audit logs.');
      }
      const data = await res.json();
      setAuditLogs(data);
    } catch (err) {
      setLogsError(err.message || 'Error occurred while fetching audit logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchApprovals = async () => {
    try {
      setApprovalsLoading(true);
      setApprovalsError(null);
      const res = await authFetch('/api/admin/approvals');
      if (!res.ok) {
        throw new Error('Failed to load pending approvals.');
      }
      const data = await res.json();
      setApprovalsList(data);
    } catch (err) {
      setApprovalsError(err.message || 'Error occurred while loading approvals.');
    } finally {
      setApprovalsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      if (activeTab === 'users') {
        fetchUsers();
      } else if (activeTab === 'logs') {
        fetchLogs();
      } else if (activeTab === 'approvals') {
        fetchApprovals();
      }
    }
  }, [activeTab]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    if (!newUsername.trim() || !newPassword.trim() || !newRole) {
      setUserError('All fields are required.');
      return;
    }

    try {
      const res = await authFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          role: newRole
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create user.');
      }

      setUserSuccess(`Account for ${newUsername} has been registered.`);
      setNewUsername('');
      setNewPassword('');
      setNewRole('USER');
      fetchUsers();
    } catch (err) {
      setUserError(err.message || 'Failed to register account.');
    }
  };

  const executeDeleteUser = async (userId) => {
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user.');
      }

      setUserSuccess('User account removed.');
      fetchUsers();
    } catch (err) {
      setUserError(err.message || 'Failed to delete user.');
    }
  };

  const handleDeleteUser = (userId, usernameToDelete) => {
    if (usernameToDelete === user?.username) {
      setConfirmModal({
        isOpen: true,
        title: 'Security Violation',
        message: 'You cannot delete your currently logged-in account.',
        type: 'danger',
        isAlertOnly: true,
        onConfirm: null
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete User Account',
      message: `Are you sure you want to permanently delete user "${usernameToDelete}"? This action cannot be undone.`,
      type: 'danger',
      isAlertOnly: false,
      onConfirm: () => executeDeleteUser(userId)
    });
  };

  const executeApprove = async (requestId) => {
    setUserError(null);
    setUserSuccess(null);
    try {
      const res = await authFetch(`/api/admin/approvals/${requestId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve request.');
      }
      setUserSuccess('Approval successfully applied to database.');
      fetchApprovals();
    } catch (err) {
      setUserError(err.message || 'Approval operation failed.');
    }
  };

  const handleApprove = (requestId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Modification Request',
      message: 'Are you sure you want to approve this request and apply edits to the live database?',
      type: 'success',
      isAlertOnly: false,
      onConfirm: () => executeApprove(requestId)
    });
  };

  const executeReject = async (requestId) => {
    setUserError(null);
    setUserSuccess(null);
    try {
      const res = await authFetch(`/api/admin/approvals/${requestId}/reject`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reject request.');
      }
      setUserSuccess('Changes successfully rejected and discarded.');
      fetchApprovals();
    } catch (err) {
      setUserError(err.message || 'Rejection operation failed.');
    }
  };

  const handleReject = (requestId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Modification Request',
      message: 'Are you sure you want to reject and discard these changes?',
      type: 'warning',
      isAlertOnly: false,
      onConfirm: () => executeReject(requestId)
    });
  };

  const renderCompareValues = (oldJson, newJson) => {
    try {
      const oldVals = JSON.parse(oldJson);
      const newVals = JSON.parse(newJson);
      const keys = Object.keys(newVals);
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem', marginBottom: '0.35rem' }}>
            <span>Field Attribute</span>
            <span>Current Value</span>
            <span>Proposed Value</span>
          </div>
          {keys.map((key) => {
            const oldVal = oldVals[key];
            const newVal = newVals[key];
            
            // Format labels for key
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            
            if (String(oldVal) !== String(newVal)) {
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', fontSize: '0.85rem', padding: '0.25rem 0' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formattedKey}</span>
                  <span style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>
                    {oldVal === null || oldVal === '' ? '—' : String(oldVal)}
                  </span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                    {newVal === null || newVal === '' ? '—' : String(newVal)}
                  </span>
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    } catch (e) {
      return <span style={{ color: 'var(--danger)' }}>Error loading comparison values.</span>;
    }
  };

  // Guard access on Client-side
  if (user?.role !== 'ADMIN') {
    return (
      <div className="page-wrapper animate-fade-in">
        <button onClick={() => navigate('/')} className="back-btn">
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div style={{ padding: '3rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center' }}>
          <ShieldAlert size={64} className="text-danger" style={{ margin: '0 auto 1.5rem', color: 'var(--danger)' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)' }}>You do not have administrative permissions to view this control board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in">
      <button onClick={() => navigate('/')} className="back-btn">
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Management Panel</h1>
          <p className="page-subtitle">Configure system users, assign role-based access control, and manage billing change requests.</p>
        </div>
      </div>

      {userError && (
        <div className="login-error" style={{ marginBottom: '1.5rem' }}>
          {userError}
        </div>
      )}
      
      {userSuccess && (
        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', borderLeft: '3px solid var(--success)', fontSize: '0.85rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{userSuccess}</span>
        </div>
      )}

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button 
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'transparent', 
            border: 'none', 
            borderBottom: activeTab === 'approvals' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'approvals' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onClick={() => {
            setActiveTab('approvals');
            setUserError(null);
            setUserSuccess(null);
          }}
        >
          <FileCheck2 size={16} />
          Approval Center
        </button>
        
        <button 
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'transparent', 
            border: 'none', 
            borderBottom: activeTab === 'users' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'users' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onClick={() => {
            setActiveTab('users');
            setUserError(null);
            setUserSuccess(null);
          }}
        >
          <Users size={16} />
          User Management
        </button>
        
        <button 
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'transparent', 
            border: 'none', 
            borderBottom: activeTab === 'logs' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'logs' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onClick={() => {
            setActiveTab('logs');
            setUserError(null);
            setUserSuccess(null);
          }}
        >
          <ListTodo size={16} />
          Security Audit Logs
        </button>
      </div>

      {/* Approvals Center Tab */}
      {activeTab === 'approvals' && (
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title">Pending System Modifications</h2>
          </div>

          <div className="table-container">
            {approvalsLoading ? (
              <div style={{ padding: '2.5rem', textAlignment: 'center', color: 'var(--text-secondary)' }}>Loading pending approvals...</div>
            ) : approvalsError ? (
              <div style={{ padding: '2.5rem', textAlignment: 'center', color: 'var(--danger)' }}>{approvalsError}</div>
            ) : approvalsList.length === 0 ? (
              <div style={{ padding: '2.5rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>
                No pending approval requests. System data is currently synchronized.
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Requested Time</th>
                    <th>Requested By</th>
                    <th>Modification Type</th>
                    <th>Target account</th>
                    <th>Details Comparison</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalsList.map((req) => (
                    <tr key={req.requestId} style={{ verticalAlign: 'top' }}>
                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {new Date(req.createdAt).toLocaleString('en-LK')}
                      </td>
                      <td style={{ fontWeight: 600 }}>{req.changedBy}</td>
                      <td>
                        <span className={`badge ${req.billingId === null ? 'info' : 'warning'}`}>
                          {req.billingId === null ? 'Customer Profile' : 'Billing Record'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {req.accountNo}
                      </td>
                      <td style={{ width: '40%' }}>
                        {renderCompareValues(req.oldValues, req.newValues)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem', backgroundColor: 'var(--success)' }}
                            onClick={() => handleApprove(req.requestId)}
                          >
                            <ThumbsUp size={12} />
                            Approve
                          </button>
                          <button 
                            className="btn btn-logout"
                            style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem', width: 'auto' }}
                            onClick={() => handleReject(req.requestId)}
                          >
                            <ThumbsDown size={12} />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Users Management Tab */}
      {activeTab === 'users' && (
        <div className="dashboard-grid">
          {/* User List */}
          <div className="card">
            <div className="panel-header">
              <h2 className="panel-title">System User Directory</h2>
            </div>
            
            <div className="table-container">
              {userLoading ? (
                <div style={{ padding: '2rem', textAlignment: 'center', color: 'var(--text-secondary)' }}>Loading users...</div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>System Role</th>
                      <th>Registered</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.username}</td>
                        <td>
                          <span className={`badge ${
                            u.role === 'ADMIN' ? 'danger' : 
                            u.role === 'OFFICER' ? 'info' : 'success'
                          }`}>
                            {u.role.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {new Date(u.createdAt).toLocaleDateString('en-LK')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn-logout"
                            style={{ display: 'inline-flex', width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            disabled={u.username === user?.username}
                          >
                            <Trash2 size={12} />
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

          {/* Create User Form */}
          <div className="card">
            <div className="panel-header">
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} className="text-primary" />
                Add System User
              </h2>
            </div>

            <form onSubmit={handleAddUser} className="login-form">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  type="text" 
                  className="login-form-input" 
                  placeholder="Enter username (or account no for Customers)" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-group">
                  <Lock className="input-icon" size={18} />
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Enter password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ paddingRight: '2.75rem' }}
                    required 
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assign Role</label>
                <select 
                  className="login-form-input" 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ appearance: 'auto' }}
                >
                  <option value="USER">Customer (Self Service Portal)</option>
                  <option value="OFFICER">Billing Officer (Upload & View)</option>
                  <option value="ADMIN">Administrator (Full Access)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Security Audit Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} className="text-primary" />
              Traceability Trail
            </h2>
          </div>

          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {logsLoading ? (
              <div style={{ padding: '3rem 0', textAlignment: 'center', color: 'var(--text-secondary)' }}>Loading audit logs...</div>
            ) : auditLogs.length === 0 ? (
              <div style={{ padding: '3rem 0', textAlignment: 'center', color: 'var(--text-muted)' }}>No audit logs found.</div>
            ) : (
              <div className="timeline" style={{ padding: '1rem' }}>
                {auditLogs.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className={`timeline-dot ${
                      log.action.includes('FAILED') || log.action.includes('DELETE') || log.action.includes('REJECT') ? 'danger' :
                      log.action.includes('UPDATE') || log.action.includes('REQUEST') ? 'warning' : 'success'
                    }`}></div>
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          {log.action.replaceAll('_', ' ')}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleString('en-LK')}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        Performed by: <strong style={{ color: 'var(--primary)' }}>{log.performedBy}</strong>
                      </div>
                      <p className="timeline-desc" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        {log.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem',
                borderRadius: '50%',
                backgroundColor: 
                  confirmModal.type === 'danger' ? 'rgba(239, 68, 68, 0.15)' :
                  confirmModal.type === 'success' ? 'rgba(16, 185, 129, 0.15)' :
                  confirmModal.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' :
                  'rgba(59, 130, 246, 0.15)',
                color: 
                  confirmModal.type === 'danger' ? 'var(--danger)' :
                  confirmModal.type === 'success' ? 'var(--success)' :
                  confirmModal.type === 'warning' ? 'var(--warning)' :
                  'var(--primary)'
              }}>
                {confirmModal.type === 'danger' && <ShieldAlert size={28} />}
                {confirmModal.type === 'success' && <CheckCircle2 size={28} />}
                {confirmModal.type === 'warning' && <AlertCircle size={28} />}
                {confirmModal.type === 'info' && <AlertCircle size={28} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  fontFamily: 'var(--font-family)'
                }}>{confirmModal.title}</h3>
                <p style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  fontFamily: 'var(--font-family)'
                }}>{confirmModal.message}</p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              marginTop: '0.5rem'
            }}>
              {!confirmModal.isAlertOnly && (
                <button
                  className="btn-logout"
                  style={{
                    margin: 0,
                    width: 'auto',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.9rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
              )}
              <button
                className="btn btn-primary"
                style={{
                  margin: 0,
                  width: 'auto',
                  padding: '0.6rem 1.5rem',
                  fontSize: '0.9rem',
                  backgroundColor: 
                    confirmModal.type === 'danger' ? 'var(--danger)' :
                    confirmModal.type === 'success' ? 'var(--success)' :
                    confirmModal.type === 'warning' ? 'var(--warning)' :
                    'var(--primary)'
                }}
                onClick={() => {
                  if (confirmModal.onConfirm) {
                    confirmModal.onConfirm();
                  }
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
              >
                {confirmModal.isAlertOnly ? 'OK' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
