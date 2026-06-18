import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, User as UserIcon, Lock } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, setError } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    await login(username.trim(), password.trim());
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="sidebar-logo-icon" style={{ width: '42px', height: '42px' }}>
            <Zap size={24} fill="currentColor" />
          </div>
          <h1 className="sidebar-title" style={{ fontSize: '1.65rem' }}>CEB Portal</h1>
        </div>

        <h2 className="login-title">Customer Billing System</h2>
        <p className="login-subtitle">Sign in to manage electricity billing, customer registers and summaries.</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <div className="input-group">
              <UserIcon className="input-icon" size={18} />
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-group">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
          <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Demo accounts (Auto-seeded):</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', marginTop: '0.5rem', gap: '0.25rem', color: 'var(--text-muted)' }}>
            <span>Admin: <strong>admin</strong> / admin123</span>
            <span>Billing: <strong>officer</strong> / officer123</span>
            <span>Viewer: <strong>viewer</strong> / viewer123</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
