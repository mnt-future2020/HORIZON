import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide transition-all duration-300",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Athletic variants - bold badges with energy
        athletic:
          "border-primary bg-primary/10 text-primary backdrop-blur-sm hover:bg-primary/20",
        energy:
          "border-accent bg-accent/10 text-accent backdrop-blur-sm hover:bg-accent/20",
        sport:
          "border-amber-400 bg-amber-400/10 text-amber-400 backdrop-blur-sm hover:bg-amber-400/20",
        glow:
          "border-primary bg-primary/20 text-primary shadow-glow-sm animate-glow-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
