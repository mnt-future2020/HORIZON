import { useState } from "react";
import { Calendar, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BookingReceipt from "@/components/BookingReceipt";
import { bookingAPI } from "@/lib/api";
import { fmt12h } from "@/lib/utils";
import { toast } from "sonner";

export function BookingHistory({ bookings: initial, total }) {
  const [bookings, setBookings] = useState(initial);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const hasMore = total ? bookings.length < total : false;

  const handleCancel = async (bookingId) => {
    setCancelling(true);
    try {
      const res = await bookingAPI.cancel(bookingId);
      toast.success(res.data?.message || "Booking cancelled");
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: "cancelled" } : b));
      setCancelConfirm(null);
      setSelected(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await bookingAPI.list({ page: page + 1, limit: 15 });
      const next = res.data?.bookings || [];
      setBookings((prev) => [...prev, ...next]);
      setPage((p) => p + 1);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 rounded-xl bg-gradient-to-br from-card to-muted/30 border border-border shadow-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900 mb-4">
          <Calendar className="h-10 w-10 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        </div>
        <p className="text-base font-semibold text-foreground mb-2">No Bookings Yet</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Your bookings will appear here once you make your first reservation
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} onClick={() => setSelected(booking)} />
        ))}
        {hasMore && (
          <div className="pt-4 text-center">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
              ) : (
                `Load More (${bookings.length} of ${total})`
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="rounded-[28px] bg-card border-border/40 max-w-[95vw] sm:max-w-sm p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20">
            <DialogTitle className="admin-heading">Booking Receipt</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {selected && <BookingReceipt booking={selected} />}
            {selected && selected.status === "confirmed" && (
              <Button
                variant="destructive"
                className="w-full mt-4 rounded-xl gap-2"
                onClick={() => setCancelConfirm(selected)}
              >
                <XCircle className="h-4 w-4" /> Cancel Booking
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelConfirm} onOpenChange={(open) => { if (!open) setCancelConfirm(null); }}>
        <DialogContent className="rounded-[28px] bg-card border-border/40 max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="admin-heading">Cancel Booking?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to cancel this booking at <span className="font-semibold text-foreground">{cancelConfirm?.venue_name}</span>?
            </p>
            <p className="text-xs text-muted-foreground">
              Refund policy: 100% if 24h+ before slot, 50% if 4-24h, 0% if less than 4h.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCancelConfirm(null)} disabled={cancelling}>
                Keep Booking
              </Button>
              <Button variant="destructive" className="flex-1 rounded-xl gap-2" onClick={() => handleCancel(cancelConfirm.id)} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Yes, Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BookingCard({ booking, onClick }) {
  const statusVariant =
    booking.status === "confirmed" ? "default" :
    booking.status === "cancelled" ? "destructive" :
    "secondary";

  return (
    <div
      className="rounded-xl bg-card border border-border shadow-sm p-5 flex items-center justify-between hover:border-brand-400 dark:hover:border-brand-600 transition-colors cursor-pointer active:scale-[0.98]"
      data-testid={`history-card-${booking.id}`}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-base text-foreground mb-1.5 truncate">
          {booking.venue_name}
        </div>
        <div className="text-xs text-muted-foreground font-medium space-y-0.5">
          <div>{booking.date}</div>
          <div>
            {fmt12h(booking.start_time)} - {fmt12h(booking.end_time)} • {booking.sport}
          </div>
        </div>
      </div>
      <div className="text-right ml-4 shrink-0">
        <div className="font-display font-bold text-lg text-foreground mb-2 tabular-nums">
          ₹{booking.total_amount}
        </div>
        <Badge variant={statusVariant} className="text-[10px] font-semibold uppercase tracking-wider">
          {booking.status}
        </Badge>
        {booking.status === "cancelled" && booking.refund_status && (
          <Badge className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${
            booking.refund_status === "processed" ? "bg-green-500/10 text-green-600" :
            booking.refund_status === "failed" ? "bg-red-500/10 text-red-600" :
            "bg-amber-500/10 text-amber-500"
          }`}>
            Refund: {booking.refund_status}
          </Badge>
        )}
        {booking.status === "cancelled" && booking.refund_pct > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            ₹{(booking.total_amount * booking.refund_pct / 100).toLocaleString()} ({booking.refund_pct}%)
          </p>
        )}
      </div>
    </div>
  );
}
