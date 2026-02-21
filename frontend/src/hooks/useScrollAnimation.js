import { useEffect, useRef, useState } from 'react';

/**
 * useScrollAnimation Hook
 * Triggers animation when element enters viewport
 * Uses Intersection Observer API
 *
 * @param {number} threshold - Percentage of element visible before triggering (0-1)
 * @returns {[ref, isVisible]} - Ref to attach to element and visibility state
 *
 * @example
 * const [ref, isVisible] = useScrollAnimation(0.2);
 * <motion.div
 *   ref={ref}
 *   initial={{ opacity: 0, y: 50 }}
 *   animate={isVisible ? { opacity: 1, y: 0 } : {}}
 * >
 */
export function useScrollAnimation(threshold = 0.1) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Unobserve after triggering once (optimization)
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return [ref, isVisible];
}

/**
 * useScrollProgress Hook
 * Returns scroll progress as percentage (0-100)
 * Useful for progress bars or scroll-based animations
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const progress = (scrolled / scrollHeight) * 100;
      setProgress(Math.min(progress, 100));
    };

    window.addEventListener('scroll', updateProgress);
    updateProgress(); // Initial calculation

    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return progress;
}
