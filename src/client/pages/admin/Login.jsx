import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import logoImg from '../../assets/logo.png';

const Login = () => {
  const { login, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [errorMsg, setErrorMsg] = useState(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('session_expired')) {
      return 'Admin session expired. Please sign in to continue.';
    }
    return '';
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password) {
      setErrorMsg('Please fill in both username and password.');
      return;
    }

    const res = await login(cleanUsername, password);
    if (res.success) {
      setFailedAttempts(0);
      toast.success(`Welcome back, ${cleanUsername}!`);
      navigate('/admin/dashboard');
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      const isLockoutOrSpecific = res.message?.includes('15 minutes') || res.message?.includes('Access denied');
      const attemptsLeft = Math.max(0, 10 - newAttempts);
      const msg = isLockoutOrSpecific || attemptsLeft === 0
        ? (res.message || 'Too many failed attempts. Please try again in 15 minutes.')
        : `${res.message || 'Invalid credentials.'} (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining)`;
      setErrorMsg(msg);
      toast.error(res.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D4715] via-[#1b5e20] to-[#2d4a22] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl space-y-6">

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner overflow-hidden">
            <img src={logoImg} alt="Buykart Logo" className="w-full h-full object-contain p-2" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Buykart Admin</h1>
          <p className="text-xs text-white/60">Sign in to manage your store</p>
        </div>

        {errorMsg && (
          <div role="alert" className="bg-red-500/20 border border-red-400/40 text-red-100 p-3.5 rounded-xl text-xs flex items-center gap-2.5">
            <MaterialIcon name="error" size={18} className="text-red-300 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="admin-username" className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 flex items-center pointer-events-none">
                <MaterialIcon name="person" size={20} />
              </span>
              <input
                id="admin-username"
                type="text"
                placeholder="Username or Phone Number"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 focus:border-white/50 transition text-sm font-medium"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 flex items-center pointer-events-none">
                <MaterialIcon name="lock" size={20} />
              </span>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 focus:border-white/50 transition text-sm font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition cursor-pointer flex items-center focus:outline-none focus:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E9762B] hover:bg-[#d6651d] text-white font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 mt-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" aria-label="Logging in..." />
            ) : (
              <>
                <MaterialIcon name="login" size={18} />
                <span>Log In</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-white/10">
          <p className="text-xs text-white/80">
            Don't have an account?{' '}
            <Link to="/admin/register" className="font-bold text-[#E9762B] hover:underline">
              Create New Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
