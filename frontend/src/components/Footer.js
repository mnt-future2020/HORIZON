import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Instagram,
  Twitter,
  Linkedin,
} from "lucide-react";
import Logo from "@/components/Logo";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-card border-t border-border relative text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2">
            <Link to="/" className="inline-block mb-4 sm:mb-6 text-brand-600">
              <Logo size="lg" />
            </Link>
            <p className="text-xs sm:text-sm font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-2 sm:mb-3">
              Sports Facility Operating System
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              A product by <span className="text-foreground font-black">MnT</span>
              <br />
              <span className="text-muted-foreground">Magizh NexGen Technologies</span>
            </p>
            <div className="flex items-center gap-3 mt-5 sm:mt-8">
              <a
                href="#"
                aria-label="Twitter"
                className="w-10 h-10 sm:w-11 sm:h-11 border border-border rounded-xl flex items-center justify-center text-muted-foreground hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all"
              >
                <Twitter className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="w-10 h-10 sm:w-11 sm:h-11 border border-border rounded-xl flex items-center justify-center text-muted-foreground hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all"
              >
                <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="w-10 h-10 sm:w-11 sm:h-11 border border-border rounded-xl flex items-center justify-center text-muted-foreground hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all"
              >
                <Linkedin className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-black text-xs sm:text-sm uppercase tracking-[0.2em] text-foreground mb-4 sm:mb-6">
              Product
            </h4>
            <ul className="space-y-2.5 sm:space-y-4">
              {[
                { label: "Browse Venues", to: "/venues" },
                { label: "Find Opponents", to: "/matchmaking" },
                { label: "Leaderboard", to: "/leaderboard" },
                { label: "List Your Venue", to: "/auth" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm sm:text-base font-bold text-muted-foreground hover:text-brand-600 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-black text-xs sm:text-sm uppercase tracking-[0.2em] text-foreground mb-4 sm:mb-6">
              Company
            </h4>
            <ul className="space-y-2.5 sm:space-y-4">
              {[
                { label: "About Us", to: "/about" },
                { label: "Contact", to: "/contact" },
                { label: "Privacy Policy", to: "/privacy-policy" },
                { label: "Terms of Service", to: "/terms" },
                { label: "Refund Policy", to: "/refund-policy" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm sm:text-base font-bold text-muted-foreground hover:text-brand-600 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h4 className="font-black text-xs sm:text-sm uppercase tracking-[0.2em] text-foreground mb-4 sm:mb-6">
              Contact
            </h4>
            <ul className="space-y-3 sm:space-y-5">
              <li className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold text-muted-foreground">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 shrink-0 text-brand-600" />
                <a
                  href="mailto:support@magizhnexgen.com"
                  className="hover:text-brand-600 transition-colors break-all"
                >
                  support@magizhnexgen.com
                </a>
              </li>
              <li className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold text-muted-foreground">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 shrink-0 text-brand-600" />
                <a
                  href="tel:+919999999999"
                  className="hover:text-brand-600 transition-colors"
                >
                  +91 99999 99999
                </a>
              </li>
              <li className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold text-muted-foreground">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 shrink-0 text-brand-600" />
                <span>Chennai, Tamil Nadu, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 sm:mt-14 pt-5 sm:pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <span className="text-center sm:text-left">
            &copy; {year} Magizh NexGen Technologies. All rights reserved.
          </span>
          <div className="flex items-center flex-wrap justify-center gap-3 sm:gap-6">
            <Link
              to="/privacy-policy"
              className="hover:text-brand-600 transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="hover:text-brand-600 transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/refund-policy"
              className="hover:text-brand-600 transition-colors"
            >
              Refunds
            </Link>
            <Link
              to="/contact"
              className="hover:text-brand-600 transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
