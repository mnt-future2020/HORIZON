import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function CoachOrganizationsList({ coachOrgs }) {
  if (coachOrgs.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border shadow-sm">
        <div className="p-4 rounded-2xl bg-muted/30 w-fit mx-auto mb-4">
          <Briefcase className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">No organizations yet</p>
        <p className="text-xs text-muted-foreground/70 mt-2">Join or create an organization to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30">
          <Briefcase className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">My Organizations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{coachOrgs.length} organization{coachOrgs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="space-y-4">
        {coachOrgs.map(org => (
          <OrganizationCard key={org.id} org={org} />
        ))}
      </div>
    </div>
  );
}

function OrganizationCard({ org }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-card via-card to-muted/10 border border-border shadow-sm p-5 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-bold text-base text-foreground truncate">
          {org.name}
        </div>
        <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider shrink-0 ml-3">
          {org.sport || "Multi-sport"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <StatBox label="Lobbians" value={org.players?.length || org.player_count || 0} />
        <StatBox label="Staff" value={org.staff?.length || org.staff_count || 0} />
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
