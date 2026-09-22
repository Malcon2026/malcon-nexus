import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Lock, Mail, AlertCircle, Loader2,
  ArrowRight, Hash, Shield, Send,
} from 'lucide-react';
import { authService } from '../lib/auth';
import type { Employee } from '../types';
import loginLogo from '../assets/login-logo.png';
import { LoginQuoteAside, LoginQuoteMobile } from '../components/LoginQuoteAside';
import { NumericKeypad, NumericReadout, OtpDigitBoxes } from '../components/NumericKeypad';
import '../styles/login-light.css';

interface LoginProps {
  onLoginSuccess: (employee: Employee) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [adminMode, setAdminMode] = useState(false);

  const [adminEmail, setAdminEmail] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const EMPLOYEE_ID_MAX = 6;
  const OTP_LENGTH = 6;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearMessages = () => setError(null);

  const switchMode = (admin: boolean) => {
    setAdminMode(admin);
    setOtpStep(false);
    setOtp('');
    clearMessages();
  };

  const backToEmployeeId = () => {
    setOtpStep(false);
    setOtp('');
    clearMessages();
  };

  const handleSendOtp = async () => {
    if (!employeeCode.trim()) {
      setError('Enter your Employee ID.');
      return;
    }
    setSendingOtp(true);
    clearMessages();

    const { error: otpError } = await authService.requestLoginOtp(employeeCode);
    setSendingOtp(false);

    if (otpError) {
      setError(otpError);
      return;
    }
    setOtpStep(true);
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpStep) {
      await handleSendOtp();
      return;
    }

    if (!employeeCode.trim() || otp.length !== OTP_LENGTH) {
      setError('Enter the 6-digit code from Telegram.');
      return;
    }
    setLoading(true);
    clearMessages();

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
    if (!adminEmail.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    clearMessages();

    const { employee, error: authError } = await authService.signIn(adminEmail, password);
    setLoading(false);

    if (authError || !employee) {
      setError(authError ?? 'Login failed. Please try again.');
      return;
    }
    onLoginSuccess(employee);
  };

  return (
    <div className="nexus-login-page min-h-[100dvh] w-full max-w-full overflow-x-hidden flex flex-col lg:flex-row relative">
      <button
        type="button"
        onClick={() => switchMode(!adminMode)}
        className="nexus-login-admin-link absolute top-4 right-4 sm:top-6 sm:right-6 z-20 inline-flex items-center gap-1.5 text-sm font-medium"
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

      <LoginQuoteAside className="hidden lg:flex lg:w-[46%] xl:w-[48%] shrink-0 p-12 xl:p-16" />

      <div className="nexus-login-panel flex-1 min-w-0 flex items-center justify-center px-4 py-12 sm:px-8 sm:py-14 lg:p-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full min-w-0 max-w-[420px]"
        >
          <div className="lg:hidden flex items-center gap-3 mb-6 pr-24">
            <img src={loginLogo} alt="" className="h-10 w-10 object-contain shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="nexus-login-brand-name text-sm leading-tight">Malcon Nexus</p>
              <p className="nexus-login-brand-sub text-xs mt-0.5">Malcon Life Sciences</p>
            </div>
          </div>

          <LoginQuoteMobile />

          <h1 className="nexus-login-title mb-6 pr-20 sm:pr-24">
            {adminMode ? 'Admin sign in' : 'Sign in'}
          </h1>

          {adminMode ? (
            <form onSubmit={handleAdminSubmit} className="space-y-5 w-full min-w-0">
              <div className="min-w-0">
                <label htmlFor="login-admin-email" className="nexus-login-label block mb-1.5">
                  Email
                </label>
                <div className="relative min-w-0">
                  <Mail className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" />
                  <input
                    id="login-admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@company.com"
                    autoComplete="email"
                    required
                    className="nexus-login-input w-full min-w-0 max-w-full pl-10 pr-4 py-2.5 transition-all"
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

              {error && <LoginAlert>{error}</LoginAlert>}

              <button
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
              {!otpStep ? (
                <>
                  <div className="relative min-w-0">
                    <NumericReadout
                      id="login-employee-code"
                      label="Employee ID"
                      value={employeeCode}
                      placeholder="e.g. 0165"
                      maxLength={EMPLOYEE_ID_MAX}
                      icon={<Hash className="h-4 w-4" />}
                    />
                  </div>

                  <NumericKeypad
                    value={employeeCode}
                    onChange={setEmployeeCode}
                    maxLength={EMPLOYEE_ID_MAX}
                    disabled={sendingOtp}
                  />

                  {error && <LoginAlert>{error}</LoginAlert>}

                  <button
                    type="submit"
                    disabled={sendingOtp || !employeeCode.trim()}
                    className="nexus-login-submit w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
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
                </>
              ) : (
                <>
                  <div className="min-w-0 space-y-3">
                    <p className="nexus-login-label text-center mb-0">Code from Telegram</p>
                    <OtpDigitBoxes value={otp} length={OTP_LENGTH} />
                    <p className="text-xs text-center text-gray-500">
                      Use the keypad below — no need to switch keyboard on your phone.
                    </p>
                  </div>

                  <NumericKeypad
                    value={otp}
                    onChange={setOtp}
                    maxLength={OTP_LENGTH}
                    disabled={loading}
                  />

                  {error && <LoginAlert>{error}</LoginAlert>}

                  <button
                    type="submit"
                    disabled={loading || otp.length !== OTP_LENGTH}
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

                  <button
                    type="button"
                    onClick={backToEmployeeId}
                    className="nexus-login-admin-link w-full text-center text-sm py-1"
                  >
                    Change Employee ID
                  </button>
                </>
              )}
            </form>
          )}

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
