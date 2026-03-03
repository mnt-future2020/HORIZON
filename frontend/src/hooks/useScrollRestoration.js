import { useEffect, useRef } from "react";
import { useNavigationType } from "react-router-dom";

/**
 * Restores scroll position when navigating back (browser back button).
 * Saves current scroll Y on unmount; restores it only on POP navigation.
 *
 * @param {string} key   - Unique key per listing page (e.g. "venues", "coaching")
 * @param {boolean} ready - Pass !loading so scroll restores after the list has rendered
 */
export function useScrollRestoration(key, ready = true) {
  const navigationType = useNavigationType();
  const storageKey = `scrollPos_${key}`;
  const targetScrollRef = useRef(null);

  // On mount: if this is a back/forward navigation, read the saved position.
  // Always consume the stored value so fresh navigations never pick it up.
  useEffect(() => {
    if (navigationType === "POP") {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        targetScrollRef.current = parseInt(saved, 10);
      }
    }
    sessionStorage.removeItem(storageKey);

    // Save exact scroll Y the moment the user leaves (component unmounts)
    return () => {
      sessionStorage.setItem(storageKey, String(Math.round(window.scrollY)));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the list data is loaded and React has committed the DOM, restore scroll.
  // Double-rAF waits for the browser to actually paint the list before scrolling,
  // which ensures items are in their final layout positions (critical for lists
  // with framer-motion stagger animations or lazily-sized elements).
  useEffect(() => {
    if (!ready || targetScrollRef.current === null) return;

    const target = targetScrollRef.current;
    targetScrollRef.current = null; // consume — only restore once

    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.scrollTo({ top: target, behavior: "instant" });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [ready]);
}
