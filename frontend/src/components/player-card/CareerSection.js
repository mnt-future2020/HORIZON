import { motion } from "framer-motion";
import {
  TrendingUp,
  Dumbbell,
  Trophy,
  Building2,
  Calendar,
} from "lucide-react";

export default function CareerSection({ career }) {
  if (!career) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-10"
    >
      {/* Quick Career Stats - Premium Grid */}
      <div className="grid grid-cols-4 gap-0 px-5 py-8 border-b border-border/10 bg-secondary/5">
        <div className="text-center group border-r border-border/10">
          <div className="font-display text-xl font-black tracking-tighter text-foreground group-hover:text-brand-500 transition-colors">
            {career.training_hours ?? 0}h
          </div>
          <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-60">
            Training
          </div>
        </div>
        <div className="text-center group border-r border-border/10">
          <div className="font-display text-xl font-black tracking-tighter text-foreground group-hover:text-brand-500 transition-colors">
            {career.organizations?.length ?? 0}
          </div>
          <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-60">
            Orgs
          </div>
        </div>
        <div className="text-center group border-r border-border/10">
          <div className="font-display text-xl font-black tracking-tighter text-foreground group-hover:text-brand-500 transition-colors">
            {career.matches_played || 0}
          </div>
          <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-60">
            Matches
          </div>
        </div>
        <div className="text-center group">
          <div className="font-display text-xl font-black tracking-tighter text-foreground group-hover:text-brand-500 transition-colors">
            {career.tournaments_played ?? 0}
          </div>
          <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-60">
            Events
          </div>
        </div>
      </div>

      {/* Recent Performance */}
      {career.recent_performance && career.recent_performance.length > 0 && (
        <div className="px-5 py-8 border-b border-border/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 blur-[40px] -z-10" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-500/80 mb-6 px-1 flex items-center gap-2">
            <TrendingUp className="h-3 w-3" />
            Recent Performance
          </h4>
          <div className="space-y-5">
            {career.recent_performance.slice(0, 5).map((record, idx) => (
              <div
                key={record.id || idx}
                className="flex items-center justify-between group cursor-default"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center border-2 ${
                      (record.type || "").toLowerCase().includes("win")
                        ? "bg-brand-500/5 border-brand-500/10 text-brand-500"
                        : (record.type || "").toLowerCase().includes("loss")
                          ? "bg-destructive/5 border-destructive/10 text-destructive"
                          : "bg-brand-500/5 border-brand-500/10 text-brand-500"
                    } transition-all group-hover:scale-110 shadow-sm`}
                  >
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground tracking-tight mb-0.5">
                      {record.title || "Untitled Match"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight opacity-70">
                        {record.date
                          ? new Intl.DateTimeFormat(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(new Date(record.date))
                          : "RECENT"}{" "}
                        · {record.type || "Match"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[9px] font-black text-brand-500 px-2.5 py-1 bg-brand-500/10 border border-brand-500/20 rounded-lg group-hover:bg-brand-500 group-hover:text-white transition-all uppercase tracking-widest shadow-sm">
                  VIEW
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organizations */}
      {career.organizations && career.organizations.length > 0 && (
        <div className="px-5 py-8">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-6 px-1 flex items-center gap-2">
            <Building2 className="h-3 w-3" />
            Affiliated Organizations
          </h4>
          <div className="flex flex-wrap gap-2.5">
            {career.organizations.map((org, idx) => (
              <div
                key={org.id || idx}
                className="px-4 py-2 bg-secondary/30 border border-border/10 rounded-xl flex items-center gap-3 hover:bg-secondary/50 transition-colors shadow-sm group"
              >
                <div className="p-1.5 rounded-lg bg-brand-500/10 group-hover:bg-brand-500 transition-colors">
                  <Building2 className="h-3.5 w-3.5 text-brand-500 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground leading-none mb-0.5">
                    {org.name}
                  </div>
                  {org.type && (
                    <span className="text-[9px] font-black text-brand-500 uppercase opacity-60 tracking-tighter">
                      {org.type}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
