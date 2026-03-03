import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Instagram, Twitter, Linkedin } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#0a0c0a] border-t border-white/5 relative text-white">
      <div className="max-w-[90rem] mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block mb-6">
              <span className="font-brier font-black text-3xl tracking-tighter uppercase text-brand-600">LOBBI</span>
            </Link>
            <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2">Sports Facility Operating System</p>
            <p className="text-xs text-white/30 font-medium">
              A product by <span className="text-white/60 font-black">MnT</span><br />
              <span className="text-white/40">Magizh NexGen Technologies</span>
            </p>
            <div className="flex items-center gap-4 mt-8">
              <a href="#" aria-label="Twitter" className="w-10 h-10 border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" aria-label="Instagram" className="w-10 h-10 border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" aria-label="LinkedIn" className="w-10 h-10 border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-sans text-sm font-black uppercase tracking-[0.2em] text-white mb-6">Product</h4>
            <ul className="space-y-4">
              {[
                { label: "Browse Venues", to: "/venues" },
                { label: "Find Opponents", to: "/matchmaking" },
                { label: "Leaderboard", to: "/leaderboard" },
                { label: "List Your Venue", to: "/auth" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm font-bold text-white/40 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-sans text-sm font-black uppercase tracking-[0.2em] text-white mb-6">Company</h4>
            <ul className="space-y-4">
              {[
                { label: "About Us", to: "/about" },
                { label: "Contact", to: "/contact" },
                { label: "Privacy Policy", to: "/privacy-policy" },
                { label: "Terms of Service", to: "/terms" },
                { label: "Refund Policy", to: "/refund-policy" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm font-bold text-white/40 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-sans text-sm font-black uppercase tracking-[0.2em] text-white mb-6">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm font-bold text-white/40">
                <Mail className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
                <a href="mailto:support@magizhnexgen.com" className="hover:text-brand-400 transition-colors break-all">support@magizhnexgen.com</a>
              </li>
              <li className="flex items-start gap-3 text-sm font-bold text-white/40">
                <Phone className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
                <a href="tel:+919999999999" className="hover:text-brand-400 transition-colors">+91 99999 99999</a>
              </li>
              <li className="flex items-start gap-3 text-sm font-bold text-white/40">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
                <span>Chennai, Tamil Nadu, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-bold text-white/30 uppercase tracking-wider">
          <span>&copy; {year} Magizh NexGen Technologies. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="hover:text-brand-400 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-400 transition-colors">Terms</Link>
            <Link to="/refund-policy" className="hover:text-brand-400 transition-colors">Refunds</Link>
            <Link to="/contact" className="hover:text-brand-400 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
