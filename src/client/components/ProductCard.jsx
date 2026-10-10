import React from 'react';
import { useCart } from '../context/CartContext';
import { getProductImageUrl, DEFAULT_PRODUCT_IMAGE } from '../utils/imageHelper';
import MaterialIcon from './common/MaterialIcon';

const ProductCard = ({ product, onCardClick }) => {
  const { cart, addToCart, updateQuantity } = useCart();
  const cartItem = cart[product.id];
  const qty = cartItem ? cartItem.quantity : 0;
  const stock = Number(product.op_stock || 0);

  // FIX: Safe price display — handle null/undefined/non-numeric values
  const displayPrice = parseFloat(product.price);
  const priceStr = isNaN(displayPrice) ? '—' : displayPrice.toLocaleString('en-IN');

  const handleCardClick = () => onCardClick && onCardClick(product);
  const handleCardKeyDown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } };

  return (
    <div className="bg-white rounded-2xl shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full group">

      {/* FIX: role="button" + tabIndex + aria-label for screen readers */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`View details for ${product.itemName}`}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className="relative h-44 sm:h-52 overflow-hidden bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
      >
        {/* FIX: loading="lazy" to avoid loading all images at once */}
        <img
          src={getProductImageUrl(product, 'jpg_300')}
          alt={product.itemName || 'Product'}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PRODUCT_IMAGE; }}
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-[#0D4715] shadow-xs">
          {product.category || 'Grocery'}
        </div>
        {stock <= 0 && (
          <div className="absolute top-3 left-3 bg-rose-600/90 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
            Out of Stock
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-white/90 text-gray-900 text-xs font-extrabold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 backdrop-blur-md">
            <MaterialIcon name="visibility" size={16} className="text-[#0D4715]" /> Quick View
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow">
        <div role="button" tabIndex={0} onClick={handleCardClick} onKeyDown={handleCardKeyDown} className="cursor-pointer focus:outline-none">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-gray-900 text-lg line-clamp-1 flex-1 pr-2 hover:text-[#0D4715] transition" title={product.itemName}>
              {product.itemName}
            </h3>
            <div className="text-right">
              {/* FIX: safe price with toLocaleString */}
              <span className="text-[#0D4715] font-extrabold text-lg">₹{priceStr}</span>
              {product.unit && <span className="text-xs text-gray-400 block font-medium">/ {product.unit}</span>}
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-4 line-clamp-2 min-h-[40px] leading-relaxed">
            {product.description || 'Fresh quality produce sourced directly for your daily household needs.'}
          </p>
        </div>

        {/* Cart controls */}
        <div className="mt-auto pt-3 border-t border-gray-50">
          {qty > 0 ? (
            <div className="flex items-center justify-between bg-[#EBF4DD] rounded-xl p-1.5 w-full">
              <button
                onClick={() => updateQuantity(product.id, -1)}
                className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-xs text-[#0D4715] hover:bg-gray-100 transition font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label={`Remove one ${product.itemName} from cart`}
              >
                <MaterialIcon name="remove" size={18} />
              </button>
              <span className="font-extrabold text-[#0D4715] text-base px-3" aria-live="polite" aria-label={`${qty} in cart`}>{qty}</span>
              <button
                disabled={qty >= stock}
                onClick={() => updateQuantity(product.id, 1)}
                className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-xs text-[#0D4715] hover:bg-gray-100 transition font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label={qty >= stock ? 'Maximum stock reached' : `Add one more ${product.itemName}`}
              >
                <MaterialIcon name="add" size={18} />
              </button>
            </div>
          ) : (
            <button
              disabled={stock <= 0}
              onClick={() => addToCart(product)}
              className="w-full bg-[#0D4715] hover:bg-[#41644A] text-white font-bold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              aria-label={stock <= 0 ? `${product.itemName} is out of stock` : `Add ${product.itemName} to cart`}
            >
              <MaterialIcon name="shopping_cart" size={18} />
              <span>{stock <= 0 ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
