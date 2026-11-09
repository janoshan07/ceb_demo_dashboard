import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound, Zap, CircleAlert, LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import edlLogo from '../assets/edl_logo.jpg';
import edlIntro from '../assets/edl-intro.mp4';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);

  const navigate = useNavigate();
  const { login, loading, error, setError } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!introVisible) return undefined;

    const timer = window.setTimeout(() => setIntroVisible(false), shouldReduceMotion ? 100 : 5000);
    return () => window.clearTimeout(timer);
  }, [introVisible, shouldReduceMotion]);

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

  const floatTransition = (duration, delay = 0) => ({
    duration,
    delay,
    repeat: Infinity,
    repeatType: 'mirror',
    ease: 'easeInOut',
  });

  return (
    <>
      <AnimatePresence>
        {introVisible && (
          <motion.div
            className="auth-intro"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.55, ease: 'easeInOut' }}
            role="status"
            aria-label="EDL"
          >
            <video
              className="auth-intro-video"
              src={edlIntro}
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              onEnded={() => setIntroVisible(false)}
              onError={() => setIntroVisible(false)}
            >
            </video>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="auth-page min-h-screen" aria-hidden={introVisible} inert={introVisible}>
      <motion.section
        className="auth-frame mx-auto grid w-full max-w-6xl overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_24px_70px_-35px_rgba(30,51,48,0.28)] lg:min-h-[690px] lg:grid-cols-[1.03fr_0.97fr]"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.1 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="auth-brand relative flex min-h-[310px] flex-col overflow-hidden sm:min-h-[360px] lg:min-h-0" aria-label="Electricity Distribution Lanka">
          <div className="auth-grid absolute inset-0" aria-hidden="true" />
          <motion.div
            className="auth-orb auth-orb-one absolute rounded-full"
            aria-hidden="true"
            animate={shouldReduceMotion ? undefined : { y: [0, -10, 0], x: [0, 4, 0] }}
            transition={floatTransition(7)}
          />
          <motion.div
            className="auth-orb auth-orb-two absolute rounded-full"
            aria-hidden="true"
            animate={shouldReduceMotion ? undefined : { y: [0, 9, 0], x: [0, -4, 0] }}
            transition={floatTransition(8, 0.5)}
          />

          <div className="auth-brand-header relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm">
              <img src={edlLogo} alt="EDL" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-800">Electricity Distribution Lanka</p>
              <p className="mt-0.5 text-xs tracking-wide text-slate-500">SMART SOLAR DASHBOARD</p>
            </div>
          </div>

          <div className="auth-brand-copy relative z-10 max-w-lg">
            <div className="auth-brand-badge inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-emerald-900/80 shadow-sm backdrop-blur-sm">
              <Zap size={14} strokeWidth={2} aria-hidden="true" />
              <span>Reliable energy. Clearer decisions.</span>
            </div>
            <h1 className="max-w-md text-3xl font-semibold leading-[1.16] tracking-[-0.04em] text-slate-900 sm:text-4xl lg:text-[2.8rem]">
              A clearer view of your energy operations.
            </h1>
            <p className="auth-brand-description max-w-md text-sm leading-7 text-slate-600 sm:text-base">
              Your workspace for customer billing, solar insights, and day-to-day operations.
            </p>
          </div>

          <div className="auth-brand-footer relative z-10 flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
            <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>SECURE ACCESS FOR AUTHORIZED PERSONNEL</span>
          </div>
        </section>

        <section className="auth-login-panel flex items-center justify-center">
          <div className="auth-login-content w-full max-w-[410px]">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.1 : 0.45, delay: shouldReduceMotion ? 0 : 0.12 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Your account</p>
              <h2 className="auth-login-title text-[1.8rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[2rem]">Welcome back</h2>
              <p className="auth-login-subtitle text-sm leading-6 text-slate-500">Sign in to continue to your dashboard.</p>
            </motion.div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key="login-error"
                  role="alert"
                  aria-live="polite"
                  className="auth-error-banner flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm leading-5 text-rose-800"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: -7, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -5, height: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0.1 : 0.2 }}
                >
                  <CircleAlert className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} autoComplete="off" className="auth-form-fields">
              <div>
                <label htmlFor="login-username" className="auth-field-label text-sm font-medium text-slate-700">
                  Username / Employee ID
                </label>
                <div className="auth-input-wrap">
                  <UserRound className="auth-input-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    id="login-username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => { setUsername(e.target.value); clearErr(); }}
                    disabled={loading}
                    className="auth-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="auth-field-label text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="auth-input-wrap">
                  <LockKeyhole className="auth-input-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearErr(); }}
                    disabled={loading}
                    className="auth-input auth-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="auth-password-toggle"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showPw}
                  >
                    {showPw ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                  </button>
                </div>
              </div>

              <div className="auth-options flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-800 focus:ring-emerald-700" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-sm font-medium text-emerald-800 transition-colors hover:text-emerald-950">
                  Forgot password?
                </a>
              </div>

              <motion.button
                id="edl-login-btn"
                type="submit"
                disabled={loading}
                className="auth-submit group flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(6,78,59,0.55)] transition-colors hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-70"
                whileHover={loading || shouldReduceMotion ? undefined : { y: -1, scale: 1.005 }}
                whileTap={loading || shouldReduceMotion ? undefined : { scale: 0.99 }}
                transition={{ duration: 0.16 }}
              >
                {loading ? (
                  <>
                    <LoaderCircle
                      size={17}
                      className="shrink-0"
                      aria-hidden="true"
                      {...(shouldReduceMotion ? {} : {
                        animate: { rotate: 360 },
                        transition: { duration: 0.9, repeat: Infinity, ease: 'linear' },
                      })}
                    />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" size={17} strokeWidth={2} aria-hidden="true" />
                  </>
                )}
              </motion.button>
            </form>

            <div className="auth-legal border-t border-slate-100 text-center">
              <p className="text-xs leading-5 text-slate-400">
                © 2026 Electricity Distribution Lanka (Pvt) Ltd.
                <br />
                Authorized personnel only. All access is monitored.
              </p>
            </div>
          </div>
        </section>
      </motion.section>
      </main>
    </>
  );
};

export default Login;
