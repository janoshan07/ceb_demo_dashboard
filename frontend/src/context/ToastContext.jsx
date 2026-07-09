import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, AlertOctagon } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'warning', // 'info', 'warning', 'danger'
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        }
      });
    });
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'success': 
        return <CheckCircle size={18} style={{ color: 'var(--success)' }} />;
      case 'error': 
        return <AlertCircle size={18} style={{ color: 'var(--danger)' }} />;
      case 'warning': 
        return <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />;
      case 'info':
      default: 
        return <Info size={18} style={{ color: 'var(--primary)' }} />;
    }
  };

  const getConfirmIcon = (type) => {
    switch (type) {
      case 'danger':
        return <AlertOctagon size={48} style={{ color: 'var(--danger)' }} />;
      case 'info':
        return <Info size={48} style={{ color: 'var(--primary)' }} />;
      case 'warning':
      default:
        return <AlertTriangle size={48} style={{ color: 'var(--warning)' }} />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type} animate-slide-in`}>
            <div className="toast-icon-box">{getIcon(toast.type)}</div>
            <div className="toast-message">{toast.message}</div>
            <button className="toast-close-btn" onClick={() => removeToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Modern Confirm Modal Overlay */}
      {confirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 16, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1.5rem',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.05)',
            transform: 'scale(0.95)',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: confirmDialog.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : confirmDialog.type === 'info' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              boxShadow: confirmDialog.type === 'danger' ? '0 0 20px rgba(239, 68, 68, 0.15)' : confirmDialog.type === 'info' ? '0 0 20px rgba(59, 130, 246, 0.15)' : '0 0 20px rgba(245, 158, 11, 0.15)'
            }}>
              {getConfirmIcon(confirmDialog.type)}
            </div>

            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.75rem',
              fontFamily: 'var(--font-family)'
            }}>{confirmDialog.title}</h3>

            <p style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              marginBottom: '2rem',
              whiteSpace: 'pre-line'
            }}>{confirmDialog.message}</p>

            <div style={{
              display: 'flex',
              gap: '1rem',
              width: '100%'
            }}>
              <button 
                onClick={confirmDialog.onCancel}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.target.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = 'var(--text-secondary)';
                }}
              >
                {confirmDialog.cancelText}
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: confirmDialog.type === 'danger' ? 'var(--danger)' : confirmDialog.type === 'info' ? 'var(--primary)' : 'var(--warning)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: confirmDialog.type === 'danger' ? '0 4px 14px var(--danger-glow)' : confirmDialog.type === 'info' ? '0 4px 14px var(--primary-glow)' : '0 4px 14px var(--warning-glow)',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.opacity = '0.9';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '1';
                  e.target.style.transform = 'none';
                }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
