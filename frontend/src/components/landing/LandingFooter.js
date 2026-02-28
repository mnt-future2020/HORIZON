import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function LandingFooter() {
  const navigate = useNavigate();

  const pageLinks = [
    { label: "HOME", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { label: "VENUES", action: () => navigate("/venues") },
    { label: "COACHING", action: () => navigate("/coaching") },
    { label: "TOURNAMENTS", action: () => navigate("/tournaments") },
    { label: "ABOUT", action: () => navigate("/about") },
    { label: "CONTACT", action: () => navigate("/contact") },
  ];

  return (
    <footer className="bg-turf-accent pt-0 px-4 md:px-8 min-h-screen flex flex-col justify-end relative pb-5">


      {/* Main Dark Card Container */}
      <div className="relative flex-1 flex flex-col w-full max-w-[1688px] mx-auto mt-12 z-10">
        {/* SVG Background Mask */}
        <div
          className="absolute inset-0 w-full h-full z-0 bg-[#282c20] overflow-hidden"
          style={{
            maskImage: 'url("/images/footer-mask.svg")',
            WebkitMaskImage: 'url("/images/footer-mask.svg")',
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
          }}
        >
          <div
            className="absolute inset-0 w-full h-full opacity-30"
            style={{
              backgroundImage: 'url("/images/curv.svg")',
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>

        <div className="relative z-20 flex flex-col h-full px-8 md:px-24 py-12 md:py-20 md:pb-12 md:pl-0 md:pr-0">
          {/* Main Content Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch mt-0">
            {/* Left Column - Pages */}
            <div className="md:col-span-3 text-center order-2 md:order-1 md:pl-8 flex flex-col justify-center h-full">
              <h4 className="font-black text-xs uppercase mb-6 text-turf-text-light/40 tracking-[0.2em]">PAGES</h4>
              <ul className="space-y-2">
                {pageLinks.map((item) => (
                  <li className="leading-5" key={item.label}>
                    <button
                      onClick={item.action}
                      className="text-turf-text-light font-bold text-xl md:text-2xl uppercase hover:text-turf-accent transition-colors inline-block leading-4"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Center Column - Title */}
            <div className="md:col-span-6 flex flex-col items-center justify-center order-1 md:order-2 relative">
              <div className="z-0 text-center mt-0">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.9] text-turf-text-light mix-blend-overlay opacity-90"
                >
                  <span className="font-sans block">ALWAYS
                    <span className="font-brier text-turf-accent"> BRINGING</span>
                  </span>
                  <span className="font-sans block">
                    THE <span className="font-brier text-turf-accent">GAME.</span>
                  </span>
                </motion.h2>
              </div>

              {/* CTA Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/auth")}
                className="mt-12 z-20 bg-turf-accent text-turf-dark font-black uppercase px-8 py-4 rounded-[14px] text-sm tracking-wider hover:bg-white transition-colors flex items-center gap-2"
              >
                GET STARTED FREE
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </motion.button>
            </div>

            {/* Right Column - Follow */}
            <div className="md:col-span-3 text-center order-3 md:order-2 md:pr-8 flex flex-col justify-center h-full">
              <h4 className="font-black text-xs uppercase mb-6 text-turf-text-light/40 tracking-[0.2em]">
                FOLLOW ON
              </h4>
              <ul className="space-y-2">
                {["TIKTOK", "INSTAGRAM", "YOUTUBE", "TWITCH"].map((platform) => (
                  <li className="leading-5" key={platform}>
                    <a
                      href="#"
                      className="text-turf-text-light font-bold text-xl md:text-2xl uppercase hover:text-turf-accent transition-colors inline-block leading-4"
                    >
                      {platform}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>


        </div>
      </div>

      {/* Bottom Bar */}
      <div className="w-full max-w-[1688px] mx-auto px-8 md:px-12 relative z-20 pt-0">
        <div className="flex flex-col md:flex-row justify-between items-center text-turf-dark text-xs font-bold tracking-wider uppercase">
          <p>&copy; {new Date().getFullYear()} Lobbi. All rights reserved</p>
          <div className="flex gap-6 mt-2 md:mt-0">
            <button onClick={() => navigate("/privacy-policy")} className="hover:opacity-60 transition-opacity">
              PRIVACY POLICY
            </button>
            <button onClick={() => navigate("/terms")} className="hover:opacity-60 transition-opacity">
              TERMS
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1688px] mx-auto px-8 md:px-12 relative z-20 pt-0">
        <div className="flex flex-col md:flex-row justify-between items-center text-turf-dark text-xs font-bold tracking-wider uppercase">
          <p className="text-xs mt-7 opacity-40 font-medium leading-4 text-left">
            Lobbi is India's all-in-one sports platform — connecting players, venues, and coaches. Book. Play. Connect. Compete.
          </p>
        </div>
      </div>
    </footer>
  );
}
