import { forwardRef } from "react";

/**
 * InvoicePDF - Reusable printable invoice component (green Lobbi theme).
 *
 * Renders a professional invoice layout optimized for browser print / PDF export.
 * Use with window.print() or html2canvas+jspdf for programmatic PDF generation.
 *
 * Props:
 *  - invoice: object with fields below
 *  - compact: boolean (optional, for smaller layout)
 *
 * invoice shape:
 *  {
 *    invoice_no, date, due_date, status,
 *    from_name, from_phone, from_email, from_gstin, from_label (e.g. venue name),
 *    to_name, to_phone, to_email,
 *    items: [{ description, qty, rate, amount }],
 *    subtotal, gst_enabled, gst_rate, gst_amount, total,
 *    payment_mode, notes,
 *  }
 */
const InvoicePDF = forwardRef(function InvoicePDF({ invoice, compact }, ref) {
  if (!invoice) return null;

  const inv = invoice;
  const items = inv.items || [];
  const statusLabel = (inv.status || "draft").toUpperCase();
  const statusColor =
    inv.status === "paid" ? "#bbf7d0" :
    inv.status === "sent" ? "#fde68a" :
    inv.status === "cancelled" ? "#fecaca" : "#cbd5e1";

  const gstHalf = inv.gst_enabled ? (inv.gst_amount || 0) / 2 : 0;
  const halfRate = inv.gst_enabled ? (inv.gst_rate || 18) / 2 : 0;

  return (
    <div
      ref={ref}
      className="bg-white text-gray-900 w-full max-w-[210mm] mx-auto print:shadow-none"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: compact ? 12 : 14 }}
    >
      {/* Green Header */}
      <div className="text-white px-6 py-5 flex items-start justify-between" style={{ background: "#047857", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ letterSpacing: "-0.03em" }}>LOBBI</h1>
          <p className="text-[10px] tracking-widest opacity-80 mt-0.5">for Sports & Fitness</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-black tracking-tight">INVOICE</h2>
          <div className="text-sm space-y-0.5 mt-1 opacity-90">
            <p>No: <span className="font-semibold">{inv.invoice_no}</span></p>
            <p>Date: {inv.date}</p>
          </div>
          <p style={{ color: statusColor }} className="font-bold text-sm mt-1">{statusLabel}</p>
        </div>
      </div>
      {/* Green accent line */}
      <div style={{ height: 3, background: "#059669" }} />

      <div className="px-6 py-5 space-y-6">
        {/* From / Bill To */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#047857" }}>From</p>
            <p className="font-bold">{inv.from_name || inv.from_label || ""}</p>
            {inv.from_label && inv.from_name && inv.from_label !== inv.from_name && (
              <p className="text-sm text-gray-500">{inv.from_label}</p>
            )}
            {inv.from_phone && <p className="text-sm text-gray-500">Ph: {inv.from_phone}</p>}
            {inv.from_email && <p className="text-sm text-gray-500">{inv.from_email}</p>}
            {inv.from_gstin && <p className="text-sm text-gray-500">GSTIN: {inv.from_gstin}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#047857" }}>Bill To</p>
            <p className="font-bold">{inv.to_name || ""}</p>
            {inv.to_phone && <p className="text-sm text-gray-500">Ph: {inv.to_phone}</p>}
            {inv.to_email && <p className="text-sm text-gray-500">{inv.to_email}</p>}
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#ecfdf5", color: "#047857" }} className="text-[11px] uppercase tracking-wider">
              <th className="text-left py-2 px-2 font-semibold border-b-2" style={{ borderColor: "#059669" }}>Description</th>
              <th className="text-center py-2 px-1 font-semibold w-16 border-b-2" style={{ borderColor: "#059669" }}>Qty</th>
              <th className="text-right py-2 px-2 font-semibold w-24 border-b-2" style={{ borderColor: "#059669" }}>Rate (Rs)</th>
              <th className="text-right py-2 px-2 font-semibold w-24 border-b-2" style={{ borderColor: "#059669" }}>Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={i % 2 === 1 ? { background: "#f0fdf4" } : {}}>
                <td className="py-2 px-2">{item.description}</td>
                <td className="py-2 px-1 text-center">{item.qty}</td>
                <td className="py-2 px-2 text-right">{Number(item.rate || 0).toLocaleString("en-IN")}</td>
                <td className="py-2 px-2 text-right font-medium">{Number(item.amount || 0).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>Rs {Number(inv.subtotal || 0).toLocaleString("en-IN")}</span>
            </div>
            {inv.gst_enabled && (
              <>
                <div className="flex justify-between text-gray-500">
                  <span>CGST ({halfRate}%)</span>
                  <span>Rs {gstHalf.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>SGST ({halfRate}%)</span>
                  <span>Rs {gstHalf.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-black text-base text-white px-3 py-2 rounded-lg mt-2" style={{ background: "#047857", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <span>TOTAL</span>
              <span>Rs {Number(inv.total || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Payment + Notes */}
        {(inv.payment_mode || inv.notes) && (
          <div className="text-sm text-gray-500 space-y-1 pt-2 border-t border-gray-100">
            {inv.payment_mode && <p>Payment Mode: <span className="uppercase font-medium">{inv.payment_mode}</span></p>}
            {inv.notes && <p className="italic">Notes: {inv.notes}</p>}
          </div>
        )}

        {/* Paid stamp */}
        {inv.status === "paid" && (
          <div className="text-center py-4">
            <span className="text-4xl font-black tracking-widest" style={{ color: "#05966933" }}>PAID</span>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-300 pt-4">Generated by LOBBI | lobbi.in</p>
      </div>
    </div>
  );
});

export default InvoicePDF;
