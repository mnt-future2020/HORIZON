import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { cardHover, subtleCardHover } from "@/lib/motion-variants"

/**
 * Athletic Card Component
 * Bold, high-energy card with pronounced hover effects
 * Perfect for venue cards, feature cards, and content cards
 */
const AthleticCard = React.forwardRef(({
  className,
  children,
  withHover = true,
  glowOnHover = false,
  subtle = false,
  ...props
}, ref) => {
  const MotionDiv = withHover ? motion.div : 'div';
  const hoverVariant = subtle ? subtleCardHover : cardHover;

  return (
    <MotionDiv
      ref={ref}
      initial="rest"
      whileHover={withHover ? "hover" : undefined}
      whileTap={withHover ? "tap" : undefined}
      variants={withHover ? hoverVariant : undefined}
      className={cn(
        "rounded-2xl border-2 bg-card text-card-foreground overflow-hidden backdrop-blur-md",
        "transition-all duration-300",
        glowOnHover && "hover:border-primary/50",
        className
      )}
      {...props}
    >
      {children}
    </MotionDiv>
  );
});
AthleticCard.displayName = "AthleticCard"

/**
 * Athletic Card Header
 * Container for card title and description
 */
const AthleticCardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-6 sm:p-8", className)}
    {...props}
  />
))
AthleticCardHeader.displayName = "AthleticCardHeader"

/**
 * Athletic Card Title
 * Bold, athletic typography for card headings
 */
const AthleticCardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display text-display-sm font-black leading-tight tracking-athletic",
      className
    )}
    {...props}
  />
))
AthleticCardTitle.displayName = "AthleticCardTitle"

/**
 * Athletic Card Description
 * Subtitle or supporting text for the card
 */
const AthleticCardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground font-medium", className)}
    {...props}
  />
))
AthleticCardDescription.displayName = "AthleticCardDescription"

/**
 * Athletic Card Content
 * Main content area with generous padding
 */
const AthleticCardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 sm:p-8 pt-0", className)} {...props} />
))
AthleticCardContent.displayName = "AthleticCardContent"

/**
 * Athletic Card Footer
 * Footer section with actions or metadata
 */
const AthleticCardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 sm:p-8 pt-0", className)}
    {...props}
  />
))
AthleticCardFooter.displayName = "AthleticCardFooter"

export {
  AthleticCard,
  AthleticCardHeader,
  AthleticCardTitle,
  AthleticCardDescription,
  AthleticCardContent,
  AthleticCardFooter,
}
