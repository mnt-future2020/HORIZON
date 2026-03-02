import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, UserCircle } from "lucide-react";

const personas = [
  {
    id: "player",
    label: "Play",
    title: "For Players",
    description: "Discover venues, join matches, and track your performance with real-time stats and AI-balanced matchmaking.",
    image: "/platform-feature/player.webp",
    icon: User
  },
  {
    id: "venue-owner",
    label: "Manage",
    title: "For Venue Owners",
    description: "Streamline operations with automated booking, digital payments, and advanced analytics for your sports facility.",
    image: "/platform-feature/venue-owner.webp",
    icon: Building2
  },
  {
    id: "coach",
    label: "Train",
    title: "For Coaches",
    description: "Build your coaching brand, manage trainee schedules, and offer subscription packages through our specialized marketplace.",
    image: "/platform-feature/coach.webp",
    icon: UserCircle
  },
];

export default function PlatformFeaturesSection() {
  const [activePersona, setActivePersona] = useState(personas[0]);

  return (
    <section id="features" className="relative bg-[#f5f1e8] py-12 md:py-24 px-4 md:px-12 overflow-hidden border-y border-black/5">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 md:mb-16">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-tight">
              <span className="block font-sans leading-[0.85] text-turf-dark">PLATFORM</span>
              <span className="block font-brier text-turf-accent text-4xl sm:text-5xl md:text-7xl lg:text-9xl mt-2">Features</span>
            </h2>
          </div>
          
          {/* Persona Switcher Tabs */}
          <div className="flex p-1.5 bg-black/5 backdrop-blur-sm rounded-2xl w-full lg:w-auto self-start">
            {personas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => setActivePersona(persona)}
                className={`relative flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-300 flex-1 lg:flex-none ${
                  activePersona.id === persona.id 
                    ? "text-white shadow-lg" 
                    : "text-turf-dark/40 hover:text-turf-dark/70"
                }`}
              >
                {activePersona.id === persona.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-turf-accent rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <persona.icon className={`w-4 h-4 relative z-10 ${activePersona.id === persona.id ? "text-white" : "text-current"}`} />
                <span className="relative z-10">{persona.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Content Description */}
          <div className="lg:col-span-4 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-turf-accent/10 border border-turf-accent/20 text-turf-accent text-[10px] font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-turf-accent animate-pulse" />
              Ecosystem
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activePersona.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-4"
              >
                <h3 className="text-2xl md:text-4xl font-black text-turf-dark uppercase font-brier tracking-tight">
                  {activePersona.title}
                </h3>
                <p className="text-lg text-turf-dark/60 leading-relaxed font-medium">
                  {activePersona.description}
                </p>
                <div className="pt-4 flex gap-3">
                  <div className="h-0.5 w-12 bg-turf-accent" />
                  <div className="h-0.5 w-4 bg-turf-dark/10" />
                  <div className="h-0.5 w-4 bg-turf-dark/10" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Image Showcase */}
          <div className="lg:col-span-8 relative">
            <div className="aspect-[16/10] md:aspect-[3/2] lg:aspect-[16/10] relative rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] bg-white/50 border-4 border-white">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePersona.id}
                  initial={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full h-full"
                >
                  <img 
                    src={activePersona.image} 
                    alt={activePersona.title} 
                    className="w-full h-full object-cover md:object-contain bg-white"
                  />
                  
                  {/* Decorative Elements */}
                  <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-2xl" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-turf-accent/5 blur-3xl rounded-full -mr-16 -mt-16" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-turf-accent/5 blur-3xl rounded-full -ml-16 -mb-16" />
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Visual Accent */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-turf-accent/10 blur-3xl rounded-full z-0" />
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-turf-accent/10 blur-3xl rounded-full z-0" />
          </div>
        </div>
      </div>
    </section>
  );
}
