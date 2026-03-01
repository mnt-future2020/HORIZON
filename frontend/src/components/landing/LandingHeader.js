import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X } from "lucide-react";

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [menuOpen]);

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Venues", path: "/venues" },
    { label: "Tournaments", path: user ? "/tournaments" : "/auth" },
    { label: "Communities", path: user ? "/communities" : "/auth" },
    { label: "Contact", path: "/contact" },
  ];

  return (
    <>
      {/* Navbar */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-transparent"
        data-testid="landing-header"
      >
        <div className="px-6 md:px-12 py-5">
          <div className="flex items-center justify-between">
            {/* Logo - Left */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-3xl md:text-4xl font-black tracking-tighter text-brand-600 font-brier"
              data-testid="logo-button"
            >
              LOBBI
            </button>

            {/* Right Side - CTA + Hamburger */}
            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={() => navigate(user ? "/feed" : "/auth")}
                className="hidden sm:inline-flex items-center px-5 md:px-6 py-2 md:py-2.5 bg-turf-accent text-white font-bold text-sm rounded-full hover:bg-turf-accent/90 transition-all hover:scale-105"
                data-testid="cta-button"
              >
                {user ? "Dashboard" : "Get Started"}
              </button>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2.5 md:p-3 rounded-lg bg-turf-dark/80 border border-white/20 hover:border-turf-accent/40 text-white hover:bg-turf-dark transition-all"
                aria-label="Toggle menu"
                data-testid="menu-button"
              >
                {menuOpen ? <X className="w-5 h-5 md:w-6 md:h-6" /> : <Menu className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Full Screen Menu */}
      <div
        className={`fixed inset-0 z-40 bg-[#0a0c0a] transition-all duration-500 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        data-testid="menu-overlay"
      >
        <div className="flex flex-col items-center justify-center h-full px-6">
          <div
            className={`flex flex-col items-center gap-5 sm:gap-8 transition-all duration-700 delay-100 ${
              menuOpen
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            {navLinks.map((link, index) => (
              <button
                key={link.label}
                onClick={() => {
                  setMenuOpen(false);
                  if (link.path === "/") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    navigate(link.path);
                  }
                }}
                className="text-3xl sm:text-4xl md:text-7xl font-black text-white hover:text-turf-accent transition-colors uppercase font-brier"
                style={{
                  transitionDelay: `${index * 50}ms`,
                }}
                data-testid={`menu-item-${link.label.toLowerCase()}`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate(user ? "/feed" : "/auth");
              }}
              className="mt-6 sm:mt-8 inline-flex items-center px-6 py-3 sm:px-8 sm:py-4 bg-turf-accent text-white font-black text-base sm:text-lg rounded-full hover:bg-turf-accent/90 transition-colors uppercase"
              data-testid="menu-cta"
            >
              {user ? "Dashboard" : "Get Started"}
            </button>

            {/* Social Links */}
            <div className="flex gap-6 sm:gap-8 mt-8 sm:mt-12">
              {["Instagram", "TikTok", "YouTube"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-sm text-white/50 hover:text-turf-accent transition-colors uppercase font-bold"
                  data-testid={`social-${social.toLowerCase()}`}
                >
                  {social}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
