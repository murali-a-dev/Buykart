import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import MaterialIcon from '../../components/common/MaterialIcon';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const Dashboard = () => {
  const [stats, setStats] = useState({
    products: [],
    orders: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [inventoryRes, ordersRes, usersRes] = await Promise.all([
        axios.get('/admin/inventory'),
        axios.get('/admin/orders'),
        axios.get('/admin/users'),
      ]);

      setFetchError(null);
      setStats({
        products: Array.isArray(inventoryRes.data) ? inventoryRes.data : [],
        orders: Array.isArray(ordersRes.data) ? ordersRes.data : [],
        users: Array.isArray(usersRes.data) ? usersRes.data : [],
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
      setFetchError('Failed to load dashboard data. Please refresh the page.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const safeProducts = Array.isArray(stats.products) ? stats.products : [];
  const safeOrders = Array.isArray(stats.orders) ? stats.orders : [];
  const safeUsers = Array.isArray(stats.users) ? stats.users : [];

  // Compute summary stats
  const totalProducts = safeProducts.length;
  // FIX: Inventory valuation = stock value (price × qty on hand) — NOT revenue
  const totalInventoryValue = safeProducts.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.op_stock || 0),
    0
  );
  // FIX: Real sales revenue = sum of delivered order totals only
  const totalSalesRevenue = safeOrders
    .filter((o) => String(o.status || '').toLowerCase() === 'delivered')
    .reduce((sum, o) => sum + Number(o.total || o.finalAmount || 0), 0);
  const totalOrders = safeOrders.length;
  const totalUsers = safeUsers.length;

  // Process Sales Chart (Last 7 Days)
  const salesByDay = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    salesByDay[key] = 0;
  }

  // FIX: Chart only counts delivered orders as revenue, not pending/cancelled
  safeOrders
    .filter((o) => String(o.status || '').toLowerCase() === 'delivered')
    .forEach((order) => {
      if (!order.createdAt) return;
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
      if (salesByDay.hasOwnProperty(dateKey)) {
        const orderTotal = Number(order.total) || Object.values(order.items || {}).reduce(
          (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
          0
        );
        salesByDay[dateKey] += orderTotal;
      }
    });

  const chartLabels = Object.keys(salesByDay).map((dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });

  const chartDataValues = Object.values(salesByDay);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Sales (₹)',
        data: chartDataValues,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.08)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#059669',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => `Sales: ₹${context.parsed.y.toLocaleString('en-IN')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 11 },
          callback: (value) => `₹${value}`,
        },
      },
    },
  };

  // Recent Activity Feed
  const recentActivities = [
    ...safeOrders.map((o) => ({
      type: 'order',
      timestamp: new Date(o.createdAt || Date.now()).getTime(),
      dateStr: new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      data: o,
    })),
    ...safeUsers.map((u) => ({
      type: 'user',
      timestamp: new Date(u.createdAt || Date.now()).getTime(),
      dateStr: new Date(u.createdAt || Date.now()).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      data: u,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 6);

  // Auto polling for live new order notifications
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [prevOrderCount, setPrevOrderCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get('/admin/orders');
        const latestOrders = Array.isArray(res.data) ? res.data : [];
        if (prevOrderCount > 0 && latestOrders.length > prevOrderCount) {
          const newest = latestOrders[0];
          setNewOrderAlert(newest);
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
          } catch (e) {}
        }
        setPrevOrderCount(latestOrders.length);
        setStats((prev) => ({ ...prev, orders: latestOrders }));
      } catch (e) {}
    }, 6000);

    return () => clearInterval(interval);
  }, [prevOrderCount]);

  // Compute status counts
  const ordersList = safeOrders;
  const statusCounts = [
    { label: 'Pending', count: ordersList.filter((o) => !o.status || o.status.toLowerCase() === 'pending').length, path: '/admin/orders?status=Pending', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { label: 'Accepted', count: ordersList.filter((o) => o.status && o.status.toLowerCase() === 'accepted').length, path: '/admin/orders?status=Accepted', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: 'Packing', count: ordersList.filter((o) => o.status && o.status.toLowerCase() === 'packing').length, path: '/admin/orders?status=Packing', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { label: 'Packed', count: ordersList.filter((o) => o.status && o.status.toLowerCase() === 'packed').length, path: '/admin/orders?status=Packed', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { label: 'Dispatched', count: ordersList.filter((o) => o.status && (o.status.toLowerCase() === 'dispatched' || o.status.toLowerCase() === 'assigned rider')).length, path: '/admin/orders?status=Dispatched', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    { label: 'Out for Delivery', count: ordersList.filter((o) => o.status && o.status.toLowerCase() === 'out for delivery').length, path: '/admin/orders?status=OutForDelivery', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { label: 'Delivered', count: ordersList.filter((o) => o.status && o.status.toLowerCase() === 'delivered').length, path: '/admin/orders?status=Delivered', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { label: 'Cancelled', count: ordersList.filter((o) => o.status && (o.status.toLowerCase() === 'cancelled' || o.status.toLowerCase() === 'delivery failed')).length, path: '/admin/orders?status=Cancelled', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Live Order Notification Banner */}
      {newOrderAlert && (
        <div className="max-w-7xl mx-auto bg-white border-l-4 border-emerald-500 p-4 rounded-xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MaterialIcon name="notifications_active" size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                New Incoming Order
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                #{newOrderAlert.id?.substring(0, 8).toUpperCase()} • {newOrderAlert.userName || newOrderAlert.customerName || 'Customer'} (₹{newOrderAlert.total || '0'})
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/orders"
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
            >
              View Order
            </Link>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              aria-label="Dismiss alert"
            >
              <MaterialIcon name="close" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Dashboard
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">
            Real-time overview of sales, inventory, and fulfillment
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-2xs disabled:opacity-50"
        >
          <MaterialIcon name="refresh" size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Products in Catalog</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalProducts}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MaterialIcon name="inventory_2" size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Inventory Stock Value</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{totalInventoryValue.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <MaterialIcon name="account_balance_wallet" size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Sales Revenue (Delivered)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{totalSalesRevenue.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MaterialIcon name="payments" size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Orders</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalOrders}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <MaterialIcon name="receipt_long" size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Registered Accounts</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalUsers}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <MaterialIcon name="group" size={22} />
            </div>
          </div>
        </div>

        {/* ORDER PIPELINE */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Order Fulfillment Pipeline
            </h2>
            <Link to="/admin/orders" className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1">
              <span>View all orders</span>
              <MaterialIcon name="chevron_right" size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {statusCounts.map((sc) => (
              <Link
                key={sc.label}
                to={sc.path}
                className={`p-3 rounded-xl border transition text-center hover:shadow-xs ${sc.color}`}
              >
                <span className="text-[11px] font-medium block opacity-90 truncate">{sc.label}</span>
                <span className="text-xl font-bold block mt-0.5">{sc.count}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ANALYTICS & RECENT ACTIVITY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Chart */}
          <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl shadow-2xs border border-slate-200/90 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MaterialIcon name="trending_up" size={18} className="text-emerald-600" />
                Sales Trends (Last 7 Days)
              </h2>
              <span className="text-xs text-slate-400">Revenue in INR</span>
            </div>
            <div className="h-68">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-2xs border border-slate-200/90 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <MaterialIcon name="schedule" size={18} className="text-slate-500" />
              Recent Activity
            </h2>

            {recentActivities.length > 0 ? (
              <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                {recentActivities.map((act, index) => (
                  <div key={index} className="flex items-start gap-3 text-xs">
                    {act.type === 'order' ? (
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <MaterialIcon name="shopping_bag" size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-purple-50 text-purple-700 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <MaterialIcon name="person" size={16} />
                      </div>
                    )}

                    <div className="space-y-0.5 flex-1 min-w-0">
                      {act.type === 'order' ? (
                        <>
                          <p className="font-semibold text-slate-900 truncate">
                            Order by <span className="text-slate-900 font-bold">{act.data.customerName || act.data.userName || 'Customer'}</span>
                          </p>
                          <p className="text-slate-500">
                            #{act.data.id?.substring(0, 8).toUpperCase()} • ₹{act.data.total || 0}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-900 truncate">
                            Account: <span className="font-bold">{act.data.name}</span>
                          </p>
                          <p className="text-slate-500">
                            {act.data.mobile || act.data.phone || 'N/A'}
                          </p>
                        </>
                      )}
                      <span className="text-[10px] text-slate-400 block">{act.dateStr}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-8">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
