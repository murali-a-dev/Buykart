import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../components/common/Toast';
import CustomerAuthModal from '../../components/website/CustomerAuthModal';
import MapLocationPickerModal from '../../components/website/MapLocationPickerModal';
import MaterialIcon from '../../components/common/MaterialIcon';

const Account = () => {
  const { customer, logoutCustomer, loginCustomer } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, confirm } = useToast();

  const [activeTab, setActiveTab] = useState('PROFILE'); // 'PROFILE' | 'ADDRESSES' | 'ORDERS' | 'SUPPORT'
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  // Profile Form State
  const [name, setName] = useState(customer?.name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [mobile, setMobile] = useState(customer?.mobile || '');

  // Addresses State (Structured: location, mapUrl, landmark, pincode)
  const getInitialAddresses = () => {
    if (Array.isArray(customer?.address) && customer.address.length > 0) return customer.address;
    if (Array.isArray(customer?.addresses) && customer.addresses.length > 0) return customer.addresses;
    if (customer?.address && typeof customer.address === 'object') return [customer.address];
    return [];
  };
  const [addresses, setAddresses] = useState(getInitialAddresses());
  const [addressTag, setAddressTag] = useState('Home'); // 'Home' | 'Work' | 'Other'
  const [addressLocation, setAddressLocation] = useState('');
  const [addressLandmark, setAddressLandmark] = useState('');
  const [addressMaplink, setAddressMaplink] = useState('');
  const [addressPincode, setAddressPincode] = useState('');
  const [editingAddressIndex, setEditingAddressIndex] = useState(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Copy Feedback
  const [copiedText, setCopiedText] = useState(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setEmail(customer.email || '');
      setMobile(customer.mobile || '');

      let list = Array.isArray(customer.addresses) ? [...customer.addresses] : [];
      if (list.length === 0 && customer.address && (customer.address.location || customer.address.Pincode)) {
        list = [customer.address];
      }
      setAddresses(list);
    }
  }, [customer]);

  // Fetch customer orders for summary & active order spotlight
  useEffect(() => {
    const fetchOrders = async () => {
      if (!customer) return;
      setLoadingOrders(true);
      try {
        const params = new URLSearchParams();
        if (customer.id) params.append('customerId', customer.id);
        if (customer.mobile) params.append('mobile', customer.mobile);
        const res = await axios.get(`/website/orders?${params.toString()}`);
        if (Array.isArray(res.data)) {
          setOrders(res.data);
        }
      } catch (e) {
        // silent fail
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchOrders();
  }, [customer]);

  // Calculate Active Delivery in Progress (if any)
  const activeOrder = useMemo(() => {
    return orders.find((o) => {
      const s = String(o.status || '').toLowerCase();
      return s !== 'delivered' && s !== 'cancelled' && s !== 'delivery failed';
    });
  }, [orders]);

  // Profile completion score
  const completionScore = useMemo(() => {
    let score = 40; // Mobile verified
    if (name && name.trim().length > 2) score += 30;
    if (email && email.includes('@')) score += 15;
    if (addresses && addresses.length > 0) score += 15;
    return score;
  }, [name, email, addresses]);

  if (!customer) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center bg-slate-50/70 px-4 py-12">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200/80 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-50 text-[#0D4715] rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
            <MaterialIcon name="manage_accounts" size={34} />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900">My Account</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Log in with your mobile phone number to manage your personal details, delivery addresses, and view live order tracking.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2 text-left">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
              <MaterialIcon name="bolt" size={18} className="text-emerald-700 mb-1" />
              <p className="font-bold text-slate-800">30-Min Delivery</p>
              <p className="text-[10px] text-slate-400">Express delivery to your doorstep</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
              <MaterialIcon name="receipt" size={18} className="text-emerald-700 mb-1" />
              <p className="font-bold text-slate-800">Instant Invoices</p>
              <p className="text-[10px] text-slate-400">View tax receipts anytime</p>
            </div>
          </div>

          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-3.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <MaterialIcon name="lock" size={16} />
            <span>Login with Mobile OTP</span>
          </button>
        </div>

        {authModalOpen && (
          <CustomerAuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        )}
      </div>
    );
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    // FIX: Validate email format before sending to server
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        did: customer.did || customer.id,
        id: customer.id || customer.did,
        name: name.trim(),
        mobile: String(mobile).trim(),
        email: email ? String(email).trim() : '',
        address: addresses,
        addresses
      };
      const res = await axios.post('/website/customer/profile', payload);
      setSaving(false);
      loginCustomer(res.data.customer, res.data.token);
      setEditingProfile(false);
      showSuccess('Profile updated successfully!');
    } catch (err) {
      setSaving(false);
      showError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  // Helper to normalize address objects and fallback legacy strings
  const normalizeAddress = (rawAddr) => {
    if (!rawAddr) return { tag: 'Home', location: '', mapUrl: '', landmark: '', pincode: '' };
    if (typeof rawAddr === 'object') {
      return {
        tag: rawAddr.tag || 'Home',
        location: rawAddr.location || rawAddr.text || rawAddr.street || '',
        mapUrl: rawAddr.mapUrl || rawAddr.maplink || rawAddr.mapLink || '',
        landmark: rawAddr.landmark || '',
        pincode: rawAddr.pincode || rawAddr.Pincode || '',
      };
    }

    let str = String(rawAddr || '').trim();
    let tag = 'Home';
    const tagMatch = str.match(/^\[(.*?)\]\s*(.*)$/);
    if (tagMatch) {
      tag = tagMatch[1];
      str = tagMatch[2].trim();
    }
    let pincode = '';
    const pinMatch = str.match(/(?:[-,\s]+(?:Pincode|Pin|PIN)?[:\s]*)?(\b\d{6}\b)\s*$/i);
    if (pinMatch) {
      pincode = pinMatch[1];
      str = str.replace(/(?:[-,\s]+(?:Pincode|Pin|PIN)?[:\s]*)?\b\d{6}\b\s*$/i, '').trim();
      str = str.replace(/[-,\s]+$/, '').trim();
    }
    return { tag, location: str, mapUrl: '', landmark: '', pincode };
  };

  const handleStartAddAddress = () => {
    setEditingAddressIndex(null);
    setAddressTag('Home');
    setAddressLocation('');
    setAddressMaplink('');
    setAddressLandmark('');
    setAddressPincode('');
    setIsAddingAddress(true);
  };

  const handleStartEditAddress = (idx) => {
    const parsed = normalizeAddress(addresses[idx]);
    setAddressTag(parsed.tag || 'Home');
    setAddressLocation(parsed.location || '');
    setAddressMaplink(parsed.mapUrl || '');
    setAddressLandmark(parsed.landmark || '');
    setAddressPincode(parsed.pincode || '');
    setEditingAddressIndex(idx);
    setIsAddingAddress(true);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const link = `https://maps.google.com/?q=${latitude},${longitude}`;
        setAddressMaplink(link);
        setDetectingLocation(false);
        showSuccess('Live GPS Location Link captured!');
      },
      (err) => {
        setDetectingLocation(false);
        showError('Unable to retrieve GPS coordinates. Please paste your Google Maps link.');
      },
      { timeout: 10000 }
    );
  };

  const handleConfirmMapLocation = ({ mapUrl, formattedAddress, pincode, landmark }) => {
    if (mapUrl) setAddressMaplink(mapUrl);
    if (!addressLocation.trim() && formattedAddress) {
      setAddressLocation(formattedAddress);
    }
    if (!addressPincode.trim() && pincode) {
      setAddressPincode(pincode);
    }
    if (!addressLandmark.trim() && landmark) {
      setAddressLandmark(landmark);
    }
    showSuccess('Delivery location selected on map!');
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addressLocation.trim()) {
      showError('Please enter your delivery location.');
      return;
    }
    if (addressPincode.trim() && !/^\d{6}$/.test(addressPincode.trim())) {
      showError('Please enter a valid 6-digit delivery pincode.');
      return;
    }

    const newObj = {
      tag: addressTag || 'Home',
      location: addressLocation.trim(),
      mapUrl: addressMaplink.trim(),
      landmark: addressLandmark.trim(),
      pincode: addressPincode.trim()
    };

    let updated;
    const wasEditing = editingAddressIndex !== null && editingAddressIndex >= 0;
    if (wasEditing) {
      updated = [...addresses];
      updated[editingAddressIndex] = newObj;
    } else {
      updated = [...addresses, newObj];
    }

    setAddresses(updated);
    setAddressLocation('');
    setAddressMaplink('');
    setAddressLandmark('');
    setAddressPincode('');
    setEditingAddressIndex(null);
    setIsAddingAddress(false);

    try {
      const payload = {
        did: customer.did || customer.id,
        id: customer.id || customer.did,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        address: updated,
        addresses: updated
      };
      const res = await axios.post('/website/customer/profile', payload);
      loginCustomer(res.data.customer, res.data.token);
      showSuccess(wasEditing ? 'Delivery address updated successfully!' : 'Delivery address saved successfully!');
    } catch (e) {
      showError('Failed to save address.');
    }
  };

  const handleDeleteAddress = (index) => {
    confirm({
      title: 'Remove Delivery Address',
      message: 'Are you sure you want to remove this delivery address from your profile?',
      confirmText: 'Remove Address',
      isDanger: true,
      onConfirm: async () => {
        const updated = addresses.filter((_, i) => i !== index);
        setAddresses(updated);
        try {
          const payload = {
            id: customer.id,
            name: customer.name,
            mobile: customer.mobile,
            email: customer.email,
            addresses: updated
          };
          const res = await axios.post('/website/customer/profile', payload);
          loginCustomer(res.data.customer, res.data.token);
          showSuccess('Address removed.');
        } catch (e) {
          showError('Failed to remove address.');
        }
      }
    });
  };

  const handleCopyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleLogout = () => {
    confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to log out of your Buykart account?',
      confirmText: 'Sign Out',
      isDanger: true,
      onConfirm: () => {
        logoutCustomer();
        showSuccess('Logged out successfully.');
        navigate('/');
      }
    });
  };

  return (
    <div className="bg-slate-50/60 min-h-screen py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">

        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <Link to="/" className="hover:text-slate-700 transition">Home</Link>
          <span>/</span>
          <span className="text-slate-700 font-bold">My Account</span>
        </div>

        {/* HERO BANNER CARD */}
        <div className="bg-gradient-to-br from-[#0D4715] via-emerald-800 to-teal-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-emerald-900">

          {/* Subtle Background Glow Orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-xl pointer-events-none translate-y-1/2"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">

            {/* User Avatar & Identity */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl sm:text-3xl font-black text-white shadow-inner">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-emerald-900 shadow-xs" title="Verified Customer">
                  <MaterialIcon name="verified" size={14} filled />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {customer.name || 'Valued Customer'}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-100/90 font-medium pt-0.5">
                  <span className="flex items-center gap-1 font-bold bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
                    <MaterialIcon name="call" size={13} className="text-emerald-300" />
                    <span>+91 {customer.mobile}</span>
                  </span>

                  {customer.email ? (
                    <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
                      <MaterialIcon name="mail" size={13} className="text-emerald-300" />
                      <span>{customer.email}</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveTab('PROFILE');
                        setEditingProfile(true);
                      }}
                      className="text-emerald-200 hover:text-white underline text-[11px] cursor-pointer"
                    >
                      + Add email for invoices
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Action & Fast Summary Stats */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-stretch md:self-auto">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 bg-red-500/60 hover:bg-red-600 active:scale-95 text-white px-4 py-3 rounded-2xl text-xs font-bold transition border border-white/15 cursor-pointer shadow-xs"
                title="Sign out of your account"
              >
                <MaterialIcon name="logout" size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE IN-FLIGHT ORDER SPOTLIGHT (If order is active) */}
        {activeOrder && (
          <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border border-amber-300/80 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#0D4715] text-white flex items-center justify-center shrink-0 shadow-sm">
                <MaterialIcon name="two_wheeler" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                    Active Delivery
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    #BK-{activeOrder.id?.substring(0, 8).toUpperCase()}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  Order Status: {activeOrder.status}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {activeOrder.assignedRiderName
                    ? `Delivery Partner ${activeOrder.assignedRiderName} is assigned to your items.`
                    : 'Your grocery order is currently being fulfilled by the hub.'}
                </p>
              </div>
            </div>

            <Link
              to="/my-orders"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-xs font-bold rounded-xl shadow-sm transition shrink-0 cursor-pointer"
            >
              <span>Track Live Delivery</span>
              <MaterialIcon name="arrow_forward" size={16} />
            </Link>
          </div>
        )}

        {/* TAB SEGMENTED NAVIGATION */}
        <div className="grid grid-cols-4 gap-2 bg-white p-2 rounded-2xl shadow-xs border border-slate-200">
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`py-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer ${activeTab === 'PROFILE'
              ? 'bg-[#0D4715] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <MaterialIcon name="person" size={18} />
            <span className='sm:block hidden'>Profile Details</span>
          </button>

          <button
            onClick={() => setActiveTab('ADDRESSES')}
            className={`py-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer ${activeTab === 'ADDRESSES'
              ? 'bg-[#0D4715] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <MaterialIcon name="location_on" size={18} />
            <span className='sm:block hidden'>Addresses ({addresses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`py-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer ${activeTab === 'ORDERS'
              ? 'bg-[#0D4715] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <MaterialIcon name="receipt_long" size={18} />
            <span className='sm:block hidden'>Orders ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('SUPPORT')}
            className={`py-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer ${activeTab === 'SUPPORT'
              ? 'bg-[#0D4715] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <MaterialIcon name="support_agent" size={18} />
            <span className='sm:block hidden'>Support & Help</span>
          </button>
        </div>

        {/* TAB 1: PROFILE DETAILS */}
        {activeTab === 'PROFILE' && (
          <div className="space-y-6">

            {/* Profile Info Form / Cards */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <MaterialIcon name="badge" size={20} className="text-[#0D4715]" />
                    Personal & Account Details
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Manage your identity, verified contact mobile number, and receipt email.
                  </p>
                </div>

                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-[#0D4715] hover:bg-emerald-100 text-xs font-bold transition border border-emerald-200/80 cursor-pointer shadow-2xs"
                  >
                    <MaterialIcon name="edit" size={16} />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {/* View / Edit Mode */}
              {!editingProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">

                  {/* Name Tile */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <MaterialIcon name="person" size={18} className="text-slate-500" />
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Full Name</span>
                    </div>
                    <p className="text-sm font-black text-slate-900">{name || 'Not provided'}</p>
                    <p className="text-[11px] text-slate-400">Used for orders & invoice identification</p>
                  </div>

                  {/* Phone Tile */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <div className="flex items-center gap-2">
                        <MaterialIcon name="call" size={18} className="text-slate-500" />
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Phone Number</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded-md">
                        <MaterialIcon name="verified" size={11} filled /> Verified
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-900">+91 {mobile}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <span>🔒</span> Verified number — cannot be changed without re-login
                    </p>
                  </div>

                  {/* Email Tile */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 space-y-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <MaterialIcon name="mail" size={18} className="text-slate-500" />
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Email Address</span>
                    </div>
                    <p className="text-sm font-black text-slate-900 truncate">
                      {email || <span className="text-slate-400 font-normal italic">No email linked</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">Digital tax receipts & invoices</p>
                  </div>

                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-6 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 focus:border-[#0D4715] focus:ring-1 focus:ring-[#0D4715] transition shadow-2xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                        Mobile Number (OTP Verified)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          disabled
                          value={`+91 ${mobile}`}
                          className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 cursor-not-allowed"
                        />
                        <MaterialIcon name="verified" size={20} className="absolute right-3.5 text-emerald-600" filled />
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Mobile number is tied to your login account.
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. name@example.com (for order invoices)"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 focus:border-[#0D4715] focus:ring-1 focus:ring-[#0D4715] transition shadow-2xs"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Digital receipts will be sent here upon successful delivery.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(false)}
                      className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: SAVED DELIVERY ADDRESSES */}
        {activeTab === 'ADDRESSES' && (
          <div className="space-y-6">

            {/* Header with Add Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <MaterialIcon name="location_on" size={20} className="text-[#0D4715]" />
                  Saved Delivery Addresses
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Save your home, office, and frequent delivery destinations for instant 1-click checkout.
                </p>
              </div>

              {!isAddingAddress && (
                <button
                  onClick={handleStartAddAddress}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
                >
                  <MaterialIcon name="add_location_alt" size={16} />
                  <span>Add New Address</span>
                </button>
              )}
            </div>

            {/* Add / Edit Address Form Accordion */}
            {isAddingAddress && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-200 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <MaterialIcon
                      name={editingAddressIndex !== null ? 'edit_location_alt' : 'add'}
                      size={17}
                      className="text-[#0D4715]"
                    />
                    <span>{editingAddressIndex !== null ? 'Edit Delivery Address' : 'New Delivery Destination'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingAddress(false);
                      setEditingAddressIndex(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveAddress} className="space-y-4">
                  {/* Address Type Chips & Pincode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Address Type Chips */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2">
                        Address Type
                      </label>
                      <div className="flex items-center gap-2">
                        {[
                          { label: 'Home', icon: 'home' },
                          { label: 'Work', icon: 'business' },
                          { label: 'Other', icon: 'place' }
                        ].map((t) => (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => setAddressTag(t.label)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${addressTag === t.label
                              ? 'bg-[#0D4715] text-white border-[#0D4715] shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                          >
                            <MaterialIcon name={t.icon} size={15} />
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pincode Input */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2">
                        Pincode <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <MaterialIcon name="pin_drop" size={18} className="absolute left-3.5 text-slate-400" />
                        <input
                          type="text"
                          maxLength={6}
                          value={addressPincode}
                          onChange={(e) => setAddressPincode(e.target.value.replace(/\D/g, ''))}
                          placeholder="6-digit Pincode (e.g. 638011)"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-[#0D4715] focus:ring-1 focus:ring-[#0D4715] transition shadow-2xs"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Complete Location / Street Details */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2">
                      Location / Street Address <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={addressLocation}
                      onChange={(e) => setAddressLocation(e.target.value)}
                      placeholder="House / Flat No., Apartment / Building, Street, Area & City"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-[#0D4715] focus:ring-1 focus:ring-[#0D4715] transition shadow-2xs"
                      required
                    />
                  </div>

                  {/* Landmark & Google Maps Link Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Landmark */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2">
                        Nearby Landmark
                      </label>
                      <div className="relative flex items-center">
                        <MaterialIcon name="flag" size={18} className="absolute left-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={addressLandmark}
                          onChange={(e) => setAddressLandmark(e.target.value)}
                          placeholder="e.g. Near Bus Stand, Opp Temple"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-[#0D4715] focus:ring-1 focus:ring-[#0D4715] transition shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Google Maps Link with Choose on Map (Amazon style) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
                          Google Maps Link (mapUrl)
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsMapPickerOpen(true)}
                          className="text-[11px] font-bold text-[#0D4715] hover:text-[#1b5e20] bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200/60 flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                        >
                          <MaterialIcon name="map" size={14} filled />
                          <span>Choose on Map</span>
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <MaterialIcon name="map" size={18} className="absolute left-3.5 text-slate-400" />
                        <input
                          type="url"
                          value={addressMaplink}
                          onClick={() => setIsMapPickerOpen(true)}
                          onChange={(e) => setAddressMaplink(e.target.value)}
                          placeholder="Click to choose on map or paste Google Maps link"
                          className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-[#0D4715] focus:ring-1 focus:ring-[#0D4715] transition shadow-2xs cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => setIsMapPickerOpen(true)}
                          className="absolute right-2 px-2.5 py-1 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <MaterialIcon name="edit_location_alt" size={13} />
                          <span>Pick</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                    >
                      {editingAddressIndex !== null ? 'Update Address' : 'Save Address'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingAddress(false);
                        setEditingAddressIndex(null);
                      }}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Saved Addresses Cards Grid (hidden while editing or adding an address) */}
            {!isAddingAddress && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                {addresses.map((rawAddr, idx) => {
                  const { tag, location, landmark, mapUrl, pincode } = normalizeAddress(rawAddr);
                  const tagIcon = tag.toLowerCase() === 'work' ? 'business' : tag.toLowerCase() === 'other' ? 'place' : 'home';
                  const isCurrentlyEditing = isAddingAddress && editingAddressIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`bg-white p-5 rounded-3xl shadow-xs border flex flex-col justify-between gap-4 transition group ${
                        isCurrentlyEditing
                          ? 'border-[#0D4715] ring-2 ring-emerald-100 shadow-sm'
                          : 'border-slate-200/90 hover:shadow-sm'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-md border border-emerald-200/70">
                              <MaterialIcon name={tagIcon} size={12} />
                              <span>{tag}</span>
                            </span>

                            {pincode && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                <MaterialIcon name="pin_drop" size={11} className="text-slate-500" />
                                <span>PIN: {pincode}</span>
                              </span>
                            )}

                            {idx === 0 && (
                              <span className="text-[10px] font-bold text-slate-400">
                                Default
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEditAddress(idx)}
                              className="text-slate-400 hover:text-[#0D4715] p-1.5 rounded-lg hover:bg-emerald-50 transition cursor-pointer"
                              title="Edit delivery address"
                            >
                              <MaterialIcon name="edit" size={16} />
                            </button>

                            <button
                              onClick={() => handleDeleteAddress(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Remove address"
                            >
                              <MaterialIcon name="delete" size={16} />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                          {location}
                        </p>

                        {landmark && (
                          <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/70 font-semibold">
                            <MaterialIcon name="flag" size={13} className="text-amber-600" />
                            <span>Landmark: {landmark}</span>
                          </div>
                        )}

                        {mapUrl && (
                          <div className="pt-1">
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                            >
                              <MaterialIcon name="map" size={14} className="text-emerald-700" />
                              <span>View on Google Maps &rarr;</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {addresses.length === 0 && (
                  <div className="md:col-span-2 bg-white p-12 rounded-3xl text-center border border-slate-200/80 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200/60">
                      <MaterialIcon name="wrong_location" size={28} />
                    </div>
                    <h4 className="text-base font-black text-slate-800">No Saved Delivery Addresses</h4>
                    <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                      Add your home or office address to enable 1-click hyperlocal delivery at checkout.
                    </p>
                    <button
                      onClick={() => setIsAddingAddress(true)}
                      className="inline-block mt-2 px-5 py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      + Add Your First Address
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 3: RECENT ORDERS & RECEIPTS PREVIEW */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <MaterialIcon name="receipt_long" size={20} className="text-[#0D4715]" />
                  Orders & Receipts Overview
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Track deliveries, download itemized tax invoices, and repeat orders.
                </p>
              </div>

              <Link
                to="/my-orders"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
              >
                <span>View All In My Orders</span>
                <MaterialIcon name="open_in_new" size={15} />
              </Link>
            </div>

            {/* Orders Summary Cards */}
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.slice(0, 3).map((order) => {
                  const itemsList = Object.values(order.items || {});
                  const orderTotal = order.total || itemsList.reduce(
                    (sum, i) => sum + Number(i.price || 0) * (i.quantity || 1),
                    0
                  );
                  const dateStr = order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                    : 'Recent';

                  return (
                    <div
                      key={order.id}
                      className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0D4715] flex items-center justify-center shrink-0 border border-emerald-100">
                          <MaterialIcon name="shopping_bag" size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-800">
                              #BK-{order.id?.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                              {order.status || 'Placed'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {dateStr} • {itemsList.length} {itemsList.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-base font-black text-[#0D4715]">
                          ₹{Number(orderTotal).toLocaleString('en-IN')}
                        </span>
                        <Link
                          to="/my-orders"
                          className="text-xs font-bold text-slate-600 hover:text-[#0D4715] flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200"
                        >
                          <span>Track / Invoice</span>
                          <MaterialIcon name="chevron_right" size={16} />
                        </Link>
                      </div>
                    </div>
                  );
                })}

                <div className="text-center pt-2">
                  <Link
                    to="/my-orders"
                    className="text-xs font-bold text-[#0D4715] hover:underline inline-flex items-center gap-1"
                  >
                    <span>View all {orders.length} orders & tax receipts</span>
                    <MaterialIcon name="arrow_forward" size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-3xl text-center border border-slate-200/80 space-y-3">
                <MaterialIcon name="receipt_long" size={32} className="text-slate-400 mx-auto" />
                <h4 className="text-base font-black text-slate-800">No Orders Yet</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  When you place an order, live tracking, status updates, and digital receipts will show here.
                </p>
                <Link
                  to="/"
                  className="inline-block mt-2 px-5 py-2.5 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Start Shopping
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HELP, FAQS & SUPPORT */}
        {activeTab === 'SUPPORT' && (
          <div className="space-y-6">

            {/* Quick Contact Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* WhatsApp Support */}
              <a
                href="https://wa.me/916383217328?text=Hi%20Buykart%20Support,%20I%20need%20assistance%20with%20my%20account"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:border-emerald-500 hover:shadow-md transition space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition">
                  <MaterialIcon name="chat" size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition">
                    WhatsApp Live Support
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Connect instantly with our customer care executive on WhatsApp for fast query resolution.
                  </p>
                  <span className="inline-block mt-3 text-xs font-bold text-emerald-700">
                    Chat on +91 6383217328 &rarr;
                  </span>
                </div>
              </a>

              {/* Email Support */}
              <a
                href="mailto:support@buykart.in?subject=Customer%20Support%20Inquiry"
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:border-emerald-500 hover:shadow-md transition space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition">
                  <MaterialIcon name="mail" size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition">
                    Email Customer Care
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Send us your detailed inquiries, business queries, or billing questions.
                  </p>
                  <span className="inline-block mt-3 text-xs font-bold text-blue-700">
                    support@buykart.in &rarr;
                  </span>
                </div>
              </a>

            </div>

            {/* Frequently Asked Questions */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <MaterialIcon name="quiz" size={20} className="text-[#0D4715]" />
                Frequently Asked Questions
              </h3>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-3">
                  <p className="font-bold text-slate-800">How fast is Buykart hyperlocal delivery?</p>
                  <p className="text-slate-500 mt-1 font-medium leading-relaxed">
                    Most orders are freshly packaged and delivered within 15–30 minutes depending on your proximity to the nearest fulfillment hub.
                  </p>
                </div>

                <div className="py-3">
                  <p className="font-bold text-slate-800">How do I download my order tax invoice?</p>
                  <p className="text-slate-500 mt-1 font-medium leading-relaxed">
                    Navigate to <Link to="/my-orders" className="text-[#0D4715] font-bold underline">My Orders</Link>, click the "Receipt" button on any order card, and select "Print Invoice" to view or download a clean 1-page A4 PDF invoice.
                  </p>
                </div>

                <div className="py-3">
                  <p className="font-bold text-slate-800">What if an item is damaged or missing?</p>
                  <p className="text-slate-500 mt-1 font-medium leading-relaxed">
                    Simply tap the "Order Support" WhatsApp button or email us with your Order ID within 24 hours for instant refund or redelivery.
                  </p>
                </div>
              </div>
            </div>

            {/* Account Danger Zone */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Account Session</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Sign out of this browser session. Your cart and orders remain safely linked to your mobile.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition cursor-pointer self-start sm:self-auto"
              >
                Sign Out Account
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Amazon-style Map Location Picker Modal */}
      <MapLocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        initialMapUrl={addressMaplink}
        onConfirmLocation={handleConfirmMapLocation}
        title="Choose Delivery Address on Map"
      />
    </div>
  );
};

export default Account;
