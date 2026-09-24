import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  AlertOctagon, 
  HelpCircle,
  Sparkles,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

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
  const [modalDialog, setModalDialog] = useState(null);
  const [promptInput, setPromptInput] = useState('');
  const [promptError, setPromptError] = useState('');
  const inputRef = useRef(null);

  // Focus prompt input when opened
  useEffect(() => {
    if (modalDialog?.isPrompt) {
      setPromptInput(modalDialog.defaultValue || '');
      setPromptError('');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [modalDialog]);

  // Keyboard accessibility (Escape to close, Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!modalDialog) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleModalCancel();
      } else if (e.key === 'Enter' && (!modalDialog.isPrompt || !e.shiftKey)) {
        e.preventDefault();
        handleModalConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalDialog, promptInput]);

  // ── Toast Notification Dispatcher ──────────────────────────────────────
  const showToast = useCallback((message, type = 'success', duration = null, title = null) => {
    let tMessage = '';
    let tType = 'success';
    let tTitle = null;
    let tDuration = null;

    if (typeof message === 'object' && message !== null) {
      tMessage = message.message || '';
      tType = message.type || type || 'success';
      tTitle = message.title || null;
      tDuration = message.duration || duration || null;
    } else {
      tMessage = String(message || '');
      tType = type || 'success';
      tTitle = title;
      tDuration = duration;
    }

    if (!tDuration) {
      if (tType === 'error' || tType === 'danger') tDuration = 6500;
      else if (tType === 'warning') tDuration = 5200;
      else tDuration = 4200;
    }

    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-4), { id, message: tMessage, type: tType, duration: tDuration, title: tTitle }]);
    
    setTimeout(() => {
      removeToast(id);
    }, tDuration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Modern Confirmation Modal Dispatcher ───────────────────────────────
  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setModalDialog({
        title: options.title || 'Confirmation Required',
        message: options.message || 'Are you sure you want to proceed with this operation?',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'warning', // 'warning', 'danger', 'info', 'success', 'confirm'
        details: options.details || null,
        isPrompt: false,
        isAlert: false,
        resolve
      });
    });
  }, []);

  // ── Modern Alert Modal Dispatcher (Single Action) ──────────────────────
  const showAlert = useCallback((options) => {
    return new Promise((resolve) => {
      setModalDialog({
        title: options.title || 'System Notification',
        message: options.message || '',
        confirmText: options.okText || options.confirmText || 'Acknowledge',
        cancelText: null,
        type: options.type || 'info',
        details: options.details || null,
        isPrompt: false,
        isAlert: true,
        resolve
      });
    });
  }, []);

  // ── Modern Prompt Modal Dispatcher (Input Action) ──────────────────────
  const showPrompt = useCallback((options) => {
    return new Promise((resolve) => {
      setModalDialog({
        title: options.title || 'Input Required',
        message: options.message || 'Please provide details below:',
        placeholder: options.placeholder || 'Enter details...',
        defaultValue: options.defaultValue || '',
        confirmText: options.confirmText || 'Submit',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'info',
        required: options.required !== false,
        isPrompt: true,
        isAlert: false,
        resolve
      });
    });
  }, []);

  const handleModalConfirm = () => {
    if (!modalDialog) return;
    if (modalDialog.isPrompt) {
      if (modalDialog.required && !promptInput.trim()) {
        setPromptError('This field is required to proceed.');
        return;
      }
      const val = promptInput;
      const resolver = modalDialog.resolve;
      setModalDialog(null);
      resolver(val);
    } else {
      const resolver = modalDialog.resolve;
      setModalDialog(null);
      resolver(true);
    }
  };

  const handleModalCancel = () => {
    if (!modalDialog) return;
    const resolver = modalDialog.resolve;
    setModalDialog(null);
    resolver(modalDialog.isPrompt ? null : false);
  };

  // ── Theme Mapping Helpers ──────────────────────────────────────────────
  const getThemeMeta = (type) => {
    switch (type) {
      case 'danger':
      case 'error':
        return {
          primary: '#ef4444',
          glow: 'rgba(239, 68, 68, 0.35)',
          bgTint: 'rgba(239, 68, 68, 0.16)',
          borderTint: 'rgba(239, 68, 68, 0.35)',
          icon: <AlertOctagon size={24} style={{ color: '#ef4444' }} />,
          toastIcon: <AlertCircle size={18} style={{ color: '#ef4444' }} />,
          category: 'ERROR',
          defaultTitle: 'Error Detected'
        };
      case 'warning':
        return {
          primary: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.35)',
          bgTint: 'rgba(245, 158, 11, 0.16)',
          borderTint: 'rgba(245, 158, 11, 0.35)',
          icon: <AlertTriangle size={24} style={{ color: '#f59e0b' }} />,
          toastIcon: <AlertTriangle size={18} style={{ color: '#f59e0b' }} />,
          category: 'WARNING',
          defaultTitle: 'Warning Notice'
        };
      case 'info':
        return {
          primary: '#38bdf8',
          glow: 'rgba(56, 189, 248, 0.35)',
          bgTint: 'rgba(56, 189, 248, 0.16)',
          borderTint: 'rgba(56, 189, 248, 0.35)',
          icon: <Info size={24} style={{ color: '#38bdf8' }} />,
          toastIcon: <Info size={18} style={{ color: '#38bdf8' }} />,
          category: 'INFO',
          defaultTitle: 'System Notification'
        };
      case 'confirm':
        return {
          primary: '#818cf8',
          glow: 'rgba(129, 140, 248, 0.35)',
          bgTint: 'rgba(129, 140, 248, 0.16)',
          borderTint: 'rgba(129, 140, 248, 0.35)',
          icon: <HelpCircle size={24} style={{ color: '#818cf8' }} />,
          toastIcon: <HelpCircle size={18} style={{ color: '#818cf8' }} />,
          category: 'CONFIRMATION',
          defaultTitle: 'Action Required'
        };
      case 'success':
      default:
        return {
          primary: '#10b981',
          glow: 'rgba(16, 185, 129, 0.35)',
          bgTint: 'rgba(16, 185, 129, 0.16)',
          borderTint: 'rgba(16, 185, 129, 0.35)',
          icon: <CheckCircle2 size={24} style={{ color: '#10b981' }} />,
          toastIcon: <CheckCircle2 size={18} style={{ color: '#10b981' }} />,
          category: 'SUCCESS',
          defaultTitle: 'Action Completed'
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm, showAlert, showPrompt }}>
      {children}
      
      {/* ── Toast Notifications Stack ─────────────────────────────────── */}
      <div 
        className="toast-container"
        style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 1000001,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '440px',
          width: 'calc(100vw - 3rem)',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((toast) => {
          const meta = getThemeMeta(toast.type);
          const title = toast.title || meta.defaultTitle;

          return (
            <div 
              key={toast.id} 
              className="toast-item"
              style={{
                pointerEvents: 'auto',
                background: 'rgba(15, 23, 42, 0.96)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${meta.borderTint}`,
                borderLeft: `4px solid ${meta.primary}`,
                borderRadius: '12px',
                padding: '0.95rem 1.1rem 1rem 1rem',
                boxShadow: `0 20px 40px -8px rgba(0, 0, 0, 0.65), 0 0 25px -6px ${meta.glow}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.85rem',
                position: 'relative',
                overflow: 'hidden',
                animation: 'toastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              {/* Status Icon */}
              <div 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  backgroundColor: meta.bgTint,
                  border: `1px solid ${meta.borderTint}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '0.1rem'
                }}
              >
                {meta.toastIcon}
              </div>

              {/* Toast Text Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Category Pill Tag */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: meta.primary,
                  marginBottom: '0.2rem'
                }}>
                  {meta.category}
                </div>

                {/* Primary Title */}
                <div style={{ 
                  fontSize: '0.88rem', 
                  fontWeight: 700, 
                  color: '#FFFFFF', 
                  lineHeight: 1.3,
                  marginBottom: '0.25rem',
                  letterSpacing: '-0.01em'
                }}>
                  {title}
                </div>

                {/* Body Message */}
                {toast.message && (
                  <div style={{ 
                    fontSize: '0.82rem', 
                    color: '#cbd5e1', 
                    lineHeight: 1.45, 
                    wordBreak: 'break-word',
                    fontWeight: 400
                  }}>
                    {toast.message}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button 
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.3rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Close notification"
              >
                <X size={15} />
              </button>

              {/* Progress Duration Line */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <div 
                  style={{
                    height: '100%',
                    backgroundColor: meta.primary,
                    animation: `toastProgress ${toast.duration || 4200}ms linear forwards`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modern Custom Modal / Alert / Prompt Overlay ──────────────── */}
      {modalDialog && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 11, 24, 0.78)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000000,
            padding: '1.25rem',
            animation: 'modalFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleModalCancel();
          }}
        >
          {(() => {
            const meta = getThemeMeta(modalDialog.type);
            return (
              <div 
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderTop: `3.5px solid ${meta.primary}`,
                  borderRadius: '14px',
                  width: '100%',
                  maxWidth: '460px',
                  padding: '1.6rem 1.75rem',
                  boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.8), 0 0 35px -10px ' + meta.glow,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  animation: 'modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.15rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div 
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: meta.bgTint,
                        border: `1px solid ${meta.borderTint}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 0 15px ' + meta.glow
                      }}
                    >
                      {meta.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.01em' }}>
                        {modalDialog.title || meta.defaultTitle}
                      </h3>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: meta.primary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        CEB Grid Security & Workflow
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={handleModalCancel}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#94a3b8';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                    aria-label="Close dialog"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Message Body */}
                <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.55, marginBottom: '1.25rem', whiteSpace: 'pre-line' }}>
                  {modalDialog.message}
                </div>

                {/* Optional Details Pill */}
                {modalDialog.details && (
                  <div 
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      marginBottom: '1.25rem',
                      fontFamily: 'monospace'
                    }}
                  >
                    {modalDialog.details}
                  </div>
                )}

                {/* Prompt Input Field */}
                {modalDialog.isPrompt && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={promptInput}
                      onChange={(e) => {
                        setPromptInput(e.target.value);
                        if (promptError) setPromptError('');
                      }}
                      placeholder={modalDialog.placeholder}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        border: promptError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        outline: 'none',
                        transition: 'border-color 0.15s ease'
                      }}
                      onFocus={(e) => {
                        if (!promptError) e.target.style.borderColor = meta.primary;
                      }}
                      onBlur={(e) => {
                        if (!promptError) e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      }}
                    />
                    {promptError && (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.35rem', fontWeight: 500 }}>
                        {promptError}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.15rem' }}>
                  {!modalDialog.isAlert && modalDialog.cancelText && (
                    <button
                      type="button"
                      onClick={handleModalCancel}
                      style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: '#cbd5e1',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = '#FFFFFF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#cbd5e1';
                      }}
                    >
                      {modalDialog.cancelText}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleModalConfirm}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: meta.primary,
                      color: '#FFFFFF',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 14px ' + meta.glow,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.filter = 'brightness(1.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.filter = 'none';
                    }}
                  >
                    <span>{modalDialog.confirmText}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </ToastContext.Provider>
  );
};
