import { motion } from "framer-motion";
import { Info, Award, ChevronRight } from "lucide-react";

export default function OverallScoreSection({
  card,
  isOwnProfile,
  onShowGuide,
}) {
  if (card.role === "coach" || card.overall_score === undefined) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-6 border-b border-border/10 relative"
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
        {/* Score Ring */}
        <div className="relative w-28 h-28 shrink-0 group">
          <div className="absolute inset-0 bg-brand-500/15 blur-[25px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <svg
            className="w-full h-full -rotate-90 relative"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-border/10"
            />
            <motion.circle
              initial={{ strokeDasharray: "0 289" }}
              animate={{
                strokeDasharray: `${card.overall_score * 2.89} 289`,
              }}
              transition={{ duration: 2, ease: "circOut", delay: 0.5 }}
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              className="text-brand-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-black tracking-tighter leading-none text-foreground">
              {card.overall_score}
            </span>
            <span className="text-[9px] font-black text-muted-foreground/50 mt-1 tracking-widest uppercase">
              Rating
            </span>
          </div>
        </div>

        {/* Score Details */}
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20">
                <Award className="h-4 w-4 text-brand-500" />
              </div>
              <div>
                <h3 className="font-bold text-base tracking-tight text-foreground leading-none mb-1">
                  Overall Performance
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">
                    {card.overall_tier || "Elite"} Tier
                  </span>
                  <span className="h-1 w-1 rounded-full bg-border/40" />
                  <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                    Certified Athlete
                  </span>
                </div>
              </div>
            </div>
            {isOwnProfile && (
              <button
                onClick={onShowGuide}
                className="p-2 rounded-xl hover:bg-secondary/80 border border-transparent hover:border-border/30 transition-all text-muted-foreground/60 hover:text-muted-foreground"
                aria-label="View scoring guide"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>

          {card.score_breakdown && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {[
                {
                  label: "Skill Mastery",
                  value: card.score_breakdown.skill,
                  color: "bg-brand-500",
                  tip:
                    card.score_breakdown.skill < 30
                      ? "Play rated matches"
                      : null,
                },
                {
                  label: "Competitive Edge",
                  value: card.score_breakdown.win_rate,
                  color: "bg-brand-500/90",
                  tip:
                    card.score_breakdown.win_rate === 0
                      ? "Win matches to boost"
                      : null,
                },
                {
                  label: "Event Presence",
                  value: card.score_breakdown.tournament,
                  color: "bg-brand-500/80",
                  tip:
                    card.score_breakdown.tournament === 0
                      ? "Join a tournament"
                      : null,
                },
                {
                  label: "Elite Training",
                  value: card.score_breakdown.training,
                  color: "bg-brand-500/70",
                  tip:
                    card.score_breakdown.training === 0
                      ? "Book coaching sessions"
                      : null,
                },
                {
                  label: "Reliability Score",
                  value: card.score_breakdown.reliability,
                  color: "bg-brand-500/60",
                  tip:
                    card.score_breakdown.reliability < 80
                      ? "Don't miss bookings"
                      : null,
                },
                {
                  label: "Arena Experience",
                  value: card.score_breakdown.experience,
                  color: "bg-brand-500/50",
                  tip:
                    card.score_breakdown.experience < 10
                      ? "Play more games"
                      : null,
                },
              ].map((b) => (
                <div key={b.label} className="group flex flex-col">
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest group-hover:text-brand-500 transition-colors">
                      {b.label}
                    </span>
                    <span className="text-[10px] font-bold text-foreground tabular-nums opacity-60">
                      {b.value}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${b.value}%` }}
                      transition={{ duration: 1, delay: 0.8 }}
                      className={`h-full rounded-full ${b.color}`}
                    />
                  </div>
                  {isOwnProfile && b.tip && (
                    <span className="text-[9px] font-bold text-brand-500/50 mt-1.5 uppercase tracking-tight px-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {b.tip}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
