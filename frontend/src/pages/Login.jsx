import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import edlLogo from '../assets/edl_logo.jpg';

/* ─── SVG Icons ── */
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
const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);

  const navigate = useNavigate();
  const { login, loading, error, setError } = useAuth();

  const clearErr = () => { if (error) setError(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    const result = await login(username.trim(), password.trim());
    if (result && result.success) {
      navigate('/', { replace: true });
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F4F6FA',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '2rem 1rem',
    }}>
      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#FFFFFF',
        border: '1px solid #E5E8EF',
        borderRadius: '18px',
        boxShadow: '0 8px 32px -8px rgba(16, 24, 40, 0.12), 0 2px 8px -2px rgba(16, 24, 40, 0.06)',
        padding: '2.5rem 2.25rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '52px', height: '52px',
            borderRadius: '12px',
            background: '#3B7EF6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(59, 126, 246, 0.25)',
          }}>
            <img src={edlLogo} alt="EDL" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{
            fontSize: '1.375rem', fontWeight: 700,
            color: '#1A2033', letterSpacing: '-0.02em',
            margin: '0 0 0.375rem',
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6B7A99', margin: 0 }}>
            Sign in to EDL Smart Solar Dashboard
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#EF4444',
            fontSize: '0.84rem',
            lineHeight: 1.45,
          }}>
            <span style={{ flexShrink: 0, marginTop: '1px' }}><IconAlert /></span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Username */}
          <div>
            <label htmlFor="login-username" style={{
              display: 'block', fontSize: '0.82rem', fontWeight: 600,
              color: '#1A2033', marginBottom: '0.4rem',
            }}>
              Username / Employee ID
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '0.875rem', top: '50%',
                transform: 'translateY(-50%)', color: '#9BA6BF', pointerEvents: 'none',
              }}>
                <IconUser />
              </span>
              <input
                id="login-username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => { setUsername(e.target.value); clearErr(); }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem 0.625rem 2.5rem',
                  background: '#F8F9FC',
                  border: '1.5px solid #E5E8EF',
                  borderRadius: '8px',
                  color: '#1A2033',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#3B7EF6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 126, 246, 0.12)';
                  e.target.style.background = '#FFFFFF';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E5E8EF';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#F8F9FC';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="login-password" style={{
              display: 'block', fontSize: '0.82rem', fontWeight: 600,
              color: '#1A2033', marginBottom: '0.4rem',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '0.875rem', top: '50%',
                transform: 'translateY(-50%)', color: '#9BA6BF', pointerEvents: 'none',
              }}>
                <IconLock />
              </span>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); clearErr(); }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.625rem 2.5rem 0.625rem 2.5rem',
                  background: '#F8F9FC',
                  border: '1.5px solid #E5E8EF',
                  borderRadius: '8px',
                  color: '#1A2033',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#3B7EF6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 126, 246, 0.12)';
                  e.target.style.background = '#FFFFFF';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E5E8EF';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#F8F9FC';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: '#9BA6BF', padding: 0,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPw ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {/* Remember / Forgot row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.82rem', color: '#6B7A99', cursor: 'pointer',
            }}>
              <input type="checkbox" style={{ accentColor: '#3B7EF6', width: 14, height: 14, cursor: 'pointer' }} />
              Remember me
            </label>
            <a href="#" style={{ fontSize: '0.82rem', color: '#3B7EF6', fontWeight: 600, textDecoration: 'none' }}>
              Forgot password?
            </a>
          </div>

          {/* Submit */}
          <button
            id="edl-login-btn"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.7rem',
              background: loading ? '#93BFFF' : '#3B7EF6',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'background-color 0.18s ease',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#2563EB'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#3B7EF6'; }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'loginSpin 0.7s linear infinite',
                }} />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <IconArrow />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9BA6BF', margin: 0, lineHeight: 1.5 }}>
          © 2026 Electricity Distribution Lanka (Pvt) Ltd.
          <br />Authorized personnel only. All access is monitored.
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes loginSpin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::placeholder { color: #9BA6BF !important; }
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 40px #F8F9FC inset !important;
          -webkit-text-fill-color: #1A2033 !important;
        }
      `}</style>
    </div>
  );
};

export default Login;
