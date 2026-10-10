import React from 'react';
import MaterialIcon from './common/MaterialIcon';

const AdminFooter = () => {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <MaterialIcon name="admin_panel_settings" size={18} className="text-emerald-400" />
          <span className="font-bold text-white">Buykart Admin Workspace</span>
          <span>© {new Date().getFullYear()} All rights reserved.</span>
        </div>

        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <span>Crafted by</span>
          <a
            href="http://my-self-murali.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 font-extrabold underline hover:text-emerald-300 transition"
          >
            Murali
          </a>
        </div>
      </div>
    </footer>
  );
};

export default AdminFooter;
