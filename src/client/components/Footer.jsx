import React from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from './common/MaterialIcon';
import { version } from '../../../package.json';
import logoImg from '../assets/logo.png';

const Footer = () => {
  const trustHighlights = [
    {
      icon: 'bolt',
      title: 'Hyperlocal Delivery',
      desc: 'Farm-fresh groceries delivered to your door in 30 minutes',
      badge: 'Fast',
    },
    {
      icon: 'eco',
      title: '100% Farm-Fresh',
      desc: 'Locally sourced fresh produce and daily staple essentials',
      badge: 'Organic',
    },
    {
      icon: 'shield_with_heart',
      title: 'Secure & Flexible Payments',
      desc: 'Encrypted transactions via UPI, Cards, Netbanking & COD',
      badge: 'Protected',
    },
    {
      icon: 'support_agent',
      title: 'Dedicated Customer Care',
      desc: 'Prompt assistance and responsive order support daily',
      badge: '24/7',
    },
  ];

  return (
    <footer className="bg-slate-950 text-slate-300 mt-20 border-t border-slate-800/80 relative overflow-hidden">
      {/* Subtle Ambient Background Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none translate-y-1/2"></div>

      {/* MAIN FOOTER NAVIGATION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">

          {/* BRAND COLUMN (Span 4) */}
          <div className="lg:col-span-4 space-y-5">
            <Link to="/" className="inline-flex items-center gap-3 group focus:outline-none">
              <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-emerald-500/40 transition">
                <img
                  src={logoImg}
                  alt="Buykart Logo"
                  className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/img/logo(1).png';
                  }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-white group-hover:text-emerald-400 transition">
                  Buykart
                </span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none">
                  Supermarket & Express
                </span>
              </div>
            </Link>

            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm">
              Connecting local households with farm-fresh produce, authentic organic groceries, and daily essentials with hyper-local delivery in under 30 minutes.
            </p>

            {/* SOCIAL COMMUNITY LINKS */}
            <div className="pt-2">
              <span className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400 mb-2.5">
                Connect With Our Team
              </span>
              <div className="flex items-center gap-2">
                <a
                  href="https://wa.me/916383217328"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500 flex items-center justify-center transition-all duration-200 shadow-sm"
                  title="WhatsApp Support"
                  aria-label="WhatsApp Support"
                >
                  <MaterialIcon name="chat" size={17} />
                </a>
                <a
                  href="mailto:support@buykart.com"
                  className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500 flex items-center justify-center transition-all duration-200 shadow-sm"
                  title="Email Us"
                  aria-label="Email Us"
                >
                  <MaterialIcon name="mail" size={17} />
                </a>
                <a
                  href="tel:+916383217328"
                  className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500 flex items-center justify-center transition-all duration-200 shadow-sm"
                  title="Direct Phone Call"
                  aria-label="Direct Phone Call"
                >
                  <MaterialIcon name="call" size={17} />
                </a>
                <a
                  href="http://my-self-murali.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500 flex items-center justify-center transition-all duration-200 shadow-sm"
                  title="Creator Portfolio"
                  aria-label="Creator Portfolio"
                >
                  <MaterialIcon name="language" size={17} />
                </a>
              </div>
            </div>
          </div>

          {/* STORE CATEGORIES (Span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              Catalog
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link to="/" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>All Groceries</span>
                </Link>
              </li>
              <li>
                <Link to="/" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>Fresh Vegetables</span>
                </Link>
              </li>
              <li>
                <Link to="/" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>Fresh Fruits</span>
                </Link>
              </li>
              <li>
                <Link to="/" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>Dairy & Eggs</span>
                </Link>
              </li>
              <li>
                <Link to="/" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>Snacks & Drinks</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* COMPANY & EXPLORE (Span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              Company
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link to="/about" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>About Us</span>
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>Contact & Help</span>
                </Link>
              </li>
              <li>
                <Link to="/cart" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>My Cart</span>
                </Link>
              </li>
              <li>
                <Link to="/account" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>Profile Settings</span>
                </Link>
              </li>
              <li>
                <Link to="/my-orders" className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-2 group">
                  <MaterialIcon name="chevron_right" size={15} className="text-slate-600 group-hover:text-emerald-400 transition" />
                  <span>Track Orders</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* CONTACT & DISPATCH HUB (Span 4) */}
          <div className="lg:col-span-4 space-y-4">
            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              Contact
            </h4>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-inner">
              <div className="flex items-start gap-3 text-xs">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <MaterialIcon name="pin_drop" size={16} />
                </div>
                <div>
                  <span className="text-slate-200 font-bold block">Central Logistics Hub</span>
                  <span className="text-slate-400 leading-relaxed">
                    24/74E, Vettukattu Valasu, Erode, Tamil Nadu — 638011
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <MaterialIcon name="call" size={16} />
                </div>
                <div>
                  <span className="text-slate-200 font-bold block">Customer Hotline</span>
                  <a href="tel:+916383217328" className="text-emerald-400 hover:underline font-semibold">
                    +91 63832 17328
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <MaterialIcon name="schedule" size={16} />
                </div>
                <div>
                  <span className="text-slate-200 font-bold block">Dispatch Working Hours</span>
                  <span className="text-slate-400">Mon – Sun: 7:00 AM – 10:30 PM IST</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM ATTRIBUTION BAR */}
        <div className="mt-6 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-emerald-500/10 text-emerald-400 font-black px-2.5 py-1 rounded-md border border-emerald-500/20 tracking-wide">
              Buykart v{version}
            </span>
            <span>© {new Date().getFullYear()} Buykart Inc. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <span>Crafted by</span>
            <a
              href="http://my-self-murali.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 font-extrabold underline hover:text-emerald-300 transition inline-flex items-center gap-1"
            >
              <span>Murali</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
