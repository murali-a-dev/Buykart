import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import MaterialIcon from '../common/MaterialIcon';

const DispatchModal = ({ order, isOpen, onClose, onSuccess }) => {
  if (!isOpen || !order) return null;

  const [riders, setRiders] = useState([]);
  const [selectedRiderId, setSelectedRiderId] = useState(order.assignedRiderId || '');
  const [riderMobile, setRiderMobile] = useState(order.assignedRiderMobile || '');
  const [riderName, setRiderName] = useState(order.assignedRiderName || '');
  const [vehicleDetails, setVehicleDetails] = useState(order.vehicleDetails || '');
  const [dispatchTime, setDispatchTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [error, setError] = useState('');

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      const orig = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchRiders = async () => {
      setRidersLoading(true);
      try {
        const res = await axios.get('/admin/riders');
        const activeRiders = (res.data || []).filter(
          (r) => !r.status || r.status.toLowerCase() === 'active'
        );
        setRiders(activeRiders);

        // Auto-select if order already had assigned rider or match
        if (order.assignedRiderId) {
          const matched = activeRiders.find((r) => r.id === order.assignedRiderId);
          if (matched) {
            handleSelectRider(matched);
          }
        }
      } catch (err) {
        console.error('Error loading riders:', err);
      } finally {
        setRidersLoading(false);
      }
    };
    if (isOpen) {
      fetchRiders();
    }
  }, [isOpen, order.assignedRiderId]);

  const handleSelectRider = (rider) => {
    if (!rider) return;
    setSelectedRiderId(rider.id);
    setRiderName(rider.name);
    setRiderMobile(rider.mobile || '');
    setVehicleDetails(rider.bikeNumber ? `Bike: ${rider.bikeNumber}` : '');
    setError('');
  };

  const handleSetCurrentTime = () => {
    setDispatchTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // Filter riders based on search query
  const filteredRiders = useMemo(() => {
    if (!searchQuery.trim()) return riders;
    const q = searchQuery.toLowerCase().trim();
    return riders.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.mobile || '').includes(q) ||
        (r.bikeNumber || '').toLowerCase().includes(q)
    );
  }, [riders, searchQuery]);

  const selectedRiderObj = useMemo(
    () => riders.find((r) => r.id === selectedRiderId),
    [riders, selectedRiderId]
  );

  const handleConfirmDispatch = async (e) => {
    e.preventDefault();
    if (!selectedRiderId) {
      setError('Please select an active delivery rider from the list.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await axios.put(`/admin/orders/${order.id}/dispatch`, {
        riderId: selectedRiderId,
        riderName,
        riderMobile,
        vehicleDetails,
        dispatchTime,
      });
      setLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || 'Failed to dispatch order');
    }
  };

  const customerName = order.userName || order.customerName || 'Customer';
  const customerMobile = order.customerMobile || order.shippingDetails?.phone || '';
  const destinationAddress =
    order.deliveryAddress ||
    (typeof order.address === 'object' ? order.address?.location : order.address) ||
    order.shippingDetails?.address ||
    'Address on file';
  const landmark =
    (typeof order.address === 'object' ? order.address?.landmark : order.landmark) ||
    order.shippingDetails?.landmark ||
    '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 text-white p-5 shrink-0 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold border border-cyan-500/30 shadow-inner">
              <MaterialIcon name="two_wheeler" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">Dispatch Order</h3>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  #{order.id?.substring(0, 8).toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Assign an active OnTime delivery partner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <MaterialIcon name="close" size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleConfirmDispatch} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2.5">
              <MaterialIcon name="error" size={18} className="text-rose-600 shrink-0" filled />
              <span>{error}</span>
            </div>
          )}

          {/* Destination Brief Preview Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Customer & Destination
              </span>
              <span className="font-black text-slate-900 font-mono text-xs">
                ₹{order.total || 0} ({order.paymentMethod || 'COD'})
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <span>{customerName}</span>
              {customerMobile && (
                <span className="text-slate-500 font-medium text-[11px]">
                  • +91 {customerMobile}
                </span>
              )}
            </div>
            <p className="text-slate-600 leading-snug truncate">
              {destinationAddress}
              {landmark ? ` (Landmark: ${landmark})` : ''}
            </p>
          </div>

          {/* MODERN RIDER SELECTION SECTION */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                Select Active Delivery Rider <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200/60">
                {filteredRiders.length} Active {filteredRiders.length === 1 ? 'Rider' : 'Riders'}
              </span>
            </div>

            {/* Quick Search Rider Filter */}
            <div className="relative">
              <MaterialIcon name="search" size={18} className="absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rider by name, mobile, or bike number..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <MaterialIcon name="close" size={15} />
                </button>
              )}
            </div>

            {/* Rider Cards List */}
            {ridersLoading ? (
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-3 bg-white rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200" />
                      <div className="space-y-1.5">
                        <div className="w-24 h-3 bg-slate-200 rounded" />
                        <div className="w-32 h-2.5 bg-slate-100 rounded" />
                      </div>
                    </div>
                    <div className="w-16 h-6 bg-slate-200 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : riders.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-2xl text-center space-y-1">
                <MaterialIcon name="warning" size={20} className="text-amber-600 mx-auto" />
                <p>No active riders found.</p>
                <p className="text-[11px] text-amber-700 font-normal">
                  Please add riders in the Admin Rider Master panel before dispatching orders.
                </p>
              </div>
            ) : filteredRiders.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center rounded-2xl">
                No riders match "<strong>{searchQuery}</strong>"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {filteredRiders.map((r) => {
                  const isSelected = selectedRiderId === r.id;
                  const initials = (r.name || 'R')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelectRider(r)}
                      className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-50/90 to-emerald-50/60 border-cyan-600 shadow-xs ring-2 ring-cyan-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rider Avatar with Online Status Indicator */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs transition ${
                              isSelected
                                ? 'bg-cyan-700 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {initials}
                          </div>
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-2xs"
                            title="Active & Ready"
                          />
                        </div>

                        {/* Rider Details */}
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-xs truncate">
                            {r.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <MaterialIcon name="call" size={11} className="text-slate-400" />
                            <span>+91 {r.mobile}</span>
                          </p>
                          {r.bikeNumber && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5">
                              <MaterialIcon name="two_wheeler" size={11} className="text-slate-400" />
                              <span className="truncate">{r.bikeNumber}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selection Radio / Check Indicator */}
                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center shadow-xs">
                            <MaterialIcon name="check" size={15} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-slate-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assigned Rider Highlight Banner (when selected) */}
          {selectedRiderObj && (
            <div className="bg-gradient-to-r from-cyan-900 to-slate-900 text-white p-3.5 rounded-2xl border border-cyan-800 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center font-black text-xs shrink-0">
                  <MaterialIcon name="badge" size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider block">
                    Assigned Delivery Partner
                  </span>
                  <p className="font-black text-white text-xs truncate">
                    {selectedRiderObj.name} • +91 {selectedRiderObj.mobile}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 px-2 py-0.5 rounded-md">
                OnTime Sync
              </span>
            </div>
          )}

          {/* Editable Rider Contact & Dispatch Timings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Rider Contact Mobile <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <MaterialIcon name="call" size={16} className="absolute left-3 text-slate-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={riderMobile}
                  onChange={(e) => setRiderMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Dispatch Time
                </label>
                <button
                  type="button"
                  onClick={handleSetCurrentTime}
                  className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-0.5 cursor-pointer"
                >
                  <MaterialIcon name="schedule" size={11} />
                  <span>Now</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <MaterialIcon name="access_time" size={16} className="absolute left-3 text-slate-400" />
                <input
                  type="text"
                  value={dispatchTime}
                  onChange={(e) => setDispatchTime(e.target.value)}
                  placeholder="e.g. 09:30 PM"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Vehicle / Bike Registration Details
            </label>
            <div className="relative flex items-center">
              <MaterialIcon name="two_wheeler" size={16} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                value={vehicleDetails}
                onChange={(e) => setVehicleDetails(e.target.value)}
                placeholder="e.g. Hero Splendor (TN 33 AB 1234)"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition"
              />
            </div>
          </div>

          <div className="bg-cyan-50/70 p-3 rounded-2xl border border-cyan-200/80 text-xs text-cyan-950 font-medium leading-relaxed flex items-center gap-2.5">
            <MaterialIcon name="bolt" size={18} className="text-cyan-700 shrink-0" filled />
            <span>
              Once confirmed, this order immediately transitions to <strong>Out for Delivery</strong> and notifies the rider on their <strong>OnTime Rider Dashboard</strong>.
            </span>
          </div>

          {/* Action Footer Buttons */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedRiderId}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-700 to-slate-900 hover:from-cyan-800 hover:to-slate-950 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <MaterialIcon
                name={loading ? 'sync' : 'send'}
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              <span>{loading ? 'Dispatching Order...' : 'Confirm Dispatch & Out for Delivery'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DispatchModal;
