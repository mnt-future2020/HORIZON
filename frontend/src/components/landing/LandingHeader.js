import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X } from "lucide-react";
import Logo from "@/components/Logo";

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
    { label: "Communities", path: user ? "/chat?discover=true" : "/auth" },
    { label: "Contact", path: "/contact" },
  ];

  return (
    <>
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-white/90 backdrop-blur-xl border-b border-gray-200 shadow-sm"
            : "bg-transparent"
        }`}
        data-testid="landing-header"
      >
        <div className="px-3 sm:px-6 md:px-12 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo - Left */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              data-testid="logo-button"
            >
              <Logo size="lg" className="text-brand-600" />
            </button>

            {/* Center Nav Links - Desktop Only */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => {
                    if (link.path === "/") {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                      navigate(link.path);
                    }
                  }}
                  className="text-sm font-bold text-black hover:text-brand-600 uppercase tracking-wide transition-colors duration-300 relative group font-brier"
                  data-testid={`nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-brand-600 group-hover:w-full transition-all duration-300" />
                </button>
              ))}
            </div>

            {/* Right Side - CTA + Hamburger (mobile only) */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <button
                onClick={() => navigate(user ? "/feed" : "/auth")}
                className="inline-flex items-center px-3.5 py-1.5 sm:px-5 sm:py-2 md:px-6 md:py-2.5 bg-brand-600 text-white font-bold text-xs sm:text-sm rounded-full hover:bg-brand-700 transition-all hover:scale-105"
                data-testid="cta-button"
              >
                {user ? "Dashboard" : "Get Started"}
              </button>

              {/* Hamburger - Mobile Only */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 sm:p-2.5 md:p-3 rounded-lg bg-gray-100 backdrop-blur-sm border border-gray-200 hover:border-brand-600/40 text-gray-900 hover:bg-gray-200 transition-all"
                aria-label="Toggle menu"
                data-testid="menu-button"
              >
                {menuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Full Screen Menu - Mobile Only */}
      <div
        className={`fixed inset-0 z-40 bg-white transition-all duration-500 lg:hidden ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        data-testid="menu-overlay"
      >
        <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6">
          <div
            className={`flex flex-col items-center gap-4 sm:gap-5 md:gap-8 transition-all duration-700 delay-100 ${
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
                className="text-2xl sm:text-3xl md:text-5xl lg:text-7xl font-black text-gray-900 hover:text-brand-600 transition-colors uppercase font-brier"
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
              className="mt-4 sm:mt-6 md:mt-8 inline-flex items-center px-5 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 bg-brand-600 text-white font-black text-sm sm:text-base md:text-lg rounded-full hover:bg-brand-700 transition-colors uppercase"
              data-testid="menu-cta"
            >
              {user ? "Dashboard" : "Get Started"}
            </button>

            {/* Social Links */}
            <div className="flex gap-4 sm:gap-6 md:gap-8 mt-6 sm:mt-8 md:mt-12">
              {["Instagram", "TikTok", "YouTube"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-xs sm:text-sm text-gray-400 hover:text-brand-600 transition-colors uppercase font-bold"
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
