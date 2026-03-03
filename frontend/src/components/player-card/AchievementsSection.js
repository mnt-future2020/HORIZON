import { motion } from "framer-motion";
import {
  Trophy,
  Star,
  Zap,
  Crown,
  Award,
  Shield,
  Medal,
  BadgeCheck,
} from "lucide-react";

const BADGE_ICONS = {
  trophy: Trophy,
  star: Star,
  zap: Zap,
  crown: Crown,
  award: Award,
  shield: Shield,
  medal: Medal,
  "badge-check": BadgeCheck,
};

const BADGE_COLORS = {
  Century: "text-brand-500",
  Veteran: "text-brand-500",
  Regular: "text-brand-500",
  Elite: "text-brand-500",
  Pro: "text-brand-500",
  Reliable: "text-brand-500",
  Champion: "text-brand-500",
  Verified: "text-brand-500",
};

export default function AchievementsSection({ badges }) {
  if (!badges || badges.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-5 py-8"
    >
      <div className="space-y-8">
        {badges.map((badge, idx) => {
          const Icon = BADGE_ICONS[badge.icon] || Trophy;
          const iconColor = BADGE_COLORS[badge.name] || "text-brand-500";

          return (
            <motion.div
              key={badge.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="flex items-start gap-5 group"
            >
              <div
                className={`mt-1 h-12 w-12 shrink-0 rounded-2xl bg-secondary/30 flex items-center justify-center border border-border/10 relative overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/50 shadow-sm`}
              >
                <div
                  className={`absolute inset-0 opacity-10 blur-[10px] ${iconColor} bg-current`}
                />
                <Icon
                  className={`h-6 w-6 relative z-10 ${iconColor} drop-shadow-sm`}
                />
              </div>
              <div className="flex-1 pb-6 border-b border-border/5">
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-sm font-bold text-foreground tracking-tight group-hover:text-brand-500 transition-colors">
                    {badge.name}
                  </h4>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-500/5 border border-brand-500/10">
                    <BadgeCheck className="h-3 w-3 text-brand-500" />
                    <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">
                      Verified
                    </span>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground/80 leading-relaxed font-medium">
                  {badge.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
