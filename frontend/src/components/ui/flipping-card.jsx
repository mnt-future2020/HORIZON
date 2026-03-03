import React from "react";
import { cn } from "@/lib/utils";

/**
 * FlippingCard component that flips on hover.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional classes for the inner card container.
 * @param {string} [props.frontClassName] - Override classes for the front face background.
 * @param {string} [props.backClassName] - Override classes for the back face background.
 * @param {number} [props.height=300] - Height of the card in pixels.
 * @param {number} [props.width] - Width of the card in pixels. Omit for full-width.
 * @param {React.ReactNode} props.frontContent - Content to display on the front face.
 * @param {React.ReactNode} props.backContent - Content to display on the back face.
 */
export function FlippingCard({
  className,
  frontClassName,
  backClassName,
  frontContent,
  backContent,
  height = 300,
  width,
}) {
  return (
    <div
      className="group/flipping-card [perspective:1000px] cursor-pointer w-full"
      style={{
        "--height": `${height}px`,
        ...(width ? { "--width": `${width}px` } : {}),
      }}
    >
      <div
        className={cn(
          "relative rounded-xl border border-neutral-200 bg-white shadow-lg transition-all duration-700 [transform-style:preserve-3d] group-hover/flipping-card:[transform:rotateY(180deg)] dark:border-neutral-800 dark:bg-neutral-950",
          "h-[var(--height)]",
          width ? "w-[var(--width)]" : "w-full",
          className
        )}
      >
        {/* Front Face */}
        <div
          className={cn(
            "absolute inset-0 h-full w-full rounded-[inherit] [transform-style:preserve-3d] [backface-visibility:hidden] [transform:rotateY(0deg)]",
            frontClassName || "bg-white text-neutral-950 dark:bg-zinc-950 dark:text-neutral-50"
          )}
        >
          <div className="[transform:translateZ(70px)_scale(.93)] h-full w-full">
            {frontContent}
          </div>
        </div>
        {/* Back Face */}
        <div
          className={cn(
            "absolute inset-0 h-full w-full rounded-[inherit] [transform-style:preserve-3d] [backface-visibility:hidden] [transform:rotateY(180deg)]",
            backClassName || "bg-white text-neutral-950 dark:bg-zinc-950 dark:text-neutral-50"
          )}
        >
          <div className="[transform:translateZ(70px)_scale(.93)] h-full w-full">
            {backContent}
          </div>
        </div>
      </div>
    </div>
  );
}
