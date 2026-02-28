import { Calendar, DollarSign, Star, Users } from "lucide-react";

export function CoachStats({ coachStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <StatCard 
        icon={Calendar} 
        value={coachStats?.total_sessions || 0} 
        label="Sessions" 
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
      <StatCard 
        icon={DollarSign} 
        value={`₹${(coachStats?.total_revenue || 0).toLocaleString("en-IN")}`} 
        label="Revenue" 
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
      <StatCard 
        icon={Star} 
        value={coachStats?.average_rating?.toFixed(1) || "N/A"} 
        label="Avg Rating" 
        color="text-amber-600 dark:text-amber-400"
        bgColor="bg-amber-50 dark:bg-amber-950"
        borderColor="border-amber-200 dark:border-amber-800"
      />
      <StatCard 
        icon={Users} 
        value={coachStats?.active_subscribers || 0} 
        label="Subscribers" 
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, bgColor, borderColor }) {
  return (
    <div className={`text-center p-4 sm:p-5 rounded-xl ${bgColor} border ${borderColor} hover:border-brand-400 dark:hover:border-brand-600 transition-colors touch-manipulation`}>
      <Icon className={`h-6 w-6 sm:h-7 sm:w-7 mx-auto mb-2 ${color}`} aria-hidden="true" />
      <div className={`text-2xl sm:text-3xl font-display font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[11px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1.5">{label}</div>
    </div>
  );
}
