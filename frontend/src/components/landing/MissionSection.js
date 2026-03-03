import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

export default function MissionSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 10]);

  return (
    <section
      id="mission"
      ref={sectionRef}
      className="relative min-h-screen bg-turf-dark text-turf-text-light py-20 md:py-32 overflow-hidden flex items-center"
    >
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
          style={{ y: y1 }}
          className="absolute top-[10%] -right-[5%] w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          style={{ y: y2 }}
          className="absolute bottom-[10%] -left-[5%] w-[400px] h-[400px] bg-sky-500/10 rounded-full blur-[100px]" 
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          {/* Left Content Column */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-[2px] bg-turf-accent" />
              <span className="text-turf-accent font-bold tracking-[0.2em] uppercase text-sm">Our Mission</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.9] mb-10 text-balance">
              <span className="text-turf-accent font-brier">BOOK.</span> PLAY. <br />
              <span className="text-turf-accent font-brier">CONNECT.</span> COMPETE. <br />
              <div className="text-3xl md:text-4xl lg:text-5xl font-oswald mt-4 opacity-50 tracking-normal">
                INDIA'S ALL-IN-ONE <br />
                <span className="text-white">SPORTS PLATFORM</span>
              </div>
            </h2>
            
            <p className="text-lg md:text-xl text-turf-text-light/70 max-w-xl leading-relaxed mb-10 font-medium">
              We're building India's premier ecosystem for athletes and professionals. 
              From booking world-class turfs to discovering elite coaching, 
              everything you need to elevate your sport is right here.
            </p>

            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col">
                <span className="text-4xl font-black text-white font-oswald">500+</span>
                <span className="text-sm text-turf-text-light/50 uppercase tracking-widest font-bold">Venues</span>
              </div>
              <div className="w-[1px] h-12 bg-white/10 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-4xl font-black text-white font-oswald">10k+</span>
                <span className="text-sm text-turf-text-light/50 uppercase tracking-widest font-bold">Players</span>
              </div>
              <div className="w-[1px] h-12 bg-white/10 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-4xl font-black text-white font-oswald">200+</span>
                <span className="text-sm text-turf-text-light/50 uppercase tracking-widest font-bold">Coaches</span>
              </div>
            </div>
          </motion.div>

          {/* Right Image/Visual Column */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Geometric Backdrop with Turf Pattern */}
            <motion.div 
              style={{ rotate: rotate }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[90%] -skew-x-12 -skew-y-3 rounded-[40px] border border-white/10 overflow-hidden z-0"
            >
              {/* Turf Base Layer */}
              <div className="absolute inset-0 bg-[#059669] opacity-40 backdrop-blur-3xl" />
              
              {/* Turf Texture Layer */}
              <div 
                className="absolute inset-0 opacity-20 contrast-125 saturate-50 mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Turf Stripe Layer (Simulating mown grass) */}
              <div 
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,0,0,0.2) 40px, rgba(0,0,0,0.2) 80px)`,
                }}
              />
              
              {/* Vignette Overlay */}
              <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/40" />
            </motion.div>

            {/* Main Asset */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-[600px] xl:max-w-[700px] flex justify-center lg:justify-end"
            >
              <img
                src="/images/mission-webp/elite_goalkeeper_mission_v2.png"
                alt="Elite Goalkeeper"
                className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-105"
              />
            </motion.div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
