import { useRef, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function HeroSection() {
  const containerRef = useRef(null);
  const lobbiRef = useRef(null);
  const subtitleRef = useRef(null);

  const adjustSubtitleSpacing = useCallback(() => {
    if (lobbiRef.current && subtitleRef.current) {
      subtitleRef.current.style.letterSpacing = '0px';
      subtitleRef.current.style.width = 'max-content';

      const lobbiWidth = lobbiRef.current.getBoundingClientRect().width;
      const subtitleNaturalWidth = subtitleRef.current.getBoundingClientRect().width;
      const charCount = subtitleRef.current.textContent.length;
      const spacing = Math.max(
        (lobbiWidth - subtitleNaturalWidth) / (charCount - 1),
        -1
      );

      subtitleRef.current.style.letterSpacing = `${spacing}px`;
      subtitleRef.current.style.width = '';
    }
  }, []);

  useEffect(() => {
    adjustSubtitleSpacing();
    window.addEventListener('resize', adjustSubtitleSpacing);
    return () => window.removeEventListener('resize', adjustSubtitleSpacing);
  }, [adjustSubtitleSpacing]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const scale = useTransform(smoothProgress, [0, 1], [1, 0.85]);
  const borderRadius = useTransform(smoothProgress, [0, 1], ["0px", "40px"]);
  const opacity = useTransform(smoothProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={containerRef} className="relative h-[130vh] sm:h-[150vh] bg-[#0a0c0a]">
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0c0a]">

        {/* Video Background with Scroll Transformation */}
        <motion.div
          className="absolute inset-0 z-0 origin-center overflow-hidden"
          style={{ scale, borderRadius }}
        >
          <div className="absolute inset-0 bg-black/40 z-10 mix-blend-multiply pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-[40vh] sm:h-[60vh] bg-gradient-to-t from-[#0a0c0a] via-[#0a0c0a]/50 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-[20vh] sm:h-[30vh] bg-gradient-to-b from-[#0a0c0a]/80 to-transparent z-10 pointer-events-none" />

          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover scale-105"
            src="https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/Create_an_8second_cinematic_seamless_loop_hero_bac_cd3232e886.webm"
          />
        </motion.div>

        {/* Foreground Content */}
        <div className="relative z-20 w-full h-full flex flex-col justify-end px-4 sm:px-6 md:px-12 pointer-events-none">

          {/* Bottom-Anchored Typography + CTA */}
          <motion.div
            style={{ opacity }}
            className="pb-6 sm:pb-10 md:pb-14 flex flex-col gap-4 sm:gap-6"
          >
            {/* Brand Title - Bottom Left */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            >
              <div className="w-fit">
                <h1 ref={lobbiRef} className="font-brier text-[20vw] sm:text-[18vw] md:text-[12vw] lg:text-[10vw] leading-[0.8] text-white tracking-tighter drop-shadow-2xl">
                  LOBBI
                </h1>
                <h2 ref={subtitleRef} className="font-oswald text-[5.5vw] sm:text-[5vw] md:text-[3.6vw] lg:text-[3vw] font-black text-white uppercase drop-shadow-lg leading-none mt-1 md:mt-2 whitespace-nowrap">
                  <span className="normal-case text-brand-600">for</span> Sports & Fitness.
                </h2>
              </div>
            </motion.div>

            {/* Bottom Row: Statement + CTA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6 pointer-events-auto">
              {/* Statement Line */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1, duration: 1, ease: "easeOut" }}
                className="max-w-[260px] sm:max-w-xs text-white/70 font-medium text-xs sm:text-sm md:text-base border-l-2 border-brand-600 pl-4 sm:pl-5 relative"
              >
                <span className="absolute -left-[2px] top-0 w-[2px] h-3 bg-white" />
                Book elite arenas. Find tournaments. Dominate your sport. Built purely for athletes.
              </motion.div>

              {/* CTA Button */}
              <motion.button
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 1, ease: "easeOut" }}
                className="group relative flex items-center justify-between gap-4 sm:gap-6 bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-3.5 sm:px-8 sm:py-5 rounded-full font-bold uppercase tracking-widest hover:border-brand-600 hover:bg-white/20 transition-all duration-500 overflow-hidden"
                onClick={() => {
                  const target = document.getElementById('mission');
                  if (target) target.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="relative z-10 font-oswald text-sm sm:text-lg">Step Inside</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-brand-600 flex items-center justify-center text-white relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-45">
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
                </div>
                <div className="absolute inset-0 bg-brand-600/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
              </motion.button>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
