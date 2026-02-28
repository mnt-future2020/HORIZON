import { Trophy, TrendingUp, Star, CheckCircle2, XCircle, Minus, Shield } from "lucide-react";

export function PlayerStats({ user, stats, tier }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
      <StatCard
        icon={Trophy}
        value={user?.skill_rating || 1500}
        label={tier.label}
        color={tier.color}
      />
      <StatCard
        icon={TrendingUp}
        value={stats?.total_games || 0}
        label="Games"
        color="text-primary"
      />
      <StatCard
        icon={Star}
        value={stats?.total_games ? `${Math.round((stats.wins / stats.total_games) * 100)}%` : "0%"}
        label="Win Rate"
        color="text-amber-400"
      />
      <StatCard
        icon={CheckCircle2}
        value={stats?.wins || 0}
        label="Wins"
        color="text-brand-400"
      />
      <StatCard
        icon={XCircle}
        value={stats?.losses || user?.losses || 0}
        label="Losses"
        color="text-red-400"
      />
      <StatCard
        icon={Minus}
        value={stats?.draws || user?.draws || 0}
        label="Draws"
        color="text-amber-400"
      />
      <StatCard
        icon={Shield}
        value={user?.reliability_score || 100}
        label="Reliability"
        color="text-sky-400"
        extra={user?.no_shows > 0 && (
          <div className="text-[9px] text-red-400 mt-1">
            {user.no_shows} no-show{user.no_shows > 1 ? "s" : ""}
          </div>
        )}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, extra, className = "" }) {
  return (
    <div className={`text-center p-3 sm:p-4 rounded-xl bg-gradient-to-br from-background/80 to-background/40 border border-border/50 hover:border-primary/30 transition-colors touch-manipulation ${className}`}>
      <Icon className={`h-5 w-5 sm:h-6 sm:w-6 mx-auto mb-1.5 ${color}`} aria-hidden="true" />
      <div className={`text-xl sm:text-2xl font-display font-black tabular-nums ${color.includes("text-") ? color : ""}`}>
        {value}
      </div>
      <div className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
        {label}
      </div>
      {extra}
    </div>
  );
}
