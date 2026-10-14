import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import MaterialIcon from '../common/MaterialIcon';
import MapLocationPickerModal from './MapLocationPickerModal';

const CustomerAuthModal = ({ isOpen, onClose, onSuccess }) => {
  const { loginCustomer } = useAuth();

  const [step, setStep] = useState('MOBILE'); // 'MOBILE' | 'OTP' | 'PROFILE'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    location: '',
    landmark: '',
    mapUrl: '',
    maplink: '',
    pincode: ''
  });
  const [detectingGps, setDetectingGps] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  // Lock background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const link = `https://maps.google.com/?q=${latitude},${longitude}`;
        setProfileData((prev) => ({ ...prev, mapUrl: link, maplink: link }));
        setDetectingGps(false);
        showToast('Live GPS Location captured in Map URL!');
      },
      () => {
        setDetectingGps(false);
        setErrorMessage('Unable to retrieve GPS coordinates. You can paste a Google Maps link manually.');
      },
      { timeout: 10000 }
    );
  };

  const handleConfirmMapLocation = ({ mapUrl, formattedAddress, pincode, landmark }) => {
    setProfileData((prev) => ({
      ...prev,
      mapUrl: mapUrl || prev.mapUrl,
      maplink: mapUrl || prev.maplink,
      location: !prev.location?.trim() && formattedAddress ? formattedAddress : prev.location,
      pincode: !prev.pincode?.trim() && pincode ? pincode : prev.pincode,
      landmark: !prev.landmark?.trim() && landmark ? landmark : prev.landmark,
    }));
    showToast('Delivery location selected on map!');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    try {
      let res;
      try {
        res = await axios.post('/website/customer/send-otp', { mobile: cleanMobile });
      } catch (err) {
        res = await axios.post('/customer/send-otp', { mobile: cleanMobile });
      }
      setLoading(false);
      // FIX: OTP is never returned from server — it is sent to the user's phone only
      showToast(`OTP sent to ${cleanMobile}. Please check your phone.`);
      setStep('OTP');
    } catch (err) {
      setLoading(false);
      setErrorMessage(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) {
      setErrorMessage('Please enter the 4-digit OTP');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await axios.post('/website/customer/verify-otp', { mobile, otp });
      setLoading(false);
      const { isNew, customer, token } = res.data;

      // Always save session credentials so subsequent profile update is authorized
      if (customer && token) {
        loginCustomer(customer, token);
      }

      if (isNew || !customer?.name) {
        showToast('OTP Verified! Please complete your profile.');
        setStep('PROFILE');
      } else {
        showToast(`Welcome back, ${customer.name}!`);
        if (onSuccess) onSuccess(customer);
        setTimeout(() => onClose(), 600);
      }
    } catch (err) {
      setLoading(false);
      setErrorMessage(err.response?.data?.message || 'Invalid OTP');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileData.name.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    try {
      const addressObj = {
        location: profileData.location.trim(),
        mapUrl: (profileData.mapUrl || profileData.maplink || '').trim(),
        landmark: profileData.landmark.trim(),
        pincode: profileData.pincode.trim()
      };

      const payload = {
        name: profileData.name.trim(),
        mobile,
        email: profileData.email.trim(),
        address: addressObj.location || addressObj.mapUrl ? [addressObj] : [],
        addresses: addressObj.location || addressObj.mapUrl ? [addressObj] : []
      };

      const res = await axios.post('/website/customer/profile', payload);
      setLoading(false);
      loginCustomer(res.data.customer, res.data.token);
      showToast('Profile completed successfully!');
      if (onSuccess) onSuccess(res.data.customer);
      setTimeout(() => onClose(), 600);
    } catch (err) {
      setLoading(false);
      setErrorMessage(err.response?.data?.message || 'Failed to save profile');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="bg-[#0D4715] text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md">
            <span className="flex items-center gap-2">
              <MaterialIcon name="check_circle" size={16} className="text-emerald-400" filled />
              {toastMessage}
            </span>
            <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white p-1 cursor-pointer">
              <MaterialIcon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0D4715] to-[#1b5e20] text-white p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <MaterialIcon name="close" size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center font-bold text-white border border-white/20 shadow-inner">
              <MaterialIcon name="phone_iphone" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Customer Access</h3>
              <p className="text-xs text-emerald-200 font-medium">Quick and secure OTP login</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {errorMessage && (
            <div className="mb-4 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-2">
              <MaterialIcon name="error" size={16} className="text-rose-600 shrink-0" filled />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: MOBILE NUMBER */}
          {step === 'MOBILE' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Phone Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 text-sm font-black">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit mobile"
                    className="w-full pl-14 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D4715]"
                    required
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 font-medium">
                  We will send a 4-digit verification code to this mobile.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-bold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Sending Code...' : (
                  <>
                    <span>Send Verification Code</span>
                    <MaterialIcon name="arrow_forward" size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: VERIFY OTP */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-xs text-emerald-800 font-medium flex items-center justify-between">
                <span>Code sent to <strong className="text-[#0D4715]">+91 {mobile}</strong></span>
                <button
                  type="button"
                  onClick={() => setStep('MOBILE')}
                  className="underline text-emerald-700 font-bold ml-1 cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Enter 4-Digit Code
                  </label>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400">
                    <MaterialIcon name="lock" size={18} />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="CODE"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xl font-black tracking-widest text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D4715]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-bold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </form>
          )}

          {/* STEP 3: COMPLETE PROFILE */}
          {step === 'PROFILE' && (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="text-xs text-slate-600 font-medium mb-1">
                Please complete your customer profile to place orders & track delivery.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400">
                    <MaterialIcon name="person" size={16} />
                  </div>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    placeholder="e.g. Murali Krishna"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0D4715]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address (Optional)</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400">
                    <MaterialIcon name="mail" size={16} />
                  </div>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    placeholder="murali@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0D4715]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Delivery Location / Street *</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400">
                    <MaterialIcon name="location_on" size={16} />
                  </div>
                  <input
                    type="text"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    placeholder="Flat / House No, Street name"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0D4715]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Landmark</label>
                  <input
                    type="text"
                    value={profileData.landmark}
                    onChange={(e) => setProfileData({ ...profileData, landmark: e.target.value })}
                    placeholder="Near water tank"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0D4715]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pincode</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={profileData.pincode}
                    onChange={(e) => setProfileData({ ...profileData, pincode: e.target.value.replace(/\D/g, '') })}
                    placeholder="600001"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0D4715]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Map Link (mapUrl)</label>
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="text-[11px] font-bold text-[#0D4715] hover:text-[#1b5e20] bg-emerald-50 hover:bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-200/60 flex items-center gap-1 cursor-pointer transition"
                  >
                    <MaterialIcon name="map" size={13} filled />
                    <span>Choose on Map</span>
                  </button>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400">
                    <MaterialIcon name="map" size={16} />
                  </div>
                  <input
                    type="url"
                    value={profileData.mapUrl || profileData.maplink}
                    onClick={() => setIsMapPickerOpen(true)}
                    onChange={(e) => setProfileData({ ...profileData, mapUrl: e.target.value, maplink: e.target.value })}
                    placeholder="Click to choose on map or paste map link"
                    className="w-full pl-9 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0D4715] cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="absolute right-1.5 px-2 py-1 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-0.5"
                  >
                    <MaterialIcon name="edit_location_alt" size={12} />
                    <span>Pick</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-bold text-xs rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving Profile...' : 'Save & Complete Profile'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Amazon-style Map Location Picker Modal */}
      <MapLocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        initialMapUrl={profileData.mapUrl || profileData.maplink}
        onConfirmLocation={handleConfirmMapLocation}
        title="Choose Delivery Address on Map"
      />
    </div>
  );
};

export default CustomerAuthModal;
