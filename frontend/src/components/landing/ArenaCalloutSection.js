import { motion } from "framer-motion";
import { InteractiveClean } from "./InteractiveClean";

export default function ArenaCalloutSection() {
  return (
    <section className="relative bg-white px-3 sm:px-4 md:px-12 overflow-hidden pb-5">
      <div className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-20 items-center min-h-[60vh] sm:min-h-[70vh] lg:min-h-screen py-8 sm:py-12 lg:py-0">
          <div className="flex flex-col justify-center items-start lg:items-end lg:pr-12 order-2 lg:order-1">
            <div className="relative">
              {/* Large decorative quote */}
              <div
                className="absolute -left-4 -top-6 sm:-left-8 sm:-top-12 md:-left-12 md:-top-16 lg:-left-24 lg:-top-32 text-turf-accent opacity-30 text-[50px] sm:text-[80px] md:text-[140px] lg:text-[280px] leading-none pointer-events-none select-none simteste"
                style={{ fontFamily: "'Alex Brush', cursive" }}
              >
                &ldquo;
              </div>

              {/* Main quote */}
              <blockquote className="relative z-10 max-w-xl">
                <p className="text-xl sm:text-2xl md:text-4xl lg:text-6xl font-black uppercase text-gray-900 leading-[1.1] tracking-tight mb-3 sm:mb-4 md:mb-8">
                  <span className="block mb-1 sm:mb-2">ONE PLATFORM</span>
                  <span className="block mb-1 sm:mb-2">FOR</span>
                  <span className="block text-turf-accent font-brier normal-case text-2xl sm:text-3xl md:text-5xl lg:text-8xl -ml-1">
                    EVERYTHING
                  </span>
                  <span className="block mt-1 sm:mt-2">IN SPORTS AND FITNESS.</span>
                  <span className="block">YOUR JOURNEY STARTS HERE.</span>
                </p>
              </blockquote>

              {/* Author attribution */}
              <div className="mt-3 sm:mt-4">
                <p className="text-sm sm:text-base font-medium font-mono md:text-lg text-turf-accent">- Lobbi Management</p>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="relative w-full aspect-[4/5] sm:aspect-square max-w-[280px] sm:max-w-sm md:max-w-lg mx-auto lg:mx-0 order-1 lg:order-2"
          >
            <InteractiveClean />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
