import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Lock, Mail, AlertCircle, Loader2,
  ArrowRight, Hash, Send,
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
  const [employeeCode, setEmployeeCode] = useState('');
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!employeeCode.trim()) {
      setEmployeeError('Enter your Employee ID.');
      setEmployeeInfo(null);
      return;
    }
    setSendingOtp(true);
    setEmployeeError(null);
    setEmployeeInfo(null);

    const { error: otpError, message } = await authService.requestLoginOtp(employeeCode);
    setSendingOtp(false);

    if (otpError) {
      setEmployeeError(otpError);
      return;
    }
    setEmployeeInfo(message ?? 'Check Telegram for your 6-digit code.');
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode.trim() || !otp.trim()) {
      setEmployeeError('Enter Employee ID and the OTP from Telegram.');
      return;
    }
    setEmployeeLoading(true);
    setEmployeeError(null);

    const { employee, error: authError } = await authService.signInWithTelegramOtp(
      employeeCode,
      otp,
    );
    setEmployeeLoading(false);

    if (authError || !employee) {
      setEmployeeError(authError ?? 'Login failed. Please try again.');
      return;
    }
    onLoginSuccess(employee);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setAdminError('Please enter your password.');
      return;
    }
    setAdminLoading(true);
    setAdminError(null);

    const { employee, error: authError } = await authService.signIn(DISPLAY_EMAIL, password);
    setAdminLoading(false);

    if (authError || !employee) {
      setAdminError(authError ?? 'Login failed. Please try again.');
      return;
    }
    onLoginSuccess(employee);
  };

  return (
    <div className="nexus-login-page min-h-screen w-full max-w-full overflow-x-hidden flex flex-col lg:flex-row">
      {/* ── Left panel (DMS-style hero) ── */}
      <div className="nexus-login-hero hidden lg:flex lg:w-[48%] xl:w-[50%] lg:min-w-0 relative flex-col justify-center p-12 xl:p-16 overflow-hidden border-r">
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

      {/* ── Right: two login sections ── */}
      <div className="nexus-login-panel flex-1 min-w-0 w-full flex items-center justify-center px-4 py-8 sm:px-6 lg:p-12 overflow-x-hidden">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full min-w-0 max-w-[480px]"
        >
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src={loginLogo} alt="Malcon Nexus" className="h-14 w-14 object-contain" />
            <p className="nexus-login-brand-name text-sm mt-3">Malcon Nexus</p>
            <p className="nexus-login-brand-sub text-xs mt-0.5">by Malcon Life Sciences</p>
            <div className="mt-4">
              <PoweredByAiBadge variant="pill" />
            </div>
          </div>

          <div className="hidden lg:flex justify-center mb-6">
            <img src={loginLogo} alt="Malcon Nexus" className="h-14 w-14 object-contain" />
          </div>

          <h1 className="nexus-login-title text-center lg:text-left mb-6">Sign in</h1>

          {/* ── Employee login ── */}
          <section className="nexus-login-section" aria-labelledby="employee-login-heading">
            <h2 id="employee-login-heading" className="nexus-login-section-title">
              Employee login
            </h2>
            <form onSubmit={handleEmployeeSubmit} className="space-y-4 w-full min-w-0">
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
                    onChange={(e) => setEmployeeCode(e.target.value)}
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
                    Send OTP via Telegram
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

              {employeeInfo && !employeeError && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                  {employeeInfo}
                </p>
              )}
              {employeeError && <LoginAlert>{employeeError}</LoginAlert>}

              <button
                type="submit"
                disabled={employeeLoading}
                className="nexus-login-submit w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                {employeeLoading ? (
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
          </section>

          <div className="nexus-login-section-divider" role="separator" aria-hidden />

          {/* ── Admin login ── */}
          <section className="nexus-login-section" aria-labelledby="admin-login-heading">
            <h2 id="admin-login-heading" className="nexus-login-section-title">
              Admin login
            </h2>
            <form onSubmit={handleAdminSubmit} className="space-y-4 w-full min-w-0">
              <div className="min-w-0">
                <label htmlFor="login-admin-email" className="nexus-login-label block mb-1.5">
                  Email
                </label>
                <div className="relative min-w-0">
                  <Mail className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <input
                    id="login-admin-email"
                    type="email"
                    value={DISPLAY_EMAIL}
                    readOnly
                    tabIndex={-1}
                    className="nexus-login-input nexus-login-input-readonly w-full min-w-0 max-w-full pl-10 pr-4 py-2.5"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <label htmlFor="login-admin-password" className="nexus-login-label block mb-1.5">
                  Password
                </label>
                <div className="relative min-w-0">
                  <Lock className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <input
                    id="login-admin-password"
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

              {adminError && <LoginAlert>{adminError}</LoginAlert>}

              <button
                type="submit"
                disabled={adminLoading}
                className="nexus-login-submit w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                {adminLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Admin sign in
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </section>

          <p className="nexus-login-muted text-center mt-8 px-1 break-words">
            Link Telegram: @Malcon_Nexus_bot →{' '}
            <span className="nexus-login-brand-name font-medium">/start YOUR_ID</span>
          </p>
          <p className="nexus-login-build text-center mt-3">Build {buildSha}</p>
        </motion.div>
      </div>
    </div>
  );
};

function LoginAlert({ children }: { children: React.ReactNode }) {
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
