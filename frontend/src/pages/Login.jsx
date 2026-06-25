import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Zap, Shield, Lock, User, Eye, EyeOff,
  Activity, Sun, Users, LineChart, CheckCircle, Database,
  ChevronDown, Wifi, TrendingUp, BarChart3, Sparkles
} from 'lucide-react';
import HoloScene from '../components/login/HoloScene';

/* ─────────────────────────────────────────────
   CONSTANTS — unchanged from original
───────────────────────────────────────────── */
const ROLES = [
  { value: 'ADMIN',    label: 'Administrator',    icon: '⬡' },
  { value: 'OFFICER',  label: 'Billing Officer',  icon: '◈' },
  { value: 'CUSTOMER', label: 'Customer Viewer',  icon: '◎' },
];

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────── */
const AnimatedStat = ({ value, label, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.6, ease: 'easeOut' }}
    className="flex flex-col items-center gap-0.5"
  >
    <span style={{ color }} className="text-[13px] font-bold tabular-nums tracking-tight">
      {value}
    </span>
    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-semibold">{label}</span>
  </motion.div>
);

/* ─────────────────────────────────────────────
   FLOATING ORBS (background ambience)
───────────────────────────────────────────── */
const FloatingOrb = ({ style, duration, delay }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={style}
    animate={{ y: [0, -30, 0], x: [0, 15, 0], opacity: [0.4, 0.7, 0.4] }}
    transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
  />
);

/* ─────────────────────────────────────────────
   GRID OVERLAY
───────────────────────────────────────────── */
const GridOverlay = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: `
        linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)
      `,
      backgroundSize: '44px 44px',
    }}
  />
);

/* ─────────────────────────────────────────────
   INTRO LOADER
───────────────────────────────────────────── */
const IntroLoader = ({ onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#060c1a]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {/* Scanning ring */}
      <div className="relative w-20 h-20 mb-6">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
          animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border border-blue-500/50"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{
            borderTopColor: '#22d3ee',
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className="w-6 h-6 text-cyan-400" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-[1px] bg-slate-800 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #22d3ee)' }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.3, ease: 'easeInOut' }}
        />
      </div>

      <motion.p
        className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        Initializing Intelligence Core...
      </motion.p>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   PREMIUM INPUT
───────────────────────────────────────────── */
const PremiumInput = ({ icon: Icon, type, placeholder, value, onChange, disabled, rightEl, id }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative group">
      {/* Glow border layer */}
      <div
        className="absolute -inset-[1px] rounded-xl transition-all duration-300 pointer-events-none"
        style={{
          background: focused
            ? 'linear-gradient(135deg, rgba(34,211,238,0.5), rgba(59,130,246,0.4), rgba(139,92,246,0.3))'
            : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
          opacity: focused ? 1 : 0.6,
        }}
      />
      {/* Icon */}
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
        <Icon
          className="w-4 h-4 transition-colors duration-300"
          style={{ color: focused ? '#22d3ee' : '#475569' }}
        />
      </div>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="relative w-full rounded-xl text-[13px] text-white placeholder-slate-500 outline-none transition-all duration-300 disabled:opacity-50"
        style={{
          background: focused ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.6)',
          border: 'none',
          paddingLeft: '2.75rem',
          paddingRight: rightEl ? '2.75rem' : '1rem',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
        }}
      />
      {rightEl && (
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center z-10">
          {rightEl}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN LOGIN COMPONENT
───────────────────────────────────────────── */
const Login = () => {
  // ── STATE (unchanged) ──────────────────────
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole]                 = useState('ADMIN');
  const [rememberMe, setRememberMe]     = useState(false);
  const { login, loading, error, setError } = useAuth();
  const [mousePos, setMousePos]         = useState({ x: 0, y: 0 });

  // ── NEW UI STATE ───────────────────────────
  const [loaded, setLoaded]             = useState(false);
  const [roleOpen, setRoleOpen]         = useState(false);
  const roleRef                         = useRef(null);

  // ── MOUSE PARALLAX (unchanged) ─────────────
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ── ROLE DROPDOWN CLOSE ON OUTSIDE CLICK ──
  useEffect(() => {
    const handler = (e) => {
      if (roleRef.current && !roleRef.current.contains(e.target)) setRoleOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── SUBMIT (unchanged) ────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !role) {
      setError('Please enter username, password, and select your control center role.');
      return;
    }
    await login(username.trim(), password.trim());
  };

  const clearErr = () => { if (error) setError(null); };

  // ── CARD PARALLAX TRANSFORM (unchanged) ───
  const cardTransform = `perspective(1200px) rotateY(${-15 + mousePos.x * 14}deg) rotateX(${6 - mousePos.y * 14}deg) translateZ(10px) translateX(${mousePos.x * 12}px) translateY(${mousePos.y * 12}px)`;

  const selectedRole = ROLES.find(r => r.value === role);

  /* ── RENDER ─────────────────────────────── */
  return (
    <>
      {/* ─── Intro Loader ─────────────────── */}
      <AnimatePresence>
        {!loaded && <IntroLoader onDone={() => setLoaded(true)} />}
      </AnimatePresence>

      {/* ─── Main Page ────────────────────── */}
      <div className="fixed inset-0 flex overflow-hidden w-screen h-screen select-none"
        style={{ fontFamily: "'Inter', 'Outfit', sans-serif", background: '#060c1a' }}>

        {/* ══════════════════════════════════
            LEFT COLUMN — Login Panel
        ══════════════════════════════════ */}
        <motion.aside
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="pointer-events-auto relative flex flex-col justify-between h-full shrink-0 z-20 overflow-hidden w-full sm:w-[480px]"
          style={{
            background: 'linear-gradient(160deg, #0b1220 0%, #080e1c 50%, #070b18 100%)',
          }}
        >
          {/* — Side glow edge — */}
          <div className="absolute right-0 top-0 bottom-0 w-[1px] pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(34,211,238,0.15) 40%, rgba(59,130,246,0.2) 60%, transparent)' }} />

          {/* — Ambient left orbs — */}
          <FloatingOrb style={{ width: 280, height: 280, top: -80, left: -100, background: 'radial-gradient(circle, rgba(59,130,246,0.08), transparent 70%)' }} duration={8} delay={0} />
          <FloatingOrb style={{ width: 200, height: 200, bottom: 60, left: -60, background: 'radial-gradient(circle, rgba(139,92,246,0.07), transparent 70%)' }} duration={10} delay={2} />

          {/* — Grid overlay — */}
          <GridOverlay />

          {/* ── HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.9, duration: 0.6 }}
            className="flex items-center gap-3 p-6 sm:p-10 pb-0 relative z-10"
          >
            {/* Logo mark */}
            <div className="relative">
              <motion.div
                className="absolute -inset-1 rounded-xl"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.4), transparent 70%)' }}
              />
              <div className="relative w-9 h-9 flex items-center justify-center rounded-xl border"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f, #0f2544)',
                  borderColor: 'rgba(34,211,238,0.3)',
                  boxShadow: '0 0 16px rgba(34,211,238,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}>
                <Zap className="w-4.5 h-4.5 text-cyan-400" />
              </div>
            </div>

            <div>
              <div className="text-[14px] font-bold tracking-tight text-white leading-tight">
                EDL Smart Solar Billing
              </div>
              <div className="text-[9px] font-semibold tracking-[0.18em] uppercase mt-0.5"
                style={{ color: 'rgba(148,163,184,0.6)' }}>
                Electricity Distribution Lanka
              </div>
            </div>

            {/* System online badge */}
            <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full border"
              style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-wider">Online</span>
            </div>
          </motion.div>

          {/* ── ALIGNED FORM AREA ── */}
          <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 relative z-10">
            <div className="max-w-[360px] w-full">

              {/* Welcome heading */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.0, duration: 0.7, ease: 'easeOut' }}
                className="mb-7"
              >
                <p className="text-[10px] font-mono font-semibold tracking-[0.25em] uppercase mb-2"
                  style={{ color: '#22d3ee' }}>
                  Secure Enterprise Access
                </p>
                <h1 className="text-[28px] font-bold tracking-tight leading-none text-white mb-2">
                  Welcome Back
                </h1>
                <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  Transforming Solar Billing Through Intelligence
                </p>
                {/* Accent underline */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: 48 }}
                  transition={{ delay: 2.3, duration: 0.8, ease: 'easeOut' }}
                  className="h-[2px] mt-3 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #22d3ee, #3b82f6)' }}
                />
              </motion.div>

              {/* Glass Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.1, duration: 0.8, ease: 'easeOut' }}
                className="relative rounded-2xl p-6"
                style={{
                  background: 'rgba(11,18,35,0.7)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,211,238,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                {/* Card inner glow */}
                <div className="absolute -inset-[1px] rounded-2xl pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, transparent 50%, rgba(139,92,246,0.06) 100%)',
                    borderRadius: 'inherit',
                  }}
                />

                {/* Error Banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2.5 p-3 rounded-xl text-[11px]"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#fca5a5',
                        }}>
                        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                        <span>{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 relative z-10">

                  {/* ── ACCESS LEVEL (Custom Dropdown) ── */}
                  <div ref={roleRef} className="relative">
                    <label className="block text-[9px] font-mono font-semibold tracking-[0.2em] uppercase mb-1.5"
                      style={{ color: 'rgba(148,163,184,0.6)' }}>
                      Access Level
                    </label>
                    <button
                      type="button"
                      id="role-selector"
                      onClick={() => { setRoleOpen(v => !v); clearErr(); }}
                      disabled={loading}
                      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-[13px] transition-all duration-200 outline-none cursor-pointer"
                      style={{
                        background: roleOpen ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.6)',
                        border: `1px solid ${roleOpen ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        color: '#e2e8f0',
                        boxShadow: roleOpen ? '0 0 0 3px rgba(34,211,238,0.08)' : 'none',
                      }}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-[15px] leading-none" style={{ color: '#22d3ee' }}>{selectedRole?.icon}</span>
                        <span>{selectedRole?.label}</span>
                      </span>
                      <motion.div animate={{ rotate: roleOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-4 h-4" style={{ color: 'rgba(148,163,184,0.5)' }} />
                      </motion.div>
                    </button>

                    {/* Dropdown */}
                    <AnimatePresence>
                      {roleOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.97 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden"
                          style={{
                            background: 'rgba(8,14,28,0.97)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(34,211,238,0.2)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                          }}
                        >
                          {ROLES.map((r, i) => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => { setRole(r.value); setRoleOpen(false); clearErr(); }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-left transition-colors duration-150"
                              style={{
                                color: r.value === role ? '#22d3ee' : '#94a3b8',
                                background: r.value === role ? 'rgba(34,211,238,0.08)' : 'transparent',
                                borderBottom: i < ROLES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,211,238,0.06)'}
                              onMouseLeave={e => e.currentTarget.style.background = r.value === role ? 'rgba(34,211,238,0.08)' : 'transparent'}
                            >
                              <span className="text-[15px]">{r.icon}</span>
                              <span>{r.label}</span>
                              {r.value === role && <CheckCircle className="w-3.5 h-3.5 ml-auto text-cyan-400" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── USERNAME ── */}
                  <div>
                    <label htmlFor="login-username" className="block text-[9px] font-mono font-semibold tracking-[0.2em] uppercase mb-1.5"
                      style={{ color: 'rgba(148,163,184,0.6)' }}>
                      Username
                    </label>
                    <PremiumInput
                      id="login-username"
                      icon={User}
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={e => { setUsername(e.target.value); clearErr(); }}
                      disabled={loading}
                    />
                  </div>

                  {/* ── PASSWORD ── */}
                  <div>
                    <label htmlFor="login-password" className="block text-[9px] font-mono font-semibold tracking-[0.2em] uppercase mb-1.5"
                      style={{ color: 'rgba(148,163,184,0.6)' }}>
                      Password
                    </label>
                    <PremiumInput
                      id="login-password"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); clearErr(); }}
                      disabled={loading}
                      rightEl={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                  </div>

                  {/* ── REMEMBER ME + FORGOT ── */}
                  <div className="flex items-center justify-between mt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="remember-me"
                          checked={rememberMe}
                          onChange={e => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className="w-4 h-4 rounded border flex items-center justify-center transition-all duration-200"
                          onClick={() => setRememberMe(v => !v)}
                          style={{
                            background: rememberMe ? 'rgba(34,211,238,0.15)' : 'rgba(15,23,42,0.6)',
                            borderColor: rememberMe ? 'rgba(34,211,238,0.6)' : 'rgba(255,255,255,0.12)',
                          }}
                        >
                          {rememberMe && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.15 }}
                            >
                              <CheckCircle className="w-3 h-3 text-cyan-400" />
                            </motion.div>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors">
                        Remember me
                      </span>
                    </label>
                    <a
                      href="#"
                      className="text-[11px] font-medium transition-colors hover:underline"
                      style={{ color: '#38bdf8' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
                      onMouseLeave={e => e.currentTarget.style.color = '#38bdf8'}
                    >
                      Forgot password?
                    </a>
                  </div>

                  {/* ── SIGN IN BUTTON ── */}
                  <motion.button
                    whileHover={{ scale: 1.015, y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    id="sign-in-btn"
                    disabled={loading}
                    className="relative w-full py-3.5 mt-1 rounded-xl font-bold tracking-wide text-[13px] uppercase overflow-hidden cursor-pointer transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #0891b2 50%, #1d4ed8 100%)',
                      backgroundSize: '200% auto',
                      color: '#ffffff',
                      boxShadow: '0 0 24px rgba(34,211,238,0.2), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundPosition = 'right center';
                      e.currentTarget.style.boxShadow = '0 0 40px rgba(34,211,238,0.35), 0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundPosition = 'left center';
                      e.currentTarget.style.boxShadow = '0 0 24px rgba(34,211,238,0.2), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)';
                    }}
                  >
                    {/* Shimmer sweep */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                      <motion.div
                        className="absolute top-0 bottom-0 w-1/3"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', skewX: '-20deg' }}
                        animate={{ x: ['-200%', '400%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
                      />
                    </div>

                    <div className="relative flex items-center justify-center gap-2.5">
                      {loading ? (
                        <>
                          <motion.span
                            className="w-4 h-4 rounded-full border-2"
                            style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          />
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ShieldCheck className="w-4 h-4" />
                        </>
                      )}
                    </div>
                  </motion.button>
                </form>
              </motion.div>
            </div>
          </div>

          {/* ── FOOTER STATS ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 0.8 }}
            className="p-6 sm:p-10 pt-0 relative z-10"
          >
            <div className="border-t pt-5 max-w-[360px]" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between mb-3">
                <AnimatedStat value="1.28M+" label="Connections" color="#e2e8f0" delay={2.6} />
                <AnimatedStat value="LKR 42.6M+" label="Monthly Vol" color="#34d399" delay={2.7} />
                <AnimatedStat value="99.85%" label="Accuracy" color="#38bdf8" delay={2.8} />
              </div>
              <p className="text-[8.5px] font-mono" style={{ color: 'rgba(100,116,139,0.7)' }}>
                End-to-end encrypted. Compliant with SLC Distribution standards.
              </p>
            </div>
          </motion.div>
        </motion.aside>

        {/* ══════════════════════════════════
            RIGHT COLUMN — Hero Panel
        ══════════════════════════════════ */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1.0 }}
          className="flex-1 h-full relative overflow-hidden hidden lg:block"
          aria-hidden="true"
        >
          {/* 3D Scene fills entire right side */}
          <HoloScene mousePos={mousePos} cardTransform={cardTransform} />

          {/* ── FLOATING STAT CARDS (HTML overlay) ── */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-10">
            {/* Top-right badge */}
            <div className="flex justify-end">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 2.4, duration: 0.7 }}
                className="flex items-center gap-2 px-3 py-2 rounded-full"
                style={{
                  background: 'rgba(6,12,26,0.7)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(34,211,238,0.2)',
                }}
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Grid Active</span>
              </motion.div>
            </div>

            {/* Bottom floating stat cards */}
            <div className="flex gap-3 justify-center">
              {[
                { icon: Users, label: 'Total Customers', value: '128,450+', color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)' },
                { icon: TrendingUp, label: 'Monthly Revenue', value: 'LKR 42.6M', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
                { icon: BarChart3, label: 'Billing Accuracy', value: '99.85%', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.2 + i * 0.12, duration: 0.6, ease: 'easeOut' }}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                  style={{
                    background: stat.bg,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: `1px solid ${stat.border}`,
                    boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
                  }}
                >
                  <stat.icon className="w-4 h-4 shrink-0" style={{ color: stat.color }} />
                  <div>
                    <div className="text-[13px] font-bold" style={{ color: '#fff' }}>{stat.value}</div>
                    <div className="text-[8.5px] font-mono uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.7)' }}>{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Vertical title overlay ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 0.25, x: 0 }}
            transition={{ delay: 2.6, duration: 1 }}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            <span className="text-[9px] font-mono tracking-[0.35em] uppercase text-cyan-400">
              EDL Intelligence Platform v4.10
            </span>
          </motion.div>
        </motion.main>

        {/* ══════════════════════════════════
            GLOBAL FOOTER BAR
        ══════════════════════════════════ */}
        <footer
          className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-between px-8 text-[8px] font-mono tracking-wide"
          style={{
            height: '36px',
            background: 'rgba(5,8,18,0.7)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            color: 'rgba(100,116,139,0.7)',
          }}
        >
          <div>© 2026 ELECTRICITY DISTRIBUTION LANKA (PVT) LTD. ALL RIGHTS RESERVED.</div>
          <div className="flex gap-4">
            <span>PORTAL VER: 4.10.2</span>
            <span style={{ color: 'rgba(239,68,68,0.5)' }}>CLASSIFICATION: CONFIDENTIAL</span>
          </div>
        </footer>

      </div>

      {/* ── Global login-page CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        #login-username, #login-password {
          background: transparent;
          border: none !important;
          box-shadow: none !important;
        }
        #sign-in-btn:not(:disabled) {
          background-size: 200% auto;
          transition: background-position 0.5s ease, box-shadow 0.3s ease, transform 0.15s ease;
        }
      `}</style>
    </>
  );
};

export default Login;
