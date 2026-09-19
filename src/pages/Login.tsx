import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Lock, Mail, AlertCircle, Loader2,
  ArrowRight, Hash, Shield, Send,
} from 'lucide-react';
import { authService } from '../lib/auth';
import type { Employee } from '../types';
import loginLogo from '../assets/login-logo.png';
import { PoweredByAiBadge } from '../components/PoweredByAiBadge';
import '../styles/login-light.css';

interface LoginProps {
  onLoginSuccess: (employee: Employee) => void;
}

const buildSha = import.meta.env.VITE_BUILD_SHA || 'local';
const DISPLAY_EMAIL =
  (import.meta.env.VITE_LOGIN_DISPLAY_EMAIL as string | undefined)?.trim() ||
  'nexus@malconnexus.com';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [adminMode, setAdminMode] = useState(false);

  const [employeeCode, setEmployeeCode] = useState('');
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleSendOtp = async () => {
    if (!employeeCode.trim()) {
      setError('Enter your Employee ID.');
      return;
    }
    setSendingOtp(true);
    resetMessages();

    const { error: otpError, message } = await authService.requestLoginOtp(employeeCode);
    setSendingOtp(false);

    if (otpError) {
      setError(otpError);
      return;
    }
    setInfo(message ?? 'Check Telegram for your 6-digit code.');
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode.trim() || !otp.trim()) {
      setError('Enter Employee ID and the OTP from Telegram.');
      return;
    }
    setLoading(true);
    resetMessages();

    const { employee, error: authError } = await authService.signInWithTelegramOtp(
      employeeCode,
      otp,
    );
    setLoading(false);

    if (authError || !employee) {
      setError(authError ?? 'Login failed. Please try again.');
      return;
    }
    onLoginSuccess(employee);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    resetMessages();

    const { employee, error: authError } = await authService.signIn(email, password);
    setLoading(false);

    if (authError || !employee) {
      setError(authError ?? 'Login failed. Please try again.');
      return;
    }
    onLoginSuccess(employee);
  };

  const switchMode = (admin: boolean) => {
    setAdminMode(admin);
    resetMessages();
  };

  return (
    <div className="nexus-login-page min-h-screen w-full max-w-full overflow-x-hidden flex flex-col lg:flex-row relative">
      <button
        type="button"
        onClick={() => switchMode(!adminMode)}
        className="nexus-login-admin-link absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 text-sm font-medium"
      >
        {adminMode ? (
          <>← Employee sign in</>
        ) : (
          <>
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Admin login
          </>
        )}
      </button>

      {/* ── Left panel (DMS-style hero) ── */}
      <div className="nexus-login-hero hidden lg:flex lg:w-[52%] xl:w-[55%] lg:min-w-0 relative flex-col justify-center p-12 xl:p-16 overflow-hidden border-r">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-lg text-left"
        >
          <img
            src={loginLogo}
            alt="Malcon Nexus by Malcon Life Sciences"
            className="w-full max-w-[300px] object-contain"
          />
          <PoweredByAiBadge variant="login" />
        </motion.div>
      </div>

      {/* ── Right form panel ── */}
      <div className="nexus-login-panel flex-1 min-w-0 w-full flex items-center justify-center px-4 py-6 sm:px-6 sm:py-10 lg:p-16 overflow-x-hidden pt-14 sm:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full min-w-0 max-w-[420px]"
        >
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img src={loginLogo} alt="Malcon Nexus" className="h-14 w-14 object-contain" />
            <p className="nexus-login-brand-name text-sm mt-3">Malcon Nexus</p>
            <p className="nexus-login-brand-sub text-xs mt-0.5">by Malcon Life Sciences</p>
            <div className="mt-4">
              <PoweredByAiBadge variant="pill" />
            </div>
          </div>

          <div className="hidden lg:flex justify-center mb-8">
            <img src={loginLogo} alt="Malcon Nexus" className="h-16 w-16 object-contain" />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="nexus-login-title">
              {adminMode ? 'Admin sign in' : 'Sign in'}
            </h1>
            {!adminMode && (
              <p className="nexus-login-muted text-sm mt-2">
                Use your Employee ID and OTP from Telegram.
              </p>
            )}
          </div>

          {adminMode ? (
            <form onSubmit={handleAdminSubmit} className="space-y-5 w-full min-w-0">
              <div className="min-w-0">
                <label htmlFor="login-email" className="nexus-login-label block mb-1.5">
                  Email
                </label>
                <div className="relative min-w-0">
                  <Mail className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    autoComplete="email"
                    required
                    className="nexus-login-input w-full min-w-0 max-w-full pl-10 pr-4 py-2.5 transition-all"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <label htmlFor="login-password" className="nexus-login-label block mb-1.5">
                  Password
                </label>
                <div className="relative min-w-0">
                  <Lock className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="nexus-login-input w-full min-w-0 max-w-full pl-10 pr-11 py-2.5 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="nexus-login-icon absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-80 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <LoginAlert variant="error">{error}</LoginAlert>}

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="nexus-login-submit w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmployeeSubmit} className="space-y-5 w-full min-w-0">
              <div className="min-w-0">
                <label htmlFor="login-email-display" className="nexus-login-label block mb-1.5">
                  Email
                </label>
                <div className="relative min-w-0">
                  <Mail className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <input
                    id="login-email-display"
                    type="email"
                    value={DISPLAY_EMAIL}
                    readOnly
                    tabIndex={-1}
                    className="nexus-login-input nexus-login-input-readonly w-full min-w-0 max-w-full pl-10 pr-4 py-2.5"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <label htmlFor="login-employee-code" className="nexus-login-label block mb-1.5">
                  Employee ID
                </label>
                <div className="relative min-w-0">
                  <Hash className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <input
                    id="login-employee-code"
                    type="text"
                    inputMode="numeric"
                    value={employeeCode}
                    onChange={(e) => {
                      setEmployeeCode(e.target.value);
                    }}
                    placeholder="e.g. 0165"
                    autoComplete="username"
                    required
                    className="nexus-login-input w-full min-w-0 max-w-full pl-10 pr-4 py-2.5 transition-all"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp || !employeeCode.trim()}
                className="nexus-login-secondary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send OTP on Telegram
                  </>
                )}
              </button>

              <div className="min-w-0">
                <label htmlFor="login-otp" className="nexus-login-label block mb-1.5">
                  OTP from Telegram
                </label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  required
                  className="nexus-login-input w-full min-w-0 max-w-full px-4 py-2.5 tracking-[0.2em] text-center font-medium transition-all"
                />
              </div>

              {info && !error && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                  {info}
                </p>
              )}
              {error && <LoginAlert variant="error">{error}</LoginAlert>}

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="nexus-login-submit w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="nexus-login-muted text-center mt-8 px-1 break-words">
            {adminMode ? (
              <span className="nexus-login-brand-name font-medium">Admin access only.</span>
            ) : (
              <>
                New to the app?{' '}
                <span className="nexus-login-brand-name font-medium">
                  Link Telegram via @Malcon_Nexus_bot with /start YOUR_ID.
                </span>
              </>
            )}
          </p>
          <p className="nexus-login-build text-center mt-3">Build {buildSha}</p>
        </motion.div>
      </div>
    </div>
  );
};

function LoginAlert({
  variant,
  children,
}: {
  variant: 'error';
  children: React.ReactNode;
}) {
  if (variant !== 'error') return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-200 bg-red-50"
    >
      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-600">{children}</p>
    </motion.div>
  );
}
