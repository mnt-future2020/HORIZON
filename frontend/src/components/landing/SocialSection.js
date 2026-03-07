import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const socialImages = [
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(1).png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(2).png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(3).png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(4).png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(5).png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(6).png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/unnamed+(7).png",
];

const handIcons = [
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/hand1.png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/hand2.png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/hand3.png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/hand4.png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/hand5.png",
  "https://lobbi-s3.s3.ap-south-1.amazonaws.com/images/hand6.png",
];

function useCardSpread() {
  const [spread, setSpread] = useState({ x: 40, y: 15 });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 480) setSpread({ x: 28, y: 10 });
      else if (w < 640) setSpread({ x: 40, y: 15 });
      else if (w < 768) setSpread({ x: 60, y: 25 });
      else if (w < 1280) setSpread({ x: 70, y: 28 });
      else setSpread({ x: 90, y: 35 });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return spread;
}

export default function SocialSection() {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const spread = useCardSpread();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIndex((prev) => (prev + 1) % handIcons.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="social-section" className="relative bg-[#F5F1E8] text-black py-8 sm:py-12 md:py-24 px-3 sm:px-4 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative h-14 sm:h-20 md:h-32 flex items-center justify-center mt-4 sm:mt-8 md:mt-16">
          <div className="relative h-full w-auto max-h-[40px] sm:max-h-[50px] md:max-h-[60px] aspect-square">
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
          <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black uppercase leading-[2] sm:leading-[2.25] text-turf-dark">
            WHAT'S UP
          </h2>
          <h3 className="text-xl sm:text-2xl md:text-5xl lg:text-6xl font-brier mt-1 sm:mt-2 leading-8 sm:leading-10 text-turf-dark">ON SOCIALS</h3>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          viewport={{ once: true }}
          className="relative h-[250px] sm:h-[350px] md:h-[500px] lg:h-[550px] xl:h-[700px] mb-6 sm:mb-8 md:mb-16 flex items-center justify-center"
        >
          {socialImages.map((image, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, rotate: 0, scale: 0 }}
              whileInView={{
                opacity: 1,
                rotate: (i - 3) * 6,
                scale: 1 - Math.abs(i - 3) * 0.02,
                x: (i - 3) * spread.x,
                y: Math.abs(i - 3) * spread.y,
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
              className="absolute w-24 sm:w-36 md:w-56 lg:w-60 xl:w-80 h-32 sm:h-48 md:h-72 lg:h-[380px] xl:h-[480px] bg-white rounded-xl sm:rounded-2xl md:rounded-3xl shadow-xl sm:shadow-2xl overflow-hidden cursor-pointer origin-bottom"
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
          className="text-center space-y-4 sm:space-y-6"
        >
          <p className="text-base sm:text-lg md:text-xl font-serif text-black/80 font-medium">Follow Lobbi on social media</p>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {["TIKTOK", "INSTAGRAM", "YOUTUBE", "TWITCH"].map((platform) => (
              <motion.a
                key={platform}
                href="#"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="font-black uppercase text-xs sm:text-sm tracking-wider text-black hover:text-black/60 transition-colors"
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
