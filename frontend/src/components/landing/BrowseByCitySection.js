import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

export default function BrowseByCitySection() {
  const [cities, setCities] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    venueAPI.cities()
      .then((res) => setCities(res.data || []))
      .catch(() => {});
  }, []);

  if (cities.length === 0) return null;

  const goToCity = (city) => navigate(`/venues?city=${encodeURIComponent(city)}`);

  return (
    <section className="relative py-12 sm:py-16 md:py-24 lg:py-32 px-3 sm:px-4 md:px-12 bg-white overflow-hidden" id="locations">
      {/* Background Decorative Element */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-turf-accent/5 -skew-x-12 transform translate-x-1/2 pointer-events-none" />

      <div className="max-w-[90rem] mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 md:mb-20 gap-3 sm:gap-4 md:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-8xl font-black uppercase tracking-tight leading-tight">
              <span className="block font-sans leading-[0.85] text-gray-900">
                ACTIVE
              </span>
              <span className="block font-brier text-turf-accent text-3xl sm:text-4xl md:text-6xl lg:text-9xl mt-1 sm:mt-2">
                LOCATIONS
              </span>
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-gray-400 font-medium max-w-xs md:text-right uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[10px] sm:text-xs md:text-sm"
          >
            Explore venues across prime urban spots and elevate your game.
          </motion.p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          {cities.slice(0, 5).map((c, idx) => (
            <motion.div
              key={c.city}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => goToCity(c.city)}
              className="group relative aspect-[3/2] rounded-xl sm:rounded-2xl md:rounded-[2rem] overflow-hidden cursor-pointer shadow-xl sm:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-white/5"
            >
              {/* Premium Dark Turf Background */}
              <div className="absolute inset-0 bg-[#0c1a0c] transition-colors duration-500">
                <div
                  className="absolute inset-0 opacity-[0.3] mix-blend-overlay"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                  }}
                />
                <div
                  className="absolute inset-0 opacity-[0.4]"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.15) 30px, rgba(255,255,255,0.15) 60px)`,
                  }}
                />
                <div className="absolute inset-0 bg-radial-gradient from-turf-accent/30 via-transparent to-transparent opacity-30 group-hover:opacity-100 transition-opacity duration-700" />
              </div>

              {/* Top border accent on hover */}
              <div className="absolute top-0 inset-x-0 h-1 bg-turf-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

              {/* Content Container */}
              <div className="absolute inset-0 p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col justify-between">
                <div className="flex justify-end">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-14 md:h-14 rounded-lg sm:rounded-xl md:rounded-2xl bg-turf-accent/10 backdrop-blur-xl flex items-center justify-center border border-turf-accent/20 transform rotate-12 group-hover:rotate-0 transition-all duration-700 shadow-xl">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-turf-accent" />
                  </div>
                </div>

                <div className="relative">
                  <h3 className="font-brier text-base sm:text-lg md:text-xl lg:text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1.5 sm:mb-3 transform group-hover:-translate-y-1 transition-all duration-500">
                    {c.city}
                  </h3>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="h-[2px] w-5 sm:w-8 bg-turf-accent transition-all duration-500 group-hover:w-12" />
                    <p className="text-turf-accent/80 group-hover:text-turf-accent font-oswald font-bold text-[9px] sm:text-xs md:text-sm tracking-[0.15em] sm:tracking-[0.2em] uppercase transition-colors duration-300">
                      {c.count} {c.count > 1 ? "VENUES" : "VENUE"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subtle Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
            </motion.div>
          ))}
        </div>

        {/* View All CTA on mobile/tablet */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-8 sm:mt-12 md:mt-16 flex justify-center lg:hidden"
        >
          <button className="px-6 py-3 sm:px-8 sm:py-4 bg-gray-900 text-white font-bold rounded-full uppercase tracking-widest text-[10px] sm:text-xs hover:bg-turf-dark transition-colors">
            View All Locations
          </button>
        </motion.div>
      </div>
    </section>
  );
}
