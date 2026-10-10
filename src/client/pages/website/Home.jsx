import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProductCard from '../../components/ProductCard';
import ProductModal from '../../components/ProductModal';
import MaterialIcon from '../../components/common/MaterialIcon';


// FIX: Simple debounce hook to avoid filtering on every keystroke
function useDebounce(value, delay) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  // FIX: Debounce search — only filter after 300ms of no typing
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState('default');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);

  const sortDropdownRef = useRef(null);

  const sortOptions = [
    { value: 'default', label: 'Recommended', icon: 'auto_awesome', hint: 'Featured & popular' },
    { value: 'price-low', label: 'Price: Low to High', icon: 'arrow_upward', hint: 'Cheapest first' },
    { value: 'price-high', label: 'Price: High to Low', icon: 'arrow_downward', hint: 'Premium first' },
    { value: 'name', label: 'Name: A to Z', icon: 'sort_by_alpha', hint: 'Alphabetical order' },
  ];

  const currentSort = sortOptions.find((opt) => opt.value === sortBy) || sortOptions[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/website/products');
      const data = response.data;
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
        if (data && data.message) {
          setError(data.message);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load products. Please check server connection.');
      setProducts([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const normalizeCategory = (cat) => {
    if (!cat) return 'General';
    const c = String(cat).trim();
    const lower = c.toLowerCase();
    if (lower === 'vegitables' || lower === 'vegetable' || lower === 'vegetables') return 'Vegetables';
    if (lower === 'fruits' || lower === 'fruit') return 'Fruits';
    if (lower.includes('dairy')) return 'Dairy & Eggs';
    if (lower.includes('bakery')) return 'Bakery';
    if (lower.includes('snack')) return 'Snacks';
    if (lower.includes('beverage') || lower.includes('drink')) return 'Beverages';
    if (lower.includes('pantry') || lower.includes('staple')) return 'Pantry & Staples';
    return c.charAt(0).toUpperCase() + c.slice(1);
  };

  const safeProducts = Array.isArray(products) ? products.map((p) => ({
    ...p,
    category: normalizeCategory(p.category)
  })) : [];

  // Extract unique sorted categories
  const categories = ['All', ...new Set(safeProducts.map((p) => p.category).filter(Boolean))];

  // Helper to parse numerical price
  const parseCleanPrice = (val) => parseFloat(String(val || 0).replace(/[^0-9.]/g, '')) || 0;

  // Filter products by search and category
  let filteredProducts = safeProducts.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const nameStr = (p.itemName || '').toLowerCase();
    const descStr = (p.description || '').toLowerCase();
    const catStr = (p.category || '').toLowerCase();
    const queryStr = searchQuery.toLowerCase().trim();
    const matchesSearch = !queryStr || nameStr.includes(queryStr) || descStr.includes(queryStr) || catStr.includes(queryStr);
    return matchesCategory && matchesSearch;
  });

  // Sort products
  if (sortBy === 'price-low') {
    filteredProducts.sort((a, b) => parseCleanPrice(a.price) - parseCleanPrice(b.price));
  } else if (sortBy === 'price-high') {
    filteredProducts.sort((a, b) => parseCleanPrice(b.price) - parseCleanPrice(a.price));
  } else if (sortBy === 'name') {
    filteredProducts.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Hero Header Banner */}
      <section className="bg-gradient-to-br from-[#0D4715] via-[#1b5e20] to-[#2e7d32] text-white py-14 sm:py-16 px-4 sm:px-6 lg:px-8 mb-10 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-emerald-100 border border-white/10 shadow-sm">
            <MaterialIcon name="verified" size={16} className="text-amber-400" filled />
            <span>Farm-Fresh Groceries & Daily Essentials</span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Welcome to <span className="text-amber-400">Buykart</span>
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base max-w-2xl mx-auto font-medium">
            Hand-picked fresh produce, dairy, bakery, and pantry staples delivered straight to your doorstep.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto pt-4 space-y-3">
            <div className="relative flex items-center">
              <div className="absolute left-4 pointer-events-none flex items-center">
                <MaterialIcon name="search" size={22} className="text-slate-400" />
              </div>
              <label htmlFor="product-search" className="sr-only">Search products</label>
              <input
                id="product-search"
                type="search"
                placeholder="Search fresh items, fruits, vegetables, dairy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-white text-slate-900 placeholder-slate-400 rounded-2xl shadow-xl focus:outline-none focus:ring-4 focus:ring-amber-400/40 transition text-sm font-semibold border border-emerald-800/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Clear search"
                >
                  <MaterialIcon name="cancel" size={18} />
                </button>
              )}
            </div>

            {/* Quick Keyword Suggestion Tags */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px] text-emerald-200">
              <span className="font-semibold text-white/80">Popular:</span>
              {['Apples', 'Tomatoes', 'Milk', 'Onions', 'Potatoes'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSearchQuery(tag)}
                  className="px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition cursor-pointer font-medium border border-white/10"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Category Filters Header & Sort Control */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <MaterialIcon name="category" size={22} className="text-[#0D4715]" />
            <h2 className="text-xl font-black text-slate-900">Explore Catalog</h2>
            <span className="text-xs font-bold text-slate-400 ml-1">
              ({filteredProducts.length} items)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Horizontally scrollable category pills on mobile, wrapped on desktop */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap max-w-full">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${selectedCategory === cat
                    ? 'bg-[#0D4715] text-white shadow-md shadow-emerald-900/20 scale-105'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Refreshing Custom Sort Dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                type="button"
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="group flex items-center gap-2.5 bg-white/95 hover:bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/90 hover:border-emerald-500/40 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                aria-expanded={sortDropdownOpen}
                aria-label="Sort products"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
                  <MaterialIcon name={currentSort.icon} size={15} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-left">
                  <span className="text-slate-400 font-medium hidden sm:inline">Sort:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[120px] sm:max-w-none">
                    {currentSort.label}
                  </span>
                </div>
                <MaterialIcon
                  name="expand_more"
                  size={18}
                  className={`text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                    sortDropdownOpen ? 'rotate-180 text-emerald-600' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu Modal / Popover */}
              {sortDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-900/10 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Sort Products
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      4 Options
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {sortOptions.map((opt) => {
                      const isSelected = opt.value === sortBy;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSortBy(opt.value);
                            setSortDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 text-left cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-500/20 shadow-xs'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-emerald-700 text-white shadow-xs shadow-emerald-700/30'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <MaterialIcon name={opt.icon} size={15} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs leading-tight font-bold">{opt.label}</span>
                              <span className="text-[10px] font-normal text-slate-400 leading-tight">
                                {opt.hint}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <MaterialIcon name="check" size={16} className="text-emerald-700 font-bold" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Skeleton Loading Grid */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-4 animate-pulse">
                <div className="w-full h-48 bg-slate-200 rounded-xl"></div>
                <div className="h-5 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-4 bg-slate-100 rounded-md w-1/2"></div>
                <div className="h-10 bg-slate-200 rounded-xl w-full"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center space-y-3 my-8 max-w-lg mx-auto shadow-sm">
            <MaterialIcon name="error_outline" size={36} className="text-rose-600 mx-auto" />
            <p className="font-bold text-sm">{error}</p>
            <button
              onClick={fetchProducts}
              className="inline-flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-rose-700 transition cursor-pointer shadow-md"
            >
              <MaterialIcon name="refresh" size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!loading && !error && (
          <>
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id || product.itemName}
                    product={product}
                    onCardClick={(prod) => setActiveProduct(prod)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <MaterialIcon name="remove_shopping_cart" size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800">No products found</h3>
                <p className="text-slate-500 text-xs mt-1 font-medium">Try adjusting your search keywords or switching category filters.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                    setSortBy('default');
                  }}
                  className="mt-5 bg-[#0D4715] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#1b5e20] transition cursor-pointer shadow-md"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Quick View Product Modal */}
      {activeProduct && (
        <ProductModal
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
        />
      )}
    </div>
  );
};

export default Home;
