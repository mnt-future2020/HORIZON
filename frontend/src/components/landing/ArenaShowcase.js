import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { motion } from "framer-motion";
import { MapPin, Star } from "lucide-react";

// Fallback static arenas if API fails
const fallbackArenas = [
  { id: 1, name: "Alpha Arena", area: "INDOOR", city: "Bengaluru", image: "/turf/unnamed.png", base_price: 1200 },
  { id: 2, name: "Beta Field", area: "OUTDOOR", city: "Bengaluru", image: "/turf/unnamed (1).png", base_price: 1500 },
  { id: 3, name: "Gamma Stadium", area: "PRO", city: "Chennai", image: "/turf/unnamed (2).png", base_price: 1800 },
  { id: 4, name: "Delta Training", area: "ACADEMY", city: "Mumbai", image: "/turf/unnamed (3).png", base_price: 2000 },
  { id: 5, name: "Epsilon Turf", area: "INDOOR", city: "Delhi", image: "/turf/unnamed (4).png", base_price: 1000 },
  { id: 6, name: "Zeta Arena", area: "OUTDOOR", city: "Hyderabad", image: "/turf/unnamed (5).png", base_price: 1600 },
  { id: 7, name: "Eta Field", area: "PRO", city: "Pune", image: "/turf/unnamed (6).png", base_price: 2200 },
  { id: 8, name: "Theta Stadium", area: "ACADEMY", city: "Kolkata", image: "/turf/unnamed (7).png", base_price: 1400 },
];

export default function ArenaShowcase() {
  const [venues, setVenues] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    venueAPI.list({ sort_by: "rating" })
      .then(res => {
        const data = res.data?.slice(0, 8) || [];
        if (data.length > 0) {
          setVenues(data);
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
    <section id="arenas" className="relative bg-[#0a0c0a] py-8 sm:py-12 md:py-24 px-3 sm:px-4 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          viewport={{ once: true }}
          className="mb-6 sm:mb-10 md:mb-20"
        >
          <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-7xl font-black uppercase tracking-tight">
            <span className="text-white">OUR</span>
            <br />
            <span className="text-turf-accent font-brier text-3xl sm:text-4xl md:text-5xl lg:text-8xl">PREMIUM VENUES</span>
          </h2>
          <p className="text-xs sm:text-sm md:text-lg text-white/60 mt-3 sm:mt-4 md:mt-6 max-w-2xl">
            From indoor floodlit turfs to massive outdoor stadiums, Lobbi provides the best-in-class infrastructure
            for football, cricket, and more.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 mb-8 sm:mb-12 md:mb-16">
          {venues.map((venue, index) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
              viewport={{ once: true }}
              onClick={() => handleClick(venue)}
              className="group cursor-pointer flex flex-col bg-white border border-white/10 hover:border-turf-accent/50
                         rounded-xl sm:rounded-2xl overflow-hidden shadow-xl sm:shadow-2xl shadow-black/50 hover:shadow-turf-accent/20
                         transition-all duration-300"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={venue.images?.[0] ? mediaUrl(venue.images[0]) : (venue.image || "/placeholder.svg")}
                  alt={venue.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {venue.badge && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                    <span className={`text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full uppercase tracking-wider
                      ${venue.badge === "bookable"
                        ? "bg-turf-accent/20 text-turf-accent border border-turf-accent/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}
                    >
                      {venue.badge === "bookable" ? "Bookable" : "Enquiry"}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5 sm:p-3 md:p-4 flex flex-col flex-grow">
                <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-zinc-900 uppercase tracking-tight truncate group-hover:text-turf-accent transition-colors duration-300">
                  {venue.name}
                </h3>

                <div className="flex items-center gap-1 sm:gap-1.5 mt-1 sm:mt-1.5 mb-2 sm:mb-3">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-turf-accent shrink-0" />
                  <span className="text-[10px] sm:text-xs md:text-sm text-zinc-500 truncate">
                    {venue.area || ""}{venue.area ? ", " : ""}{venue.city || ""}
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between pt-2 sm:pt-3 md:pt-4 border-t border-zinc-100">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-amber-400 text-amber-400" />
                    <span className="text-xs sm:text-sm font-bold text-zinc-900">
                      {venue.rating?.toFixed(1) || "0.0"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-0.5 sm:gap-1.5">
                    <span className="text-[8px] sm:text-xs text-zinc-400 font-normal hidden sm:inline">from</span>
                    <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-black text-turf-accent">
                      ₹{venue.base_price || venue.price_per_hour || 2000}
                    </span>
                    <span className="text-[8px] sm:text-xs text-zinc-400 uppercase tracking-widest">/HR</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
