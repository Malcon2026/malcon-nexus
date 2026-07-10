import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Lock, Mail, AlertCircle, Loader2,
  Package, ArrowRight, Shield, Activity,
} from 'lucide-react';
import { authService } from '../lib/auth';
import type { Employee } from '../types';
import { malconLogo } from '../assets/malconLogo';

interface LoginProps {
  onLoginSuccess: (employee: Employee) => void;
}

const STAGES = [
  'Kit Prep',
  'Surgery',
  'Cleaning',
  'Audit',
  'Billing',
  'Collection',
];

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);

    const { employee, error: authError } = await authService.signIn(email, password);
    setLoading(false);

    if (authError || !employee) {
      setError(authError ?? 'Login failed. Please try again.');
      return;
    }
    onLoginSuccess(employee);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative bg-gray-950 flex-col justify-between p-12 overflow-hidden">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-indigo-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] bg-emerald-600/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3">
            <img src={malconLogo} alt="Malcon Life Sciences" className="h-12 w-12 rounded-xl object-contain bg-white p-1" />
            <div>
              <p className="text-white font-bold text-lg leading-none">Malcon Nexus</p>
              <p className="text-gray-400 text-xs mt-0.5">by Malcon Life Sciences</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 max-w-lg"
        >
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight">
            Implant workflow,
            <span className="text-gray-500"> from kit to collection.</span>
          </h2>
          <p className="text-gray-400 text-base mt-5 leading-relaxed">
            Track surgical cases across departments, manage approvals, and keep every implant case on schedule.
          </p>

          {/* Mini workflow strip */}
          <div className="mt-10 flex items-center gap-1">
            {STAGES.map((stage, i) => (
              <React.Fragment key={stage}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-white' : 'bg-gray-700'}`} />
                  <span className="text-[10px] text-gray-600 whitespace-nowrap hidden xl:block">{stage}</span>
                </motion.div>
                {i < STAGES.length - 1 && (
                  <div className="flex-1 h-px bg-gray-800 min-w-[12px]" />
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative z-10 flex items-center gap-6"
        >
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Shield className="h-3.5 w-3.5" />
            <span>Role-based access</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Activity className="h-3.5 w-3.5" />
            <span>Real-time case tracking</span>
          </div>
        </motion.div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src={malconLogo} alt="Malcon Life Sciences" className="h-9 w-9 rounded-lg object-contain bg-white p-0.5" />
            <div>
              <p className="text-gray-900 font-bold text-sm leading-none">Malcon Nexus</p>
              <p className="text-gray-400 text-[10px] mt-0.5">by Malcon Life Sciences</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1.5">Sign in to your workspace to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl"
              >
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm group"
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

          <p className="text-center text-xs text-gray-400 mt-8">
            Need access?{' '}
            <span className="text-gray-600 font-medium">Contact your administrator.</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
