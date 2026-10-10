import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './components/common/Toast';

import Navbar from './components/Navbar';
import AdminNavbar from './components/AdminNavbar';
import Footer from './components/Footer';
import AdminFooter from './components/AdminFooter';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/website/Home';
import Cart from './pages/website/Cart';
import About from './pages/website/About';
import Contact from './pages/website/Contact';
import MyOrders from './pages/website/MyOrders';
import Account from './pages/website/Account';

import Login from './pages/admin/Login';
import Register from './pages/admin/Register';
import Dashboard from './pages/admin/Dashboard';
import Inventory from './pages/admin/Inventory';
import Orders from './pages/admin/Orders';
import Users from './pages/admin/Users';
import RiderManagement from './pages/admin/RiderManagement';
import PurchaseEntry from './pages/admin/PurchaseEntry';

import RiderLogin from './pages/ontime/RiderLogin';
import RiderDashboard from './pages/ontime/RiderDashboard';
import ErrorBoundary from './components/ErrorBoundary';

// Layout for Public E-Commerce Website
const WebsiteLayout = () => {
  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-grow">
          <Outlet />
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
};

// Layout for Protected Admin Panel
const AdminLayout = () => {
  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-slate-50">
        <AdminNavbar />
        <div className="flex-grow">
          <Outlet />
        </div>
        <AdminFooter />
      </div>
    </ErrorBoundary>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <Routes>
          {/* Public Storefront Routes */}
          <Route element={<WebsiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/buykart" element={<Home />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/account" element={<Account />} />
            <Route path="/my-orders" element={<MyOrders />} />
          </Route>

          {/* OnTime Rider App Routes */}
          <Route path="/ontime" element={<Navigate to="/ontime/login" replace />} />
          <Route path="/ontime/login" element={<RiderLogin />} />
          <Route path="/ontime/dashboard" element={<RiderDashboard />} />

          {/* Admin App Unprotected Auth Routes */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/register" element={<Register />} />
          
          {/* Admin App Root Redirect */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Protected Admin App Routes */}
          <Route element={<AdminLayout />}>
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <ProtectedRoute>
                  <Inventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/purchase-entry"
              element={
                <ProtectedRoute>
                  <PurchaseEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/riders"
              element={
                <ProtectedRoute>
                  <RiderManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Backward Compatibility Redirects */}
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/register" element={<Navigate to="/admin/register" replace />} />
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/inventory" element={<Navigate to="/admin/inventory" replace />} />
          <Route path="/purchase-entry" element={<Navigate to="/admin/purchase-entry" replace />} />
          <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
          <Route path="/riders" element={<Navigate to="/admin/riders" replace />} />
          <Route path="/users" element={<Navigate to="/admin/users" replace />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  </ErrorBoundary>
  );
};

export default App;
