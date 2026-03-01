import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { motion } from "framer-motion";

// Fallback static arenas if API fails
const fallbackArenas = [
  { id: 1, name: "Alpha Arena", year: "INDOOR", image: "/turf/unnamed.png" },
  { id: 2, name: "Beta Field", year: "OUTDOOR", image: "/turf/unnamed (1).png" },
  { id: 3, name: "Gamma Stadium", year: "PRO", image: "/turf/unnamed (2).png" },
  { id: 4, name: "Delta Training", year: "ACADEMY", image: "/turf/unnamed (3).png" },
  { id: 5, name: "Epsilon Turf", year: "INDOOR", image: "/turf/unnamed (4).png" },
  { id: 6, name: "Zeta Arena", year: "OUTDOOR", image: "/turf/unnamed (5).png" },
  { id: 7, name: "Eta Field", year: "PRO", image: "/turf/unnamed (6).png" },
  { id: 8, name: "Theta Stadium", year: "ACADEMY", image: "/turf/unnamed (7).png" },
];

export default function ArenaShowcase() {
  const [venues, setVenues] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    venueAPI.list({ sort_by: "rating" })
      .then(res => {
        const data = res.data?.slice(0, 8) || [];
        if (data.length > 0) {
          setVenues(data.map((v, i) => ({
            id: v.id,
            name: v.name,
            year: v.area || (v.badge === "bookable" ? "BOOKABLE" : "ENQUIRY"),
            image: v.images?.[0] || `/turf/unnamed${i > 0 ? ` (${i})` : ""}.png`,
            slug: v.slug,
          })));
        } else {
          setVenues(fallbackArenas);
        }
      })
      .catch(() => setVenues(fallbackArenas));
  }, []);

  const handleClick = (venue) => {
    if (venue.slug) {
      navigate(`/venue/${venue.slug}`);
    } else {
      navigate("/venues");
    }
  };

  return (
    <section id="arenas" className="relative bg-[#0a0c0a] py-12 md:py-24 px-4 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          viewport={{ once: true }}
          className="mb-10 md:mb-20"
        >
          <h2 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight">
            <span className="text-white">OUR</span>
            <br />
            <span className="text-turf-accent font-brier text-4xl sm:text-5xl md:text-6xl lg:text-8xl">PREMIUM VENUES</span>
          </h2>
          <p className="text-sm md:text-lg text-white/60 mt-4 md:mt-6 max-w-2xl">
            From indoor floodlit turfs to massive outdoor stadiums, Lobbi provides the best-in-class infrastructure
            for football, cricket, and more.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-16">
          {venues.map((arena, index) => (
            <motion.div
              key={arena.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.03, ease: "easeOut" }}
              viewport={{ once: true }}
              className="group relative cursor-pointer"
              onMouseEnter={() => setHoveredId(arena.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleClick(arena)}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="relative aspect-square overflow-hidden rounded-2xl bg-[#0a0a0a]
                           border-2 border-gray-800
                           group-hover:border-[#059669]
                           group-hover:shadow-2xl
                           group-hover:shadow-[#059669]/20
                           transition-all duration-300"
              >
                <div className="absolute inset-0 flex items-center justify-center p-2 md:p-8">
                  <img
                    src={arena.image || "/placeholder.svg"}
                    alt={arena.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>

                <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 text-right">
                  <p className="text-xs md:text-sm font-bold text-white/70 group-hover:text-white transition-colors duration-300">
                    {arena.name}
                  </p>
                  <p className="text-sm md:text-base font-black text-[#059669] group-hover:scale-110 group-hover:text-white transition-all duration-300 inline-block">
                    {arena.year}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
