import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Instagram, Twitter, Linkedin } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-card border-t border-border mt-16 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-3">
              <span className="font-display font-black text-2xl tracking-tighter uppercase text-primary">HORIZON</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed mb-1">Sports Facility Operating System</p>
            <p className="text-[11px] text-muted-foreground/70">
              A product by <span className="text-foreground font-semibold">MnT</span><br />
              <span className="text-muted-foreground/60">Magizh NexGen Technologies</span>
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="#" aria-label="Twitter" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:shadow-glow-sm hover:scale-110 transition-all duration-300">
                <Twitter className="w-3.5 h-3.5" />
              </a>
              <a href="#" aria-label="Instagram" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:shadow-glow-sm hover:scale-110 transition-all duration-300">
                <Instagram className="w-3.5 h-3.5" />
              </a>
              <a href="#" aria-label="LinkedIn" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:shadow-glow-sm hover:scale-110 transition-all duration-300">
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Product</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Browse Venues", to: "/venues" },
                { label: "Find Opponents", to: "/matchmaking" },
                { label: "Leaderboard", to: "/leaderboard" },
                { label: "List Your Venue", to: "/auth" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Company</h4>
            <ul className="space-y-2.5">
              {[
                { label: "About Us", to: "/about" },
                { label: "Contact", to: "/contact" },
                { label: "Privacy Policy", to: "/privacy-policy" },
                { label: "Terms of Service", to: "/terms" },
                { label: "Refund Policy", to: "/refund-policy" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                <a href="mailto:support@magizhnexgen.com" className="hover:text-primary transition-colors break-all">support@magizhnexgen.com</a>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                <a href="tel:+919999999999" className="hover:text-primary transition-colors">+91 99999 99999</a>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                <span>Chennai, Tamil Nadu, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {year} Magizh NexGen Technologies. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/refund-policy" className="hover:text-primary transition-colors">Refunds</Link>
            <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
