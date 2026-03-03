import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmt12h } from "@/lib/utils";

export function BookingHistory({ bookings }) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 rounded-xl bg-gradient-to-br from-card to-muted/30 border border-border shadow-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900 mb-4">
          <Calendar className="h-10 w-10 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        </div>
        <p className="text-base font-semibold text-foreground mb-2">No Booking History</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Your booking history will appear here once you make your first reservation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.slice(0, 15).map(booking => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
      {bookings.length > 15 && (
        <p className="text-center text-sm text-muted-foreground pt-4">
          Showing 15 of {bookings.length} bookings
        </p>
      )}
    </div>
  );
}

function BookingCard({ booking }) {
  const statusVariant = 
    booking.status === "confirmed" ? "default" :
    booking.status === "cancelled" ? "destructive" :
    "secondary";

  return (
    <div
      className="rounded-xl bg-card border border-border shadow-sm p-5 flex items-center justify-between hover:border-brand-400 dark:hover:border-brand-600 transition-colors"
      data-testid={`history-card-${booking.id}`}
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
      </div>
    </div>
  );
}
