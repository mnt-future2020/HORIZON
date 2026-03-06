import { Building2, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function VenuesList({ ownerVenues, venueAnalytics, reviewSummaries }) {
  if (ownerVenues.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border shadow-sm">
        <div className="p-4 rounded-2xl bg-muted/30 w-fit mx-auto mb-4">
          <Building2 className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">No venues added yet</p>
        <p className="text-xs text-muted-foreground/70 mt-2">Add your first venue to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30">
          <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">My Venues</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{ownerVenues.length} venue{ownerVenues.length !== 1 ? 's' : ''} registered</p>
        </div>
      </div>
      <div className="space-y-4">
        {ownerVenues.map(venue => (
          <VenueCard
            key={venue.id}
            venue={venue}
            analytics={venueAnalytics[venue.id] || {}}
            reviewSummary={reviewSummaries[venue.id]}
          />
        ))}
      </div>
    </div>
  );
}

function VenueCard({ venue, analytics, reviewSummary }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-card via-card to-muted/10 border border-border shadow-sm p-5 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="admin-name text-sm sm:text-base mb-1.5 truncate">
            {venue.name}
          </div>
          <div className="admin-secondary text-xs sm:text-sm flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {venue.city}
            {venue.area && `, ${venue.area}`}
          </div>
        </div>
        <Badge
          variant={venue.status === "active" ? "default" : "secondary"}
          className="text-[10px] font-semibold uppercase tracking-wider shrink-0 ml-3"
        >
          {venue.status || "active"}
        </Badge>
      </div>

      {venue.sports?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {venue.sports.map(sport => (
            <Badge key={sport} variant="outline" className="text-[10px] font-semibold">
              {sport}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mt-3">
        <StatBox label="Bookings" value={analytics.total_bookings || 0} />
        <StatBox label="Revenue" value={`₹${(analytics.total_revenue || 0).toLocaleString("en-IN")}`} />
        <StatBox
          label="Rating"
          value={
            <div className="flex items-center justify-center gap-1">
              <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              {reviewSummary?.average_rating?.toFixed(1) || "N/A"}
            </div>
          }
        />
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/30 border border-border">
      <div className="text-sm font-display font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}
