import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import edlLogo from '../assets/edl_logo.jpg';

/* ─── tiny SVG icons (clean inline SVG, zero external overhead) ─────────────────────────── */
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="7.5" cy="15.5" r="4.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3" />
  </svg>
);
const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);
const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);
const IconCheckCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/* ─── Input Field Component ────────────────────────────────────────────── */
const Field = ({ id, icon: Icon, type, placeholder, value, onChange, disabled, right }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span style={{
        position: 'absolute', left: '14px', display: 'flex', alignItems: 'center',
        color: focused ? '#22d3ee' : 'rgba(34, 211, 238, 0.7)', transition: 'color 0.2s', pointerEvents: 'none', zIndex: 1,
      }}>
        <Icon />
      </span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        style={{
          width: '100%', height: '48px', background: focused ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.75)',
          border: `1px solid ${focused ? '#22d3ee' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '10px', color: '#ffffff', fontSize: '13.5px', outline: 'none',
          paddingLeft: '42px', paddingRight: right ? '42px' : '14px',
          boxSizing: 'border-box', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: focused ? '0 0 16px rgba(34, 211, 238, 0.35)' : 'none',
        }}
      />
      {right && (
        <span style={{ position: 'absolute', right: '13px', display: 'flex', alignItems: 'center', zIndex: 1 }}>
          {right}
        </span>
      )}
    </div>
  );
};

/* ─── Main Login Page ────────────────────────────────────────── */
const Login = () => {
  // Step: 'CREDENTIALS' | 'OTP'
  const [step, setStep] = useState('CREDENTIALS');

  // Credentials form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken]       = useState('');
  const [showPw, setShowPw]     = useState(false);

  // OTP form state
  const [otpSessionId, setOtpSessionId] = useState('');
  const [maskedPhone, setMaskedPhone]   = useState('');
  const [otpDigits, setOtpDigits]       = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown]       = useState(60);
  const [resendLoading, setResendLoading] = useState(false);
  const [otpError, setOtpError]         = useState(null);
  const [otpSuccess, setOtpSuccess]     = useState(null);

  const digitInputRefs = useRef([]);

  const { login, verifyOtp, resendOtp, loading, error, setError } = useAuth();

  // Clear credentials error
  const clearErr = () => { if (error) setError(null); };

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    let timer;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Handle Initial Login Credentials Submission
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.');
      return;
    }

    const result = await login(username.trim(), password.trim());

    if (result && result.otpRequired) {
      // Transition to OTP verification step
      setOtpSessionId(result.otpSessionId);
      setMaskedPhone(result.maskedPhone || '******4567');
      setCountdown(result.resendCooldownSeconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setOtpSuccess(result.message || 'Verification code sent to your registered phone.');
      setStep('OTP');

      // Auto-focus first OTP digit after transition
      setTimeout(() => {
        if (digitInputRefs.current[0]) {
          digitInputRefs.current[0].focus();
        }
      }, 150);
    }
  };

  // Handle individual OTP digit input
  const handleDigitChange = (index, value) => {
    // Only accept numeric inputs
    const cleanVal = value.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      // Handle paste of full 6-digit code
      const pasted = cleanVal.slice(0, 6).split('');
      pasted.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      digitInputRefs.current[nextIndex]?.focus();
      return;
    }

    newDigits[index] = cleanVal ? cleanVal[cleanVal.length - 1] : '';
    setOtpDigits(newDigits);
    setOtpError(null);

    // Auto-advance to next input
    if (cleanVal && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace navigation across OTP cells
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '');
    if (pastedData) {
      const newDigits = [...otpDigits];
      const chars = pastedData.slice(0, 6).split('');
      chars.forEach((c, i) => {
        if (i < 6) newDigits[i] = c;
      });
      setOtpDigits(newDigits);
      const targetFocus = Math.min(chars.length, 5);
      digitInputRefs.current[targetFocus]?.focus();
    }
  };

  // Handle OTP Verification Submission
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    setOtpError(null);
    const result = await verifyOtp(otpSessionId, code);

    if (result && result.error) {
      setOtpError(result.error);
    }
    // If successful, AuthContext automatically updates user state and App.jsx redirects to Dashboard!
  };

  // Handle Resend OTP request
  const handleResend = async () => {
    if (countdown > 0 || resendLoading) return;

    setResendLoading(true);
    setOtpError(null);
    setOtpSuccess(null);

    const result = await resendOtp(otpSessionId);
    setResendLoading(false);

    if (result.success) {
      setOtpSessionId(result.otpSessionId);
      if (result.maskedPhone) setMaskedPhone(result.maskedPhone);
      setCountdown(result.resendCooldownSeconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpSuccess(result.message || 'A new 6-digit code has been sent.');
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 100);
    } else {
      setOtpError(result.error || 'Failed to resend code. Please try again.');
    }
  };

  // Reset back to credentials step
  const handleBackToLogin = () => {
    setStep('CREDENTIALS');
    setOtpError(null);
    setOtpSuccess(null);
    setError(null);
    setOtpDigits(['', '', '', '', '', '']);
  };

  const ring = (size, opacity, border) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    border: `1px solid ${border}`, opacity, left: '50%', top: '42%',
    transform: 'translate(-50%, -50%)', pointerEvents: 'none',
  });

  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#060d1b', fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(96,165,250,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,0.03) 1px,transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />
      {/* Ambient blobs */}
      <div style={{ position: 'absolute', top: '-120px', left: '-80px', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-100px', right: '-60px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Page title */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
          EDL Secure Access
        </h1>
        <p style={{ fontSize: '11px', color: 'rgba(148,163,184,0.55)', marginTop: '6px', letterSpacing: '0.04em' }}>
          Utility Management Dashboard &nbsp;|&nbsp; Electricity Distribution Lanka (Private) Limited
        </p>
      </div>

      {/* Main card */}
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: '820px',
        display: 'flex', borderRadius: '22px', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 0%, rgba(16, 26, 46, 0.96) 0%, rgba(9, 14, 26, 0.98) 100%)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1.5px solid rgba(34, 211, 238, 0.4)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(34, 211, 238, 0.18)',
        margin: '0 24px',
      }}>
        {/* ── Left panel ── */}
        <div style={{
          flex: '0 0 280px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '24px',
          padding: '56px 32px',
          background: 'linear-gradient(160deg, rgba(17,35,72,0.9) 0%, rgba(7,14,34,0.95) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Left glow */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(37,99,235,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
          {/* Rings */}
          <div style={ring('230px', 0.18, 'rgba(96,165,250,0.5)')} />
          <div style={ring('170px', 0.25, 'rgba(96,165,250,0.4)')} />
          <div style={ring('110px', 0.30, 'rgba(96,165,250,0.35)')} />

          {/* Logo */}
          <div style={{
            width: '88px', height: '88px', borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid rgba(96,165,250,0.4)',
            boxShadow: '0 0 40px rgba(37,99,235,0.4), 0 0 80px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1,
          }}>
            <img src={edlLogo} alt="EDL Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Left text */}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#60a5fa', marginBottom: '6px' }}>
              Operational Dashboard
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(148,163,184,0.65)', letterSpacing: '0.06em', lineHeight: 1.7 }}>
              Electricity Distribution Lanka<br />Smart Solar Billing System
            </div>
          </div>

          {/* Indicator dots */}
          <div style={{ display: 'flex', gap: '6px', position: 'relative', zIndex: 1 }}>
            {[step === 'CREDENTIALS', step === 'OTP', false, false].map((a, i) => (
              <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: a ? '#38bdf8' : 'rgba(255,255,255,0.15)', transition: 'background 0.3s ease' }} />
            ))}
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div style={{ flex: 1, padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {step === 'CREDENTIALS' ? (
            /* ──────────────── STEP 1: CREDENTIALS ──────────────── */
            <>
              {/* Status badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '999px', alignSelf: 'flex-start',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                fontSize: '9.5px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#34d399', marginBottom: '20px',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'edl-blink 1.5s ease-in-out infinite' }} />
                System Online
              </div>

              <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#3b82f6', margin: '0 0 8px' }}>
                Secure Enterprise Access
              </p>
              <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.15, margin: '0 0 4px' }}>
                Welcome Back
              </h2>
              <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.65)', margin: '0 0 28px', lineHeight: 1.5 }}>
                Sign in to access the EDL operational dashboard
              </p>

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px',
                  borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
                  color: '#fca5a5', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5,
                }}>
                  <IconShield /><span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCredentialsSubmit} autoComplete="off">
                {/* Employee ID */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.6)', marginBottom: '7px' }} htmlFor="edl-username">
                    Employee ID / Username
                  </label>
                  <Field id="edl-username" icon={IconUser} type="text" placeholder="Enter your Employee ID"
                    value={username} onChange={e => { setUsername(e.target.value); clearErr(); }} disabled={loading} />
                </div>

                {/* Password */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.6)', marginBottom: '7px' }} htmlFor="edl-password">
                    Password
                  </label>
                  <Field id="edl-password" icon={IconLock} type={showPw ? 'text' : 'password'} placeholder="Enter your password"
                    value={password} onChange={e => { setPassword(e.target.value); clearErr(); }} disabled={loading}
                    right={
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0, display: 'flex' }}>
                        {showPw ? <IconEyeOff /> : <IconEye />}
                      </button>
                    }
                  />
                </div>

                {/* Security Token */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.6)', marginBottom: '7px' }} htmlFor="edl-token">
                    Security Token <span style={{ opacity: 0.4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <Field id="edl-token" icon={IconKey} type="text" placeholder="Enter security token"
                    value={token} onChange={e => setToken(e.target.value)} disabled={loading} />
                </div>

                {/* Links */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', marginTop: '4px' }}>
                  <a href="#" style={{ fontSize: '11.5px', color: '#60a5fa', textDecoration: 'none', fontWeight: '500' }}>Forgot Password?</a>
                  <a href="#" style={{ fontSize: '11.5px', color: '#60a5fa', textDecoration: 'none', fontWeight: '500' }}>Request Access</a>
                </div>

                {/* Submit */}
                <button
                  id="edl-login-btn"
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', height: '50px', border: 'none', borderRadius: '11px',
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #22d3ee 100%)',
                    color: '#fff', fontSize: '13px', fontWeight: '700', letterSpacing: '0.08em',
                    textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    boxShadow: '0 4px 20px rgba(34, 211, 238, 0.4), 0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 6px 28px rgba(34, 211, 238, 0.6), 0 12px 32px rgba(0,0,0,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(34, 211, 238, 0.4), 0 8px 24px rgba(0,0,0,0.4)'; e.currentTarget.style.transform = 'none'; }}
                >
                  {loading ? (
                    <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'edl-spin 0.75s linear infinite' }} /><span>Verifying Credentials…</span></>
                  ) : (
                    <><span>Sign In With Credentials</span><IconArrow /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ──────────────── STEP 2: OTP VERIFICATION ──────────────── */
            <div style={{ animation: 'edl-fade-in 0.3s ease-out' }}>
              {/* Back to credentials button */}
              <button
                type="button"
                onClick={handleBackToLogin}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                  fontSize: '11.5px', fontWeight: '500', display: 'inline-flex', alignItems: 'center',
                  gap: '6px', padding: 0, marginBottom: '18px', transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                <IconArrowLeft />
                <span>Back to Sign In</span>
              </button>

              {/* Status badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '999px', alignSelf: 'flex-start',
                background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)',
                fontSize: '9.5px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#22d3ee', marginBottom: '16px',
              }}>
                <IconLock />
                Two-Factor Phone Verification
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.15, margin: '0 0 6px' }}>
                Enter Security Code
              </h2>
              <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.7)', margin: '0 0 20px', lineHeight: 1.5 }}>
                A 6-digit verification code was sent to your registered number{' '}
                <span style={{ color: '#38bdf8', fontWeight: '700', padding: '1px 6px', background: 'rgba(56, 189, 248, 0.12)', borderRadius: '6px', letterSpacing: '0.04em' }}>
                  {maskedPhone}
                </span>
              </p>

              {/* Success alert */}
              {otpSuccess && !otpError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                  borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#6ee7b7', fontSize: '11.5px', marginBottom: '18px', lineHeight: 1.4,
                }}>
                  <IconCheckCircle />
                  <span>{otpSuccess}</span>
                </div>
              )}

              {/* Error alert */}
              {otpError && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px',
                  borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#fca5a5', fontSize: '12px', marginBottom: '18px', lineHeight: 1.4,
                }}>
                  <IconShield />
                  <span>{otpError}</span>
                </div>
              )}

              <form onSubmit={handleOtpSubmit} autoComplete="off">
                {/* 6 Digit Input Cells */}
                <div style={{ marginBottom: '22px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.6)', marginBottom: '10px', textAlign: 'center' }}>
                    6-Digit Verification Code
                  </label>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handlePaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => (digitInputRefs.current[idx] = el)}
                        id={`edl-otp-digit-${idx}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleDigitChange(idx, e.target.value)}
                        onKeyDown={e => handleKeyDown(idx, e)}
                        disabled={loading}
                        style={{
                          width: '46px',
                          height: '52px',
                          textAlign: 'center',
                          fontSize: '22px',
                          fontWeight: '700',
                          color: '#ffffff',
                          background: digit ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.75)',
                          border: `1.5px solid ${digit ? '#22d3ee' : 'rgba(255,255,255,0.14)'}`,
                          borderRadius: '11px',
                          outline: 'none',
                          boxShadow: digit ? '0 0 14px rgba(34, 211, 238, 0.35)' : 'none',
                          transition: 'all 0.2s ease',
                          caretColor: '#22d3ee',
                        }}
                        onFocus={e => {
                          e.target.style.borderColor = '#22d3ee';
                          e.target.style.boxShadow = '0 0 16px rgba(34, 211, 238, 0.4)';
                          e.target.select();
                        }}
                        onBlur={e => {
                          if (!e.target.value) {
                            e.target.style.borderColor = 'rgba(255,255,255,0.14)';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Resend OTP button & Countdown timer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', padding: '0 4px' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(148,163,184,0.6)' }}>
                    Didn't receive the SMS code?
                  </div>
                  {countdown > 0 ? (
                    <div style={{
                      fontSize: '11px', fontWeight: '600', color: '#94a3b8',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8' }} />
                      Resend in <span style={{ color: '#38bdf8', fontWeight: '700', minWidth: '22px' }}>{countdown}s</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id="edl-resend-otp-btn"
                      onClick={handleResend}
                      disabled={resendLoading || loading}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#38bdf8', fontSize: '11.5px', fontWeight: '600',
                        display: 'flex', alignItems: 'center', gap: '5px', padding: 0,
                        transition: 'color 0.2s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
                      onMouseLeave={e => e.currentTarget.style.color = '#38bdf8'}
                    >
                      {resendLoading ? (
                        <span>Sending…</span>
                      ) : (
                        <>
                          <IconRefresh />
                          <span>Resend Code</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Verify Button */}
                <button
                  id="edl-verify-otp-btn"
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6}
                  style={{
                    width: '100%', height: '50px', border: 'none', borderRadius: '11px',
                    cursor: (loading || otpDigits.join('').length !== 6) ? 'not-allowed' : 'pointer',
                    opacity: (loading || otpDigits.join('').length !== 6) ? 0.65 : 1,
                    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #22d3ee 100%)',
                    color: '#fff', fontSize: '13px', fontWeight: '700', letterSpacing: '0.08em',
                    textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    boxShadow: '0 4px 20px rgba(34, 211, 238, 0.4), 0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={e => { if (!loading && otpDigits.join('').length === 6) { e.currentTarget.style.boxShadow = '0 6px 28px rgba(34, 211, 238, 0.6), 0 12px 32px rgba(0,0,0,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(34, 211, 238, 0.4), 0 8px 24px rgba(0,0,0,0.4)'; e.currentTarget.style.transform = 'none'; }}
                >
                  {loading ? (
                    <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'edl-spin 0.75s linear infinite' }} /><span>Validating OTP Code…</span></>
                  ) : (
                    <><span>Verify & Sign In</span><IconArrow /></>
                  )}
                </button>
              </form>
            </div>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '24px 0' }} />
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            {['Privacy Policy', 'Terms of Use', 'Support'].map(t => (
              <a key={t} href="#" style={{ fontSize: '10.5px', color: 'rgba(148,163,184,0.4)', textDecoration: 'none' }}>{t}</a>
            ))}
          </div>
        </div>
      </div>

      {/* Page footer */}
      <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 32px', height: '34px',
        background: 'rgba(4,8,20,0.7)', backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: '8.5px', fontFamily: 'monospace', color: 'rgba(100,116,139,0.6)',
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        <span>© 2026 Electricity Distribution Lanka (Pvt) Ltd. All rights reserved.</span>
        <span style={{ color: 'rgba(239,68,68,0.45)' }}>Classification: Confidential &nbsp;|&nbsp; Portal v4.10.2</span>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #334155 !important; opacity: 1; }
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 40px #0a1120 inset !important;
          -webkit-text-fill-color: #f1f5f9 !important;
          caret-color: #f1f5f9;
        }
        @keyframes edl-spin { to { transform: rotate(360deg); } }
        @keyframes edl-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes edl-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Login;
