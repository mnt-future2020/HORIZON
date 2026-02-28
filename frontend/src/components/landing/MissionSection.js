import { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, useInView } from "framer-motion";

export default function MissionSection() {
  const sectionRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        const sectionHeight = rect.height;
        const scrolled = -rect.top;
        const progress = Math.min(Math.max(scrolled / sectionHeight, 0), 1);
        setScrollProgress(progress);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      id="mission"
      ref={sectionRef}
      className="relative min-h-screen bg-turf-dark text-turf-text-light py-24 flex items-center justify-center"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="relative h-32 flex items-center justify-center mt-16">
          <img
            src="/images/icon/ico-helmet-w.png"
            className="h-full w-auto max-h-[60px] object-contain"
            alt="Icon"
          />
        </div>

        <div className="text-center">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight text-balance leading-[1.1] xl:text-8xl">
            <span className="text-turf-accent font-brier leading-[1.1] text-8xl">PREMIUM</span> TURFS,
            <br />
            BUILT FOR <span className="text-turf-accent font-brier leading-[1.1]">PERFORMANCE</span>,
            <br />
            BRINGING YOUR GAME TO
            <br />
            THE NEXT LEVEL.
            <br />
            DEFINING THE <span className="text-turf-accent font-brier leading-[1.1]">STANDARD</span>
            <br />
            IN MODERN SPORTS
            <br />
            PRO PLAYFIELDS & ACADEMY.
          </h2>
        </div>
      </div>
    </section>
  );
}
