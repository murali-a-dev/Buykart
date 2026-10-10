import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import PackingModal from '../../components/admin/PackingModal';
import DispatchModal from '../../components/admin/DispatchModal';
import OrderPackingSlipModal from '../../components/admin/OrderPackingSlipModal';
import { useToast } from '../../components/common/Toast';
import MaterialIcon from '../../components/common/MaterialIcon';

const STATUS_STAGES = [
  'Pending',
  'Accepted',
  'Packing',
  'Packed',
  'Dispatched',
  'Out For Delivery',
  'Delivered',
  'Delivery Failed',
  'Cancelled'
];

const STEPPER_STAGES = [
  { id: 'placed', label: 'Placed', fullLabel: 'Order Placed', icon: 'receipt_long' },
  { id: 'accepted', label: 'Accepted', fullLabel: 'Accepted', icon: 'thumb_up' },
  { id: 'packed', label: 'Packed', fullLabel: 'Packed', icon: 'inventory_2' },
  { id: 'dispatched', label: 'Dispatched', fullLabel: 'Dispatched', icon: 'two_wheeler' },
  { id: 'delivered', label: 'Delivered', fullLabel: 'Delivered', icon: 'check_circle' },
];

/**
 * Returns a deterministic gradient background for customer avatars
 */
const getAvatarGradient = (name = '') => {
  const gradients = [
    'from-blue-600 to-indigo-600',
    'from-emerald-600 to-teal-700',
    'from-purple-600 to-pink-600',
    'from-amber-600 to-orange-600',
    'from-rose-600 to-red-700',
    'from-cyan-600 to-blue-700',
  ];
  const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return gradients[charCode % gradients.length];
};

/**
 * Readable relative time helper
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  const now = Date.now();
  const date = new Date(timestamp).getTime();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
};

/**
 * Status color and badge theme helper
 */
const getStatusTheme = (status = 'Pending') => {
  const s = status.toLowerCase();
  switch (s) {
    case 'pending':
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        icon: 'schedule',
        badge: 'text-amber-700 bg-amber-100',
      };
    case 'accepted':
      return {
        bg: 'bg-blue-50 text-blue-800 border-blue-200',
        dot: 'bg-blue-500',
        icon: 'check_box',
        badge: 'text-blue-700 bg-blue-100',
      };
    case 'packing':
      return {
        bg: 'bg-purple-50 text-purple-800 border-purple-200',
        dot: 'bg-purple-500',
        icon: 'inventory',
        badge: 'text-purple-700 bg-purple-100',
      };
    case 'packed':
      return {
        bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dot: 'bg-indigo-500',
        icon: 'inventory_2',
        badge: 'text-indigo-700 bg-indigo-100',
      };
    case 'dispatched':
    case 'assigned rider':
      return {
        bg: 'bg-teal-50 text-teal-800 border-teal-200',
        dot: 'bg-teal-500',
        icon: 'send',
        badge: 'text-teal-700 bg-teal-100',
      };
    case 'out for delivery':
      return {
        bg: 'bg-orange-50 text-orange-800 border-orange-200',
        dot: 'bg-orange-500',
        icon: 'two_wheeler',
        badge: 'text-orange-700 bg-orange-100',
      };
    case 'delivered':
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        icon: 'verified',
        badge: 'text-emerald-700 bg-emerald-100',
      };
    case 'cancelled':
    case 'delivery failed':
      return {
        bg: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
        icon: 'cancel',
        badge: 'text-rose-700 bg-rose-100',
      };
    default:
      return {
        bg: 'bg-slate-100 text-slate-800 border-slate-200',
        dot: 'bg-slate-500',
        icon: 'help',
        badge: 'text-slate-700 bg-slate-200',
      };
  }
};

/**
 * Determine progress stepper index (0-4)
 */
const getStepperStepIndex = (status = 'Pending') => {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 0;
  if (s === 'accepted') return 1;
  if (s === 'packing' || s === 'packed') return 2;
  if (s === 'dispatched' || s === 'out for delivery' || s === 'assigned rider') return 3;
  if (s === 'delivered') return 4;
  return 0; // cancelled / failed
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatusTab = searchParams.get('status') || 'All';

  const { showSuccess, showError, showInfo, confirm } = useToast();

  // Modals state
  const [packingOrder, setPackingOrder] = useState(null);
  const [dispatchOrder, setDispatchOrder] = useState(null);
  const [slipOrder, setSlipOrder] = useState(null);

  // Fetch orders from API with graceful retry
  const fetchOrders = async (silent = false, retries = 1) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get('/admin/orders');
      const data = Array.isArray(response.data) ? response.data : [];
      setOrders(data);
    } catch (err) {
      if (err.response?.status === 401) {
        console.warn('Admin authentication required for orders API.');
        return;
      }
      if (retries > 0) {
        setTimeout(() => fetchOrders(silent, retries - 1), 800);
        return;
      }
      console.warn('Orders fetch notification:', err.message);
      if (!silent) showError('Failed to fetch orders from server.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Polling for live orders (every 15 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Update status handler
  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await axios.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      showSuccess(`Order #${orderId.substring(0, 8).toUpperCase()} updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating order status:', err);
      showError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Cancel order confirmation dialog
  const handleCancelOrder = (order) => {
    confirm({
      title: `Cancel Order #${order.id?.substring(0, 8).toUpperCase()}?`,
      message: 'This will mark the order as Cancelled and return reserved inventory to stock.',
      confirmText: 'Yes, Cancel Order',
      isDanger: true,
      onConfirm: async () => {
        await handleStatusChange(order.id, 'Cancelled');
      },
    });
  };

  // 1-click clipboard copy
  const handleCopyText = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showInfo(`${label} copied to clipboard`);
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        // Status tab filter
        if (currentStatusTab !== 'All') {
          const cleanTab = currentStatusTab.toLowerCase().replace(/\s+/g, '');
          const cleanStatus = (o.status || '').toLowerCase().replace(/\s+/g, '');

          if (cleanTab === 'cancelled') {
            if (cleanStatus !== 'cancelled' && cleanStatus !== 'deliveryfailed') return false;
          } else if (cleanTab === 'dispatched') {
            if (cleanStatus !== 'dispatched' && cleanStatus !== 'assignedrider') return false;
          } else {
            if (cleanStatus !== cleanTab) return false;
          }
        }

        // Payment Method filter
        if (paymentFilter !== 'All') {
          const method = (o.paymentMethod || o.shippingDetails?.paymentMethod || 'COD').toLowerCase();
          if (paymentFilter === 'COD' && !method.includes('cod') && !method.includes('cash')) return false;
          if (paymentFilter === 'Online' && (method.includes('cod') || method.includes('cash'))) return false;
        }

        // Search Query filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const idMatch = (o.id || '').toLowerCase().includes(query);
          const nameMatch = (o.userName || o.customerName || '').toLowerCase().includes(query);
          const phoneMatch = (o.customerMobile || o.shippingDetails?.phone || '').includes(query);
          const addrText = typeof o.address === 'object'
            ? `${o.address?.location || ''} ${o.address?.landmark || ''} ${o.address?.Pincode || ''}`
            : '';
          const addressMatch = (o.deliveryAddress || o.shippingDetails?.address || o.shippingDetails?.location || addrText).toLowerCase().includes(query);
          const riderMatch = (o.assignedRiderName || '').toLowerCase().includes(query);

          if (!idMatch && !nameMatch && !phoneMatch && !addressMatch && !riderMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        }
        if (sortBy === 'amount-high') {
          return (Number(b.total) || 0) - (Number(a.total) || 0);
        }
        if (sortBy === 'amount-low') {
          return (Number(a.total) || 0) - (Number(b.total) || 0);
        }
        return 0;
      });
  }, [orders, currentStatusTab, paymentFilter, searchQuery, sortBy]);

  // Operational KPI metrics calculations
  const metrics = useMemo(() => {
    const totalCount = orders.length;
    let totalGMV = 0;
    let actionRequiredCount = 0;
    let inFulfillmentCount = 0;
    let deliveredCount = 0;
    let exceptionsCount = 0;

    orders.forEach((o) => {
      const amt = Number(o.total) || 0;
      totalGMV += amt;

      const st = (o.status || 'Pending').toLowerCase();
      if (st === 'pending' || st === 'accepted') {
        actionRequiredCount++;
      } else if (st === 'packing' || st === 'packed' || st === 'dispatched' || st === 'assigned rider') {
        inFulfillmentCount++;
      } else if (st === 'delivered') {
        deliveredCount++;
      } else if (st === 'cancelled' || st === 'delivery failed') {
        exceptionsCount++;
      }
    });

    const deliverySuccessRate =
      totalCount > 0 ? Math.round((deliveredCount / Math.max(1, deliveredCount + exceptionsCount)) * 100) : 100;

    return {
      totalCount,
      totalGMV,
      actionRequiredCount,
      inFulfillmentCount,
      deliveredCount,
      deliverySuccessRate,
      exceptionsCount,
    };
  }, [orders]);

  // Pipeline Status Tabs Definitions with live counts
  const statusTabs = useMemo(() => {
    const getCount = (tabKey) => {
      if (tabKey === 'All') return orders.length;
      return orders.filter((o) => {
        const s = (o.status || 'Pending').toLowerCase().replace(/\s+/g, '');
        const target = tabKey.toLowerCase().replace(/\s+/g, '');
        if (target === 'cancelled') return s === 'cancelled' || s === 'deliveryfailed';
        if (target === 'dispatched') return s === 'dispatched' || s === 'assignedrider';
        return s === target;
      }).length;
    };

    return [
      { key: 'All', label: 'All Orders', count: getCount('All') },
      { key: 'Pending', label: 'Pending', count: getCount('Pending'), highlight: 'text-amber-700 bg-amber-100' },
      { key: 'Accepted', label: 'Accepted', count: getCount('Accepted'), highlight: 'text-blue-700 bg-blue-100' },
      { key: 'Packing', label: 'Packing', count: getCount('Packing'), highlight: 'text-purple-700 bg-purple-100' },
      { key: 'Packed', label: 'Packed', count: getCount('Packed'), highlight: 'text-indigo-700 bg-indigo-100' },
      { key: 'Dispatched', label: 'Dispatched', count: getCount('Dispatched'), highlight: 'text-teal-700 bg-teal-100' },
      { key: 'Out For Delivery', label: 'Out for Delivery', count: getCount('Out For Delivery'), highlight: 'text-orange-700 bg-orange-100' },
      { key: 'Delivered', label: 'Delivered', count: getCount('Delivered'), highlight: 'text-emerald-700 bg-emerald-100' },
      { key: 'Cancelled', label: 'Cancelled / Failed', count: getCount('Cancelled'), highlight: 'text-rose-700 bg-rose-100' },
    ];
  }, [orders]);

  const handleTabClick = (tabKey) => {
    if (tabKey === 'All') {
      setSearchParams({});
    } else {
      setSearchParams({ status: tabKey });
    }
  };

  /**
   * Helper to render the expanded order details (used in both desktop table drawer and mobile cards)
   */
  const renderOrderDetailsContent = (order) => {
    const itemsList = Object.values(order.items || {});
    const totalAmount =
      order.total ||
      itemsList.reduce(
        (sum, item) => sum + Number(item.price || 0) * (item.quantity || 1),
        0
      );
    const shipping = order.shippingDetails || {};
    const addressLocation = (typeof order.address === 'object' && order.address?.location) || shipping.location || order.deliveryAddress || shipping.address || 'Address on file';
    const landmark = (typeof order.address === 'object' && order.address?.landmark) || order.landmark || shipping.landmark || '';
    const maplink = (typeof order.address === 'object' && (order.address?.mapUrl || order.address?.maplink)) || order.mapUrl || order.maplink || shipping.mapUrl || shipping.maplink || '';
    const pincode = (typeof order.address === 'object' && (order.address?.pincode || order.address?.Pincode)) || shipping.pincode || shipping.Pincode || '';
    const status = order.status || 'Pending';
    const customerName = order.userName || order.customerName || 'Customer';
    const customerPhone = order.customerMobile || shipping.phone || '';
    const paymentMethod = order.paymentMethod || shipping.paymentMethod || 'COD';
    const currentStepIdx = getStepperStepIndex(status);
    const isCancelled = status === 'Cancelled' || status === 'Delivery Failed';

    return (
      <div className="space-y-4 text-xs">
        {/* Exception alert if delivery failed */}
        {order.failureReason && (
          <div className="bg-rose-50 border border-rose-200 p-3 sm:p-4 rounded-xl flex items-start sm:items-center justify-between gap-2 text-rose-900 font-semibold">
            <div className="flex items-center gap-2">
              <MaterialIcon name="error" size={18} className="text-rose-600 shrink-0" filled />
              <span className="text-xs">Exception: {order.failureReason}</span>
            </div>
            <span className="text-[10px] text-rose-600 uppercase font-bold tracking-wider shrink-0">
              Needs Attention
            </span>
          </div>
        )}

        {/* 5-STAGE FULFILLMENT STEPPER */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Fulfillment Progress
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Stage {currentStepIdx + 1} of 5
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              ID: #{order.id?.substring(0, 10).toUpperCase()}
            </span>
          </div>

          {/* Desktop Stepper (sm and up) */}
          <div className="hidden sm:flex relative items-center justify-between pt-1 pb-2">
            <div className="absolute left-6 right-6 top-5 h-1 bg-slate-200 z-0" />
            {STEPPER_STAGES.map((st, index) => {
              const isPassed = index < currentStepIdx;
              const isCurrent = index === currentStepIdx && !isCancelled;

              let circleStyle = 'bg-white text-slate-400 border-2 border-slate-300';
              if (isPassed) {
                circleStyle = 'bg-emerald-600 text-white border-2 border-emerald-600 shadow-xs';
              } else if (isCurrent) {
                circleStyle = 'bg-slate-900 text-white border-2 border-slate-900 ring-4 ring-slate-200 shadow-xs';
              } else if (isCancelled && index === 0) {
                circleStyle = 'bg-rose-600 text-white border-2 border-rose-600';
              }

              return (
                <div key={st.id} className="relative z-10 flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition ${circleStyle}`}>
                    <MaterialIcon name={isPassed ? 'check' : st.icon} size={16} />
                  </div>
                  <span
                    className={`text-[11px] font-bold mt-2 text-center whitespace-nowrap ${
                      isCurrent ? 'text-slate-900' : isPassed ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile Stepper Bar (< sm screens) */}
          <div className="sm:hidden space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Current: {status}
              </span>
              <span className="text-slate-400 font-medium">
                {isCancelled ? 'Cancelled' : `Step ${currentStepIdx + 1}/5`}
              </span>
            </div>
            {/* Progress Segment Bar */}
            <div className="grid grid-cols-5 gap-1.5 h-2">
              {[0, 1, 2, 3, 4].map((stepIdx) => {
                const isPassed = stepIdx <= currentStepIdx && !isCancelled;
                return (
                  <div
                    key={stepIdx}
                    className={`rounded-full transition ${
                      isCancelled
                        ? stepIdx === 0
                          ? 'bg-rose-500'
                          : 'bg-slate-200'
                        : isPassed
                        ? 'bg-emerald-600'
                        : 'bg-slate-200'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* 3-CARD MODULAR GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Card 1: Ordered Items Breakdown */}
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <MaterialIcon name="shopping_cart" size={15} className="text-emerald-600" />
                <span>Ordered Items ({itemsList.length})</span>
              </h4>
              <span className="text-[11px] font-bold text-slate-400">Qty / Price</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto pr-1">
              {itemsList.map((it, idx) => {
                const qty = it.packedQuantity ?? it.quantity ?? 1;
                const unitPrice = Number(it.price || 0);
                const lineTotal = unitPrice * qty;

                return (
                  <div key={idx} className="py-2 flex justify-between items-center text-slate-700">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-900 truncate">{it.itemName}</p>
                      <p className="text-[11px] text-slate-400">
                        ₹{unitPrice} × {qty} {it.unit || ''}
                      </p>
                    </div>
                    <span className="font-mono font-black text-slate-900 shrink-0">
                      ₹{lineTotal}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2.5 border-t border-slate-200 space-y-1 text-slate-600">
              <div className="flex justify-between items-center text-[11px]">
                <span>Items Subtotal:</span>
                <span className="font-mono font-bold">₹{totalAmount}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span>Delivery:</span>
                <span className="font-bold text-emerald-600">FREE</span>
              </div>
              <div className="flex justify-between items-center font-black text-sm text-slate-950 pt-1 border-t border-slate-100">
                <span>Grand Total:</span>
                <span className="font-mono text-base">₹{totalAmount}</span>
              </div>
            </div>

            {order.packingRemarks && (
              <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-[11px] text-purple-900">
                <strong className="font-bold">Packing note:</strong> {order.packingRemarks}
              </div>
            )}
          </div>

          {/* Card 2: Customer & Shipping Details */}
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <MaterialIcon name="person" size={15} className="text-blue-600" />
                <span>Customer & Destination</span>
              </h4>
              <button
                onClick={() => handleCopyText(
                  [addressLocation, landmark, pincode ? `Pincode: ${pincode}` : ''].filter(Boolean).join(', '),
                  'Address'
                )}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                <MaterialIcon name="content_copy" size={12} />
                <span>Copy</span>
              </button>
            </div>

            <div className="space-y-2 text-slate-700">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Name
                </span>
                <p className="font-bold text-slate-900">{customerName}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Contact
                </span>
                <p className="font-semibold text-slate-800 flex items-center gap-1">
                  <MaterialIcon name="call" size={12} className="text-slate-400" />
                  <span>{customerPhone || 'Not Provided'}</span>
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Address
                </span>
                <p className="font-medium text-slate-700 leading-relaxed text-[11px] mt-0.5 break-words">
                  {addressLocation} {pincode ? `- ${pincode}` : ''}
                </p>
                {landmark && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
                    <MaterialIcon name="flag" size={12} className="text-amber-500 shrink-0" />
                    <span>Landmark: {landmark}</span>
                  </p>
                )}
                {maplink && (
                  <div className="mt-1">
                    <a
                      href={maplink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <MaterialIcon name="open_in_new" size={12} />
                      <span>Open in Google Maps</span>
                    </a>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Payment
                </span>
                <span className="inline-flex items-center gap-1 mt-0.5 font-bold text-slate-800">
                  <MaterialIcon name="payments" size={13} className="text-slate-400" />
                  {paymentMethod}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Logistics & Rider Hub */}
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <MaterialIcon name="local_shipping" size={15} className="text-teal-600" />
                  <span>Logistics & Rider</span>
                </h4>
                <span className="text-[11px] font-bold text-slate-400">
                  {order.assignedRiderName ? 'Dispatched' : 'Pending'}
                </span>
              </div>

              {order.assignedRiderName ? (
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                      <MaterialIcon name="two_wheeler" size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{order.assignedRiderName}</p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        +91 {order.assignedRiderMobile}
                      </p>
                    </div>
                  </div>
                  {order.vehicleDetails && (
                    <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                      <strong>Vehicle:</strong> {order.vehicleDetails}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-1">
                  <MaterialIcon name="two_wheeler" size={20} className="text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No rider assigned yet</p>
                  <p className="text-[10px] text-slate-400">Pack items, then assign an active rider.</p>
                </div>
              )}
            </div>

            {/* Quick Actions inside Drawer */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSlipOrder(order)}
                className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
              >
                <MaterialIcon name="print" size={14} />
                <span>Packing Slip</span>
              </button>

              {(status === 'Pending' || status === 'Accepted' || status === 'Packing') && (
                <button
                  onClick={() => setPackingOrder(order)}
                  className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 py-2 px-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <MaterialIcon name="inventory" size={14} />
                  <span>Pack</span>
                </button>
              )}

              {status === 'Packed' && (
                <button
                  onClick={() => setDispatchOrder(order)}
                  className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 py-2 px-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <MaterialIcon name="send" size={14} />
                  <span>Dispatch</span>
                </button>
              )}

              {status !== 'Cancelled' && status !== 'Delivered' && (
                <button
                  onClick={() => handleCancelOrder(order)}
                  disabled={updatingId === order.id}
                  className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition shrink-0 disabled:opacity-50"
                  title="Cancel Order"
                >
                  <MaterialIcon
                    name={updatingId === order.id ? 'sync' : 'delete_forever'}
                    size={16}
                    className={updatingId === order.id ? 'animate-spin' : ''}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-x-hidden relative">
      {/* Top Global API Activity Loader Bar */}
      {(loading || !!updatingId) && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-200/80 overflow-hidden shadow-xs">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 w-full animate-pulse" />
        </div>
      )}

      {/* 1. TOP HEADER COMMAND STRIP */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">
              Orders & Fulfillment
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Hub
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
            Monitor fulfillment pipelines, dispatch riders, and print warehouse slips
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Live Sync Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <MaterialIcon
              name={autoRefresh ? 'sync' : 'sync_disabled'}
              size={14}
              className={autoRefresh ? 'animate-spin' : ''}
              style={{ animationDuration: '4s' }}
            />
            <span>{autoRefresh ? 'Sync Active' : 'Sync Paused'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchOrders(false)}
            disabled={loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
          >
            <MaterialIcon name="sync" size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRIC SCORECARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* Total Orders */}
        <div
          onClick={() => handleTabClick('All')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Total Orders</span>
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg sm:rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition shrink-0">
              <MaterialIcon name="local_mall" size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-950">
            {metrics.totalCount}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate mt-0.5">
            ₹{Number(metrics.totalGMV).toLocaleString('en-IN')} GMV
          </p>
        </div>

        {/* Action Required */}
        <div
          onClick={() => handleTabClick('Pending')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-amber-200/80 shadow-2xs hover:border-amber-400 transition cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-amber-700 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Action Needed</span>
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg sm:rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition shrink-0">
              <MaterialIcon name="notifications_active" size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-900 flex items-center gap-1.5">
            <span>{metrics.actionRequiredCount}</span>
            {metrics.actionRequiredCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-700/80 font-medium truncate mt-0.5">
            Pending review
          </p>
        </div>

        {/* In Fulfillment */}
        <div
          onClick={() => handleTabClick('Packing')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-purple-200/80 shadow-2xs hover:border-purple-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-purple-700 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">In Progress</span>
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg sm:rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition shrink-0">
              <MaterialIcon name="forklift" size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-purple-900">
            {metrics.inFulfillmentCount}
          </div>
          <p className="text-[10px] sm:text-[11px] text-purple-700/80 font-medium truncate mt-0.5">
            Packing / Dispatched
          </p>
        </div>

        {/* Delivered */}
        <div
          onClick={() => handleTabClick('Delivered')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-200/80 shadow-2xs hover:border-emerald-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-emerald-700 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Delivered</span>
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition shrink-0">
              <MaterialIcon name="verified" size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-950">
            {metrics.deliveredCount}
          </div>
          <p className="text-[10px] sm:text-[11px] text-emerald-700/80 font-medium truncate mt-0.5">
            {metrics.deliverySuccessRate}% success rate
          </p>
        </div>

        {/* Exceptions */}
        <div
          onClick={() => handleTabClick('Cancelled')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-rose-200/80 shadow-2xs hover:border-rose-400 transition cursor-pointer group col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-rose-700 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Exceptions</span>
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg sm:rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition shrink-0">
              <MaterialIcon name="error_outline" size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-950">
            {metrics.exceptionsCount}
          </div>
          <p className="text-[10px] sm:text-[11px] text-rose-700/80 font-medium truncate mt-0.5">
            Cancelled / Failed
          </p>
        </div>
      </div>

      {/* 3. HORIZONTAL STATUS PIPELINE TABS */}
      <div className="overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        <div className="inline-flex items-center gap-1.5 p-1 sm:p-1.5 bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl shadow-2xs min-w-max">
          {statusTabs.map((tab) => {
            const isActive = currentStatusTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold transition ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.count > 0 && tab.highlight
                      ? tab.highlight
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. FILTER, SEARCH & VIEW TOOLBAR */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-2.5 sm:gap-3">
        {/* Full-width Search Bar */}
        <div className="relative w-full flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-slate-400">
            <MaterialIcon name="search" size={17} />
          </div>
          <input
            type="text"
            placeholder="Search by ID, customer, phone, address, rider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition text-slate-800 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              title="Clear search"
            >
              <MaterialIcon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns and Layout Toggle */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 text-xs">
          {/* Payment Method Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <MaterialIcon name="payments" size={14} className="text-slate-400 shrink-0" />
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer w-full text-xs"
            >
              <option value="All">All Payments</option>
              <option value="COD">Cash on Delivery</option>
              <option value="Online">Online / Prepaid</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <MaterialIcon name="sort" size={14} className="text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer w-full text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-high">Amount: High</option>
              <option value="amount-low">Amount: Low</option>
            </select>
          </div>

          {/* Desktop View Switcher (Hidden on Mobile) */}
          <div className="hidden md:inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 ml-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Data Table View"
            >
              <MaterialIcon name="table_rows" size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              <MaterialIcon name="grid_view" size={16} />
            </button>
          </div>

          {/* Reset Filters */}
          {(searchQuery || paymentFilter !== 'All' || currentStatusTab !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPaymentFilter('All');
                setSearchParams({});
              }}
              className="col-span-2 sm:col-span-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-xl border border-rose-200 flex items-center justify-center gap-1 transition"
            >
              <MaterialIcon name="filter_alt_off" size={13} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. MAIN ORDERS CONTENT */}
      {loading ? (
        /* Skeleton UI */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-6 space-y-3">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="h-16 bg-slate-50 rounded-xl animate-pulse flex items-center justify-between px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-3 bg-slate-200 rounded w-28" />
                  <div className="h-2.5 bg-slate-200 rounded w-16" />
                </div>
              </div>
              <div className="h-6 bg-slate-200 rounded-full w-20" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-8 sm:p-16 text-center space-y-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <MaterialIcon name="inbox" size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-800">No matching orders found</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || paymentFilter !== 'All' || currentStatusTab !== 'All'
                ? 'Try adjusting your search query, status filters, or payment method options.'
                : 'Incoming customer orders will appear here automatically.'}
            </p>
          </div>
          {(searchQuery || paymentFilter !== 'All' || currentStatusTab !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPaymentFilter('All');
                setSearchParams({});
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition mt-2"
            >
              <MaterialIcon name="refresh" size={13} />
              <span>Clear all filters</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* MOBILE VIEW (< md screens): MOBILE-OPTIMIZED ORDER CARDS */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => {
              const itemsList = Object.values(order.items || {});
              const totalAmount =
                order.total ||
                itemsList.reduce(
                  (sum, item) => sum + Number(item.price || 0) * (item.quantity || 1),
                  0
                );
              const isExpanded = expandedOrderId === order.id;
              const shipping = order.shippingDetails || {};
              const status = order.status || 'Pending';
              const theme = getStatusTheme(status);
              const customerName = order.userName || order.customerName || 'Customer';
              const customerPhone = order.customerMobile || shipping.phone || '';
              const shortId = order.id?.substring(0, 8).toUpperCase();
              const isUpdating = updatingId === order.id;
              const paymentMethod = order.paymentMethod || shipping.paymentMethod || 'COD';

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3 transition"
                >
                  {/* Card Header: Order ID + Status Badge + Override */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        #{shortId}
                      </span>
                      <button
                        onClick={() => handleCopyText(order.id, 'Order ID')}
                        className="text-slate-400 hover:text-slate-700 p-1"
                        title="Copy full ID"
                      >
                        <MaterialIcon name="content_copy" size={13} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${theme.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                        <span>{status}</span>
                      </span>

                      {/* Compact manual override dropdown */}
                      <select
                        value={status}
                        disabled={isUpdating}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded p-1"
                        title="Change status"
                      >
                        {STATUS_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Customer Info Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(
                          customerName
                        )} text-white flex items-center justify-center font-bold text-[11px] shrink-0`}
                      >
                        {customerName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate">{customerName}</p>
                        {customerPhone && (
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {customerPhone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-950 text-xs block font-mono">
                        ₹{Number(totalAmount).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatRelativeTime(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Items summary & Payment Method */}
                  <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                    <span className="text-slate-600 font-medium">
                      {itemsList.length} {itemsList.length === 1 ? 'item' : 'items'}
                    </span>
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          paymentMethod.toLowerCase().includes('online') ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {paymentMethod}
                    </span>
                  </div>

                  {/* Action CTAs & Drawer Toggle */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Primary Contextual Action Button */}
                    <div className="flex-1">
                      {status === 'Pending' && (
                        <button
                          onClick={() => handleStatusChange(order.id, 'Accepted')}
                          disabled={isUpdating}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-75 cursor-pointer"
                        >
                          <MaterialIcon
                            name={isUpdating ? 'sync' : 'check'}
                            size={14}
                            className={isUpdating ? 'animate-spin' : ''}
                          />
                          <span>{isUpdating ? 'Accepting Order...' : 'Accept Order'}</span>
                        </button>
                      )}

                      {(status === 'Accepted' || status === 'Packing') && (
                        <button
                          onClick={() => setPackingOrder(order)}
                          className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-3 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                        >
                          <MaterialIcon name="inventory" size={14} />
                          <span>Pack Items</span>
                        </button>
                      )}

                      {status === 'Packed' && (
                        <button
                          onClick={() => setDispatchOrder(order)}
                          className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                        >
                          <MaterialIcon name="two_wheeler" size={14} />
                          <span>Assign Rider</span>
                        </button>
                      )}

                      {(status === 'Dispatched' || status === 'Out For Delivery') && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg w-full justify-center">
                          <MaterialIcon name="two_wheeler" size={13} />
                          <span className="truncate">{order.assignedRiderName || 'With Rider'}</span>
                        </div>
                      )}

                      {status === 'Delivered' && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg w-full justify-center">
                          <MaterialIcon name="check_circle" size={13} filled />
                          <span>Completed</span>
                        </div>
                      )}

                      {(status === 'Cancelled' || status === 'Delivery Failed') && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg w-full justify-center">
                          <MaterialIcon name="error" size={13} />
                          <span>{status}</span>
                        </div>
                      )}
                    </div>

                    {/* Print Slip Icon */}
                    <button
                      onClick={() => setSlipOrder(order)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                      title="Print Packing Slip"
                    >
                      <MaterialIcon name="print" size={15} />
                    </button>

                    {/* Expand Details Button */}
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                        isExpanded
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{isExpanded ? 'Hide' : 'Details'}</span>
                      <MaterialIcon
                        name={isExpanded ? 'expand_less' : 'expand_more'}
                        size={15}
                      />
                    </button>
                  </div>

                  {/* Expanded Content on Mobile */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 animate-in fade-in duration-150">
                      {renderOrderDetailsContent(order)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP VIEW (md+ screens): TABLE VIEW or GRID VIEW */}
          <div className="hidden md:block">
            {viewMode === 'table' ? (
              /* Desktop Data Table */
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase tracking-wider text-[10px] sm:text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3">Order ID</th>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3">Customer</th>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3">Date / Time</th>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3 text-center">Items</th>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3">Total & Payment</th>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3">Stage</th>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3 text-center">Next Action</th>
                        <th className="py-2.5 sm:py-3 px-2.5 sm:px-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.map((order) => {
                        const itemsList = Object.values(order.items || {});
                        const totalAmount =
                          order.total ||
                          itemsList.reduce(
                            (sum, item) => sum + Number(item.price || 0) * (item.quantity || 1),
                            0
                          );
                        const isExpanded = expandedOrderId === order.id;
                        const shipping = order.shippingDetails || {};
                        const status = order.status || 'Pending';
                        const theme = getStatusTheme(status);
                        const customerName = order.userName || order.customerName || 'Customer';
                        const customerPhone = order.customerMobile || shipping.phone || '';
                        const shortId = order.id?.substring(0, 8).toUpperCase();
                        const isUpdating = updatingId === order.id;
                        const paymentMethod = order.paymentMethod || shipping.paymentMethod || 'COD';

                        return (
                          <React.Fragment key={order.id}>
                            <tr
                              className={`hover:bg-slate-50/80 transition group ${
                                isExpanded ? 'bg-slate-50/50' : ''
                              }`}
                            >
                              {/* Order ID Column */}
                              <td className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    #{shortId}
                                  </span>
                                  <button
                                    onClick={() => handleCopyText(order.id, 'Order ID')}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
                                    title="Copy Full ID"
                                  >
                                    <MaterialIcon name="content_copy" size={12} />
                                  </button>
                                </div>
                              </td>

                              {/* Customer Column */}
                              <td className="py-2.5 px-2.5 sm:px-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(
                                      customerName
                                    )} text-white flex items-center justify-center font-bold text-[11px] shadow-2xs shrink-0`}
                                  >
                                    {customerName.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 block truncate text-xs">
                                      {customerName}
                                    </span>
                                    {customerPhone && (
                                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5 font-medium">
                                        <MaterialIcon name="call" size={10} />
                                        <span>{customerPhone}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Date & Time */}
                              <td className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap">
                                <span className="font-bold text-slate-800 block text-xs">
                                  {formatRelativeTime(order.createdAt)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {order.createdAt
                                    ? new Date(order.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'N/A'}
                                </span>
                              </td>

                              {/* Items Count */}
                              <td className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                                  <MaterialIcon name="shopping_bag" size={11} className="text-slate-400" />
                                  {itemsList.length} {itemsList.length === 1 ? 'item' : 'items'}
                                </span>
                              </td>

                              {/* Total & Payment */}
                              <td className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap">
                                <div className="font-black text-slate-950 text-xs font-mono">
                                  ₹{Number(totalAmount).toLocaleString('en-IN')}
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 border ${
                                    paymentMethod.toLowerCase().includes('online')
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {paymentMethod}
                                </span>
                              </td>

                              {/* Status Badge */}
                              <td className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${theme.bg}`}
                                >
                                  <span>{status}</span>
                                </span>
                              </td>

                              {/* Next Action Button */}
                              <td className="py-2.5 px-2.5 sm:px-3 text-center whitespace-nowrap">
                                <div className="inline-flex items-center justify-center gap-1.5">
                                  {status === 'Pending' && (
                                    <button
                                      onClick={() => handleStatusChange(order.id, 'Accepted')}
                                      disabled={isUpdating}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-75 cursor-pointer"
                                    >
                                      <MaterialIcon
                                        name={isUpdating ? 'sync' : 'check'}
                                        size={13}
                                        className={isUpdating ? 'animate-spin' : ''}
                                      />
                                      <span>{isUpdating ? 'Accepting...' : 'Accept'}</span>
                                    </button>
                                  )}

                                  {(status === 'Accepted' || status === 'Packing') && (
                                    <button
                                      onClick={() => setPackingOrder(order)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                                    >
                                      <MaterialIcon name="inventory" size={13} />
                                      <span>Pack Items</span>
                                    </button>
                                  )}

                                  {status === 'Packed' && (
                                    <button
                                      onClick={() => setDispatchOrder(order)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                                    >
                                      <MaterialIcon name="two_wheeler" size={13} />
                                      <span>Assign Rider</span>
                                    </button>
                                  )}

                                  {(status === 'Dispatched' || status === 'Out For Delivery') && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
                                      <MaterialIcon name="two_wheeler" size={13} />
                                      <span>{order.assignedRiderName || 'With Rider'}</span>
                                    </span>
                                  )}

                                  {status === 'Delivered' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                      <MaterialIcon name="check_circle" size={13} filled />
                                      <span>Completed</span>
                                    </span>
                                  )}

                                  {(status === 'Cancelled' || status === 'Delivery Failed') && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                                      <MaterialIcon name="error" size={13} />
                                      <span>{status}</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Details & Print Slip */}
                              <td className="py-2.5 px-2.5 sm:px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => setSlipOrder(order)}
                                    className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                                    title="Print Packing Slip"
                                  >
                                    <MaterialIcon name="print" size={15} />
                                  </button>

                                  <button
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                    className={`p-1.5 rounded-lg transition ${
                                      isExpanded
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                                    }`}
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                  >
                                    <MaterialIcon
                                      name={isExpanded ? 'expand_less' : 'expand_more'}
                                      size={17}
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Row */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70 border-b border-slate-200/80 animate-in fade-in duration-150">
                                <td colSpan={8} className="p-4 sm:p-6">
                                  {renderOrderDetailsContent(order)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Desktop Card Grid */
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => {
                  const itemsList = Object.values(order.items || {});
                  const totalAmount =
                    order.total ||
                    itemsList.reduce(
                      (sum, item) => sum + Number(item.price || 0) * (item.quantity || 1),
                      0
                    );
                  const isExpanded = expandedOrderId === order.id;
                  const status = order.status || 'Pending';
                  const theme = getStatusTheme(status);
                  const customerName = order.userName || order.customerName || 'Customer';
                  const customerPhone = order.customerMobile || order.shippingDetails?.phone || '';
                  const isUpdating = updatingId === order.id;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            #{order.id?.substring(0, 8).toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${theme.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                            <span>{status}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                              customerName
                            )} text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0`}
                          >
                            {customerName.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs truncate">{customerName}</p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {customerPhone || 'No phone'} • {formatRelativeTime(order.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-xs text-slate-700">
                          <div className="flex justify-between items-center font-bold text-slate-900">
                            <span>{itemsList.length} Items</span>
                            <span className="font-mono text-xs">₹{totalAmount}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {itemsList.map((i) => i.itemName).join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSlipOrder(order)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                          title="Print Packing Slip"
                        >
                          <MaterialIcon name="print" size={15} />
                        </button>

                        <div className="flex items-center gap-1.5">
                          {status === 'Pending' && (
                            <button
                              onClick={() => handleStatusChange(order.id, 'Accepted')}
                              disabled={isUpdating}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-75 cursor-pointer flex items-center gap-1"
                            >
                              <MaterialIcon
                                name={isUpdating ? 'sync' : 'check'}
                                size={13}
                                className={isUpdating ? 'animate-spin' : ''}
                              />
                              <span>{isUpdating ? 'Accepting...' : 'Accept'}</span>
                            </button>
                          )}

                          {(status === 'Accepted' || status === 'Packing') && (
                            <button
                              onClick={() => setPackingOrder(order)}
                              className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1"
                            >
                              <MaterialIcon name="inventory" size={13} />
                              <span>Pack</span>
                            </button>
                          )}

                          {status === 'Packed' && (
                            <button
                              onClick={() => setDispatchOrder(order)}
                              className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1"
                            >
                              <MaterialIcon name="two_wheeler" size={13} />
                              <span>Dispatch</span>
                            </button>
                          )}

                          <button
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition"
                          >
                            {isExpanded ? 'Close' : 'Details'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-100 col-span-full animate-in fade-in duration-150">
                          {renderOrderDetailsContent(order)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* PACKING MODAL */}
      {packingOrder && (
        <PackingModal
          order={packingOrder}
          isOpen={!!packingOrder}
          onClose={() => setPackingOrder(null)}
          onSuccess={() => {
            setPackingOrder(null);
            fetchOrders();
          }}
        />
      )}

      {/* DISPATCH MODAL */}
      {dispatchOrder && (
        <DispatchModal
          order={dispatchOrder}
          isOpen={!!dispatchOrder}
          onClose={() => setDispatchOrder(null)}
          onSuccess={() => {
            setDispatchOrder(null);
            fetchOrders();
          }}
        />
      )}

      {/* PRINT PACKING SLIP MODAL */}
      {slipOrder && (
        <OrderPackingSlipModal
          order={slipOrder}
          isOpen={!!slipOrder}
          onClose={() => setSlipOrder(null)}
        />
      )}
    </div>
  );
};

export default Orders;
