import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const galleryImages = [
  { src: "/turf/unnamed.png", alt: "Indoor football turf with goal", aspect: "aspect-[3/4]" },
  { src: "/turf/unnamed (1).png", alt: "Stadium lighting over premium turf", aspect: "aspect-[4/3]" },
  { src: "/turf/unnamed (2).png", alt: "Aerial view of multi-sport arena", aspect: "aspect-[3/4]" },
  { src: "/turf/unnamed (3).png", alt: "Close up of high-quality synthetic grass", aspect: "aspect-[4/3]" },
  { src: "/turf/unnamed (4).png", alt: "Training session on open turf", aspect: "aspect-[3/4]" },
  { src: "/turf/unnamed (5).png", alt: "Night time floodlights on field", aspect: "aspect-[4/3]" },
  { src: "/turf/unnamed (6).png", alt: "Indoor multi-sport facility", aspect: "aspect-[3/4]" },
  { src: "/turf/unnamed (7).png", alt: "Soccer field lines on premium grass", aspect: "aspect-[4/3]" },
  { src: "/turf/unnamed (8).png", alt: "Arena seating and turf view", aspect: "aspect-[3/4]" },
  { src: "/turf/unnamed (9).png", alt: "Sunset over football arena", aspect: "aspect-[4/3]" },
  { src: "/turf/unnamed (10).png", alt: "Modern indoor turf infrastructure", aspect: "aspect-[3/4]" },
  { src: "/turf/unnamed.png", alt: "Premium sports experience", aspect: "aspect-[4/3]" },
];

function MasonryCard({ image, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      viewport={{ once: true, margin: "-50px" }}
      className={`relative overflow-hidden rounded-xl shadow-2xl transition-all duration-500 bg-gray-900/20 border-2 border-transparent w-full ${image.aspect}`}
    >
      <img
        src={image.src || "/placeholder.svg"}
        alt={image.alt}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
        loading="lazy"
      />
    </motion.div>
  );
}

export default function MasonryGallerySection() {
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const backgroundColor = useTransform(scrollYProgress, [0, 0.6, 1], ["#181c10", "#222", "#0a0c0a"]);
  const y = useTransform(scrollYProgress, [0, 1], ["0vh", "-150vh"]);

  const column1 = galleryImages.filter((_, i) => i % 3 === 0);
  const column2 = galleryImages.filter((_, i) => i % 3 === 1);
  const column3 = galleryImages.filter((_, i) => i % 3 === 2);

  return (
    <section
      ref={sectionRef}
      id="masonry-gallery"
      className="relative"
      style={{ height: "400vh" }}
    >
      <motion.div className="sticky top-0 h-screen w-full overflow-hidden" style={{ backgroundColor }}>
        <motion.div style={{ y }} className="relative w-full max-w-[1400px] mx-auto px-4 md:px-8 py-32">
          <div className="flex flex-col md:flex-row gap-8 w-full">
            {/* Column 1 */}
            <div className="flex flex-col gap-8 w-full md:w-1/3">
              {column1.map((image, index) => (
                <MasonryCard key={`col1-${index}`} image={image} index={index * 3} />
              ))}
            </div>

            {/* Column 2 */}
            <div className="flex flex-col gap-8 w-full md:w-1/3">
              {column2.map((image, index) => (
                <MasonryCard key={`col2-${index}`} image={image} index={index * 3 + 1} />
              ))}
            </div>

            {/* Column 3 */}
            <div className="flex flex-col gap-8 w-full md:w-1/3">
              {column3.map((image, index) => (
                <MasonryCard key={`col3-${index}`} image={image} index={index * 3 + 2} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Bottom Fade Mask */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0a0c0a] to-transparent z-30" />
      </motion.div>
    </section>
  );
}
