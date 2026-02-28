import { Building2, Calendar, DollarSign, Star } from "lucide-react";

export function VenueOwnerStats({ ownerVenues, venueAnalytics, reviewSummaries }) {
  const totalBookings = Object.values(venueAnalytics || {}).reduce(
    (s, a) => s + (a?.total_bookings || 0), 
    0
  );
  const totalRevenue = Object.values(venueAnalytics || {}).reduce(
    (s, a) => s + (a?.total_revenue || 0), 
    0
  );
  const ratings = Object.values(reviewSummaries || {}).filter(r => r?.average_rating > 0);
  const ratingSum = ratings.reduce((s, r) => s + (Number(r.average_rating) || 0), 0);
  const avgRating = ratings.length > 0 ? (ratingSum / ratings.length).toFixed(1) : "N/A";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={Building2} value={ownerVenues.length} label="Venues" color="text-primary" />
      <StatCard icon={Calendar} value={totalBookings} label="Bookings" color="text-brand-400" />
      <StatCard 
        icon={DollarSign} 
        value={`₹${(totalRevenue || 0).toLocaleString("en-IN")}`} 
        label="Revenue" 
        color="text-amber-400" 
      />
      <StatCard icon={Star} value={avgRating} label="Avg Rating" color="text-violet-400" />
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center p-3 rounded-lg bg-background/50">
      <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} aria-hidden="true" />
      <div className="text-lg font-display font-black tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground font-mono uppercase">{label}</div>
    </div>
  );
}
