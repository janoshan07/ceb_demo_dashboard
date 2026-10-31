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
                background: '#FFFFFF',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                border: `1px solid #E5E8EF`,
                borderLeft: `3px solid ${meta.primary}`,
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                boxShadow: '0 8px 24px -6px rgba(16, 24, 40, 0.12), 0 2px 8px -2px rgba(16, 24, 40, 0.08)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                position: 'relative',
                overflow: 'hidden',
                animation: 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              {/* Status Icon */}
              <div 
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  backgroundColor: meta.bgTint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '0.05rem'
                }}
              >
                {meta.toastIcon}
              </div>

              {/* Toast Text Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Category label */}
                <div style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: meta.primary,
                  marginBottom: '0.15rem'
                }}>
                  {meta.category}
                </div>

                {/* Primary Title */}
                <div style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  color: '#1A2033', 
                  lineHeight: 1.3,
                  marginBottom: '0.2rem',
                  letterSpacing: '-0.01em'
                }}>
                  {title}
                </div>

                {/* Body Message */}
                {toast.message && (
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: '#6B7A99', 
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
                  color: '#9BA6BF',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1A2033';
                  e.currentTarget.style.backgroundColor = '#F1F3F8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#9BA6BF';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Close notification"
              >
                <X size={14} />
              </button>

              {/* Progress Duration Line */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#F1F3F8'
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
            background: 'rgba(26, 32, 51, 0.45)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000000,
            padding: '1.25rem',
            animation: 'modalFadeIn 0.18s ease'
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
                  background: '#FFFFFF',
                  border: '1px solid #E5E8EF',
                  borderTop: `3px solid ${meta.primary}`,
                  borderRadius: '14px',
                  width: '100%',
                  maxWidth: '460px',
                  padding: '1.5rem 1.75rem',
                  boxShadow: '0 20px 40px -8px rgba(16, 24, 40, 0.15), 0 8px 16px -4px rgba(16, 24, 40, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  animation: 'modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div 
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: meta.bgTint,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {meta.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A2033', margin: 0, letterSpacing: '-0.01em' }}>
                        {modalDialog.title || meta.defaultTitle}
                      </h3>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: meta.primary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        EDL Solar Billing System
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={handleModalCancel}
                    style={{
                      background: '#F1F3F8',
                      border: '1px solid #E5E8EF',
                      color: '#6B7A99',
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
                      e.currentTarget.style.color = '#1A2033';
                      e.currentTarget.style.backgroundColor = '#E5E8EF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#6B7A99';
                      e.currentTarget.style.backgroundColor = '#F1F3F8';
                    }}
                    aria-label="Close dialog"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Message Body */}
                <div style={{ fontSize: '0.875rem', color: '#6B7A99', lineHeight: 1.6, marginBottom: '1.25rem', whiteSpace: 'pre-line' }}>
                  {modalDialog.message}
                </div>

                {/* Optional Details Pill */}
                {modalDialog.details && (
                  <div 
                    style={{
                      background: '#F8F9FC',
                      border: '1px solid #E5E8EF',
                      borderRadius: '8px',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.8rem',
                      color: '#6B7A99',
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
                        padding: '0.625rem 0.875rem',
                        backgroundColor: '#F8F9FC',
                        border: promptError ? '1.5px solid #EF4444' : '1.5px solid #E5E8EF',
                        borderRadius: '8px',
                        color: '#1A2033',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                      }}
                      onFocus={(e) => {
                        if (!promptError) {
                          e.target.style.borderColor = meta.primary;
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 126, 246, 0.1)';
                          e.target.style.backgroundColor = '#FFFFFF';
                        }
                      }}
                      onBlur={(e) => {
                        if (!promptError) {
                          e.target.style.borderColor = '#E5E8EF';
                          e.target.style.boxShadow = 'none';
                          e.target.style.backgroundColor = '#F8F9FC';
                        }
                      }}
                    />
                    {promptError && (
                      <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '0.35rem', fontWeight: 500 }}>
                        {promptError}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #E5E8EF', paddingTop: '1rem' }}>
                  {!modalDialog.isAlert && modalDialog.cancelText && (
                    <button
                      type="button"
                      onClick={handleModalCancel}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '7px',
                        border: '1px solid #E5E8EF',
                        background: '#F8F9FC',
                        color: '#6B7A99',
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        fontFamily: "'Inter', sans-serif"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#E5E8EF';
                        e.currentTarget.style.color = '#1A2033';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8F9FC';
                        e.currentTarget.style.color = '#6B7A99';
                      }}
                    >
                      {modalDialog.cancelText}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleModalConfirm}
                    style={{
                      padding: '0.5rem 1.125rem',
                      borderRadius: '7px',
                      border: 'none',
                      backgroundColor: meta.primary,
                      color: '#FFFFFF',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      boxShadow: '0 2px 8px rgba(16, 24, 40, 0.15)',
                      transition: 'all 0.15s ease',
                      fontFamily: "'Inter', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = 'brightness(1.08)';
                    }}
                    onMouseLeave={(e) => {
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
