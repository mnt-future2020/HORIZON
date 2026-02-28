import { motion } from "framer-motion";
import { InteractiveClean } from "./InteractiveClean";

export default function ArenaCalloutSection() {
  return (
    <section className="relative bg-turf-dark px-6 md:px-12 overflow-hidden pb-5">
      <div className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-screen">
          <div className="flex flex-col justify-center items-start lg:items-end lg:pr-12 order-2 lg:order-1">
            <div className="relative">
              {/* Large decorative quote */}
              <div
                className="absolute -left-16 -top-20 lg:-left-24 lg:-top-32 text-turf-accent opacity-30 text-[200px] lg:text-[280px] leading-none pointer-events-none select-none simteste"
                style={{ fontFamily: "'Alex Brush', cursive" }}
              >
                &ldquo;
              </div>

              {/* Main quote */}
              <blockquote className="relative z-10 max-w-xl">
                <p className="text-4xl md:text-5xl lg:text-6xl font-black uppercase text-turf-text-light leading-[1.1] tracking-tight mb-8">
                  <span className="block mb-2">ONE PLATFORM</span>
                  <span className="block mb-2">FOR</span>
                  <span className="block text-turf-accent font-brier normal-case text-5xl md:text-6xl -ml-1 lg:text-8xl">
                    EVERYTHING
                  </span>
                  <span className="block mt-2">IN SPORTS.</span>
                  <span className="block">YOUR GAME STARTS HERE.</span>
                </p>
              </blockquote>

              {/* Author attribution */}
              <div className="mt-4">
                <p className="text-base font-medium font-mono md:text-lg text-turf-accent">- Lobbi Management</p>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="relative w-full aspect-[4/5] md:aspect-square max-w-lg mx-auto lg:mx-0 order-1 lg:order-2"
          >
            <InteractiveClean />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
