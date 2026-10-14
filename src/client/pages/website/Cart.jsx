import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getProductImageUrl, DEFAULT_PRODUCT_IMAGE } from '../../utils/imageHelper';
import { useToast } from '../../components/common/Toast';
import CustomerAuthModal from '../../components/website/CustomerAuthModal';
import MapLocationPickerModal from '../../components/website/MapLocationPickerModal';
import MaterialIcon from '../../components/common/MaterialIcon';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, clearCart, getTotalPrice, checkout } = useCart();
  const { customer } = useAuth();
  const activeUser = customer;
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  const [shippingDetails, setShippingDetails] = useState({
    fullName: '',
    phone: '',
    location: '',
    address: '',
    landmark: '',
    mapUrl: '',
    maplink: '',
    pincode: '',
    Pincode: '',
    addressType: 'Home',
    deliveryInstructions: 'Leave at doorstep',
    paymentMethod: 'COD',
  });
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  const items = Object.values(cart);
  const rawTotalPrice = getTotalPrice();

  // Prevent background scrolling when Delivery or Auth modal is open
  useEffect(() => {
    if (isModalOpen || authModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isModalOpen, authModalOpen]);

  // Calculate discount based on promo code
  const discountAmount = appliedPromo ? appliedPromo.discount : 0;
  const finalTotalPrice = Math.max(0, rawTotalPrice - discountAmount);

  // FIX: Promo validation is now server-side — codes are never stored in the client bundle
  const [promoLoading, setPromoLoading] = useState(false);

  const handleApplyPromo = async (e) => {
    e.preventDefault();
    setPromoError('');
    const code = promoInput.trim().toUpperCase();

    if (!code) {
      setPromoError('Please enter a promo code.');
      return;
    }

    setPromoLoading(true);
    try {
      const res = await axios.post('/website/promo/validate', { code, cartTotal: rawTotalPrice });
      if (res.data?.success) {
        setAppliedPromo({ code: res.data.code, discount: res.data.discount, description: res.data.description });
        showSuccess(`Promo code ${res.data.code} applied! You save ₹${res.data.discount}`);
        setPromoInput('');
      } else {
        setPromoError(res.data?.message || 'Invalid promo code.');
      }
    } catch (err) {
      setPromoError(err.response?.data?.message || 'Invalid promo code.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError('');
  };

  // Helper to parse saved address format or object
  const parseAddressString = (rawAddr) => {
    if (!rawAddr) return { tag: 'Home', location: '', landmark: '', mapUrl: '', maplink: '', pincode: '', Pincode: '', text: '' };
    if (typeof rawAddr === 'object') {
      const loc = rawAddr.location || rawAddr.text || rawAddr.street || '';
      const lmk = rawAddr.landmark || '';
      const url = rawAddr.mapUrl || rawAddr.maplink || rawAddr.mapLink || '';
      const pin = rawAddr.pincode || rawAddr.Pincode || '';
      return { tag: rawAddr.tag || 'Home', location: loc, landmark: lmk, mapUrl: url, maplink: url, pincode: pin, Pincode: pin, text: loc };
    }

    let str = String(rawAddr || '').trim();
    let tag = 'Home';
    const tagMatch = str.match(/^\[(.*?)\]\s*(.*)$/);
    if (tagMatch) {
      tag = tagMatch[1];
      str = tagMatch[2].trim();
    }
    let pincode = '';
    const pinMatch = str.match(/(?:[-,\s]+(?:Pincode|Pin|PIN)?[:\s]*)?(\b\d{6}\b)\s*$/i);
    if (pinMatch) {
      pincode = pinMatch[1];
      str = str.replace(/(?:[-,\s]+(?:Pincode|Pin|PIN)?[:\s]*)?\b\d{6}\b\s*$/i, '').trim();
      str = str.replace(/[-,\s]+$/, '').trim();
    }
    return { tag, location: str, landmark: '', mapUrl: '', maplink: '', pincode, Pincode: pincode, text: str };
  };

  const handleDetectGPSLocation = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const link = `https://maps.google.com/?q=${latitude},${longitude}`;
        setShippingDetails((prev) => ({ ...prev, mapUrl: link, maplink: link }));
        setDetectingLocation(false);
        showSuccess('Live GPS Location link captured in Map URL!');
      },
      (err) => {
        setDetectingLocation(false);
        showError('Unable to get GPS coordinates. Please paste Google Maps link.');
      },
      { timeout: 10000 }
    );
  };

  const handleConfirmMapLocation = ({ mapUrl, formattedAddress, pincode, landmark }) => {
    setShippingDetails((prev) => ({
      ...prev,
      mapUrl: mapUrl || prev.mapUrl,
      maplink: mapUrl || prev.maplink,
      address: !prev.address?.trim() && formattedAddress ? formattedAddress : prev.address,
      location: !prev.location?.trim() && formattedAddress ? formattedAddress : prev.location,
      pincode: !prev.pincode?.trim() && pincode ? pincode : prev.pincode,
      Pincode: !prev.Pincode?.trim() && pincode ? pincode : prev.Pincode,
      landmark: !prev.landmark?.trim() && landmark ? landmark : prev.landmark,
    }));
    showSuccess('Delivery location selected on map!');
  };

  const handleOpenCheckoutModal = () => {
    if (!activeUser) {
      setAuthModalOpen(true);
      return;
    }
    const customerAddrList = Array.isArray(customer?.address) ? customer.address : (Array.isArray(customer?.addresses) ? customer.addresses : []);
    const defaultAddr = customerAddrList.length > 0 ? customerAddrList[0] : (customer?.address || null);
    const parsed = parseAddressString(defaultAddr);

    setShippingDetails((prev) => ({
      ...prev,
      fullName: activeUser.name || prev.fullName || '',
      phone: activeUser.mobile || activeUser.phone || prev.phone || '',
      location: parsed.location || prev.location || '',
      address: parsed.location || prev.address || '',
      landmark: parsed.landmark || prev.landmark || '',
      mapUrl: parsed.mapUrl || prev.mapUrl || '',
      maplink: parsed.mapUrl || prev.maplink || '',
      pincode: parsed.pincode || prev.pincode || '',
      Pincode: parsed.pincode || prev.Pincode || '',
      addressType: parsed.tag || prev.addressType || 'Home',
    }));
    setIsModalOpen(true);
  };

  const handleFinalCheckout = async (e) => {
    e.preventDefault();

    const cleanPhoneVal = String(shippingDetails.phone || activeUser?.mobile || '').replace(/\D/g, '').slice(-10);
    if (cleanPhoneVal.length !== 10) {
      showError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    const cleanPincode = String(shippingDetails.Pincode || shippingDetails.pincode || '').trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      showError('Please enter a valid 6-digit numerical Pincode.');
      return;
    }

    const cleanLocation = String(shippingDetails.location || shippingDetails.address || '').trim();
    if (!cleanLocation) {
      showError('Please enter your delivery location/address.');
      return;
    }

    setCheckoutLoading(true);

    const addressObj = {
      location: cleanLocation,
      landmark: String(shippingDetails.landmark || '').trim(),
      maplink: String(shippingDetails.maplink || '').trim(),
      Pincode: cleanPincode
    };

    const checkoutPayload = {
      ...shippingDetails,
      phone: cleanPhoneVal,
      address: addressObj,
      location: addressObj.location,
      landmark: addressObj.landmark,
      maplink: addressObj.maplink,
      Pincode: cleanPincode,
      pincode: cleanPincode,
      customerId: activeUser?.id,
      customerName: activeUser?.name || shippingDetails.fullName,
      customerMobile: cleanPhoneVal,
      discount: discountAmount,
      appliedCoupon: appliedPromo?.code || null,
      finalAmount: finalTotalPrice,
    };

    const res = await checkout(checkoutPayload);
    setCheckoutLoading(false);

    if (res.success) {
      setIsModalOpen(false);
      showSuccess(res.message || 'Order placed successfully! Delivery on its way.');
      setTimeout(() => navigate('/my-orders'), 1500);
    } else {
      showError(res.message || 'Failed to place order.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* BREADCRUMB & STEP PROGRESS BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Link to="/" className="hover:text-emerald-700 transition">Home</Link>
              <span>/</span>
              <span className="text-slate-800 font-bold">Shopping Cart</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Review Shopping Cart
              </h1>
              {items.length > 0 && (
                <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-2.5 py-1 rounded-full border border-emerald-300/60">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {items.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm) {
                    // FIX: Use a custom confirm — window.confirm is not stylable and blocked in some browsers
                    const confirmed = window.confirm('Are you sure you want to empty your cart?');
                    if (confirmed) { clearCart(); showSuccess('Cart cleared.'); }
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/60 transition cursor-pointer"
                title="Clear all items"
              >
                <MaterialIcon name="delete_sweep" size={16} />
                <span>Clear Cart</span>
              </button>
            )}

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:text-emerald-700 hover:bg-slate-100 border border-slate-200 shadow-xs transition"
            >
              <MaterialIcon name="arrow_back" size={16} />
              <span>Continue Shopping</span>
            </Link>
          </div>
        </div>

        {/* EMPTY STATE */}
        {items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xs border border-slate-200/80 space-y-6 max-w-xl mx-auto my-12">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-50 to-teal-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-inner">
              <MaterialIcon name="remove_shopping_cart" size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Your Basket is Empty</h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
                Explore our catalog of farm-fresh fruits, organic vegetables, dairy staples, and packaged essentials to stock up your pantry!
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-[#0D4715] hover:bg-[#1b5e20] text-white font-extrabold px-6 py-3.5 rounded-2xl transition shadow-lg shadow-emerald-950/20 text-sm hover:scale-[1.02]"
              >
                <MaterialIcon name="storefront" size={20} />
                <span>Start Shopping Now</span>
              </Link>
            </div>
          </div>
        ) : (
          /* CART CONTENT GRID */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* ITEMS LIST (Span 8) */}
            <div className="lg:col-span-8 space-y-4">

              {/* Freshness Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-900 font-semibold">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="eco" size={18} className="text-emerald-700" />
                  <span>All grocery items are fresh-packed and hygienically sealed prior to dispatch.</span>
                </div>
                <span className="hidden sm:inline font-bold text-emerald-800 bg-white/80 px-2.5 py-0.5 rounded-full text-[11px] border border-emerald-200">
                  Instant Dispatch
                </span>
              </div>

              {/* Items Card List */}
              <div className="space-y-3">
                {items.map((item) => {
                  const itemPrice = Number(item.price || 0);
                  const itemTotal = itemPrice * item.quantity;

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-200 hover:shadow-md hover:border-emerald-500/30 group"
                    >
                      {/* Product Media & Details */}
                      <div className="flex items-center gap-4 w-full sm:w-auto flex-1 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={getProductImageUrl(item, 'jpg_300')}
                            alt={item.itemName}
                            className="w-20 h-20 sm:w-22 sm:h-22 object-cover rounded-2xl bg-slate-50 border border-slate-100 group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = DEFAULT_PRODUCT_IMAGE;
                            }}
                          />
                          {item.category && (
                            <span className="absolute bottom-1 left-1 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                              {item.category}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight truncate">
                            {item.itemName}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">
                              ₹{itemPrice.toLocaleString('en-IN')}
                            </span>
                            {item.unit && (
                              <span className="text-[11px] font-medium text-slate-400">
                                / {item.unit}
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <MaterialIcon name="check_circle" size={13} />
                            In Stock • Same-Day Delivery
                          </span>
                        </div>
                      </div>

                      {/* Quantity Stepper & Price Column */}
                      <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0">

                        {/* Stepper */}
                        <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200/60 shadow-inner">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-xs text-slate-700 hover:text-rose-600 transition font-bold cursor-pointer hover:scale-105 active:scale-95"
                            aria-label="Decrease quantity"
                          >
                            <MaterialIcon name={item.quantity === 1 ? 'delete' : 'remove'} size={15} />
                          </button>

                          <span className="w-9 text-center font-black text-slate-900 text-sm select-none">
                            {item.quantity}
                          </span>

                          <button
                            disabled={item.op_stock !== undefined && item.quantity >= Number(item.op_stock)}
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-xs text-slate-700 hover:text-emerald-700 transition font-bold cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Increase quantity"
                            title={item.op_stock !== undefined && item.quantity >= Number(item.op_stock) ? 'Maximum stock reached' : 'Increase quantity'}
                          >
                            <MaterialIcon name="add" size={15} />
                          </button>
                        </div>

                        {/* Item Total Price */}
                        <div className="text-right min-w-[80px]">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                            Total
                          </span>
                          <span className="font-black text-slate-950 text-base sm:text-lg">
                            ₹{itemTotal.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Remove Action */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                          title="Remove item from cart"
                          aria-label="Remove item"
                        >
                          <MaterialIcon name="delete_outline" size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ORDER SUMMARY SIDEBAR (Span 4) */}
            <div className="lg:col-span-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/90 sticky top-24 space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <MaterialIcon name="receipt_long" size={22} className="text-emerald-800" />
                    <span>Order Summary</span>
                  </h2>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {items.length} Items
                  </span>
                </div>

                {/* Promo Code Input Box */}
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-black tracking-wider text-slate-400 block">
                    Have a Promo Code?
                  </label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <MaterialIcon name="local_offer" size={16} className="text-emerald-700" />
                        <div>
                          <span>{appliedPromo.code}</span>
                          <span className="text-[10px] font-medium text-emerald-700 block">
                            {appliedPromo.description}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleRemovePromo}
                        className="text-rose-600 hover:text-rose-800 text-xs font-black underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyPromo} className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Enter promo code"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition uppercase"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition shadow-xs cursor-pointer shrink-0"
                      >
                        Apply
                      </button>
                    </form>
                  )}
                  {promoError && (
                    <p className="text-[11px] font-semibold text-rose-600">{promoError}</p>
                  )}
                </div>

                {/* Breakdown Costs */}
                <div className="space-y-3 text-xs sm:text-sm text-slate-600 font-medium">
                  <div className="flex justify-between items-center">
                    <span>Items Subtotal</span>
                    <span className="font-bold text-slate-900">₹{rawTotalPrice.toLocaleString('en-IN')}</span>
                  </div>

                  {appliedPromo && (
                    <div className="flex justify-between items-center text-emerald-700 font-bold">
                      <span className="flex items-center gap-1">
                        <MaterialIcon name="discount" size={15} />
                        Coupon Savings ({appliedPromo.code})
                      </span>
                      <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <span>Delivery Fee</span>
                      <span className="line-through text-slate-400 text-xs font-normal">₹40</span>
                    </span>
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs border border-emerald-200">
                      FREE EXPRESS
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Applicable Taxes & GST</span>
                    <span className="text-slate-500 font-semibold text-xs">Included in price</span>
                  </div>
                </div>

                {/* Grand Total Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-950 to-slate-900 text-white space-y-1 shadow-md">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs uppercase font-bold text-slate-300 tracking-wider">
                      Grand Total
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                      ₹{finalTotalPrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Guaranteed best prices • No hidden checkout fees
                  </p>
                </div>

                {/* Primary CTA Button */}
                <button
                  onClick={handleOpenCheckoutModal}
                  className="w-full bg-[#0D4715] hover:bg-[#1b5e20] text-white font-extrabold py-4 px-4 rounded-2xl transition-all shadow-lg shadow-emerald-950/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                >
                  <MaterialIcon name="lock" size={18} />
                  <span>Proceed to Delivery & Checkout</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* DELIVERY DETAILS & PAYMENT METHOD CHECKOUT MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overscroll-contain overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[88vh] flex flex-col overscroll-contain my-auto overflow-hidden">

            {/* Modal Header (Pinned) */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0D4715] to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-950/20 shrink-0">
                    <MaterialIcon name="local_shipping" size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                        Delivery & Payment Details
                      </h2>
                      <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                        <MaterialIcon name="bolt" size={12} />
                        30-Min Express
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5">
                      Confirm your doorstep address & choose your preferred payment mode
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer shrink-0 ml-2"
                  aria-label="Close modal"
                >
                  <MaterialIcon name="close" size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleFinalCheckout} className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5">

              {/* SECTION 1: CONTACT INFORMATION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold flex items-center justify-center">1</span>
                    Contact Information
                  </span>
                  {activeUser && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ✓ Verified Customer
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Full Name *</label>
                    <div className="relative">
                      <MaterialIcon name="person" size={17} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={shippingDetails.fullName}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, fullName: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                        placeholder="e.g. John Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Mobile Phone Number *</label>
                    <div className="relative">
                      <MaterialIcon name="phone"
                          autoComplete="tel" size={17} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={shippingDetails.phone}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, phone: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                        placeholder="10-digit mobile number"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: SHIPPING DESTINATION */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold flex items-center justify-center">2</span>
                    Shipping Destination
                  </span>

                  {/* Address Tag Selector */}
                  <div className="flex items-center gap-1.5">
                    {['Home', 'Work', 'Other'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setShippingDetails({ ...shippingDetails, addressType: type })}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${(shippingDetails.addressType || 'Home') === type
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-fill from Saved Profile Addresses */}
                {((Array.isArray(customer?.address) && customer.address.length > 0) || (Array.isArray(customer?.addresses) && customer.addresses.length > 0)) && (
                  <div className="space-y-1.5 pb-1 bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/70">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-black text-emerald-950 flex items-center gap-1">
                        <MaterialIcon name="saved_search" size={15} className="text-emerald-700" />
                        <span>Auto-Fill from Profile:</span>
                      </span>
                      <Link to="/account" className="text-[10px] text-emerald-800 hover:underline font-bold">
                        Manage Addresses &rarr;
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {(Array.isArray(customer?.address) && customer.address.length > 0 ? customer.address : customer.addresses).map((addrItem, i) => {
                        const p = parseAddressString(addrItem);
                        const isSelected = (shippingDetails.location === p.location || shippingDetails.address === p.location) && (!p.pincode || shippingDetails.pincode === p.pincode);

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setShippingDetails((prev) => ({
                                ...prev,
                                location: p.location,
                                address: p.location,
                                landmark: p.landmark,
                                mapUrl: p.mapUrl,
                                maplink: p.mapUrl,
                                pincode: p.pincode || prev.pincode,
                                Pincode: p.pincode || prev.Pincode,
                                addressType: p.tag || 'Home',
                              }));
                              showSuccess(`Auto-filled ${p.tag} address and Pincode ${p.pincode || ''}!`);
                            }}
                            className={`text-left px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'bg-white border-emerald-700 text-emerald-950 font-bold shadow-xs ring-2 ring-emerald-600/30'
                                : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="text-[10px] uppercase font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-950">
                              {p.tag}
                            </span>
                            <span className="truncate max-w-[140px] sm:max-w-[180px]">{p.location}</span>
                            {p.pincode && (
                              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded">
                                PIN: {p.pincode}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Location / Street Address *</label>
                  <div className="relative">
                    <textarea
                      required
                      rows={2}
                      value={shippingDetails.location || shippingDetails.address}
                      onChange={(e) => setShippingDetails({ ...shippingDetails, location: e.target.value, address: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white transition resize-none"
                      placeholder="Flat / House No, Building, Street Name, Area & City..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Nearby Landmark</label>
                    <div className="relative">
                      <MaterialIcon name="flag" size={17} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={shippingDetails.landmark}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, landmark: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                        placeholder="e.g. Near Bus Stand, Opp Temple"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Google Maps Link (mapUrl)</label>
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className="text-[11px] font-bold text-[#0D4715] hover:text-[#1b5e20] bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200/60 flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                      >
                        <MaterialIcon name="map" size={14} filled />
                        <span>Choose on Map</span>
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <MaterialIcon name="map" size={17} className="absolute left-3.5 text-slate-400" />
                      <input
                        type="url"
                        value={shippingDetails.mapUrl || shippingDetails.maplink}
                        onClick={() => setIsMapPickerOpen(true)}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, mapUrl: e.target.value, maplink: e.target.value })}
                        className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white transition cursor-pointer"
                        placeholder="Click to choose on map or paste map link"
                      />
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className="absolute right-2 px-2.5 py-1 bg-[#0D4715] hover:bg-[#1b5e20] text-white text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <MaterialIcon name="edit_location_alt" size={13} />
                        <span>Pick</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Area Pincode *</label>
                    <div className="relative">
                      <MaterialIcon name="pin_drop" size={17} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={shippingDetails.Pincode || shippingDetails.pincode}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, Pincode: e.target.value, pincode: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                        placeholder="e.g. 638011"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Delivery Zone & City</label>
                    <div className="relative">
                      <MaterialIcon name="location_city" size={17} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        readOnly
                        value="Erode, Tamil Nadu"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Drop-off Preference Chips */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-500">Delivery Drop-off Preference:</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Leave at doorstep', icon: 'door_front' },
                      { label: 'Call upon arrival', icon: 'ring_volume' },
                      { label: 'Deliver to security', icon: 'shield' },
                    ].map((pref) => {
                      const isSelected = (shippingDetails.deliveryInstructions || 'Leave at doorstep') === pref.label;
                      return (
                        <button
                          key={pref.label}
                          type="button"
                          onClick={() => setShippingDetails({ ...shippingDetails, deliveryInstructions: pref.label })}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border ${isSelected
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                          <MaterialIcon name={pref.icon} size={14} className={isSelected ? 'text-emerald-700' : 'text-slate-400'} />
                          <span>{pref.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 3: PAYMENT METHOD */}
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold flex items-center justify-center">3</span>
                  Select Payment Mode
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">

                  {/* COD */}
                  <button
                    type="button"
                    onClick={() => setShippingDetails({ ...shippingDetails, paymentMethod: 'COD' })}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer relative ${shippingDetails.paymentMethod === 'COD'
                      ? 'bg-emerald-50/90 border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/30 shadow-xs'
                      : 'bg-slate-50/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <MaterialIcon name="payments" size={16} />
                      </div>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-950">
                        Zero Risk
                      </span>
                    </div>
                    <div>
                      <span className="font-extrabold text-xs block text-slate-900">Cash / UPI at Door</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Pay after receiving order</span>
                    </div>
                  </button>

                  {/* UPI */}
                  <button
                    type="button"
                    onClick={() => setShippingDetails({ ...shippingDetails, paymentMethod: 'UPI' })}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer relative ${shippingDetails.paymentMethod === 'UPI'
                      ? 'bg-emerald-50/90 border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/30 shadow-xs'
                      : 'bg-slate-50/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <MaterialIcon name="qr_code_scanner" size={16} />
                      </div>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">
                        Instant
                      </span>
                    </div>
                    <div>
                      <span className="font-extrabold text-xs block text-slate-900">Instant Online UPI</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">GPay, PhonePe, Paytm</span>
                    </div>
                  </button>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => setShippingDetails({ ...shippingDetails, paymentMethod: 'Card' })}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer relative ${shippingDetails.paymentMethod === 'Card'
                      ? 'bg-emerald-50/90 border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/30 shadow-xs'
                      : 'bg-slate-50/90 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <MaterialIcon name="credit_card" size={16} />
                      </div>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-900">
                        Secure
                      </span>
                    </div>
                    <div>
                      <span className="font-extrabold text-xs block text-slate-900">Cards / Netbanking</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Visa, RuPay, Master</span>
                    </div>
                  </button>

                </div>
              </div>

              {/* SECTION 4: MINI RECEIPT SNAPSHOT */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>Order Items ({items.length} items):</span>
                  <span>₹{rawTotalPrice.toLocaleString('en-IN')}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>Coupon Savings ({appliedPromo.code}):</span>
                    <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>Hyperlocal Dispatch:</span>
                  <span className="font-black text-emerald-700">FREE EXPRESS</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-slate-800 font-bold">
                  <span className="flex items-center gap-1.5">
                    <MaterialIcon name="schedule" size={14} className="text-emerald-700" />
                    Estimated Doorstep Arrival:
                  </span>
                  <span className="text-emerald-900 font-black">Within 30–45 Mins</span>
                </div>
              </div>

              {/* SECTION 5: PINNED SUBMIT ACTION */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                    Total Amount to Pay
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-800">
                      ₹{finalTotalPrice.toLocaleString('en-IN')}
                    </span>
                    {appliedPromo && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Saved ₹{discountAmount}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="w-full sm:w-auto bg-[#0D4715] hover:bg-[#1b5e20] text-white font-black py-4 px-8 rounded-2xl transition-all shadow-lg shadow-emerald-950/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  {checkoutLoading ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      <span>Processing Order...</span>
                    </div>
                  ) : (
                    <>
                      <MaterialIcon name="verified" size={18} />
                      <span>Confirm & Place Order</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER AUTH MODAL */}
      {authModalOpen && (
        <CustomerAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            setAuthModalOpen(false);
            handleOpenCheckoutModal();
          }}
        />
      )}

      {/* AMAZON-STYLE MAP LOCATION PICKER MODAL */}
      <MapLocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        initialMapUrl={shippingDetails.mapUrl || shippingDetails.maplink}
        onConfirmLocation={handleConfirmMapLocation}
        title="Choose Delivery Address on Map"
      />
    </div>
  );
};

export default Cart;
