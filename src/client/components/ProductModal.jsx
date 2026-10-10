import React, { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { getProductImageUrl, DEFAULT_PRODUCT_IMAGE } from '../utils/imageHelper';
import MaterialIcon from './common/MaterialIcon';

const ProductModal = ({ product, onClose }) => {
  const { cart, addToCart, updateQuantity } = useCart();
  const closeBtnRef = useRef(null);
  const firstFocusRef = useRef(null);

  // FIX: Trap focus inside modal and close on Escape
  useEffect(() => {
    if (!product) return;

    // Move focus into modal
    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }

      // Tab key focus trap
      if (e.key === 'Tab') {
        const modal = document.getElementById('product-modal');
        if (!modal) return;
        const focusable = modal.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent background scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [product, onClose]);

  if (!product) return null;

  const cartItem = cart[product.id];
  const qty = cartItem ? cartItem.quantity : 0;
  const stock = Number(product.op_stock || 0);
  const isLowStock = stock > 0 && stock <= 5;
  const isOutOfStock = stock <= 0;
  const displayPrice = parseFloat(product.price);
  const priceStr = isNaN(displayPrice) ? '—' : displayPrice.toLocaleString('en-IN');

  return (
    // FIX: Backdrop click closes modal
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden="true"
    >
      {/* FIX: role="dialog", aria-modal, aria-labelledby for screen readers */}
      <div
        id="product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-product-title"
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Image */}
        <div className="relative h-48 sm:h-64 bg-gray-50 overflow-hidden shrink-0">
          <img
            src={getProductImageUrl(product, 'jpg_700')}
            alt={product.itemName || 'Product'}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PRODUCT_IMAGE; }}
          />
          {/* FIX: ref for initial focus */}
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full shadow-md backdrop-blur-md transition cursor-pointer hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-900"
            aria-label="Close product view"
          >
            <MaterialIcon name="close" size={20} />
          </button>
          <div className="absolute top-4 left-4 bg-[#0D4715] text-white px-3 py-1 rounded-full text-xs font-extrabold shadow-sm">
            {product.category || 'Grocery'}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 id="modal-product-title" className="text-2xl font-extrabold text-gray-900">{product.itemName}</h2>
              {product.unit && <span className="text-xs text-gray-400 font-semibold">Unit: {product.unit}</span>}
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-[#0D4715]">₹{priceStr}</span>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
            {product.description || 'Fresh quality grocery produce sourced directly for your daily household needs.'}
          </p>

          {/* Stock Status */}
          <div className="flex items-center justify-between text-xs font-bold pt-1">
            <span className="text-gray-500 uppercase tracking-wider">Stock Status</span>
            {isOutOfStock ? (
              <span className="text-rose-600 bg-rose-50 px-3 py-1 rounded-full flex items-center gap-1 font-bold">
                <MaterialIcon name="error" size={16} filled /> Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="text-amber-700 bg-amber-50 px-3 py-1 rounded-full flex items-center gap-1 font-bold">
                <MaterialIcon name="warning" size={16} filled /> Only {stock} left
              </span>
            ) : (
              <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1 font-bold">
                <MaterialIcon name="check_circle" size={16} filled /> In Stock ({stock} available)
              </span>
            )}
          </div>

          {/* Cart Controls */}
          <div className="pt-3 border-t border-gray-100">
            {qty > 0 ? (
              <div className="flex items-center justify-between bg-[#EBF4DD] rounded-2xl p-2 w-full">
                <button
                  onClick={() => updateQuantity(product.id, -1)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-xs text-[#0D4715] hover:bg-gray-100 transition font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={`Remove one ${product.itemName} from cart`}
                >
                  <MaterialIcon name="remove" size={20} />
                </button>
                <span className="font-extrabold text-[#0D4715] text-lg px-4" aria-live="polite">{qty} in Cart</span>
                <button
                  disabled={qty >= stock}
                  onClick={() => updateQuantity(product.id, 1)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-xs text-[#0D4715] hover:bg-gray-100 transition font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={qty >= stock ? 'Maximum stock reached' : `Add one more ${product.itemName}`}
                >
                  <MaterialIcon name="add" size={20} />
                </button>
              </div>
            ) : (
              <button
                disabled={isOutOfStock}
                onClick={() => addToCart(product)}
                className="w-full bg-[#0D4715] hover:bg-[#41644A] text-white font-extrabold py-3.5 px-4 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <MaterialIcon name="shopping_cart" size={18} />
                <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
