import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Trophy,
  Crown,
  GraduationCap,
  Shield,
  Footprints,
  CheckCircle2,
  Award,
  Flame,
  X,
  Swords,
  TrendingUp,
  Zap,
} from "lucide-react";

/* ─── Score metric definitions ─────────────────────────────────────── */
const SCORE_METRICS = [
  {
    icon: Swords,
    label: "Skill Mastery",
    weight: "40%",
    desc: "Based on your Competitive Performance Rating",
    items: [
      "Beat higher-rated opponents to climb faster",
      "Consistent high performance impacts this most",
      "Elo-based calculation starts at 1500 (Bronze)",
    ],
  },
  {
    icon: Trophy,
    label: "Win Rate",
    weight: "20%",
    desc: "Your historical win/loss ratio",
    items: [
      "Win matches consistently to boost",
      "Every competitive game impacts your %",
    ],
  },
  {
    icon: Crown,
    label: "Tournament Performance",
    weight: "15%",
    desc: "Participation and victory in official events",
    items: [
      "Bonus points for placing in Top 3",
      "Participating in Arena tournaments counts",
    ],
  },
  {
    icon: GraduationCap,
    label: "Elite Training",
    weight: "10%",
    desc: "Professional coaching engagement",
    items: [
      "Book sessions with certified coaches",
      "Total training hours contribute to your elite rank",
    ],
  },
  {
    icon: Shield,
    label: "Reliability Factor",
    weight: "10%",
    desc: "Professional standards and attendance",
    items: [
      "100% attendance is the athletic standard",
      "No-shows drastically impact this score",
    ],
  },
  {
    icon: Footprints,
    label: "Experience Depth",
    weight: "5%",
    desc: "Total match volume on the platform",
    items: ["Stay active — every game adds to your legacy"],
  },
];

const TIER_DATA = [
  { tier: "Elite", range: "86-100", active: true },
  { tier: "Pro", range: "71-85", active: true },
  { tier: "Advanced", range: "51-70", active: false },
  { tier: "Inter", range: "31-50", active: false },
  { tier: "Beginner", range: "0-30", active: false },
];

const ENGAGEMENT_ACTIONS = [
  {
    action: "Feed Contributions",
    points: "+3 pts",
    sub: "Each post published",
  },
  {
    action: "Arena Interaction",
    points: "+2 pts",
    sub: "Likes & tactical comments",
  },
  {
    action: "Daily Presence",
    points: "+5 pts",
    sub: "Maintaining your streak",
  },
  {
    action: "Session Booking",
    points: "+10 pts",
    sub: "Arena slot confirmation",
  },
  { action: "Sport Stories", points: "+3 pts", sub: "Visual updates" },
];

const ENGAGEMENT_LEVELS = ["Bench", "Rookie", "Pro", "All-Star", "Legend"];

export default function LevelUpGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-lg max-h-[85vh] overflow-hidden bg-card border border-border/10 rounded-2xl shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="px-5 py-4 border-b border-border/10 flex items-center justify-between bg-secondary/10">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                <TrendingUp className="h-4 w-4 text-brand-500" />
              </div>
              <div>
                <h2 className="font-display text-base font-black tracking-tight uppercase">
                  Athletic Evolution
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mt-0.5">
                  The path to elite status
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Scrollable Content ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
            {/* Overall Score Breakdown */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-foreground">
                  <Target className="h-3.5 w-3.5 text-brand-500" />
                  Overall Score Breakdown
                </h3>
                <span className="text-[9px] font-black text-brand-500 px-2 py-0.5 rounded-md bg-brand-500/5 border border-brand-500/10 tabular-nums">
                  100 PTS MAX
                </span>
              </div>

              <div className="space-y-2">
                {SCORE_METRICS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className="group p-3.5 rounded-xl bg-secondary/10 border border-border/5 hover:border-brand-500/15 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3 mb-2.5">
                        <div className="mt-0.5 h-7 w-7 rounded-lg bg-brand-500/8 flex items-center justify-center border border-brand-500/10 shrink-0 group-hover:bg-brand-500/15 transition-colors">
                          <Icon className="h-3.5 w-3.5 text-brand-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-xs text-foreground">
                              {s.label}
                            </span>
                            <span className="text-[10px] font-black text-brand-500 tabular-nums">
                              {s.weight}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 font-medium leading-relaxed">
                            {s.desc}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-1 ml-10">
                        {s.items.map((item, i) => (
                          <li
                            key={i}
                            className="text-[10px] text-muted-foreground/60 flex items-start gap-2 leading-relaxed"
                          >
                            <div className="h-1 w-1 rounded-full bg-brand-500/30 mt-1.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Score Tiers */}
            <section>
              <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-4 text-foreground">
                <Award className="h-3.5 w-3.5 text-brand-500" />
                Professional Tiers
              </h3>
              <div className="grid grid-cols-5 gap-1.5">
                {TIER_DATA.map((t) => (
                  <div
                    key={t.tier}
                    className={`rounded-lg border py-2 px-1 flex flex-col items-center justify-center text-center transition-colors ${
                      t.active
                        ? "text-brand-500 border-brand-500/15 bg-brand-500/5"
                        : "text-muted-foreground/40 border-border/10 bg-secondary/5"
                    }`}
                  >
                    <div className="font-black text-[10px] uppercase truncate w-full">
                      {t.tier}
                    </div>
                    <div className="text-[8px] font-bold opacity-50 tabular-nums mt-0.5">
                      {t.range}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Engagement Level */}
            <section className="bg-brand-500/5 rounded-xl p-5 border border-brand-500/10">
              <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-1.5 text-brand-500">
                <Zap className="h-3.5 w-3.5 fill-brand-500" />
                Engagement Level
              </h3>
              <p className="text-[10px] text-brand-500/50 font-medium mb-5 leading-relaxed">
                Measures weekly activity — resets every Monday to encourage peak
                athletic presence.
              </p>

              <div className="space-y-0">
                {ENGAGEMENT_ACTIONS.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 border-b border-brand-500/5 last:border-0"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {e.action}
                      </div>
                      <div className="text-[9px] text-muted-foreground/50 font-medium">
                        {e.sub}
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-brand-500 tabular-nums">
                      {e.points}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-5 gap-1.5">
                {ENGAGEMENT_LEVELS.map((l, i) => (
                  <div
                    key={l}
                    className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity"
                  >
                    <div
                      className={`h-1 w-full rounded-full ${i === 4 ? "bg-brand-500" : "bg-brand-500/20"}`}
                    />
                    <span className="text-[8px] font-black uppercase text-center leading-tight">
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── Footer CTA ── */}
          <div className="p-4 border-t border-border/10 bg-secondary/10">
            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-brand-500 text-white font-bold text-sm uppercase tracking-widest hover:bg-brand-600 transition-colors shadow-md shadow-brand-500/20"
            >
              Back to Training
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
