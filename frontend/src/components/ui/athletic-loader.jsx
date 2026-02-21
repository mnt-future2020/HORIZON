import { motion } from "framer-motion";

/**
 * Athletic Loader Component
 * Spinning ring loader with primary color
 */
export function AthleticLoader({ size = "md" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };

  return (
    <div className="flex items-center justify-center">
      <motion.div
        className={`${sizeClasses[size]} rounded-full border-4 border-primary/20 border-t-primary`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

/**
 * Athletic Skeleton Card
 * Loading skeleton for venue/content cards
 */
export function AthleticSkeletonCard() {
  return (
    <div className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden">
      {/* Image skeleton */}
      <div className="h-52 bg-gradient-to-br from-primary/10 to-accent/10 animate-pulse" />

      {/* Content skeleton */}
      <div className="p-6 space-y-4">
        <div className="h-6 bg-muted/50 rounded animate-pulse" />
        <div className="h-4 bg-muted/30 rounded w-2/3 animate-pulse" />
        <div className="flex justify-between pt-4 border-t border-border/50">
          <div className="h-4 bg-muted/30 rounded w-16 animate-pulse" />
          <div className="h-6 bg-primary/20 rounded w-20 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton Grid
 * For loading multiple cards
 */
export function SkeletonGrid({ count = 6, columns = 3 }) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <AthleticSkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Inline Spinner
 * Small spinner for button loading states
 */
export function InlineSpinner({ className = "h-4 w-4" }) {
  return (
    <motion.div
      className={`${className} rounded-full border-2 border-current border-t-transparent`}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}
