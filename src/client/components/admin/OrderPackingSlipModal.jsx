import React, { useRef } from 'react';
import MaterialIcon from '../common/MaterialIcon';

/**
 * Printable Packing Slip / Invoice Modal
 * Provides warehouse operators and delivery riders with a clean,
 * standardized physical slip including barcode style IDs, checklist,
 * items, customer information, and fulfillment sign-offs.
 */
const OrderPackingSlipModal = ({ order, isOpen, onClose }) => {
  const printAreaRef = useRef(null);

  if (!isOpen || !order) return null;

  const itemsList = Object.values(order.items || {});
  const shipping = order.shippingDetails || {};
  const totalAmount =
    order.total ||
    itemsList.reduce(
      (sum, item) => sum + Number(item.price || 0) * (item.quantity || 1),
      0
    );

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('en-IN');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-8">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="print:hidden bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <MaterialIcon name="receipt_long" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Warehouse Packing Slip</h3>
              <p className="text-[11px] text-slate-400">Order #{order.id?.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <MaterialIcon name="print" size={15} />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <MaterialIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Printable Packing Slip Area */}
        <div ref={printAreaRef} className="p-6 sm:p-8 space-y-6 text-slate-800 font-sans bg-white print:p-0 print:m-0">
          {/* Slip Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-950">BUYKART</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide">
                  Express Darkstore
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Fulfillment & Delivery Dispatch Note</p>
            </div>

            <div className="text-right space-y-0.5">
              <div className="font-mono text-sm font-black text-slate-900">
                #{order.id?.toUpperCase()}
              </div>
              <div className="text-[11px] text-slate-500">{formattedDate}</div>
              <div className="inline-block px-2 py-0.5 mt-1 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold font-mono tracking-widest text-slate-700">
                STATUS: {order.status?.toUpperCase() || 'PENDING'}
              </div>
            </div>
          </div>

          {/* Customer & Delivery Coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Deliver To:
              </span>
              <p className="font-bold text-slate-900 text-sm">
                {order.userName || order.customerName || 'Customer'}
              </p>
              <p className="text-slate-600 mt-0.5 font-medium">
                {order.customerMobile || shipping.phone || 'Phone Not Provided'}
              </p>
              <p className="text-slate-600 mt-1 leading-relaxed">
                {order.deliveryAddress || `${shipping.location || shipping.address || ''} ${shipping.Pincode || shipping.pincode ? `- ${shipping.Pincode || shipping.pincode}` : ''}`}
              </p>
              {(order.address?.landmark || order.landmark || shipping.landmark) && (
                <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
                  Landmark: {order.address?.landmark || order.landmark || shipping.landmark}
                </p>
              )}
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4 space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Payment Mode
                </span>
                <span className="font-bold text-slate-900 text-xs inline-flex items-center gap-1 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${order.paymentMethod === 'Online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {order.paymentMethod || shipping.paymentMethod || 'Cash On Delivery'}
                </span>
              </div>

              {order.assignedRiderName && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Assigned OnTime Rider
                  </span>
                  <p className="font-semibold text-slate-800 text-xs">
                    {order.assignedRiderName} ({order.assignedRiderMobile || 'N/A'})
                  </p>
                  {order.vehicleDetails && (
                    <p className="text-[11px] text-slate-500">{order.vehicleDetails}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Checklist & Items Table */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Item Fulfillment Checklist ({itemsList.length} items)
              </span>
              <span className="text-[11px] text-slate-400">Verify unit weight & tamper seal</span>
            </div>

            <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-8 text-center">✓</th>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-center">Unit / Qty</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {itemsList.map((item, idx) => {
                  const qty = item.packedQuantity ?? item.quantity ?? 1;
                  const unitPrice = Number(item.price || 0);
                  const lineTotal = unitPrice * qty;

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center">
                        <div className="w-4 h-4 border border-slate-400 rounded-xs mx-auto" />
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {item.itemName}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-medium">
                        {qty} {item.unit || ''}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 font-mono">
                        ₹{unitPrice}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                        ₹{lineTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold text-slate-700 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[11px] tracking-wider font-bold">
                    Order Grand Total:
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-sm text-slate-950 font-mono">
                    ₹{Number(totalAmount).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Packing Remarks if any */}
          {order.packingRemarks && (
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-xs text-purple-900">
              <strong className="font-bold">Packing Station Note:</strong> {order.packingRemarks}
            </div>
          )}

          {/* Signatures & Warehouse Verification */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs text-slate-500">
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 mb-1" />
              <p className="font-medium text-slate-600">Packer Signature / Timestamp</p>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 mb-1" />
              <p className="font-medium text-slate-600">Customer Receiver Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPackingSlipModal;
