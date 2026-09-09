import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package, ShieldCheck, Lock, Mail, Loader2, ArrowRight, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || 'Invalid operator credentials. Please verify your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillAndSubmit = async (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(presetEmail, presetPass);
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || 'Invalid operator credentials. Please verify your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA] text-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden select-none">
      
      {/* Subtle Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6 relative z-10"
      >
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 mb-1">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warehouse Intelligence</h1>
          <p className="text-xs text-slate-500">Enterprise Operator & Command Center Portal</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium animate-pulse">
            <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Operator Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@wms-intel.io"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Session...</span>
              </>
            ) : (
              <>
                <span>Sign In to Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Preset Buttons */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            Demo Operator Accounts (1-Click Sign-In)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillAndSubmit('supervisor@wms-intel.io', 'password123')}
              disabled={isSubmitting}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 text-[11px] font-medium rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Supervisor</span>
            </button>
            <button
              type="button"
              onClick={() => fillAndSubmit('operator@wms-intel.io', 'password123')}
              disabled={isSubmitting}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-[11px] font-medium rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Operator</span>
            </button>
            <button
              type="button"
              onClick={() => fillAndSubmit('admin@wms-intel.io', 'password123')}
              disabled={isSubmitting}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-[11px] font-medium rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500 font-mono">
          Strict Multi-Tenant Scoping • SHA256 / JWT Auth Active
        </div>
      </motion.div>
    </div>
  );
};
