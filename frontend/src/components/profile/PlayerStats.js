import { Trophy, TrendingUp, Star, CheckCircle2, XCircle, Minus, Shield } from "lucide-react";

export function PlayerStats({ user, stats, tier }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border/50">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/20">
          <Trophy className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-foreground">Player Statistics</h3>
          <p className="text-xs text-muted-foreground">Your performance & achievements</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Trophy}
          value={user?.skill_rating || 1500}
          label={tier.label}
          color={tier.color}
          bgColor="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900"
          borderColor="border-amber-300 dark:border-amber-700"
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
          color="text-emerald-600 dark:text-emerald-400"
          bgColor="bg-emerald-50 dark:bg-emerald-950"
          borderColor="border-emerald-200 dark:border-emerald-800"
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
          color="text-sky-600 dark:text-sky-400"
          bgColor="bg-sky-50 dark:bg-sky-950"
          borderColor="border-sky-200 dark:border-sky-800"
          extra={user?.no_shows > 0 && (
            <div className="text-[10px] text-red-600 dark:text-red-400 mt-1.5 font-semibold">
              {user.no_shows} no-show{user.no_shows > 1 ? "s" : ""}
            </div>
          )}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, bgColor, borderColor, extra, className = "" }) {
  return (
    <div className={`group text-center p-4 sm:p-5 rounded-xl ${bgColor} border-2 ${borderColor} hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 touch-manipulation cursor-default ${className}`}>
      <Icon className={`h-6 w-6 sm:h-7 sm:w-7 mx-auto mb-2 ${color} group-hover:scale-110 transition-transform duration-300`} aria-hidden="true" />
      <div className={`text-2xl sm:text-3xl font-display font-bold tabular-nums ${color} group-hover:scale-105 transition-transform duration-300`}>
        {value}
      </div>
      <div className="text-[11px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1.5">
        {label}
      </div>
      {extra}
    </div>
  );
}
