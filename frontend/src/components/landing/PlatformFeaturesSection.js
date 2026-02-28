import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Swords, GraduationCap, Trophy, Activity } from "lucide-react";

const hotspots = [
  {
    id: 1, x: 50, y: 15,
    label: "Venue Discovery & Booking",
    description: "Find and book sports venues with GPS discovery, real-time slot availability, split payments, and QR check-in.",
    category: "venues",
    stats: [{ label: "Pay Mode", value: "Split 2–22" }, { label: "Locking", value: "Real-time" }, { label: "Check-in", value: "QR Code" }],
  },
  {
    id: 2, x: 30, y: 45,
    label: "Matchmaking & Ratings",
    description: "Find opponents at your skill level with AI-balanced teams, Glicko-2 tamper-proof ratings, and global leaderboards.",
    category: "compete",
    stats: [{ label: "Algorithm", value: "Glicko-2" }, { label: "Tiers", value: "4 Levels" }],
  },
  {
    id: 3, x: 55, y: 60,
    label: "Coaching Marketplace",
    description: "Discover coaches, book private or group sessions, subscribe to monthly packages, and track performance progress.",
    category: "training",
    stats: [{ label: "Sessions", value: "1-on-1" }, { label: "Packages", value: "Monthly" }],
  },
  {
    id: 4, x: 60, y: 85,
    label: "Tournaments & Live Scoring",
    description: "Create and join tournaments with auto-generated brackets and real-time WebSocket live scoring for spectators.",
    category: "tournaments",
    stats: [{ label: "Formats", value: "KO / RR" }, { label: "Scoring", value: "Real-time" }],
  },
];

const getCategoryIcon = (category) => {
  switch (category) {
    case "venues": return <MapPin className="w-4 h-4 text-turf-accent" />;
    case "compete": return <Swords className="w-4 h-4 text-turf-accent" />;
    case "training": return <GraduationCap className="w-4 h-4 text-turf-accent" />;
    case "tournaments": return <Trophy className="w-4 h-4 text-turf-accent" />;
    default: return <Activity className="w-4 h-4 text-turf-accent" />;
  }
};

function HotspotPoint({ spot, isActive, onHover, onLeave }) {
  const opensUpward = spot.y > 50;

  return (
    <div
      style={{ top: `${spot.y}%`, left: `${spot.x}%` }}
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-30"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onHover}
    >
      <div className="relative flex items-center justify-center w-12 h-12">
        <motion.div
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          className="absolute inset-0 bg-turf-accent/40 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.2 }}
          className="absolute inset-0 bg-turf-accent/30 rounded-full"
        />
        <div className="relative w-3 h-3 bg-turf-accent rounded-full shadow-[0_0_15px_rgba(5,150,105,1)] ring-2 ring-black/20" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: opensUpward ? -20 : 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: opensUpward ? -10 : 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute left-1/2 -translate-x-1/2 z-50 w-[320px] md:w-[360px] ${
              opensUpward ? "bottom-full mb-4" : "top-full mt-4"
            }`}
          >
            {!opensUpward && (
              <>
                <div className="absolute -top-4 left-1/2 w-px h-4 bg-gradient-to-b from-transparent to-turf-accent/50" />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-turf-accent rounded-full shadow-[0_0_10px_#059669]" />
              </>
            )}
            {opensUpward && (
              <>
                <div className="absolute -bottom-4 left-1/2 w-px h-4 bg-gradient-to-t from-transparent to-turf-accent/50" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-turf-accent rounded-full shadow-[0_0_10px_#059669]" />
              </>
            )}

            <div className="relative overflow-hidden rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-turf-accent/50 to-transparent opacity-50" />
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-turf-accent/5 blur-[50px]" />

              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(spot.category)}
                  <span className="text-xs font-bold tracking-widest text-turf-accent uppercase opacity-80">
                    {spot.category}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-white/40">FEAT.{spot.id.toString().padStart(3, "0")}</div>
              </div>

              <div className="p-5">
                <h3 className="text-xl font-bold text-white mb-2 font-oswald uppercase tracking-wide">
                  {spot.label}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed mb-5 border-l-2 border-turf-accent/30 pl-3">
                  {spot.description}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {spot.stats.map((stat, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 rounded px-3 py-2 border border-white/5 hover:border-turf-accent/30 transition-colors group"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-brier group-hover:text-turf-accent/70 transition-colors">
                        {stat.label}
                      </div>
                      <div className="text-sm font-medium text-white font-mono">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-30">
                <div className="w-1 h-1 bg-turf-accent rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PlatformFeaturesSection() {
  const [activeHotspot, setActiveHotspot] = useState(null);

  return (
    <section id="features" className="relative bg-[#f5f1e8] py-24 px-6 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-12">
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-tight">
            <span className="block font-sans leading-[0.85] text-turf-dark">PLATFORM</span>
            <span className="block font-brier text-turf-accent text-9xl">Features</span>
          </h2>
          <p className="text-base mt-6 max-w-2xl text-turf-dark/60 md:text-base">
            Everything players, venue owners, and coaches need — in one platform.
            Hover over the points to discover each feature.
          </p>
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="relative w-full aspect-[4/3] md:aspect-[3/2]">
            <img src="/turf/unnamed (3).png" alt="Turf Tech Specs" className="w-full h-full object-contain" />

            {hotspots.map((spot) => (
              <HotspotPoint
                key={spot.id}
                spot={spot}
                isActive={activeHotspot === spot.id}
                onHover={() => setActiveHotspot(spot.id)}
                onLeave={() => setActiveHotspot(null)}
              />
            ))}
          </div>

          <div className="md:hidden text-center mt-8 text-gray-500 text-sm">
            Tap on the pulsating points to see the information
          </div>
        </div>
      </div>
    </section>
  );
}
