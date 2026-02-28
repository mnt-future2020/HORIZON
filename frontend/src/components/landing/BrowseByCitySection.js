import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

const CITY_IMAGES = {
  madurai: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80",
  vilupuram: "https://images.unsplash.com/photo-1629807496522-83ecd8af4152?auto=format&fit=crop&w=800&q=80",
  chennai: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/0j7/x20/oav/360_F_275034287_RwBdkQQIvoYjxvHPocTR5MBrgQXFaZqr.jpg",
  coimbatore: "https://images.unsplash.com/photo-1621689032733-4df4249a0225?auto=format&fit=crop&w=800&q=80",
  bangalore: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/ifp/8jh/ak3/istockphoto-1192261427-612x612.jpg",
  bengaluru: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/ifp/8jh/ak3/istockphoto-1192261427-612x612.jpg",
  delhi: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/9kj/gle/h29/istockphoto-505239248-612x612.jpg",
  mumbai: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/ebv/o6u/qsu/istockphoto-1307189136-612x612.jpg",
  default: "https://images.unsplash.com/photo-1518605368461-1e1292237fac?auto=format&fit=crop&w=800&q=80",
};

const getCityImage = (cityName) => {
  if (!cityName) return CITY_IMAGES.default;
  const normalized = cityName.toLowerCase();
  for (const [key, url] of Object.entries(CITY_IMAGES)) {
    if (normalized.includes(key)) return url;
  }
  return CITY_IMAGES.default;
};

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
    <section className="py-24 md:py-32 px-6 md:px-12 bg-[#0a0c0a]" id="locations">
      <div className="max-w-[90rem] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.85]">
              <span className="text-white">ACTIVE</span>
              <br />
              <span className="text-turf-accent font-brier text-8xl">LOCATIONS</span>
            </h2>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {cities.slice(0, 5).map((c, idx) => (
            <motion.div
              key={c.city}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              onClick={() => goToCity(c.city)}
              className="group relative aspect-[3/4] rounded-[2rem] overflow-hidden cursor-pointer border-2 border-white/5 hover:border-turf-accent/40 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-turf-dark">
                <img
                  src={getCityImage(c.city)}
                  alt={c.city}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-500" />

              <div className="absolute inset-x-8 bottom-8 flex flex-col justify-end">
                <div className="mb-4 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 transform -translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display text-3xl font-black text-white uppercase tracking-tighter leading-none mb-2 group-hover:text-turf-accent transition-colors duration-300">
                  {c.city}
                </h3>
                <p className="text-turf-accent font-bold text-[11px] tracking-widest uppercase">
                  {c.count} VENUE{c.count > 1 ? "S" : ""}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
