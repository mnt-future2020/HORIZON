import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import {
  Search, MapPin, Star, ChevronRight, Zap, Shield, Users, BarChart3,
  Smartphone, Building2, Navigation, Sun, Moon, ArrowRight, Play, Quote,
  MessageCircle, Swords, Trophy, Medal, Dumbbell, Heart, Bookmark,
  UserPlus, Share2, Bell, Lock, Copy, Check, LogIn, Monitor,
  Lightbulb, ShoppingCart, TrendingUp, Calendar, ClipboardList,
  Video, Layers, Target, Flame, GraduationCap, ContactRound
} from "lucide-react";
import { toast } from "sonner";

// Hero images
const HERO_ATHLETE = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=80";
const ATHLETE_IMAGES = [
  { src: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=800&q=80", name: "Football", sport: "Football" },
  { src: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80", name: "Basketball", sport: "Basketball" },
  { src: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80", name: "Tennis", sport: "Tennis" },
];
const BANNER_IMAGE = "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80";
const AMBASSADORS = [
  { src: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=400&q=80", name: "Arjun K.", role: "Pro Footballer", quote: "Horizon changed how I find turfs. No more phone calls!" },
  { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", name: "Rahul M.", role: "Cricket Captain", quote: "Split payments with the team is a game changer." },
  { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80", name: "Priya S.", role: "Tennis Coach", quote: "Managing my academy has never been this smooth." },
  { src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80", name: "Vikram R.", role: "Venue Owner", quote: "Revenue went up 40% after listing on Horizon." },
];
const CTA_ATHLETE = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80";

// Demo credentials
const DEMO_ACCOUNTS = [
  { role: "Player", email: "demo@player.com", password: "demo123", icon: Swords, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { role: "Venue Owner", email: "demo@owner.com", password: "demo123", icon: Building2, color: "text-violet-400", bg: "bg-violet-500/10" },
  { role: "Coach", email: "demo@coach.com", password: "demo123", icon: GraduationCap, color: "text-amber-400", bg: "bg-amber-500/10" },
  { role: "Admin", email: "admin@horizon.com", password: "admin123", icon: Shield, color: "text-rose-400", bg: "bg-rose-500/10" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [searchText, setSearchText] = useState("");
  const [cities, setCities] = useState([]);
  const [featuredVenues, setFeaturedVenues] = useState([]);
  const [copiedEmail, setCopiedEmail] = useState("");

  useEffect(() => {
    venueAPI.cities().then(res => setCities(res.data)).catch(() => {});
    venueAPI.list({ sort_by: "rating" }).then(res => setFeaturedVenues(res.data.slice(0, 6))).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchText.trim()) params.set("q", searchText.trim());
    navigate(`/venues?${params.toString()}`);
  };

  const goToCity = (city) => navigate(`/venues?city=${encodeURIComponent(city)}`);
  const totalVenues = cities.reduce((sum, c) => sum + c.count, 0);

  const handleCopyCredential = (email, password) => {
    navigator.clipboard.writeText(`${email} / ${password}`);
    setCopiedEmail(email);
    toast.success("Credentials copied!");
    setTimeout(() => setCopiedEmail(""), 2000);
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* ═══ ATHLETIC NAVBAR ═══ */}
      <nav className="fixed top-0 w-full z-50 h-16 flex items-center justify-between px-6 md:px-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <span className="font-display font-black text-xl tracking-tighter uppercase text-primary">Horizon</span>
        <div className="hidden md:flex items-center gap-6">
          {[
            { label: "Features", id: "features" },
            { label: "Players", id: "for-players" },
            { label: "Venue Owners", id: "for-owners" },
            { label: "Coaches", id: "for-coaches" },
          ].map(l => (
            <button key={l.id} onClick={() => scrollTo(l.id)}
              className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} data-testid="landing-theme-toggle"
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-card/50 border-2 border-border/50 hover:border-primary/50 hover:scale-110 transition-all duration-300">
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
          <Button variant="ghost" size="sm" onClick={() => scrollTo("demo-login")}
            className="text-sm font-bold hidden sm:flex" data-testid="nav-demo">
            <LogIn className="h-4 w-4 mr-1.5" /> Demo
          </Button>
          <Button size="sm" onClick={() => navigate("/auth")}
            className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-bold rounded-xl h-10 px-6 transition-all duration-300"
            data-testid="nav-get-started">
            Get Started
          </Button>
        </div>
      </nav>

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative overflow-hidden min-h-[95vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-16 relative w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <Badge variant="athletic" className="text-xs px-5 py-2 mb-8">
                  SPORTS FACILITY OPERATING SYSTEM
                </Badge>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
                className="font-display text-display-xl md:text-[6rem] lg:text-[7rem] font-black leading-[0.9] tracking-athletic">
                THE<br />
                <span className="bg-gradient-athletic bg-clip-text text-transparent">HORIZON</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
                className="text-muted-foreground mt-8 max-w-xl text-lg md:text-xl leading-relaxed font-semibold">
                Book turfs. Split costs. Find opponents. Chat with friends. Join tournaments. One platform that runs the entire amateur sports ecosystem.
              </motion.p>

              {/* Search Bar */}
              <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }} className="mt-10 max-w-xl" data-testid="hero-search-form">
                <div className="flex gap-3 p-3 rounded-2xl bg-card/50 border-2 border-border/50 backdrop-blur-md shadow-2xl hover:border-primary/30 transition-all duration-300">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search venues, areas, cities..."
                      value={searchText} onChange={(e) => setSearchText(e.target.value)}
                      className="pl-12 border-0 bg-transparent h-14 text-base font-semibold focus-visible:ring-0"
                      data-testid="hero-search-input" />
                  </div>
                  <Button type="submit"
                    className="h-14 px-8 bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide text-sm rounded-xl transition-all duration-300"
                    data-testid="hero-search-btn">
                    <Search className="h-4 w-4 mr-2" />SEARCH
                  </Button>
                </div>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <span className="text-sm text-muted-foreground font-bold">Popular:</span>
                  {cities.slice(0, 4).map(c => (
                    <button key={c.city} type="button" onClick={() => goToCity(c.city)}
                      className="text-sm text-primary/80 hover:text-primary font-bold hover:scale-110 transition-all duration-300">
                      {c.city}
                    </button>
                  ))}
                </div>
              </motion.form>

              {/* Stats Row */}
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                className="flex gap-8 sm:gap-12 mt-12">
                {[
                  { value: `${totalVenues}+`, label: "VENUES" },
                  { value: "50K+", label: "PLAYERS" },
                  { value: "4.8", label: "AVG RATING" },
                  { value: "35+", label: "FEATURES" },
                ].map((s, idx) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + idx * 0.1 }}>
                    <div className="font-display text-3xl sm:text-4xl font-black text-foreground tracking-athletic">{s.value}</div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Hero Athlete Image */}
            <motion.div initial={{ opacity: 0, scale: 0.9, x: 40 }} animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative hidden lg:block">
              <div className="relative rounded-3xl overflow-hidden aspect-[3/4] max-h-[650px] shadow-2xl">
                <img src={HERO_ATHLETE} alt="Athlete in action" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.6 }}
                  className="absolute bottom-8 left-6 right-6">
                  <div className="bg-background/80 backdrop-blur-xl rounded-2xl p-5 border-2 border-border/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Play className="h-5 w-5 text-primary fill-primary" />
                      </div>
                      <div>
                        <div className="font-display font-black text-sm uppercase tracking-wide text-foreground">Game On</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-0.5">2,400+ matches this week</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ DEMO LOGIN CREDENTIALS ═══ */}
      <section id="demo-login" className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-20">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card/50 to-accent/5 backdrop-blur-md overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-primary/10 blur-3xl" />
          <div className="relative p-8 md:p-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <LogIn className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-black tracking-athletic">Try It Now</h2>
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-semibold mb-8 ml-[52px]">
              Use these demo accounts to explore all features instantly
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEMO_ACCOUNTS.map((acc) => (
                <motion.div key={acc.email}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="rounded-2xl border-2 border-border/50 bg-card/80 backdrop-blur-md p-5 hover:border-primary/50 hover:shadow-glow-sm transition-all duration-300 group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-xl ${acc.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <acc.icon className={`h-5 w-5 ${acc.color}`} />
                    </div>
                    <span className="font-display font-black text-sm uppercase tracking-wide">{acc.role}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</div>
                      <div className="text-sm font-bold text-foreground mt-0.5 font-mono">{acc.email}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Password</div>
                      <div className="text-sm font-bold text-foreground mt-0.5 font-mono">{acc.password}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1 text-[11px] h-8"
                      onClick={() => handleCopyCredential(acc.email, acc.password)}>
                      {copiedEmail === acc.email ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copiedEmail === acc.email ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" className="flex-1 text-[11px] h-8 bg-gradient-athletic text-white"
                      onClick={() => navigate("/auth")}>
                      Login <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ SPORTS ACTION BANNER ═══ */}
      <section className="relative overflow-hidden">
        <div className="grid grid-cols-3 h-[300px] md:h-[400px]">
          {ATHLETE_IMAGES.map((img, idx) => (
            <motion.div key={img.sport} initial={{ opacity: 0, scale: 1.1 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.15, duration: 0.8 }}
              className="relative overflow-hidden group">
              <img src={img.src} alt={img.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-background/60 group-hover:bg-background/40 transition-colors duration-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-2xl md:text-4xl lg:text-5xl font-black text-white/90 uppercase tracking-athletic group-hover:scale-110 transition-transform duration-300">
                  {img.sport}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ PLATFORM OVERVIEW — One Platform. Every Role. ═══ */}
      <section id="features" className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <Badge variant="athletic" className="text-xs px-5 py-2 mb-6">BUILT FOR EVERYONE</Badge>
          <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
            One Platform. <span className="bg-gradient-athletic bg-clip-text text-transparent">Every Role.</span>
          </h2>
          <p className="text-base text-muted-foreground font-semibold mt-3 max-w-2xl mx-auto">
            Whether you're a player looking for a game, a venue owner managing bookings, or a coach building your academy — Horizon has you covered.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {[
            {
              icon: Swords, title: "For Players", color: "bg-emerald-500/10 text-emerald-400", border: "hover:border-emerald-500/50",
              features: ["Social Feed & Stories", "AI Matchmaking", "Tournaments & Leagues", "WhatsApp-style Chat", "Communities & Teams", "Leaderboards & Ratings", "Split Payments", "Contact Sync"],
              cta: "for-players"
            },
            {
              icon: Building2, title: "For Venue Owners", color: "bg-violet-500/10 text-violet-400", border: "hover:border-violet-500/50",
              features: ["Revenue Dashboard", "Booking Management", "POS System", "IoT Smart Lighting", "Review Management", "Analytics & Reports", "Public Venue Page", "Multi-court Support"],
              cta: "for-owners"
            },
            {
              icon: GraduationCap, title: "For Coaches", color: "bg-amber-500/10 text-amber-400", border: "hover:border-amber-500/50",
              features: ["Academy Dashboard", "Student Management", "Session Scheduling", "Coach Marketplace", "Performance Tracking", "Community Groups", "Direct Messaging", "Profile & Ratings"],
              cta: "for-coaches"
            },
          ].map((role, idx) => (
            <motion.div key={role.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
              className={`rounded-3xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-8 group ${role.border} hover:shadow-glow-sm transition-all duration-300`}>
              <div className={`w-16 h-16 rounded-2xl ${role.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <role.icon className="h-8 w-8" />
              </div>
              <h3 className="font-display text-xl font-black mb-4">{role.title}</h3>
              <ul className="space-y-2.5 mb-6">
                {role.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full font-bold border-2 hover:border-primary/50 hover:bg-primary/5"
                onClick={() => scrollTo(role.cta)}>
                Learn More <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ FOR PLAYERS — Feature Grid ═══ */}
      <section id="for-players" className="bg-gradient-to-b from-primary/3 to-transparent">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-14">
            <Badge variant="athletic" className="text-xs px-5 py-2 mb-6">FOR PLAYERS</Badge>
            <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
              Your Sports <span className="bg-gradient-athletic bg-clip-text text-transparent">Superapp</span>
            </h2>
            <p className="text-base text-muted-foreground font-semibold mt-3 max-w-2xl">
              Everything you need to play, compete, and connect — all in one place.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[
              { icon: Flame, title: "Social Feed", desc: "Instagram-style feed with posts, stories, reactions, and explore page", color: "bg-rose-500/10 text-rose-400" },
              { icon: Swords, title: "AI Matchmaking", desc: "Glicko-2 skill rating system finds you perfectly matched opponents", color: "bg-emerald-500/10 text-emerald-400" },
              { icon: Medal, title: "Tournaments", desc: "Create and join tournaments with brackets, pools, and live scoring", color: "bg-amber-500/10 text-amber-400" },
              { icon: MessageCircle, title: "1-on-1 Chat", desc: "WhatsApp-style messaging with read receipts, typing indicators, replies", color: "bg-sky-500/10 text-sky-400" },
              { icon: Users, title: "Communities", desc: "Create groups, join communities, and chat with like-minded players", color: "bg-violet-500/10 text-violet-400" },
              { icon: Shield, title: "Teams", desc: "Build your squad, manage rosters, and challenge other teams", color: "bg-indigo-500/10 text-indigo-400" },
              { icon: Trophy, title: "Leaderboard", desc: "City, sport, and global rankings based on verified match results", color: "bg-orange-500/10 text-orange-400" },
              { icon: Dumbbell, title: "Coach Booking", desc: "Browse certified coaches, book sessions, and track progress", color: "bg-pink-500/10 text-pink-400" },
              { icon: Zap, title: "Instant Booking", desc: "Book turfs in seconds with real-time slot availability", color: "bg-teal-500/10 text-teal-400" },
              { icon: Share2, title: "Split Payments", desc: "Split booking costs with friends. Everyone pays their share via UPI", color: "bg-cyan-500/10 text-cyan-400" },
              { icon: ContactRound, title: "Contact Sync", desc: "Find friends on Horizon by syncing your phone contacts", color: "bg-lime-500/10 text-lime-400" },
              { icon: Video, title: "Highlights", desc: "Upload and share your best sports moments with the community", color: "bg-fuchsia-500/10 text-fuchsia-400" },
            ].map((f, idx) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
                className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 group hover:border-primary/50 hover:scale-[1.03] hover:shadow-glow-sm transition-all duration-300">
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-base font-black group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-xs text-muted-foreground font-semibold mt-1.5 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOR VENUE OWNERS — Feature Grid ═══ */}
      <section id="for-owners" className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="mb-14">
          <Badge className="text-xs px-5 py-2 mb-6 bg-violet-500/20 text-violet-400 border-violet-500/30">FOR VENUE OWNERS</Badge>
          <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
            Run Your Venue <span className="bg-gradient-accent bg-clip-text text-transparent">Smarter</span>
          </h2>
          <p className="text-base text-muted-foreground font-semibold mt-3 max-w-2xl">
            A complete operating system to manage bookings, revenue, IoT devices, and customer experience.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: BarChart3, title: "Revenue Dashboard", desc: "Real-time analytics with daily, weekly, monthly revenue tracking, booking trends, and occupancy rates", color: "bg-violet-500/10 text-violet-400" },
            { icon: Calendar, title: "Booking Management", desc: "Manage all court bookings, handle walk-ins, set pricing rules, and manage time slots", color: "bg-sky-500/10 text-sky-400" },
            { icon: ShoppingCart, title: "POS System", desc: "Full point-of-sale for walk-in bookings, equipment rental, and food counter with receipt generation", color: "bg-emerald-500/10 text-emerald-400" },
            { icon: Lightbulb, title: "IoT Smart Lighting", desc: "Control court floodlights remotely, set auto-schedules, and monitor energy consumption", color: "bg-amber-500/10 text-amber-400" },
            { icon: Star, title: "Review Management", desc: "Monitor and respond to player reviews, track satisfaction scores, and build reputation", color: "bg-rose-500/10 text-rose-400" },
            { icon: Monitor, title: "Public Venue Page", desc: "Custom branded page with photos, amenities, pricing, and direct booking for players", color: "bg-indigo-500/10 text-indigo-400" },
          ].map((f, idx) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.08 }}
              className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-8 group hover:border-violet-500/50 hover:scale-[1.03] hover:shadow-glow-accent transition-all duration-300">
              <div className={`w-14 h-14 rounded-xl ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <f.icon className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-black group-hover:text-violet-400 transition-colors">{f.title}</h3>
              <p className="text-sm text-muted-foreground font-semibold mt-2 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ FOR COACHES — Feature Grid ═══ */}
      <section id="for-coaches" className="bg-gradient-to-b from-amber-500/3 to-transparent">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-14">
            <Badge className="text-xs px-5 py-2 mb-6 bg-amber-500/20 text-amber-400 border-amber-500/30">FOR COACHES</Badge>
            <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
              Grow Your <span className="bg-gradient-sport bg-clip-text text-transparent">Academy</span>
            </h2>
            <p className="text-base text-muted-foreground font-semibold mt-3 max-w-2xl">
              Tools to manage students, schedule sessions, and get discovered by players looking for coaching.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: GraduationCap, title: "Academy Dashboard", desc: "Overview of your academy with student count, upcoming sessions, and earnings at a glance", color: "bg-amber-500/10 text-amber-400" },
              { icon: Users, title: "Student Management", desc: "Track student progress, manage batches, and send updates to parents", color: "bg-orange-500/10 text-orange-400" },
              { icon: Target, title: "Coach Marketplace", desc: "Get listed in the coach directory. Players can discover, compare, and book you directly", color: "bg-emerald-500/10 text-emerald-400" },
              { icon: Calendar, title: "Session Scheduling", desc: "Set your availability, manage bookings, and handle cancellations seamlessly", color: "bg-sky-500/10 text-sky-400" },
              { icon: MessageCircle, title: "Direct Messaging", desc: "Chat with students and parents directly through the app", color: "bg-violet-500/10 text-violet-400" },
              { icon: TrendingUp, title: "Performance Analytics", desc: "Track student improvement over time with detailed performance reports", color: "bg-rose-500/10 text-rose-400" },
            ].map((f, idx) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.08 }}
                className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-8 group hover:border-amber-500/50 hover:scale-[1.03] transition-all duration-300">
                <div className={`w-14 h-14 rounded-xl ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-lg font-black group-hover:text-amber-400 transition-colors">{f.title}</h3>
                <p className="text-sm text-muted-foreground font-semibold mt-2 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
            How It <span className="bg-gradient-athletic bg-clip-text text-transparent">Works</span>
          </h2>
          <p className="text-base text-muted-foreground font-semibold mt-3">Get started in 4 simple steps</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: "01", icon: UserPlus, title: "Sign Up", desc: "Create your account as a Player, Venue Owner, or Coach in seconds" },
            { step: "02", icon: Search, title: "Discover", desc: "Browse venues, find opponents, or explore the sports community" },
            { step: "03", icon: Zap, title: "Book & Play", desc: "Book courts instantly, split costs with friends, and hit the field" },
            { step: "04", icon: Users, title: "Connect", desc: "Join communities, chat with players, and climb the leaderboard" },
          ].map((s, idx) => (
            <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
              className="text-center group">
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <s.icon className="h-9 w-9 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-athletic text-white font-display font-black text-sm flex items-center justify-center shadow-glow-sm">
                  {s.step}
                </span>
              </div>
              <h3 className="font-display text-lg font-black group-hover:text-primary transition-colors">{s.title}</h3>
              <p className="text-sm text-muted-foreground font-semibold mt-2 max-w-xs mx-auto">{s.desc}</p>
              {idx < 3 && (
                <div className="hidden lg:block absolute top-10 right-0 w-[calc(100%-5rem)]">
                  <ArrowRight className="h-5 w-5 text-muted-foreground/20 mx-auto" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <Badge variant="athletic" className="text-xs px-5 py-2 mb-6">TRUSTED BY ATHLETES</Badge>
          <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
            Our <span className="bg-gradient-athletic bg-clip-text text-transparent">Community</span>
          </h2>
          <p className="text-base text-muted-foreground font-semibold mt-3">Real players. Real stories. Real impact.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {AMBASSADORS.map((a, idx) => (
            <motion.div key={a.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
              className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden group hover:border-primary/50 hover:shadow-glow-sm hover:scale-[1.03] transition-all duration-300">
              <div className="relative h-56 overflow-hidden">
                <img src={a.src} alt={a.name} className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <Badge variant="athletic" className="text-[10px] uppercase backdrop-blur-md">{a.role}</Badge>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-black text-foreground">{a.name}</h3>
                <div className="flex items-start gap-2 mt-3">
                  <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground font-semibold leading-relaxed italic">"{a.quote}"</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ FULL-WIDTH BANNER ═══ */}
      <section className="relative h-[350px] md:h-[450px] overflow-hidden">
        <img src={BANNER_IMAGE} alt="Athletes celebrating" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-background/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="text-center max-w-3xl px-6">
            <div className="font-display text-display-md md:text-display-lg lg:text-display-xl font-black tracking-athletic text-white leading-[0.95]">
              EVERY GAME<br />
              <span className="bg-gradient-athletic bg-clip-text text-transparent">STARTS HERE</span>
            </div>
            <p className="text-white/70 text-lg font-semibold mt-6 mb-8">
              From casual matches to competitive leagues — find your game
            </p>
            <Button onClick={() => navigate("/venues")}
              className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide text-base h-14 px-10 rounded-xl transition-all duration-300">
              Find Your Turf <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ═══ BROWSE BY CITY ═══ */}
      {cities.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28" data-testid="popular-cities">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">Browse by City</h2>
            <p className="text-base text-muted-foreground font-semibold mt-2 mb-10">Find venues near you</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {cities.map((c, idx) => (
              <motion.div key={c.city} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
                onClick={() => goToCity(c.city)}
                className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 cursor-pointer group hover:border-primary/50 hover:scale-105 hover:shadow-glow-sm transition-all duration-300 text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <MapPin className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display text-base font-black text-foreground group-hover:text-primary transition-colors">{c.city}</h3>
                <p className="text-sm text-muted-foreground font-semibold mt-1">{c.count} venue{c.count > 1 ? "s" : ""}</p>
              </motion.div>
            ))}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: cities.length * 0.05 }}
              onClick={() => navigate("/venues")}
              className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 cursor-pointer group hover:border-primary/50 hover:scale-105 hover:shadow-glow-sm transition-all duration-300 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-all duration-300">
                <Building2 className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-display text-base font-black text-foreground group-hover:text-primary transition-colors">All Cities</h3>
              <p className="text-sm text-muted-foreground font-semibold mt-1">View all</p>
            </motion.div>
          </div>
        </section>
      )}

      {/* ═══ FEATURED VENUES ═══ */}
      {featuredVenues.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24" data-testid="featured-venues">
          <div className="flex items-end justify-between mb-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">Top Rated</h2>
              <p className="text-base text-muted-foreground font-semibold mt-2">Highest rated across all cities</p>
            </motion.div>
            <Button variant="ghost" className="text-sm text-primary font-bold hover:scale-105 transition-all"
              onClick={() => navigate("/venues")} data-testid="view-all-venues-btn">
              View All <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {featuredVenues.map((v, idx) => (
              <motion.div key={v.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(v.slug ? `/venue/${v.slug}` : "/venues")}
                className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden cursor-pointer group hover:border-primary/50 hover:shadow-glow-sm hover:scale-[1.02] transition-all duration-300">
                <div className="relative h-48 overflow-hidden bg-secondary/30">
                  {v.images?.[0] ? (
                    <img src={v.images[0]} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/50">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    <span className="text-sm font-black text-primary">{v.rating?.toFixed(1)}</span>
                  </div>
                  {v.sports?.length > 0 && (
                    <div className="absolute bottom-3 left-3 flex gap-2">
                      {v.sports.slice(0, 2).map(s => (
                        <Badge key={s} variant="athletic" className="text-[10px] uppercase">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="font-display text-lg font-black text-foreground truncate group-hover:text-primary transition-colors">{v.name}</h3>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="truncate">{v.area ? `${v.area}, ` : ""}{v.city}</span>
                    </div>
                    <span className="font-display text-lg font-black text-primary">{v.base_price ? `₹${v.base_price}` : ""}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ ATHLETIC CTA ═══ */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative rounded-3xl border-2 border-border/50 overflow-hidden">
          <img src={CTA_ATHLETE} alt="Athletic training" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/80" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background/60 to-accent/15" />
          <div className="relative p-12 md:p-20 text-center">
            <h2 className="font-display text-display-sm md:text-display-lg font-black tracking-athletic">Ready to play?</h2>
            <p className="text-base md:text-lg text-muted-foreground font-semibold mt-4 mb-6">
              Join thousands of players already on Horizon
            </p>
            {/* Quick demo reminder */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card/60 backdrop-blur-md border border-border/50 mb-8">
              <LogIn className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-muted-foreground">
                Demo: <span className="text-foreground font-mono">demo@player.com</span> / <span className="text-foreground font-mono">demo123</span>
              </span>
            </div>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button onClick={() => navigate(user ? "/dashboard" : "/auth")}
                className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide text-base h-14 px-10 rounded-xl transition-all duration-300"
                data-testid="cta-get-started">
                Get Started Free <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/venues")}
                className="font-black uppercase tracking-wide text-base h-14 px-10 rounded-xl border-2 hover:border-primary/50 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-md"
                data-testid="cta-browse-venues">
                Browse Venues
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
