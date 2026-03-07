import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Wind, Layers, Activity } from "lucide-react";

const hotspots = [
  {
    id: 1, x: 50, y: 15,
    label: "Professional Fiber",
    description: "Monofilament diamond-shaped fibers designed for maximum durability and realistic ball roll.",
    category: "performance",
    stats: [{ label: "Micron", value: "360" }, { label: "Type", value: "Diamond" }, { label: "UV", value: "12 Years" }],
  },
  {
    id: 2, x: 30, y: 45,
    label: "Eco-Friendly Infill",
    description: "Recycled SBR rubber infill providing excellent shock absorption and cooling properties.",
    category: "durability",
    stats: [{ label: "Temp", value: "-10°C" }, { label: "Drainage", value: "60L/min" }],
  },
  {
    id: 3, x: 55, y: 60,
    label: "ShockPad Pro",
    description: "Advanced underlay layer engineered to reduce impact on players' joints and allow consistent bounce.",
    category: "comfort",
    stats: [{ label: "Softness", value: "H-Grade" }, { label: "Impact", value: "85% Red." }],
  },
  {
    id: 4, x: 60, y: 85,
    label: "Tri-Layer Backing",
    description: "Polyurethane reinforced backing ensuring the fibers stay rooted even under extreme athletic force.",
    category: "protection",
    stats: [{ label: "Tear", value: "High-Tens" }, { label: "Bond", value: "PU Max" }],
  },
];

const getCategoryIcon = (category) => {
  switch (category) {
    case "protection": return <Shield className="w-4 h-4 text-turf-accent" />;
    case "performance": return <Zap className="w-4 h-4 text-turf-accent" />;
    case "comfort": return <Wind className="w-4 h-4 text-turf-accent" />;
    case "durability": return <Layers className="w-4 h-4 text-turf-accent" />;
    default: return <Activity className="w-4 h-4 text-turf-accent" />;
  }
};

function HotspotPoint({ spot, isActive, onHover, onLeave }) {
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
        <div className="relative w-3 h-3 bg-turf-accent rounded-full shadow-[0_0_15px_rgba(163,230,53,1)] ring-2 ring-black/20" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-4 left-1/2 -translate-x-1/2 z-50 w-[320px] md:w-[360px]"
          >
            <div className="absolute -top-4 left-1/2 w-px h-4 bg-gradient-to-b from-transparent to-turf-accent/50" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-turf-accent rounded-full shadow-[0_0_10px_#a3e635]" />

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
                <div className="text-[10px] font-mono text-white/40">TECH.ID.{spot.id.toString().padStart(3, "0")}</div>
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

export default function TurfTechSection() {
  const [activeHotspot, setActiveHotspot] = useState(null);

  return (
    <section id="tech" className="relative bg-turf-accent py-24 px-6 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-12">
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-tight">
            <span className="block font-sans leading-[0.85] text-turf-dark">TURF</span>
            <span className="block font-brier text-turf-dark text-9xl">SPECS</span>
          </h2>
          <p className="text-base mt-6 max-w-2xl text-turf-dark md:text-base">
            Explore the advanced technology behind our high-performance synthetic turfs. Hover over the points to discover
            the layers that make our fields the best in the game.
          </p>
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="relative w-full aspect-[4/3] md:aspect-[3/2]">
            <img src="https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(3).png" alt="Turf Tech Specs" className="w-full h-full object-contain" />

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
