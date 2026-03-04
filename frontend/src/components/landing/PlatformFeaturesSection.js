import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, UserCircle } from "lucide-react";

const personas = [
  {
    id: "player",
    label: "Play",
    title: "For Players",
    description:
      "Discover venues, join matches, and track your performance with real-time stats and AI-balanced matchmaking.",
    image: "/platform-feature/player.webp",
    icon: User,
  },
  {
    id: "venue-owner",
    label: "Manage",
    title: "For Venue Owners",
    description:
      "Streamline operations with automated booking, digital payments, and advanced analytics for your sports facility.",
    image: "/platform-feature/venue-owner.webp",
    icon: Building2,
  },
  {
    id: "coach",
    label: "Train",
    title: "For Coaches",
    description:
      "Build your coaching brand, manage trainee schedules, and offer subscription packages through our specialized marketplace.",
    image: "/platform-feature/coach.webp",
    icon: UserCircle,
  },
];

/** Maps scroll progress (0→1) across the section to a tab index (0,1,2) */
function getTabIndexFromProgress(progress) {
  if (progress < 0.33) return 0;
  if (progress < 0.66) return 1;
  return 2;
}

export default function PlatformFeaturesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const manualOverrideRef = useRef(false);
  const manualTimerRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    function onScroll() {
      if (manualOverrideRef.current) return;

      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.min(Math.max(scrolled / scrollable, 0), 1);

      const newIndex = getTabIndexFromProgress(progress);
      setActiveIndex((prev) => (prev === newIndex ? prev : newIndex));
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleTabClick(index) {
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualOverrideRef.current = true;
    setActiveIndex(index);

    const section = sectionRef.current;
    if (section) {
      const scrollable = section.offsetHeight - window.innerHeight;
      const targetProgress = index / (personas.length - 1);
      const targetScroll = section.offsetTop + targetProgress * scrollable;
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    }

    manualTimerRef.current = setTimeout(() => {
      manualOverrideRef.current = false;
    }, 1500);
  }

  const activePersona = personas[activeIndex];

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative bg-[#f5f1e8] border-y border-black/5"
      style={{ height: "200vh" }}
    >
      {/* Sticky panel */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-[100dvh] flex flex-col justify-start sm:justify-center overflow-clip px-3 sm:px-4 md:px-12 pt-[60px] sm:pt-16 md:pt-20 touch-pan-y"
      >
        {/* Progress rail */}
        <div className="absolute left-0 top-0 w-full h-[3px] bg-black/5">
          <motion.div
            className="h-full bg-turf-accent origin-left"
            animate={{ scaleX: (activeIndex + 1) / personas.length }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="max-w-7xl mx-auto w-full py-1 sm:py-8 md:py-12 flex flex-col h-[calc(100dvh-60px)] sm:h-auto">
          {/* Header row */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-1.5 sm:gap-6 md:gap-8 mb-2 sm:mb-8 md:mb-16">
            <div className="max-w-3xl">
              <h2 className="text-lg sm:text-3xl md:text-5xl lg:text-8xl font-black uppercase tracking-tight leading-tight">
                <span className="block font-sans leading-[0.85] text-turf-dark">
                  PLATFORM
                </span>
                <span className="block font-brier text-turf-accent text-xl sm:text-4xl md:text-6xl lg:text-9xl mt-0.5 sm:mt-2">
                  Features
                </span>
              </h2>
            </div>

            {/* Persona Switcher Tabs */}
            <div className="flex p-0.5 sm:p-1.5 bg-black/5 backdrop-blur-sm rounded-lg sm:rounded-2xl w-full lg:w-auto self-start">
              {personas.map((persona, i) => (
                <button
                  key={persona.id}
                  onClick={() => handleTabClick(i)}
                  className={`relative flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-4 md:px-6 py-1.5 sm:py-3 rounded-md sm:rounded-xl text-[9px] sm:text-xs md:text-sm font-bold uppercase tracking-wider sm:tracking-widest transition-all duration-300 flex-1 lg:flex-none ${
                    activeIndex === i
                      ? "text-white shadow-lg"
                      : "text-turf-dark/40 hover:text-turf-dark/70"
                  }`}
                >
                  {activeIndex === i && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-turf-accent rounded-md sm:rounded-xl"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                  <persona.icon
                    className={`w-3 h-3 sm:w-4 sm:h-4 relative z-10 ${
                      activeIndex === i ? "text-white" : "text-current"
                    }`}
                  />
                  <span className="relative z-10">{persona.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content grid */}
          <div className="grid lg:grid-cols-12 gap-2 sm:gap-8 md:gap-12 items-center flex-1 min-h-0">
            {/* Left: text + step dots */}
            <div className="lg:col-span-4 space-y-1 sm:space-y-4 md:space-y-6">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-turf-accent/10 border border-turf-accent/20 text-turf-accent text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-turf-accent animate-pulse" />
                Ecosystem
              </div>

              {/* Text crossfade */}
              <div className="relative min-h-[4.5rem] sm:min-h-[8rem]">
                <AnimatePresence>
                  {personas.map((persona) =>
                    persona.id === activePersona.id ? (
                      <motion.div
                        key={persona.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute top-0 left-0 right-0 space-y-1 sm:space-y-4"
                      >
                        <h3 className="text-base sm:text-2xl md:text-4xl font-black text-turf-dark uppercase font-brier tracking-tight">
                          {persona.title}
                        </h3>
                        <p className="text-[11px] sm:text-base md:text-lg text-turf-dark/60 leading-snug sm:leading-relaxed font-medium">
                          {persona.description}
                        </p>
                      </motion.div>
                    ) : null
                  )}
                </AnimatePresence>
              </div>

              {/* Step indicator dots */}
              <div className="flex items-center gap-2">
                {personas.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleTabClick(i)}
                    aria-label={`Go to ${personas[i].label}`}
                    className="focus:outline-none"
                  >
                    <motion.div
                      animate={{
                        width: activeIndex === i ? 32 : 8,
                        backgroundColor:
                          activeIndex === i
                            ? "var(--color-turf-accent, #22c55e)"
                            : "rgba(0,0,0,0.12)",
                      }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="h-1.5 rounded-full"
                      style={{ width: activeIndex === i ? 32 : 8 }}
                    />
                  </button>
                ))}
              </div>

              {/* Scroll hint - hidden on small screens */}
              <div className="hidden sm:flex h-6 items-center">
                <AnimatePresence>
                  {activeIndex === 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.4, duration: 0.4 }}
                      className="text-xs text-turf-dark/30 font-semibold uppercase tracking-widest flex items-center gap-2"
                    >
                      <motion.span
                        animate={{ y: [0, 4, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.4,
                          ease: "easeInOut",
                        }}
                      >
                        ↓
                      </motion.span>
                      Scroll to explore
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right: image */}
            <div className="lg:col-span-8 relative min-h-0 flex-1 sm:flex-none">
              <div className="aspect-[2/1] sm:aspect-[3/2] lg:aspect-[16/10] max-h-[35dvh] sm:max-h-none relative rounded-xl sm:rounded-3xl overflow-hidden shadow-[0_16px_32px_-8px_rgba(0,0,0,0.15)] sm:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] bg-white border-2 sm:border-4 border-white">
                <AnimatePresence>
                  {personas.map((persona) =>
                    persona.id === activePersona.id ? (
                      <motion.div
                        key={persona.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute inset-0"
                      >
                        <img
                          src={persona.image}
                          alt={persona.title}
                          className="w-full h-full object-cover md:object-contain bg-white"
                        />
                        <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl sm:rounded-2xl" />
                        <div className="absolute top-0 right-0 w-16 sm:w-32 h-16 sm:h-32 bg-turf-accent/5 blur-3xl rounded-full -mr-8 sm:-mr-16 -mt-8 sm:-mt-16" />
                        <div className="absolute bottom-0 left-0 w-16 sm:w-32 h-16 sm:h-32 bg-turf-accent/5 blur-3xl rounded-full -ml-8 sm:-ml-16 -mb-8 sm:-mb-16" />
                      </motion.div>
                    ) : null
                  )}
                </AnimatePresence>
              </div>

              {/* Visual accent glows */}
              <div className="absolute -bottom-3 sm:-bottom-6 -right-3 sm:-right-6 w-16 sm:w-32 h-16 sm:h-32 bg-turf-accent/10 blur-3xl rounded-full z-0" />
              <div className="absolute -top-3 sm:-top-6 -left-3 sm:-left-6 w-16 sm:w-32 h-16 sm:h-32 bg-turf-accent/10 blur-3xl rounded-full z-0" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
