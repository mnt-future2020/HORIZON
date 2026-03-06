import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmt12h } from "@/lib/utils";

export function CoachSessionsList({ coachSessions }) {
  if (coachSessions.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border shadow-sm">
        <div className="p-4 rounded-2xl bg-muted/30 w-fit mx-auto mb-4">
          <Calendar className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">No coaching sessions yet</p>
        <p className="text-xs text-muted-foreground/70 mt-2">Your upcoming and past sessions will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30">
          <Calendar className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">Coaching Sessions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{coachSessions.length} session{coachSessions.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>
      <div className="space-y-3">
        {coachSessions.slice(0, 20).map(session => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const statusVariant =
    session.status === "completed" ? "default" :
    session.status === "cancelled" ? "destructive" :
    "secondary";

  return (
    <div className="rounded-xl bg-gradient-to-br from-card via-card to-muted/10 border border-border shadow-sm p-5 flex items-center justify-between hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex-1 min-w-0">
        <div className="admin-name text-sm sm:text-base mb-1.5 truncate">
          {session.student_name || session.player_name || "Lobbian"}
        </div>
        <div className="admin-secondary text-xs sm:text-sm space-y-0.5">
          <div>
            {session.sport} • {session.date}
            {session.start_time && ` • ${fmt12h(session.start_time)}`}
          </div>
        </div>
      </div>
      <div className="text-right ml-4 shrink-0">
        <div className="font-display font-bold text-lg text-foreground mb-2 tabular-nums">
          ₹{session.amount || session.price || 0}
        </div>
        <Badge variant={statusVariant} className="text-[10px] font-semibold uppercase tracking-wider">
          {session.status}
        </Badge>
      </div>
    </div>
  );
}
