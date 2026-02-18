import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { Building2, Users, Trophy, Zap, Target, Heart } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 bg-background/90 backdrop-blur-xl border-b border-border">
        <Link to="/" className="font-display font-black text-lg tracking-tighter uppercase text-primary">HORIZON</Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
          <Link to="/venues" className="hover:text-primary transition-colors">Browse Venues</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Building2 className="w-3.5 h-3.5" /> About Us
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl text-foreground mb-4">
            Built for <span className="text-primary">Indian Sports</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            HORIZON is a comprehensive Sports Facility Operating System built by
            <strong className="text-foreground"> Magizh NexGen Technologies (MnT)</strong> to power the next generation of amateur sports in India.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 mb-10">
          <h2 className="font-display font-bold text-xl mb-4">About Magizh NexGen Technologies (MnT)</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Magizh NexGen Technologies is a Chennai-based technology company focused on building scalable digital infrastructure for the sports and fitness industry in India. We believe every amateur athlete deserves access to quality sports facilities without friction.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Our flagship product, <strong className="text-foreground">HORIZON</strong>, enables venue owners to digitize their operations, helps players discover and book turfs instantly, and creates a connected sports ecosystem with matchmaking, coaching, and analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          <div className="glass-card rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2">Our Mission</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To make booking a sports facility as easy as ordering food online — instant, transparent, and affordable for every Indian.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2">Our Vision</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A India where every neighbourhood has a world-class sports facility, connected through smart technology and powered by data.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { icon: Building2, value: "16+", label: "Active Venues" },
            { icon: Users, value: "50K+", label: "Registered Players" },
            { icon: Trophy, value: "4.8★", label: "Average Rating" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="glass-card rounded-xl p-5 text-center">
              <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="font-display font-black text-2xl text-primary">{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h2 className="font-display font-bold text-xl mb-6">What HORIZON Offers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Zap, title: "Instant Booking", desc: "Real-time slot availability and instant confirmations" },
              { icon: Users, title: "Matchmaking", desc: "AI-powered opponent matching based on skill level" },
              { icon: Trophy, title: "Skill Ratings", desc: "Glicko-2 algorithm for accurate player skill tracking" },
              { icon: Building2, title: "Venue Management", desc: "Complete dashboard for venue owners with analytics" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
