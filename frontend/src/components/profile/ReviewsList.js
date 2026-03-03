import { MessageSquare, Star } from "lucide-react";

export function ReviewsList({ ownerVenues, reviewSummaries }) {
  const venuesWithReviews = ownerVenues.filter(v => reviewSummaries[v.id]);

  if (venuesWithReviews.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border shadow-sm">
        <div className="p-4 rounded-2xl bg-muted/30 w-fit mx-auto mb-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">No reviews yet</p>
        <p className="text-xs text-muted-foreground/70 mt-2">Reviews will appear here once customers leave feedback</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30">
          <Star className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">Customer Reviews</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Feedback from your customers</p>
        </div>
      </div>
      <div className="space-y-4">
        {venuesWithReviews.map(venue => (
          <VenueReviewCard key={venue.id} venue={venue} reviewSummary={reviewSummaries[venue.id]} />
        ))}
      </div>
    </div>
  );
}

function VenueReviewCard({ venue, reviewSummary }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-card via-card to-muted/10 border border-border shadow-sm p-6 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display font-bold text-base">{venue.name}</h4>
        <div className="flex items-center gap-2 text-base font-display font-bold">
          <Star className="h-5 w-5 text-amber-500" aria-hidden="true" />
          {reviewSummary.average_rating?.toFixed(1) || "N/A"}
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-4 font-medium">
        {reviewSummary.total_reviews || 0} total reviews
      </div>

      {reviewSummary.rating_distribution && (
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map(star => {
            const count = reviewSummary.rating_distribution[star] || 0;
            const pct = reviewSummary.total_reviews
              ? Math.round((count / reviewSummary.total_reviews) * 100)
              : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-4 text-right text-muted-foreground font-medium tabular-nums">
                  {star}
                </span>
                <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-muted-foreground font-medium tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
