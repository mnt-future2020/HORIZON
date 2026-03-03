import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Instagram, Twitter, Linkedin } from "lucide-react";
import Logo from "@/components/Logo";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-gray-200 relative text-gray-900">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block mb-6 text-brand-600">
              <Logo size="lg" />
            </Link>
            <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Sports Facility Operating System</p>
            <p className="text-sm text-gray-500 font-medium">
              A product by <span className="text-gray-900 font-black">MnT</span><br />
              <span className="text-gray-500">Magizh NexGen Technologies</span>
            </p>
            <div className="flex items-center gap-4 mt-8">
              <a href="#" aria-label="Twitter" className="w-11 h-11 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" aria-label="Instagram" className="w-11 h-11 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" aria-label="LinkedIn" className="w-11 h-11 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-black text-sm uppercase tracking-[0.2em] text-gray-900 mb-6">Product</h4>
            <ul className="space-y-4">
              {[
                { label: "Browse Venues", to: "/venues" },
                { label: "Find Opponents", to: "/matchmaking" },
                { label: "Leaderboard", to: "/leaderboard" },
                { label: "List Your Venue", to: "/auth" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-base font-bold text-gray-600 hover:text-brand-600 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-black text-sm uppercase tracking-[0.2em] text-gray-900 mb-6">Company</h4>
            <ul className="space-y-4">
              {[
                { label: "About Us", to: "/about" },
                { label: "Contact", to: "/contact" },
                { label: "Privacy Policy", to: "/privacy-policy" },
                { label: "Terms of Service", to: "/terms" },
                { label: "Refund Policy", to: "/refund-policy" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-base font-bold text-gray-600 hover:text-brand-600 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-black text-sm uppercase tracking-[0.2em] text-gray-900 mb-6">Contact</h4>
            <ul className="space-y-5">
              <li className="flex items-start gap-3 text-base font-bold text-gray-600">
                <Mail className="w-5 h-5 mt-0.5 shrink-0 text-brand-600" />
                <a href="mailto:support@magizhnexgen.com" className="hover:text-brand-600 transition-colors whitespace-nowrap">support@magizhnexgen.com</a>
              </li>
              <li className="flex items-start gap-3 text-base font-bold text-gray-600">
                <Phone className="w-5 h-5 mt-0.5 shrink-0 text-brand-600" />
                <a href="tel:+919999999999" className="hover:text-brand-600 transition-colors">+91 99999 99999</a>
              </li>
              <li className="flex items-start gap-3 text-base font-bold text-gray-600">
                <MapPin className="w-5 h-5 mt-0.5 shrink-0 text-brand-600" />
                <span>Chennai, Tamil Nadu, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <span>&copy; {year} Magizh NexGen Technologies. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="hover:text-brand-600 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-600 transition-colors">Terms</Link>
            <Link to="/refund-policy" className="hover:text-brand-600 transition-colors">Refunds</Link>
            <Link to="/contact" className="hover:text-brand-600 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
