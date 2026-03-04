import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { InteractiveClean } from "./InteractiveClean";

const APP_URL = "https://lobbi.app";

export default function ArenaCalloutSection() {
  const [showQR, setShowQR] = useState(false);

  return (
    <section className="relative bg-white px-3 sm:px-4 md:px-12 overflow-hidden pb-5">
      <div className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-20 items-center min-h-[60vh] sm:min-h-[70vh] lg:min-h-screen py-8 sm:py-12 lg:py-0">
          <div className="flex flex-col justify-center items-start lg:items-end lg:pr-12 order-2 lg:order-1">
            <div className="relative">
              {/* Large decorative quote */}
              <div
                className="absolute -left-4 -top-6 sm:-left-8 sm:-top-12 md:-left-12 md:-top-16 lg:-left-24 lg:-top-32 text-turf-accent opacity-30 text-[50px] sm:text-[80px] md:text-[140px] lg:text-[280px] leading-none pointer-events-none select-none simteste"
                style={{ fontFamily: "'Alex Brush', cursive" }}
              >
                &ldquo;
              </div>

              {/* Main quote */}
              <blockquote className="relative z-10 max-w-xl">
                <p className="text-xl sm:text-2xl md:text-4xl lg:text-6xl font-black uppercase text-gray-900 leading-[1.1] tracking-tight mb-3 sm:mb-4 md:mb-8">
                  <span className="block mb-1 sm:mb-2">ONE PLATFORM</span>
                  <span className="block mb-1 sm:mb-2">FOR</span>
                  <span className="block text-turf-accent font-brier normal-case text-2xl sm:text-3xl md:text-5xl lg:text-8xl -ml-1">
                    EVERYTHING
                  </span>
                  <span className="block mt-1 sm:mt-2">IN SPORTS AND FITNESS.</span>
                  <span className="block">YOUR JOURNEY STARTS HERE.</span>
                </p>
              </blockquote>

              {/* Author attribution */}
              <div className="mt-3 sm:mt-4">
                <p className="text-sm sm:text-base font-medium font-mono md:text-lg text-turf-accent">- Lobbi Management</p>
              </div>

              {/* Start Playing Button */}
              <motion.button
                onClick={() => setShowQR(true)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="mt-6 sm:mt-8 flex items-center gap-3 bg-turf-accent text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-lg shadow-turf-accent/25 hover:shadow-turf-accent/40 transition-shadow"
              >
                <span className="uppercase tracking-wider">Start playing</span>
                {/* Apple icon */}
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                {/* Google Play icon */}
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.18 23.27c-.36-.17-.57-.51-.57-.93V1.66c0-.42.21-.76.57-.93l11.83 11.27L3.18 23.27zM16.23 13.2l-2.82-2.69 2.82-2.69 3.46 1.97c.63.36.63.94 0 1.3L16.23 13.2zM12.41 11.51L4.77.77l10.63 6.05-2.99 4.69zM12.41 12.49l2.99 4.69L4.77 23.23l7.64-10.74z" />
                </svg>
              </motion.button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="relative w-full aspect-[4/5] sm:aspect-square max-w-[280px] sm:max-w-sm md:max-w-lg mx-auto lg:mx-0 order-1 lg:order-2"
          >
            <InteractiveClean />
          </motion.div>
        </div>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#1c1f26] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 lg:p-12 max-w-2xl w-full shadow-[0_32px_80px_-12px_rgba(0,0,0,0.6)]"
            >
              {/* Close button */}
              <button
                onClick={() => setShowQR(false)}
                className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 text-white/40 hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Mobile: stacked | Desktop: side-by-side */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-8 md:gap-10">
                {/* QR Code - top on mobile, right on desktop */}
                <div className="bg-white p-2.5 sm:p-3 rounded-lg sm:rounded-xl shrink-0 self-center sm:self-start sm:order-2">
                  <QRCodeSVG
                    value={APP_URL}
                    size={180}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#000000"
                    className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] md:w-[160px] md:h-[160px]"
                  />
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0 sm:order-1">
                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-white leading-[1.2] mb-4 sm:mb-6 pr-6 sm:pr-0 text-center sm:text-left">
                    A game is around the corner,<br />
                    scan this QR code.
                  </h3>

                  <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm md:text-[15px] text-white/50 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/30 mt-[6px] sm:mt-[7px] shrink-0" />
                      Open your phone camera and point it at the QR code.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/30 mt-[6px] sm:mt-[7px] shrink-0" />
                      Alternatively, download any QR code scanner to scan.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/30 mt-[6px] sm:mt-[7px] shrink-0" />
                      Click on the link generated to download Lobbi.
                    </li>
                  </ul>

                  {/* Store icons */}
                  <div className="flex items-center gap-4 mt-5 sm:mt-8">
                    {/* Apple */}
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    {/* Google Play */}
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.18 23.27c-.36-.17-.57-.51-.57-.93V1.66c0-.42.21-.76.57-.93l11.83 11.27L3.18 23.27zM16.23 13.2l-2.82-2.69 2.82-2.69 3.46 1.97c.63.36.63.94 0 1.3L16.23 13.2zM12.41 11.51L4.77.77l10.63 6.05-2.99 4.69zM12.41 12.49l2.99 4.69L4.77 23.23l7.64-10.74z" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
