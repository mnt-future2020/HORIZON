import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const socialImages = [
  "/turf/unnamed (1).png",
  "/turf/unnamed (2).png",
  "/turf/unnamed (3).png",
  "/turf/unnamed (4).png",
  "/turf/unnamed (5).png",
  "/turf/unnamed (6).png",
  "/turf/unnamed (7).png",
];

const handIcons = [
  "/images/icon/icon-hand1.png",
  "/images/icon/icon-hand2.png",
  "/images/icon/icon-hand3.png",
  "/images/icon/icon-hand4.png",
  "/images/icon/icon-hand5.png",
  "/images/icon/icon-hand6.png",
];

export default function SocialSection() {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIndex((prev) => (prev + 1) % handIcons.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="social-section" className="relative bg-[#F5F1E8] text-black py-24 px-6 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative h-32 flex items-center justify-center mt-16">
          <div className="relative h-full w-auto max-h-[60px] aspect-square">
            {handIcons.map((icon, index) => (
              <div
                key={icon}
                className={`absolute inset-0 transition-opacity duration-0 ${
                  index === currentIconIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <img
                  src={icon || "/placeholder.svg"}
                  className="h-full w-full object-contain"
                  alt="Animated hand icon"
                />
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-2.5"
        >
          <h2 className="text-5xl md:text-7xl font-black uppercase leading-none leading-[2.25] text-turf-dark lg:text-6xl">
            WHAT'S UP
          </h2>
          <h3 className="text-4xl md:text-6xl font-brier mt-2 lg:text-6xl leading-10 text-turf-dark">ON SOCIALS</h3>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          viewport={{ once: true }}
          className="relative h-[600px] md:h-[700px] mb-16 flex items-center justify-center"
        >
          {socialImages.map((image, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, rotate: 0, scale: 0 }}
              whileInView={{
                opacity: 1,
                rotate: (i - 3) * 6,
                scale: 1 - Math.abs(i - 3) * 0.02,
                x: (i - 3) * 90,
                y: Math.abs(i - 3) * 35,
              }}
              transition={{
                duration: 0.8,
                delay: 0.2 + i * 0.1,
                type: "spring",
                stiffness: 60,
                damping: 12,
              }}
              viewport={{ once: true }}
              whileHover={{
                rotate: 0,
                scale: 1.1,
                zIndex: 20,
                y: -40,
                transition: { duration: 0.3 },
              }}
              className="absolute w-60 md:w-80 h-80 md:h-[480px] bg-white rounded-3xl shadow-2xl overflow-hidden cursor-pointer origin-bottom"
              style={{ zIndex: 10 - Math.abs(i - 3) }}
            >
              <div className="relative w-full h-full">
                <img src={image || "/placeholder.svg"} alt={`Social post ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center space-y-6"
        >
          <p className="text-lg md:text-xl font-serif text-black/80 font-medium">Follow Lobbi on social media</p>

          <div className="flex flex-wrap justify-center gap-6">
            {["TIKTOK", "INSTAGRAM", "YOUTUBE", "TWITCH"].map((platform) => (
              <motion.a
                key={platform}
                href="#"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="font-black uppercase text-sm tracking-wider text-black hover:text-black/60 transition-colors"
              >
                {platform}
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
