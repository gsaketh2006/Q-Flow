import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/auth';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err?.detail || 'Failed to process request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-radial from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-inner mb-3">
            <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              QF
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">QFlow</h1>
          <p className="text-slate-400 text-sm mt-1">Queue Management Platform</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
          {submitted ? (
            /* Success state */
            <div className="text-center py-4">
              <div className="inline-flex p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Check Your Inbox</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                If <span className="text-indigo-400 font-medium">{email}</span> is registered,
                you'll receive a password reset link within a few minutes.
              </p>
              <p className="text-slate-500 text-xs mt-3">
                Remember to check your spam folder.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="flex items-center gap-2 mb-6">
                <Link
                  to="/login"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Back to login"
                >
                  <ArrowLeft size={16} />
                </Link>
                <div>
                  <h2 className="text-xl font-bold text-white">Forgot Password</h2>
                  <p className="text-slate-400 text-xs mt-0.5">We'll send you a reset link</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-2xl">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      id="forgot-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-500 transition-all"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="forgot-submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending Link...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <p className="text-center text-slate-500 text-xs mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
