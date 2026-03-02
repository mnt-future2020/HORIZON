import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "lobbi_preloader_seen";

function FullSplash({ onComplete }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      onComplete();
      document.body.style.overflow = "unset";
    }, 2000);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "unset";
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ y: 0 }}
      exit={{ y: "-100%", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-brand-600 text-white"
    >
      <div className="relative flex items-center justify-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative flex items-baseline text-6xl md:text-8xl lg:text-9xl font-bold uppercase tracking-tighter"
        >
          <span className="font-brier ml-1">LOBBI</span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-12 font-oswald text-sm md:text-base font-bold tracking-widest uppercase"
      >
        THE STANDARD FOR PLAY
      </motion.div>
    </motion.div>
  );
}

function TopProgressBar({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px]"
      style={{ backgroundColor: "rgba(0,0,0,0.05)" }}
    >
      <motion.div
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        className="h-full bg-brand-600 rounded-r-full"
        style={{ boxShadow: "0 0 10px rgba(0, 166, 81, 0.5), 0 0 5px rgba(0, 166, 81, 0.3)" }}
      />
    </motion.div>
  );
}

export default function Preloader() {
  const hasSeenRef = useRef(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [hasSeen] = useState(() => hasSeenRef.current());
  const [isVisible, setIsVisible] = useState(true);

  const handleComplete = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // sessionStorage unavailable — silently continue
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        hasSeen ? (
          <TopProgressBar onComplete={handleComplete} />
        ) : (
          <FullSplash onComplete={handleComplete} />
        )
      )}
    </AnimatePresence>
  );
}
