import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, IndianRupee, Users } from "lucide-react";
import { fmt12h } from "@/lib/utils";

/**
 * BookingReceipt — reusable receipt card with auto QR code.
 *
 * Props:
 *  - booking: { venue_name, date, start_time, end_time, turf_name, sport, total_amount, status, payment_details, num_players, qr_data }
 *  - compact: boolean — compact mode for admin views
 */
export default function BookingReceipt({ booking, compact }) {
  if (!booking) return null;

  const statusColor = {
    confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    payment_pending: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
    expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  }[booking.status] || "bg-zinc-500/15 text-zinc-400";

  const pd = booking.payment_details || {};

  return (
    <div className={`rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md ${compact ? "p-4" : "p-6"} space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`font-display font-black text-foreground truncate ${compact ? "text-sm" : "text-lg"}`}>
            {booking.venue_name}
          </h3>
          {booking.turf_name && (
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">{booking.turf_name} · {booking.sport}</p>
          )}
        </div>
        <Badge className={`${statusColor} uppercase text-[10px] font-bold border shrink-0`}>
          {booking.status?.replace("_", " ")}
        </Badge>
      </div>

      {/* Details grid */}
      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"} gap-3`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-semibold">{booking.date}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="font-semibold">{fmt12h(booking.start_time)} - {fmt12h(booking.end_time)}</span>
        </div>
        {booking.num_players && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <span className="font-semibold">{booking.num_players} Lobbians</span>
          </div>
        )}
      </div>

      {/* Amount + Payment info */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-primary" />
          <span className="font-display text-xl font-black text-primary">
            {booking.total_amount?.toLocaleString("en-IN")}
          </span>
        </div>
        {pd.razorpay_payment_id && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {pd.razorpay_payment_id}
          </p>
        )}
        {pd.paid_at && (
          <p className="text-[10px] text-muted-foreground">
            {new Date(pd.paid_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* QR Code — auto from booking.qr_data */}
      {booking.qr_data && booking.status === "confirmed" && (
        <div className="flex flex-col items-center gap-3 pt-3 border-t border-border/40">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={booking.qr_data} size={compact ? 140 : 180} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Show this to venue staff to check in
          </p>
        </div>
      )}
    </div>
  );
}
