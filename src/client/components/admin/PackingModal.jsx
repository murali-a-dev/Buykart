import React, { useState } from 'react';
import axios from 'axios';
import MaterialIcon from '../common/MaterialIcon';

const PackingModal = ({ order, isOpen, onClose, onSuccess }) => {
  if (!isOpen || !order) return null;

  const itemsList = Object.values(order.items || {});

  const [packedQuantities, setPackedQuantities] = useState(() => {
    const initial = {};
    itemsList.forEach((item, idx) => {
      initial[idx] = item.quantity || 1;
    });
    return initial;
  });

  const [remarks, setRemarks] = useState(order.packingRemarks || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQtyChange = (idx, value) => {
    setPackedQuantities((prev) => ({
      ...prev,
      [idx]: Math.max(0, Number(value)),
    }));
  };

  const handleSavePacking = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const packedItemsPayload = itemsList.map((item, idx) => ({
      ...item,
      expectedQuantity: item.quantity || 1,
      packedQuantity: packedQuantities[idx] ?? (item.quantity || 1),
    }));

    try {
      await axios.put(`/admin/orders/${order.id}/pack`, {
        packedItems: packedItemsPayload,
        packingRemarks: remarks,
      });
      setLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || 'Failed to save packing details');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold border border-purple-500/30">
              <MaterialIcon name="inventory" size={22} />
            </div>
            <div>
              <h3 className="text-base font-black">Order Packing Verification</h3>
              <p className="text-xs text-slate-400">
                Order #{order.id?.substring(0, 8).toUpperCase()} • Customer:{' '}
                {order.userName || order.customerName || 'Customer'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <MaterialIcon name="close" size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSavePacking} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
              <MaterialIcon name="error" size={18} className="text-rose-600 shrink-0" filled />
              <span>{error}</span>
            </div>
          )}

          {/* Customer & Address Details */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-400 block uppercase text-[10px]">Customer Name</span>
              <p className="font-black text-slate-900 text-sm mt-0.5">
                {order.userName || order.customerName || 'N/A'}
              </p>
              <p className="text-slate-500 font-medium">
                {order.customerMobile || order.shippingDetails?.phone || 'No phone'}
              </p>
            </div>
            <div>
              <span className="font-bold text-slate-400 block uppercase text-[10px]">Delivery Address</span>
              <p className="font-semibold text-slate-800 leading-snug mt-0.5">
                {order.deliveryAddress ||
                  `${order.shippingDetails?.location || order.shippingDetails?.address || ''}, ${order.shippingDetails?.Pincode || order.shippingDetails?.pincode || ''}`}
              </p>
              {(order.address?.landmark || order.landmark || order.shippingDetails?.landmark) && (
                <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
                  Landmark: {order.address?.landmark || order.landmark || order.shippingDetails?.landmark}
                </p>
              )}
            </div>
          </div>

          {/* Products Packing Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <MaterialIcon name="checklist" size={16} className="text-[#0D4715]" />
              Item Packing Checklist
            </h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Ordered</th>
                    <th className="p-3 text-center">Packed</th>
                    <th className="p-3 text-center">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {itemsList.map((item, idx) => {
                    const expected = item.quantity || 1;
                    const currentPacked = packedQuantities[idx] ?? expected;
                    const isMatched = currentPacked === expected;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold">{item.itemName}</td>
                        <td className="p-3 text-center font-black text-slate-900">
                          {expected} {item.unit || ''}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={currentPacked}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-black text-sm focus:ring-2 focus:ring-purple-600"
                          />
                        </td>
                        <td className="p-3 text-center">
                          {isMatched ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                              <MaterialIcon name="check" size={14} /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black">
                              Adjusted
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Packing Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Packing Remarks / Special Handling
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Produce double-checked for freshness, packaged in eco bags."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-purple-600 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <MaterialIcon
                name={loading ? 'sync' : 'check'}
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              <span>{loading ? 'Saving Packing Details...' : 'Mark Order as Packed'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackingModal;
