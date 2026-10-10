import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import { useToast } from '../../components/common/Toast';

const RiderLogin = () => {
  const { loginRider } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState('MOBILE'); // 'MOBILE' | 'OTP'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      toast.warning('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    try {
      await axios.post('/ontime/rider/send-otp', { mobile: cleanMobile });
    } catch (err) {
      // Allow proceeding even if network hiccup
    }
    toast.info(`Code sent to +91 ${cleanMobile}`);
    setStep('OTP');
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) {
      setError('Please enter the 4-digit OTP');
      return;
    }
    setError('');
    setLoading(true);

    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);

    try {
      let res;
      try {
        res = await axios.post('/ontime/rider/verify-otp', { mobile: cleanMobile, otp });
      } catch (err) {
        res = await axios.post('/ontime/verify-otp', { mobile: cleanMobile, otp });
      }
      setLoading(false);
      loginRider(res.data.rider, res.data.token);
      toast.success(`Welcome, Rider ${res.data.rider?.name || ''}!`);
      setTimeout(() => navigate('/ontime/dashboard'), 500);
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || 'Rider login failed. Please check mobile & OTP.';
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
            <MaterialIcon name="two_wheeler" size={34} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">OnTime Rider App</h1>
          <p className="text-xs text-slate-400 font-medium">Buykart Express Delivery Fleet Portal</p>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-300 border border-red-500/30 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span className="text-red-400 shrink-0">
              <MaterialIcon name="error" size={18} />
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: MOBILE */}
        {step === 'MOBILE' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Registered Rider Mobile
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 10-digit mobile"
                  className="w-full pl-14 pr-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Get Rider Login OTP</span>
              <MaterialIcon name="arrow_forward" size={18} />
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-slate-950 p-3 rounded-xl text-xs text-slate-300 border border-slate-800 flex justify-between items-center">
              <span>OTP sent to <strong>+91 {mobile}</strong></span>
              <button
                type="button"
                onClick={() => setStep('MOBILE')}
                className="text-amber-400 font-bold hover:underline cursor-pointer"
              >
                Change Number
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Enter 4-Digit Rider OTP
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
                  <MaterialIcon name="pin" size={20} />
                </span>
                <input
                  type="text"
                  maxLength={4}
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="CODE"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-xl font-black tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-950 border-t-transparent"></span>
              ) : (
                <>
                  <MaterialIcon name="check_circle" size={18} />
                  <span>Verify & Open Rider Dashboard</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Info Note & Fast Links */}
        <div className="pt-3 border-t border-slate-800 text-center space-y-2.5">
          <p className="text-[11px] text-slate-400">
            ℹ️ Rider accounts are created by Admin in <strong className="text-slate-300">Rider Fleet Management</strong>.
          </p>
          <div className="flex justify-center gap-4 text-xs font-bold pt-1">
            <Link to="/" className="text-emerald-400 hover:underline flex items-center gap-1">
              <MaterialIcon name="storefront" size={14} />
              <span>Customer Store</span>
            </Link>
            <span className="text-slate-600">•</span>
            <Link to="/admin/dashboard" className="text-amber-400 hover:underline flex items-center gap-1">
              <MaterialIcon name="dashboard" size={14} />
              <span>Admin Panel</span>
            </Link>
          </div>
          <div className="pt-2 text-[10px] text-slate-500 font-medium">
            <span>OnTime Fleet App • Powered by Buykart</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RiderLogin;
