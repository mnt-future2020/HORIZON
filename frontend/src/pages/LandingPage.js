import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { MapPin, Users, Zap, Shield, CreditCard, Trophy, ChevronRight, Star } from "lucide-react";

const HERO_BG = "https://images.unsplash.com/photo-1763494392824-bbb80840ead4?w=1400&q=80";

const features = [
  { icon: MapPin, title: "Smart Discovery", desc: "Find turfs sorted by drive time, not distance. Real-time availability.", color: "text-emerald-400" },
  { icon: CreditCard, title: "Split Payments", desc: "No more chasing friends for money. Everyone pays their share instantly.", color: "text-violet-400" },
  { icon: Users, title: "AI Matchmaking", desc: "Glicko-2 skill ratings ensure balanced, competitive matches every time.", color: "text-sky-400" },
  { icon: Zap, title: "IoT Automation", desc: "Lights, gates, and HVAC auto-controlled by booking state. Zero waste.", color: "text-amber-400" },
  { icon: Shield, title: "Dynamic Pricing", desc: "Airline-style yield management. Maximize revenue per available hour.", color: "text-rose-400" },
  { icon: Trophy, title: "Mercenary Mode", desc: "Need one more player? Our system finds rated ringers in minutes.", color: "text-cyan-400" },
];

const stats = [
  { value: "500+", label: "Active Venues" },
  { value: "50K+", label: "Players" },
  { value: "99.9%", label: "IoT Uptime" },
  { value: "4.8", label: "Avg Rating" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display font-black text-xl tracking-tighter uppercase text-primary">Horizon</span>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth")} data-testid="nav-login-btn" className="text-muted-foreground hover:text-foreground">
              Log in
            </Button>
            <Button onClick={() => navigate("/auth")} data-testid="nav-signup-btn" className="bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center" data-testid="hero-section">
        <div className="absolute inset-0 z-0">
          <img src={HERO_BG} alt="Stadium" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
          <div className="absolute inset-0 hero-glow" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary font-mono text-xs uppercase tracking-widest px-4 py-1.5">
              Sports Facility Operating System
            </Badge>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-black tracking-tighter uppercase leading-none">
              <span className="text-foreground">THE</span><br />
              <span className="text-primary">HORIZON</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mt-8 leading-relaxed">
              Book turfs. Split costs. Find opponents. One platform that runs the entire amateur sports ecosystem.
            </p>
            <div className="flex flex-wrap gap-4 mt-10">
              <Button size="lg" onClick={() => navigate("/auth")} data-testid="hero-get-started-btn"
                className="bg-primary text-primary-foreground font-bold uppercase tracking-wide h-12 px-8 text-sm hover:bg-primary/90 transition-all">
                Get Started Free <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" data-testid="hero-demo-btn"
                onClick={() => navigate("/auth")}
                className="border-border text-foreground font-bold uppercase tracking-wide h-12 px-8 text-sm hover:bg-secondary">
                View Demo
              </Button>
            </div>
          </motion.div>
          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-2xl">
            {stats.map((s, i) => (
              <div key={i} className="text-left">
                <div className="text-2xl md:text-3xl font-display font-black text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 md:py-32 max-w-7xl mx-auto px-6" data-testid="features-section">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Platform Capabilities</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-3">
            Everything your <span className="text-primary">sports ecosystem</span> needs
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="glass-card p-8 rounded-lg hover:border-primary/30 transition-all duration-300 group cursor-default">
              <f.icon className={`h-8 w-8 ${f.color} mb-5 group-hover:scale-110 transition-transform`} />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="py-24 border-t border-border" data-testid="personas-section">
        <div className="max-w-7xl mx-auto px-6">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Built For Everyone</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-3">Three roles, one platform</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            {[
              { icon: Users, title: "Players", desc: "Book venues, split costs with friends, find opponents through AI matchmaking, and track your skill progression.", badge: "B2C" },
              { icon: Star, title: "Venue Owners", desc: "Manage multiple venues, set dynamic pricing rules, track revenue analytics, and automate operations with IoT.", badge: "B2B" },
              { icon: Trophy, title: "Coaches", desc: "Run your academy, manage student subscriptions, track progress, and handle fee reconciliation effortlessly.", badge: "SaaS" },
            ].map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="relative glass-card p-8 rounded-lg overflow-hidden">
                <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20">{p.badge}</Badge>
                <p.icon className="h-10 w-10 text-primary mb-6" />
                <h3 className="font-display text-xl font-bold mb-3">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-black tracking-tighter uppercase">
            Ready to <span className="text-primary">play</span>?
          </h2>
          <p className="text-muted-foreground mt-6 text-lg">Join thousands of players and venue owners on Horizon.</p>
          <Button size="lg" onClick={() => navigate("/auth")} data-testid="cta-get-started-btn"
            className="mt-10 bg-primary text-primary-foreground font-bold uppercase tracking-wide h-14 px-10 text-base hover:bg-primary/90">
            Create Free Account
          </Button>
          <p className="text-xs text-muted-foreground mt-4 font-mono">Demo: demo@player.com / demo123</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display font-black text-sm tracking-tighter uppercase text-muted-foreground">Horizon 2026</span>
          <span className="text-xs text-muted-foreground">DPDP Act 2023 Compliant</span>
        </div>
      </footer>
    </div>
  );
}
