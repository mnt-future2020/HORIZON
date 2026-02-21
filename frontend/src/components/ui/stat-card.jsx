import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { fadeInScale } from "@/lib/motion-variants"

/**
 * Athletic Stat Card Component
 * High-impact stat display with icon, large value, and label
 * Perfect for dashboard KPIs and metrics
 */
const iconColorMap = {
  primary: "bg-primary/10 text-primary",
  violet: "bg-violet-500/10 text-violet-400",
  amber: "bg-amber-500/10 text-amber-400",
  sky: "bg-sky-500/10 text-sky-400",
  green: "bg-green-500/10 text-green-400",
  red: "bg-red-500/10 text-red-400",
};

export const AthleticStatCard = React.forwardRef(({
  icon: Icon,
  label,
  value,
  color,
  iconColor,
  trend,
  delay = 0,
  className,
  ...props
}, ref) => {
  const resolvedColor = iconColor
    ? (iconColorMap[iconColor] || "bg-primary/10 text-primary")
    : (color || "bg-primary/10 text-primary");
  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate="animate"
      variants={fadeInScale}
      transition={{ delay }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 sm:p-8",
        "hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300",
        className
      )}
      {...props}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative flex items-start gap-4 sm:gap-6">
        {/* Icon */}
        {Icon && (
          <div className={cn(
            "p-3 sm:p-4 rounded-xl transition-transform duration-300 group-hover:scale-110",
            resolvedColor
          )}>
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        )}

        {/* Value & Label */}
        <div className="flex-1 min-w-0">
          <motion.div
            className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-athletic mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + 0.1, duration: 0.6 }}
          >
            {value}
          </motion.div>
          <div className="label-caps text-muted-foreground">
            {label}
          </div>

          {/* Optional trend indicator */}
          {trend !== undefined && (
            <div className={cn(
              "mt-2 text-xs font-bold flex items-center gap-1",
              trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-muted-foreground"
            )}>
              {trend > 0 ? "↑" : trend < 0 ? "↓" : "—"} {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
AthleticStatCard.displayName = "AthleticStatCard"

/**
 * Minimal Stat Card (No Icon)
 * Cleaner version for secondary metrics
 */
export const MinimalStatCard = React.forwardRef(({
  label,
  value,
  subtitle,
  trend,
  delay = 0,
  className,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate="animate"
      variants={fadeInScale}
      transition={{ delay }}
      className={cn(
        "rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 sm:p-6",
        "hover:border-primary/30 transition-all duration-300",
        className
      )}
      {...props}
    >
      <div className="label-caps text-muted-foreground mb-2">
        {label}
      </div>
      <div className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-athletic">
        {value}
      </div>
      {subtitle && (
        <div className="text-sm text-muted-foreground mt-1">
          {subtitle}
        </div>
      )}
      {trend !== undefined && (
        <div className={cn(
          "mt-2 text-xs font-bold",
          trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-muted-foreground"
        )}>
          {trend > 0 ? "↑" : trend < 0 ? "↓" : "—"} {Math.abs(trend)}%
        </div>
      )}
    </motion.div>
  );
});
MinimalStatCard.displayName = "MinimalStatCard"

/**
 * Stat Card with Progress Bar
 * For metrics with a target or goal
 */
export const ProgressStatCard = React.forwardRef(({
  icon: Icon,
  label,
  value,
  target,
  color = "bg-primary/10 text-primary",
  delay = 0,
  className,
  ...props
}, ref) => {
  const percentage = target ? Math.min((value / target) * 100, 100) : 0;

  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate="animate"
      variants={fadeInScale}
      transition={{ delay }}
      className={cn(
        "rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 sm:p-8",
        "hover:border-primary/50 transition-all duration-300",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={cn("p-3 rounded-xl", color)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="font-display text-3xl font-black text-foreground tracking-athletic">
              {value}
            </div>
            <div className="text-sm text-muted-foreground">
              of {target} {label}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: delay + 0.2, duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </motion.div>
  );
});
ProgressStatCard.displayName = "ProgressStatCard"
