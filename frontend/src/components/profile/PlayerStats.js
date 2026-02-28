import { Trophy, TrendingUp, Star, CheckCircle2, XCircle, Minus, Shield } from "lucide-react";

export function PlayerStats({ user, stats, tier }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <StatCard
        icon={Trophy}
        value={user?.skill_rating || 1500}
        label={tier.label}
        color={tier.color}
        bgColor="bg-amber-50 dark:bg-amber-950"
        borderColor="border-amber-200 dark:border-amber-800"
      />
      <StatCard
        icon={TrendingUp}
        value={stats?.total_games || 0}
        label="Games"
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
      <StatCard
        icon={Star}
        value={stats?.total_games ? `${Math.round((stats.wins / stats.total_games) * 100)}%` : "0%"}
        label="Win Rate"
        color="text-amber-600 dark:text-amber-400"
        bgColor="bg-amber-50 dark:bg-amber-950"
        borderColor="border-amber-200 dark:border-amber-800"
      />
      <StatCard
        icon={CheckCircle2}
        value={stats?.wins || 0}
        label="Wins"
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
      <StatCard
        icon={XCircle}
        value={stats?.losses || user?.losses || 0}
        label="Losses"
        color="text-red-600 dark:text-red-400"
        bgColor="bg-red-50 dark:bg-red-950"
        borderColor="border-red-200 dark:border-red-800"
      />
      <StatCard
        icon={Minus}
        value={stats?.draws || user?.draws || 0}
        label="Draws"
        color="text-slate-600 dark:text-slate-400"
        bgColor="bg-slate-50 dark:bg-slate-900"
        borderColor="border-slate-200 dark:border-slate-700"
      />
      <StatCard
        icon={Shield}
        value={user?.reliability_score || 100}
        label="Reliability"
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
        extra={user?.no_shows > 0 && (
          <div className="text-[10px] text-red-600 dark:text-red-400 mt-1.5 font-semibold">
            {user.no_shows} no-show{user.no_shows > 1 ? "s" : ""}
          </div>
        )}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, bgColor, borderColor, extra, className = "" }) {
  return (
    <div className={`text-center p-4 sm:p-5 rounded-xl ${bgColor} border ${borderColor} hover:border-brand-400 dark:hover:border-brand-600 transition-colors touch-manipulation ${className}`}>
      <Icon className={`h-6 w-6 sm:h-7 sm:w-7 mx-auto mb-2 ${color}`} aria-hidden="true" />
      <div className={`text-2xl sm:text-3xl font-display font-bold tabular-nums ${color}`}>
        {value}
      </div>
      <div className="text-[11px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1.5">
        {label}
      </div>
      {extra}
    </div>
  );
}
