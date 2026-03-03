import { useRef, useEffect, useCallback } from "react";

const sizeConfig = {
  sm: { lobbi: "text-2xl", subtitle: "text-[7px]" },
  md: { lobbi: "text-2xl md:text-3xl", subtitle: "text-[7px] md:text-[9px]" },
  lg: { lobbi: "text-3xl md:text-4xl", subtitle: "text-[9px] md:text-[11px]" },
  xl: {
    lobbi: "text-6xl md:text-8xl lg:text-9xl",
    subtitle: "text-lg md:text-2xl lg:text-[28px]",
  },
};

export default function Logo({ size = "md", className = "" }) {
  const lobbiRef = useRef(null);
  const subtitleRef = useRef(null);

  const adjustSpacing = useCallback(() => {
    if (lobbiRef.current && subtitleRef.current) {
      subtitleRef.current.style.letterSpacing = "0px";
      subtitleRef.current.style.width = "max-content";
      const lobbiWidth = lobbiRef.current.getBoundingClientRect().width;
      const subtitleNaturalWidth = subtitleRef.current.getBoundingClientRect().width;
      const charCount = subtitleRef.current.textContent.length;
      const spacing = Math.max(
        (lobbiWidth - subtitleNaturalWidth) / (charCount - 1),
        -1
      );
      subtitleRef.current.style.letterSpacing = `${spacing}px`;
      subtitleRef.current.style.width = "";
    }
  }, []);

  useEffect(() => {
    adjustSpacing();
    document.fonts.ready.then(adjustSpacing);
    window.addEventListener("resize", adjustSpacing);
    return () => window.removeEventListener("resize", adjustSpacing);
  }, [adjustSpacing]);

  const s = sizeConfig[size] || sizeConfig.md;

  return (
    <div className={`w-fit ${className}`}>
      <div
        ref={lobbiRef}
        className={`font-brier font-black ${s.lobbi} leading-[0.8] tracking-tighter`}
        style={{ WebkitTextStroke: "0.3px currentColor" }}
      >
        LOBBI
      </div>
      <div
        ref={subtitleRef}
        className={`font-oswald font-black ${s.subtitle} uppercase leading-none whitespace-nowrap mt-0.5`}
      >
        <span className="normal-case font-light text-brand-600">for</span> Sports & Fitness
      </div>
    </div>
  );
}
