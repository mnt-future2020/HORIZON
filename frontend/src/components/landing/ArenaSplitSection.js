import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function ArenaSplitSection() {
  const navigate = useNavigate();

  return (
    <section id="academy" className="relative py-24 px-6 md:px-12 bg-[#0a0c0a]">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          {/* Card 1: Explore Venues */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative group h-[500px] md:h-[650px] overflow-hidden rounded-[2rem] cursor-pointer border border-white/5"
            onClick={() => navigate("/venues")}
          >
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.7 }} className="absolute inset-0">
              <img src="/turf/unnamed (1).png" alt="Premium Venues" className="w-full h-full object-cover" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />

            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-20">
              <motion.h3
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                viewport={{ once: true }}
                className="text-5xl md:text-7xl font-black text-white uppercase mb-8 leading-none tracking-tighter"
              >
                EXPLORE
                <br />
                VENUES
              </motion.h3>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group/btn bg-turf-accent text-turf-text-dark font-bold h-14 px-8 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl"
              >
                <span className="font-black uppercase text-sm tracking-wider">BROWSE ALL</span>
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </motion.div>

          {/* Card 2: Find Your Game */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative group h-[500px] md:h-[650px] overflow-hidden rounded-[2rem] cursor-pointer border border-white/5"
            onClick={() => navigate("/auth")}
          >
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.7 }} className="absolute inset-0">
              <img src="/turf/unnamed (4).png" alt="Find Your Game" className="w-full h-full object-cover" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />

            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-20">
              <motion.h3
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                viewport={{ once: true }}
                className="text-5xl md:text-7xl font-black text-white uppercase mb-8 leading-none tracking-tighter"
              >
                FIND YOUR
                <br />
                GAME
              </motion.h3>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group/btn bg-white text-black font-bold h-14 px-8 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl"
              >
                <span className="font-black uppercase text-sm tracking-wider">MATCHMAKING</span>
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
