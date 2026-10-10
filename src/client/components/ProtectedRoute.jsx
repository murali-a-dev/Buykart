import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import MaterialIcon from './common/MaterialIcon';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, adminToken } = useAuth();
  const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('buykart_admin_token') : '');

  if (!currentUser || !token) {
    return <Navigate to="/admin/login" replace />;
  }

  // SECURITY FIX: Role check must rely solely on the JWT-decoded `role` field.
  // The previous name-based fallback allowed anyone named "admin" to bypass this check.
  const isAdmin = currentUser.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl text-center max-w-md space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <MaterialIcon name="security" size={36} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Admin Access Required</h2>
          <p className="text-sm text-slate-500">
            Your account (<strong className="text-slate-800">{currentUser.name}</strong>) does not have
            administrator privileges to view this area.
          </p>
          <div className="pt-2 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 bg-[#0D4715] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1b5e20] transition shadow-xs"
            >
              <MaterialIcon name="storefront" size={18} />
              <span>Go to Storefront</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
