import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import { useToast } from '../../components/common/Toast';

const RiderDashboard = () => {
  const { rider, logoutRider } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [assignedOrders, setAssignedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'all' | 'delivered'
  const [failedModalOrder, setFailedModalOrder] = useState(null);
  const [failureReason, setFailureReason] = useState('Customer Not Available');
  const [submitting, setSubmitting] = useState(false);

  const fetchRiderOrders = async () => {
    if (!rider) return;
    setLoading(true);
    try {
      const res = await axios.get(`/ontime/rider/${rider.id || rider.mobile}/orders`);
      setAssignedOrders(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching rider orders:', err);
      setAssignedOrders([]);
      setLoading(false);
      toast.error('Failed to load rider orders');
    }
  };

  useEffect(() => {
    if (!rider) {
      navigate('/ontime/login');
      return;
    }
    fetchRiderOrders();
  }, [rider]);

  const safeAssignedOrders = Array.isArray(assignedOrders) ? assignedOrders : [];

  const handleUpdateStatus = async (orderId, status, reason = null) => {
    try {
      await axios.put(`/ontime/orders/${orderId}/rider-status`, {
        status,
        failureReason: reason
      });
      toast.success(`Order marked as "${status}"`);
      fetchRiderOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update delivery status');
    }
  };

  const handleConfirmFailure = async (e) => {
    e.preventDefault();
    if (!failedModalOrder) return;
    setSubmitting(true);
    await handleUpdateStatus(failedModalOrder.id, 'Delivery Failed', failureReason);
    setSubmitting(false);
    setFailedModalOrder(null);
  };

  // Metrics
  const todayCount = safeAssignedOrders.length;
  const pendingDeliveries = safeAssignedOrders.filter(o => {
    const s = (o.status || '').toLowerCase();
    return s === 'dispatched' || s === 'assigned rider' || s === 'out for delivery';
  });
  const completedDeliveries = safeAssignedOrders.filter(o => (o.status || '').toLowerCase() === 'delivered');

  // Filtered orders based on active tab
  const displayedOrders = safeAssignedOrders.filter(order => {
    const s = (order.status || '').toLowerCase();
    if (activeTab === 'pending') {
      return s === 'dispatched' || s === 'assigned rider' || s === 'out for delivery';
    }
    if (activeTab === 'delivered') {
      return s === 'delivered';
    }
    return true; // 'all'
  });

  const getNavigationUrl = (order) => {
    const mapUrlStr =
      (typeof order.address === 'object' && (order.address?.mapUrl || order.address?.maplink)) ||
      order.mapUrl ||
      order.maplink ||
      order.shippingDetails?.mapUrl ||
      order.shippingDetails?.maplink ||
      '';

    // 1. Try extracting precise coordinates from mapUrl
    if (mapUrlStr) {
      const decodedUrl = decodeURIComponent(mapUrlStr);

      // Match q=11.3427,77.6965 or query=11.3427,77.6965
      const qMatch = decodedUrl.match(/(?:q|query)=([-\d.]+)\s*,\s*([-\d.]+)/i);
      if (qMatch) {
        return `https://www.google.com/maps/dir/?api=1&destination=${qMatch[1]},${qMatch[2]}&travelmode=driving`;
      }

      // Match @11.3427,77.6965
      const atMatch = decodedUrl.match(/@([-\d.]+)\s*,\s*([-\d.]+)/);
      if (atMatch) {
        return `https://www.google.com/maps/dir/?api=1&destination=${atMatch[1]},${atMatch[2]}&travelmode=driving`;
      }

      // Match destination=...
      const destParam = decodedUrl.match(/destination=([^&]+)/i);
      if (destParam) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destParam[1])}&travelmode=driving`;
      }

      // Match raw coordinates string: "11.3427, 77.6965"
      const rawMatch = mapUrlStr.trim().match(/^([-\d.]+)\s*,\s*([-\d.]+)$/);
      if (rawMatch) {
        return `https://www.google.com/maps/dir/?api=1&destination=${rawMatch[1]},${rawMatch[2]}&travelmode=driving`;
      }

      // If it's a short link (like maps.app.goo.gl) or already a google maps URL
      if (mapUrlStr.startsWith('http://') || mapUrlStr.startsWith('https://')) {
        return mapUrlStr;
      }
    }

    // 2. Fallback to location text + landmark + pincode
    const locationStr =
      (typeof order.address === 'object' && (order.address?.location || order.address?.text || order.address?.street)) ||
      order.shippingDetails?.location ||
      order.deliveryAddress ||
      order.shippingDetails?.address ||
      '';

    const landmarkStr =
      (typeof order.address === 'object' && order.address?.landmark) ||
      order.landmark ||
      order.shippingDetails?.landmark ||
      '';

    const pincodeStr =
      (typeof order.address === 'object' && (order.address?.pincode || order.address?.Pincode)) ||
      order.shippingDetails?.pincode ||
      order.shippingDetails?.Pincode ||
      '';

    const destinationParts = [locationStr, landmarkStr, pincodeStr].filter(Boolean).join(', ').trim();
    if (destinationParts) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationParts)}&travelmode=driving`;
    }

    return null;
  };

  const handleStartNavigation = (order) => {
    const navUrl = getNavigationUrl(order);
    if (!navUrl) {
      toast.error('No delivery address or GPS coordinates available for this order.');
      return;
    }

    // Direct synchronous open ensures mobile browsers never block this as an unwanted popup
    const opened = window.open(navUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      // In case window.open is strictly blocked, navigate in current window
      window.location.assign(navUrl);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Sticky Mobile Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
            <MaterialIcon name="two_wheeler" size={24} />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-tight">OnTime Delivery</h1>
            <p className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <MaterialIcon name="person" size={13} />
              <span>{rider?.name || 'Active Rider'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRiderOrders}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl cursor-pointer active:scale-95 transition"
            title="Refresh Deliveries"
          >
            <MaterialIcon name="refresh" size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              logoutRider();
              toast.info('Logged out from Rider App');
              navigate('/ontime/login');
            }}
            className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition cursor-pointer active:scale-95"
            title="Log Out"
          >
            <MaterialIcon name="logout" size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-5">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`p-3 rounded-2xl border text-center transition cursor-pointer ${activeTab === 'all'
                ? 'bg-slate-800 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-slate-900 border-slate-800 hover:bg-slate-850'
              }`}
          >
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Total</span>
            <span className="text-xl font-black text-white">{todayCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`p-3 rounded-2xl border text-center transition cursor-pointer ${activeTab === 'pending'
                ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
              }`}
          >
            <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">Pending</span>
            <span className="text-xl font-black text-amber-400">{pendingDeliveries.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('delivered')}
            className={`p-3 rounded-2xl border text-center transition cursor-pointer ${activeTab === 'delivered'
                ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
              }`}
          >
            <span className="text-[10px] font-black uppercase text-emerald-400 block tracking-wider">Delivered</span>
            <span className="text-xl font-black text-emerald-400">{completedDeliveries.length}</span>
          </button>
        </div>

        {/* Deliveries Feed */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <MaterialIcon name="local_shipping" size={16} className="text-amber-400" />
              <span>
                {activeTab === 'pending' ? 'Pending Orders' : activeTab === 'delivered' ? 'Completed Deliveries' : 'All Assigned Orders'} ({displayedOrders.length})
              </span>
            </h2>
            <span className="text-[11px] text-slate-400 font-bold">Express Rider Mode</span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-2.5">
              <MaterialIcon name="refresh" size={32} className="animate-spin text-amber-400 mx-auto" />
              <p className="text-xs font-bold text-slate-300">Syncing assigned delivery orders...</p>
            </div>
          ) : displayedOrders.length === 0 ? (
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 text-center space-y-3 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <MaterialIcon name="inventory_2" size={32} />
              </div>
              <h3 className="text-base font-bold text-white">No deliveries in this section</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {activeTab === 'pending'
                  ? 'Great job! You have no pending deliveries right now.'
                  : 'Orders assigned by the Admin team will appear here.'}
              </p>
            </div>
          ) : (
            displayedOrders.map((order) => {
              const itemsList = Object.values(order.items || {});
              const phoneNum = order.customerMobile || order.shippingDetails?.phone || '';
              const orderAddr = order.address || {};
              const locationStr = (typeof order.address === 'object' && order.address?.location) || order.shippingDetails?.location || order.deliveryAddress || order.shippingDetails?.address || '';
              const landmarkStr = (typeof order.address === 'object' && order.address?.landmark) || order.landmark || order.shippingDetails?.landmark || '';
              const mapUrlStr = (typeof order.address === 'object' && (order.address?.mapUrl || order.address?.maplink)) || order.mapUrl || order.maplink || order.shippingDetails?.mapUrl || order.shippingDetails?.maplink || '';
              const pincodeStr = (typeof order.address === 'object' && (order.address?.pincode || order.address?.Pincode)) || order.shippingDetails?.pincode || order.shippingDetails?.Pincode || '';
              const addressStr = locationStr || 'No address specified';

              const isOut = order.status === 'Out For Delivery';
              const isDelivered = order.status === 'Delivered';
              const isFailed = order.status === 'Delivery Failed';

              return (
                <div
                  key={order.id}
                  className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-4 shadow-xl relative overflow-hidden"
                >
                  {/* Status Banner Stripe */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 ${isDelivered ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : isOut ? 'bg-amber-400' : 'bg-cyan-500'
                      }`}
                  />

                  {/* Top Row: Order ID & Status Badge */}
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black text-amber-400 tracking-wider">
                        #{order.id?.substring(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        • {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1 ${isDelivered
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isFailed
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isOut
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                              : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        }`}
                    >
                      <MaterialIcon
                        name={isDelivered ? 'check_circle' : isFailed ? 'cancel' : isOut ? 'near_me' : 'schedule'}
                        size={12}
                        fill
                      />
                      <span>{order.status}</span>
                    </span>
                  </div>

                  {/* Customer Info Card */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-black text-white">{order.userName || order.customerName || 'Customer'}</p>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px] uppercase border border-slate-700">
                        {order.paymentMethod || 'Cash On Delivery'}
                      </span>
                    </div>

                    {phoneNum && (
                      <p className="text-slate-300 font-bold flex items-center gap-1.5">
                        <MaterialIcon name="call" size={15} className="text-emerald-400" />
                        <span>+91 {phoneNum}</span>
                      </p>
                    )}

                    <div className="text-slate-300 leading-relaxed font-medium bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-start gap-1.5">
                        <span className="text-amber-400 shrink-0 mt-0.5">
                          <MaterialIcon name="location_on" size={16} />
                        </span>
                        <span className="text-xs text-slate-200">
                          {addressStr}
                          {pincodeStr ? ` - ${pincodeStr}` : ''}
                        </span>
                      </div>
                      {landmarkStr && (
                        <div className="flex items-center gap-1.5 pl-5 text-[11px] text-amber-300/90 font-medium">
                          <MaterialIcon name="flag" size={13} className="text-amber-400 shrink-0" />
                          <span>Landmark: {landmarkStr}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items List Accordion/Summary */}
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[10px]">
                      <span>Items ({itemsList.length})</span>
                      <span>
                        Order Total: <strong className="text-emerald-400 text-sm font-black">₹{order.total}</strong>
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800/60">
                      {itemsList.map((it, idx) => (
                        <div key={idx} className="py-1 text-slate-300 flex justify-between items-center">
                          <span className="font-medium text-slate-200">{it.itemName} <strong className="text-amber-400">×{it.quantity}</strong></span>
                          <span className="font-bold text-slate-300">₹{Number(it.price || 0) * it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.packingRemarks && (
                      <p className="text-[11px] text-amber-300/90 pt-1.5 border-t border-slate-800 flex items-start gap-1">
                        <MaterialIcon name="notes" size={14} className="shrink-0 mt-0.5" />
                        <span><strong>Note:</strong> {order.packingRemarks}</span>
                      </p>
                    )}
                  </div>

                  {/* Failure Alert Reason if failed */}
                  {isFailed && order.failureReason && (
                    <div className="bg-red-500/10 text-red-300 p-3 rounded-xl border border-red-500/20 text-xs font-semibold flex items-center gap-2">
                      <MaterialIcon name="error" size={16} className="text-red-400 shrink-0" />
                      <span>Failure Reason: <strong>{order.failureReason}</strong></span>
                    </div>
                  )}

                  {/* ERGONOMIC TOUCH TARGET ACTION BUTTONS */}
                  {!isDelivered && !isFailed && (
                    <div className="space-y-2 pt-1">
                      {/* Direct Call & Google Maps Navigation */}
                      <div className="grid grid-cols-2 gap-2">
                        {phoneNum ? (
                          <a
                            href={`tel:+91${phoneNum}`}
                            className="min-h-[46px] bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition border border-slate-700 active:scale-95 shadow-xs"
                          >
                            <span className="text-emerald-400 flex items-center">
                              <MaterialIcon name="call" size={18} />
                            </span>
                            <span>Call Customer</span>
                          </a>
                        ) : (
                          <button
                            disabled
                            className="min-h-[46px] bg-slate-800/40 text-slate-500 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-800 cursor-not-allowed"
                          >
                            <span>No Phone</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartNavigation(order)}
                          className="min-h-[46px] bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition border border-slate-700 active:scale-95 shadow-xs cursor-pointer"
                          title="Navigate to customer delivery destination"
                        >
                          <span className="text-cyan-400 flex items-center">
                            <MaterialIcon name="navigation" size={18} />
                          </span>
                          <span>Start Navigation</span>
                        </button>
                      </div>

                      {/* Main Delivery Status Progression */}
                      {!isOut ? (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'Out For Delivery')}
                          className="w-full min-h-[48px] bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                          <MaterialIcon name="two_wheeler" size={20} />
                          <span>Start Delivery (Out for Delivery)</span>
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'Delivered')}
                            className="min-h-[48px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <MaterialIcon name="check_circle" size={18} />
                            <span>Mark Delivered</span>
                          </button>

                          <button
                            onClick={() => setFailedModalOrder(order)}
                            className="min-h-[48px] bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <MaterialIcon name="cancel" size={18} />
                            <span>Delivery Failed</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed Confirmation State */}
                  {isDelivered && (
                    <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20 text-xs font-bold flex items-center justify-center gap-1.5">
                      <MaterialIcon name="check_circle" size={16} fill />
                      <span>Delivery Successfully Completed</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* DELIVERY FAILED REASON MODAL */}
      {failedModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-slate-900 text-white rounded-3xl p-6 space-y-4 border border-slate-800 shadow-2xl">
            <h3 className="text-base font-black flex items-center gap-2">
              <span className="text-red-500 flex items-center">
                <MaterialIcon name="error" size={22} />
              </span>
              <span>Delivery Failure Reason</span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Order #{failedModalOrder.id?.substring(0, 8).toUpperCase()} for {failedModalOrder.userName || 'Customer'}
            </p>

            <form onSubmit={handleConfirmFailure} className="space-y-4">
              <select
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="Customer Not Available">Customer Not Available</option>
                <option value="Wrong Address">Wrong Delivery Address</option>
                <option value="Customer Cancelled at Doorstep">Customer Cancelled at Doorstep</option>
                <option value="Customer Refused Payment">Customer Refused Payment</option>
                <option value="Premises Locked">Premises Locked</option>
                <option value="Other">Other Reason</option>
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFailedModalOrder(null)}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Confirm Delivery Failure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderDashboard;
