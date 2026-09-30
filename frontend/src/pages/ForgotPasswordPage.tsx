import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, KeyRound, ArrowRight, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

interface ForgotPasswordPageProps {
  navigate: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ navigate }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'REQUEST' | 'RESET'>('REQUEST');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.forgotPassword(email);
      setSuccessMsg(res.message || 'Password reset OTP dispatched.');
      setStep('RESET');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch password reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(email, otp, newPassword);
      setSuccessMsg('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP or failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-white flex flex-col justify-center p-4 relative py-12 selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-cyan-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full mx-auto mb-6 z-10">
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center space-x-2 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>BACK TO LOGIN</span>
        </button>
      </div>

      <div className="max-w-md w-full mx-auto glass-panel p-8 rounded-3xl border border-cyan-500/30 shadow-2xl relative z-10 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold font-display tracking-tight text-white uppercase">
            {step === 'REQUEST' ? 'RESET PASSWORD' : 'SET NEW PASSWORD'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            {step === 'REQUEST'
              ? 'Enter your registered email to receive a secure reset OTP'
              : `Enter the 6-digit code dispatched to ${email}`}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2 font-mono"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-start space-x-2 font-mono"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {step === 'REQUEST' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">Registered Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  placeholder="name@crisiscommand.demo"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold font-mono tracking-wider text-xs transition-all shadow-glow flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'SENDING RESET CODE...' : 'SEND RESET CODE'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">6-Digit Reset Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-cyan-500 text-cyan-300 text-sm tracking-widest font-mono text-center focus:outline-none"
                  placeholder="123456"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-black font-bold font-mono tracking-wider text-xs transition-all shadow-glow-emerald flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'UPDATING...' : 'RESET PASSWORD & LOGIN'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
