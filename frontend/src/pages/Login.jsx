import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  User as UserIcon, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Shield, 
  ShieldCheck, 
  Leaf, 
  Users, 
  LineChart 
} from 'lucide-react';
import loginBgImg from '../assets/login_bg_clean.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <div 
      className="login-container animate-fade-in" 
      style={{ backgroundImage: `url(${loginBgImg})` }}
    >
      <div className="login-overlay"></div>
      
      <div className="login-content-wrapper">
        {/* Left Side: Branding, Slogan, and Features */}
        <div className="login-brand-panel">
          {/* Logo Section */}
          <div className="brand-logo-container animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <Zap size={32} fill="#eab308" color="#eab308" className="logo-lightning-icon" />
            <div className="brand-logo-text">
              <h1 className="brand-title">EDL</h1>
              <p className="brand-subtitle">Electricity Distribution Lanka (Private) Limited</p>
            </div>
          </div>

          {/* Slogan Section */}
          <div className="brand-slogan-container animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <h2 className="brand-slogan-main">
              Powering Sri Lanka<br />
              <span className="gold-text">Empowering Lives</span>
            </h2>
            <p className="brand-slogan-sub">
              Delivering reliable, sustainable and efficient electricity to empower every life.
            </p>
            <div className="brand-slogan-line"></div>
          </div>

          {/* Feature Badges */}
          <div className="brand-features-grid animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="feature-badge-card">
              <div className="feature-icon-wrapper">
                <ShieldCheck size={20} className="feature-icon-blue" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">Reliable Service</h4>
                <p className="feature-desc">Ensuring uninterrupted power supply</p>
              </div>
            </div>

            <div className="feature-badge-card">
              <div className="feature-icon-wrapper">
                <Leaf size={20} className="feature-icon-blue" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">Sustainable Future</h4>
                <p className="feature-desc">Committed to clean and green energy</p>
              </div>
            </div>

            <div className="feature-badge-card">
              <div className="feature-icon-wrapper">
                <Users size={20} className="feature-icon-blue" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">Customer Focused</h4>
                <p className="feature-desc">Building stronger connections with communities</p>
              </div>
            </div>

            <div className="feature-badge-card">
              <div className="feature-icon-wrapper">
                <LineChart size={20} className="feature-icon-blue" />
              </div>
              <div className="feature-text">
                <h4 className="feature-title">Innovative Solutions</h4>
                <p className="feature-desc">Leveraging technology for a better tomorrow</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Login Card */}
        <div className="login-form-panel animate-slide-in-right" style={{ animationDelay: '0.2s' }}>
          <div className="login-form-card">
            <div className="login-card-header">
              {/* Logo in Card for Mobile View */}
              <div className="card-mobile-logo">
                <Zap size={24} fill="#eab308" color="#eab308" className="logo-lightning-icon" />
                <span className="card-mobile-logo-text">EDL</span>
              </div>
              <h2 className="login-welcome-title">Welcome Back!</h2>
              <p className="login-welcome-subtitle">Sign in to continue to your account</p>
            </div>

            {error && <div className="login-error-toast animate-slide-in">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form-fields-custom">
              <div className="login-field-group">
                <label className="login-field-label-custom" htmlFor="username">Username</label>
                <div className="login-field-input-wrapper">
                  <UserIcon className="field-input-icon-custom" size={16} />
                  <input
                    id="username"
                    type="text"
                    className="login-field-input-custom"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="login-field-group">
                <label className="login-field-label-custom" htmlFor="password">Password</label>
                <div className="login-field-input-wrapper">
                  <Lock className="field-input-icon-custom" size={16} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="login-field-input-custom"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    className="login-password-toggle-custom"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="login-options-row">
                <label className="remember-me-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="remember-me-checkbox"
                  />
                  <span>Remember me</span>
                </label>
                <a href="#forgot" className="forgot-password-link" onClick={(e) => e.preventDefault()}>
                  Forgot Password?
                </a>
              </div>

              <button
                type="submit"
                className="login-submit-button-custom"
                disabled={loading}
              >
                {loading ? (
                  <span className="button-loader-wrapper">
                    Authenticating...
                  </span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} className="button-arrow-icon" style={{ marginLeft: '0.35rem' }} />
                  </>
                )}
              </button>
            </form>

            <div className="login-divider-custom">
              <div className="divider-line"></div>
              <span className="divider-text">or continue with</span>
              <div className="divider-line"></div>
            </div>

            <button
              type="button"
              className="login-sso-button"
              disabled={loading}
              onClick={() => setError('SSO Authentication requires corporate active directory connection.')}
            >
              <Shield size={16} className="sso-shield-icon" />
              <span>SSO Login</span>
            </button>

            <div className="login-footer-text">
              <div>© 2025 EDL (Electricity Distribution Lanka (Private) Limited).</div>
              <div style={{ marginTop: '0.2rem' }}>All rights reserved.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
