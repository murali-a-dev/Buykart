import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';

const Register = () => {
  const { register, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.trim().replace(/\D/g, '');

    if (cleanName.length < 2) {
      setErrorMsg('Username must be at least 2 characters.');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (formData.password.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    const payload = {
      name: cleanName,
      phone: cleanPhone,
      password: formData.password,
      role: 'admin',
    };

    const res = await register(payload);
    if (res.success) {
      setSuccessMsg('Account created successfully! Redirecting to login...');
      toast.success('Account created successfully!');
      setTimeout(() => navigate('/admin/login'), 1500);
    } else {
      setErrorMsg(res.message || 'Registration failed');
      toast.error(res.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D4715] via-[#1b5e20] to-[#2d4a22] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/admin/login" className="text-white/80 hover:text-white flex items-center gap-1.5 text-xs font-bold transition">
            <MaterialIcon name="arrow_back" size={16} />
            <span>Back to Login</span>
          </Link>
          <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider">Registration</span>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Account</h1>
          <p className="text-xs text-emerald-100 font-medium">Join Buykart to manage store inventory and orders</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-400/40 text-red-100 p-3.5 rounded-xl text-xs flex items-center gap-2.5 backdrop-blur-sm">
            <span className="text-red-300 shrink-0">
              <MaterialIcon name="error" size={18} />
            </span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 p-3.5 rounded-xl text-xs flex items-center gap-2.5 backdrop-blur-sm font-bold">
            <span className="text-emerald-300 shrink-0">
              <MaterialIcon name="check_circle" size={18} fill />
            </span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 flex items-center pointer-events-none">
                <MaterialIcon name="person" size={20} />
              </span>
              <input
                type="text"
                placeholder="Choose username"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 focus:border-white/50 transition text-sm font-medium"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Phone Number</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 flex items-center pointer-events-none">
                <MaterialIcon name="call" size={20} />
              </span>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 focus:border-white/50 transition text-sm font-medium"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 flex items-center pointer-events-none">
                <MaterialIcon name="lock" size={20} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password (min 4 chars)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-11 pr-11 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 focus:border-white/50 transition text-sm font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition cursor-pointer flex items-center"
              >
                <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Confirm Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 flex items-center pointer-events-none">
                <MaterialIcon name="lock" size={20} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 focus:border-white/50 transition text-sm font-medium"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E9762B] hover:bg-[#d6651d] text-white font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 mt-2 active:scale-95"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
            ) : (
              <>
                <MaterialIcon name="person_add" size={18} />
                <span>Create Admin Account</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
