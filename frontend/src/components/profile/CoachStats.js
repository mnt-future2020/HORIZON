import { Calendar, DollarSign, Star, Users } from "lucide-react";

export function CoachStats({ coachStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard 
        icon={Calendar} 
        value={coachStats?.total_sessions || 0} 
        label="Sessions" 
        color="text-primary" 
      />
      <StatCard 
        icon={DollarSign} 
        value={`₹${(coachStats?.total_revenue || 0).toLocaleString("en-IN")}`} 
        label="Revenue" 
        color="text-brand-400" 
      />
      <StatCard 
        icon={Star} 
        value={coachStats?.average_rating?.toFixed(1) || "N/A"} 
        label="Avg Rating" 
        color="text-amber-400" 
      />
      <StatCard 
        icon={Users} 
        value={coachStats?.active_subscribers || 0} 
        label="Subscribers" 
        color="text-violet-400" 
      />
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
