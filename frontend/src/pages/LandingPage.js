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
  UserPlus, Share2, Bell, Lock, Check, Monitor,
  Lightbulb, ShoppingCart, TrendingUp, Calendar, ClipboardList,
  Video, Layers, Target, Flame, GraduationCap, ContactRound
} from "lucide-react";
// Hero background images — Ken Burns crossfade cycle (video-like)
const HERO_SLIDES = [
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1461896836934-bd45ba8d7459?auto=format&fit=crop&w=1920&q=80",
];
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


export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [searchText, setSearchText] = useState("");
  const [cities, setCities] = useState([]);
  const [featuredVenues, setFeaturedVenues] = useState([]);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    venueAPI.cities().then(res => setCities(res.data)).catch(() => {});
    venueAPI.list({ sort_by: "rating" }).then(res => setFeaturedVenues(res.data.slice(0, 6))).catch(() => {});
  }, []);

  // Ken Burns crossfade cycle
  useEffect(() => {
    const timer = setInterval(() => setHeroSlide(p => (p + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchText.trim()) params.set("q", searchText.trim());
    navigate(`/venues?${params.toString()}`);
  };

  const goToCity = (city) => navigate(`/venues?city=${encodeURIComponent(city)}`);
  const totalVenues = cities.reduce((sum, c) => sum + c.count, 0);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* ═══ ATHLETIC NAVBAR ═══ */}
      <nav className="fixed top-0 w-full z-50 h-16 flex items-center justify-between px-6 md:px-10 bg-background/95 backdrop-blur-xl border-b border-border/50">
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
          <Button size="sm" onClick={() => navigate("/auth")}
            className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-bold rounded-xl h-10 px-6 transition-all duration-300"
            data-testid="nav-get-started">
            Get Started
          </Button>
        </div>
      </nav>

      {/* ═══ HERO SECTION — Cinematic fullscreen (always dark for both themes) ═══ */}
      <section className="relative overflow-hidden h-screen min-h-[700px] max-h-[1100px] flex items-center">
        {/* Ken Burns crossfade background — video-like */}
        {HERO_SLIDES.map((src, i) => (
          <div key={i} className={`absolute inset-0 transition-opacity duration-[2000ms] ${i === heroSlide ? "opacity-100" : "opacity-0"}`}>
            <img src={src} alt="" className={`w-full h-full object-cover ${i === heroSlide ? "hero-kenburns" : ""}`}
              style={{ willChange: "transform" }} />
          </div>
        ))}
        {/* Cinematic overlays — fixed dark for both themes */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(5,10,21,0.95) 0%, rgba(5,10,21,0.8) 50%, rgba(5,10,21,0.4) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,10,21,1) 0%, transparent 50%, rgba(5,10,21,0.5) 100%)" }} />

        <div className="max-w-7xl mx-auto px-4 md:px-8 relative w-full z-10">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-6 flex-wrap">
              <Badge variant="live" className="text-[10px] px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5 animate-pulse" />
                LIVE — 1,200+ GAMES THIS WEEK
              </Badge>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-[4rem] md:text-[6rem] lg:text-[7.5rem] font-black leading-[0.88] tracking-tighter text-white">
              FIND YOUR<br />
              <span className="bg-gradient-athletic bg-clip-text text-transparent">GAME</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="text-white/60 mt-6 max-w-lg text-lg leading-relaxed font-medium">
              Book turfs. Split costs. Find opponents. Join tournaments. The operating system for amateur sports.
            </motion.p>

            {/* Search */}
            <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }} className="mt-8 max-w-lg" data-testid="hero-search-form">
              <div className="flex gap-2 p-2 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <Input placeholder="Search venues, areas, cities..."
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    className="pl-12 border-0 bg-transparent h-13 text-base font-semibold focus-visible:ring-0 !text-white placeholder:!text-white/30"
                    data-testid="hero-search-input" />
                </div>
                <Button type="submit"
                  className="h-13 px-6 bg-gradient-athletic text-white font-black uppercase tracking-wide text-sm rounded-xl transition-all duration-300 hover:scale-105 shadow-glow-primary"
                  data-testid="hero-search-btn">
                  <Search className="h-4 w-4 mr-2" />SEARCH
                </Button>
              </div>
              {cities.length > 0 && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-xs text-white/30 font-bold uppercase tracking-wider">Popular:</span>
                  {cities.slice(0, 4).map(c => (
                    <button key={c.city} type="button" onClick={() => goToCity(c.city)}
                      className="text-xs text-white/50 hover:text-white font-bold transition-colors">
                      {c.city}
                    </button>
                  ))}
                </div>
              )}
            </motion.form>

            {/* Stats strip */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
              className="flex gap-8 mt-10">
              {[
                { value: `${totalVenues}+`, label: "VENUES" },
                { value: "50K+", label: "PLAYERS" },
                { value: "4.8★", label: "RATING" },
                { value: "10+", label: "SPORTS" },
              ].map((s, idx) => (
                <motion.div key={s.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + idx * 0.1 }}>
                  <div className="font-display text-2xl md:text-3xl font-black tracking-tight text-white">{s.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mt-0.5">{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-8 right-8 z-10 flex gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button key={i} onClick={() => setHeroSlide(i)}
              className={`h-1 rounded-full transition-all duration-500 ${i === heroSlide ? "w-8 bg-white" : "w-3 bg-white/30"}`} />
          ))}
        </div>
      </section>

      {/* ═══ SPORTS ACTION BANNER ═══ */}
      <section className="relative overflow-hidden">
        <div className="grid grid-cols-3 h-[300px] md:h-[400px]">
          {ATHLETE_IMAGES.map((img, idx) => (
            <motion.div key={img.sport} initial={{ opacity: 0, scale: 1.1 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.15, duration: 0.8 }}
              className="relative overflow-hidden group">
              <img src={img.src} alt={img.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 transition-opacity duration-500" style={{ background: "rgba(5,10,21,0.6)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-2xl md:text-4xl lg:text-5xl font-black text-white/90 uppercase tracking-athletic group-hover:scale-110 transition-transform duration-300">
                  {img.sport}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-20" style={{ background: "linear-gradient(to top, rgba(5,10,21,0.8), transparent)" }} />
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
              icon: Swords, title: "For Players",
              iconBg: "bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 ring-1 ring-emerald-500/20 dark:ring-emerald-400/10",
              iconColor: "text-emerald-600 dark:text-emerald-400",
              border: "hover:border-emerald-500/50", glow: "hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]",
              gradient: "from-emerald-500/20 to-emerald-500/0",
              features: ["Social Feed & Stories", "AI Matchmaking", "Tournaments & Leagues", "WhatsApp-style Chat", "Communities & Teams", "Leaderboards & Ratings", "Split Payments", "Contact Sync"],
              cta: "for-players", checkColor: "text-emerald-600 dark:text-emerald-400",
              btnClass: "hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-400"
            },
            {
              icon: Building2, title: "For Venue Owners",
              iconBg: "bg-gradient-to-br from-violet-500/15 to-violet-600/5 ring-1 ring-violet-500/20 dark:ring-violet-400/10",
              iconColor: "text-violet-600 dark:text-violet-400",
              border: "hover:border-violet-500/50", glow: "hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]",
              gradient: "from-violet-500/20 to-violet-500/0",
              features: ["Revenue Dashboard", "Booking Management", "POS System", "IoT Smart Lighting", "Review Management", "Analytics & Reports", "Public Venue Page", "Multi-court Support"],
              cta: "for-owners", checkColor: "text-violet-600 dark:text-violet-400",
              btnClass: "hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-violet-600 dark:hover:text-violet-400"
            },
            {
              icon: GraduationCap, title: "For Coaches",
              iconBg: "bg-gradient-to-br from-amber-500/15 to-amber-600/5 ring-1 ring-amber-500/20 dark:ring-amber-400/10",
              iconColor: "text-amber-600 dark:text-amber-400",
              border: "hover:border-amber-500/50", glow: "hover:shadow-[0_0_40px_rgba(245,158,11,0.15)]",
              gradient: "from-amber-500/20 to-amber-500/0",
              features: ["Academy Dashboard", "Student Management", "Session Scheduling", "Coach Marketplace", "Performance Tracking", "Community Groups", "Direct Messaging", "Profile & Ratings"],
              cta: "for-coaches", checkColor: "text-amber-600 dark:text-amber-400",
              btnClass: "hover:border-amber-500/50 hover:bg-amber-500/5 hover:text-amber-600 dark:hover:text-amber-400"
            },
          ].map((role, idx) => (
            <motion.div key={role.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
              className={`relative rounded-3xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md p-8 group shadow-sm dark:shadow-none ${role.border} ${role.glow} transition-all duration-500`}>
              {/* Gradient glow on top */}
              <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${role.gradient} rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative">
                <div className={`w-16 h-16 rounded-2xl ${role.iconBg} ${role.iconColor} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                  <role.icon className="h-7 w-7" strokeWidth={1.8} />
                </div>
                <h3 className="font-display text-xl font-black mb-4">{role.title}</h3>
                <ul className="space-y-2.5 mb-6">
                  {role.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
                      <Check className={`h-4 w-4 ${role.checkColor} flex-shrink-0`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className={`w-full font-bold border-2 ${role.btnClass} transition-all duration-300`}
                  onClick={() => scrollTo(role.cta)}>
                  Learn More <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
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
              { icon: Flame, title: "Social Feed", desc: "Instagram-style feed with posts, stories, reactions, and explore page", bg: "from-rose-500/15 to-rose-600/5 ring-rose-500/20 dark:ring-rose-400/10", tc: "text-rose-600 dark:text-rose-400" },
              { icon: Swords, title: "AI Matchmaking", desc: "Glicko-2 skill rating system finds you perfectly matched opponents", bg: "from-emerald-500/15 to-emerald-600/5 ring-emerald-500/20 dark:ring-emerald-400/10", tc: "text-emerald-600 dark:text-emerald-400" },
              { icon: Medal, title: "Tournaments", desc: "Create and join tournaments with brackets, pools, and live scoring", bg: "from-amber-500/15 to-amber-600/5 ring-amber-500/20 dark:ring-amber-400/10", tc: "text-amber-600 dark:text-amber-400" },
              { icon: MessageCircle, title: "1-on-1 Chat", desc: "WhatsApp-style messaging with read receipts, typing indicators, replies", bg: "from-sky-500/15 to-sky-600/5 ring-sky-500/20 dark:ring-sky-400/10", tc: "text-sky-600 dark:text-sky-400" },
              { icon: Users, title: "Communities", desc: "Create groups, join communities, and chat with like-minded players", bg: "from-violet-500/15 to-violet-600/5 ring-violet-500/20 dark:ring-violet-400/10", tc: "text-violet-600 dark:text-violet-400" },
              { icon: Shield, title: "Teams", desc: "Build your squad, manage rosters, and challenge other teams", bg: "from-indigo-500/15 to-indigo-600/5 ring-indigo-500/20 dark:ring-indigo-400/10", tc: "text-indigo-600 dark:text-indigo-400" },
              { icon: Trophy, title: "Leaderboard", desc: "City, sport, and global rankings based on verified match results", bg: "from-orange-500/15 to-orange-600/5 ring-orange-500/20 dark:ring-orange-400/10", tc: "text-orange-600 dark:text-orange-400" },
              { icon: Dumbbell, title: "Coach Booking", desc: "Browse certified coaches, book sessions, and track progress", bg: "from-pink-500/15 to-pink-600/5 ring-pink-500/20 dark:ring-pink-400/10", tc: "text-pink-600 dark:text-pink-400" },
              { icon: Zap, title: "Instant Booking", desc: "Book turfs in seconds with real-time slot availability", bg: "from-teal-500/15 to-teal-600/5 ring-teal-500/20 dark:ring-teal-400/10", tc: "text-teal-600 dark:text-teal-400" },
              { icon: Share2, title: "Split Payments", desc: "Split booking costs with friends. Everyone pays their share via UPI", bg: "from-cyan-500/15 to-cyan-600/5 ring-cyan-500/20 dark:ring-cyan-400/10", tc: "text-cyan-600 dark:text-cyan-400" },
              { icon: ContactRound, title: "Contact Sync", desc: "Find friends on Horizon by syncing your phone contacts", bg: "from-lime-500/15 to-lime-600/5 ring-lime-500/20 dark:ring-lime-400/10", tc: "text-lime-600 dark:text-lime-400" },
              { icon: Video, title: "Highlights", desc: "Upload and share your best sports moments with the community", bg: "from-fuchsia-500/15 to-fuchsia-600/5 ring-fuchsia-500/20 dark:ring-fuchsia-400/10", tc: "text-fuchsia-600 dark:text-fuchsia-400" },
            ].map((f, idx) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
                className="rounded-2xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md p-6 group hover:border-primary/50 hover:scale-[1.03] hover:shadow-glow-sm shadow-sm dark:shadow-none transition-all duration-300">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.bg} ring-1 ${f.tc} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                  <f.icon className="h-5 w-5" strokeWidth={1.8} />
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
          <Badge className="text-xs px-5 py-2 mb-6 bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30">FOR VENUE OWNERS</Badge>
          <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
            Run Your Venue <span className="bg-gradient-accent bg-clip-text text-transparent">Smarter</span>
          </h2>
          <p className="text-base text-muted-foreground font-semibold mt-3 max-w-2xl">
            A complete operating system to manage bookings, revenue, IoT devices, and customer experience.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: BarChart3, title: "Revenue Dashboard", desc: "Real-time analytics with daily, weekly, monthly revenue tracking, booking trends, and occupancy rates", bg: "from-violet-500/15 to-violet-600/5 ring-violet-500/20 dark:ring-violet-400/10", tc: "text-violet-600 dark:text-violet-400" },
            { icon: Calendar, title: "Booking Management", desc: "Manage all court bookings, handle walk-ins, set pricing rules, and manage time slots", bg: "from-sky-500/15 to-sky-600/5 ring-sky-500/20 dark:ring-sky-400/10", tc: "text-sky-600 dark:text-sky-400" },
            { icon: ShoppingCart, title: "POS System", desc: "Full point-of-sale for walk-in bookings, equipment rental, and food counter with receipt generation", bg: "from-emerald-500/15 to-emerald-600/5 ring-emerald-500/20 dark:ring-emerald-400/10", tc: "text-emerald-600 dark:text-emerald-400" },
            { icon: Lightbulb, title: "IoT Smart Lighting", desc: "Control court floodlights remotely, set auto-schedules, and monitor energy consumption", bg: "from-amber-500/15 to-amber-600/5 ring-amber-500/20 dark:ring-amber-400/10", tc: "text-amber-600 dark:text-amber-400" },
            { icon: Star, title: "Review Management", desc: "Monitor and respond to player reviews, track satisfaction scores, and build reputation", bg: "from-rose-500/15 to-rose-600/5 ring-rose-500/20 dark:ring-rose-400/10", tc: "text-rose-600 dark:text-rose-400" },
            { icon: Monitor, title: "Public Venue Page", desc: "Custom branded page with photos, amenities, pricing, and direct booking for players", bg: "from-indigo-500/15 to-indigo-600/5 ring-indigo-500/20 dark:ring-indigo-400/10", tc: "text-indigo-600 dark:text-indigo-400" },
          ].map((f, idx) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.08 }}
              className="rounded-2xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md p-8 group hover:border-violet-500/50 hover:scale-[1.03] hover:shadow-glow-accent shadow-sm dark:shadow-none transition-all duration-300">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.bg} ring-1 ${f.tc} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                <f.icon className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <h3 className="font-display text-lg font-black group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{f.title}</h3>
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
            <Badge className="text-xs px-5 py-2 mb-6 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">FOR COACHES</Badge>
            <h2 className="font-display text-display-sm md:text-display-md font-black tracking-athletic">
              Grow Your <span className="bg-gradient-sport bg-clip-text text-transparent">Academy</span>
            </h2>
            <p className="text-base text-muted-foreground font-semibold mt-3 max-w-2xl">
              Tools to manage students, schedule sessions, and get discovered by players looking for coaching.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: GraduationCap, title: "Academy Dashboard", desc: "Overview of your academy with student count, upcoming sessions, and earnings at a glance", bg: "from-amber-500/15 to-amber-600/5 ring-amber-500/20 dark:ring-amber-400/10", tc: "text-amber-600 dark:text-amber-400" },
              { icon: Users, title: "Student Management", desc: "Track student progress, manage batches, and send updates to parents", bg: "from-orange-500/15 to-orange-600/5 ring-orange-500/20 dark:ring-orange-400/10", tc: "text-orange-600 dark:text-orange-400" },
              { icon: Target, title: "Coach Marketplace", desc: "Get listed in the coach directory. Players can discover, compare, and book you directly", bg: "from-emerald-500/15 to-emerald-600/5 ring-emerald-500/20 dark:ring-emerald-400/10", tc: "text-emerald-600 dark:text-emerald-400" },
              { icon: Calendar, title: "Session Scheduling", desc: "Set your availability, manage bookings, and handle cancellations seamlessly", bg: "from-sky-500/15 to-sky-600/5 ring-sky-500/20 dark:ring-sky-400/10", tc: "text-sky-600 dark:text-sky-400" },
              { icon: MessageCircle, title: "Direct Messaging", desc: "Chat with students and parents directly through the app", bg: "from-violet-500/15 to-violet-600/5 ring-violet-500/20 dark:ring-violet-400/10", tc: "text-violet-600 dark:text-violet-400" },
              { icon: TrendingUp, title: "Performance Analytics", desc: "Track student improvement over time with detailed performance reports", bg: "from-rose-500/15 to-rose-600/5 ring-rose-500/20 dark:ring-rose-400/10", tc: "text-rose-600 dark:text-rose-400" },
            ].map((f, idx) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.08 }}
                className="rounded-2xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md p-8 group hover:border-amber-500/50 hover:scale-[1.03] shadow-sm dark:shadow-none transition-all duration-300">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.bg} ring-1 ${f.tc} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                  <f.icon className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="font-display text-lg font-black group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{f.title}</h3>
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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20 dark:ring-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                  <s.icon className="h-7 w-7 text-primary" strokeWidth={1.8} />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-athletic text-white font-display font-black text-[11px] flex items-center justify-center shadow-glow-sm ring-2 ring-background">
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
              className="rounded-2xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md overflow-hidden group hover:border-primary/50 hover:shadow-glow-sm hover:scale-[1.03] shadow-sm dark:shadow-none transition-all duration-500">
              <div className="relative h-60 overflow-hidden">
                <img src={a.src} alt={a.name} className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <Badge variant="athletic" className="text-[10px] uppercase backdrop-blur-md">{a.role}</Badge>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-black text-foreground">{a.name}</h3>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className="h-3 w-3 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-2 mt-3">
                  <Quote className="h-5 w-5 text-gradient-primary shrink-0 mt-0.5 text-primary" />
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
        <div className="absolute inset-0" style={{ background: "rgba(5,10,21,0.78)" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-transparent to-accent/15" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,10,21,0.9) 0%, transparent 50%, rgba(5,10,21,0.4) 100%)" }} />
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
                className="rounded-2xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md p-6 cursor-pointer group hover:border-primary/50 hover:scale-105 hover:shadow-glow-sm shadow-sm dark:shadow-none transition-all duration-300 text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20 dark:ring-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                  <MapPin className="h-6 w-6 text-primary" strokeWidth={1.8} />
                </div>
                <h3 className="font-display text-base font-black text-foreground group-hover:text-primary transition-colors">{c.city}</h3>
                <p className="text-sm text-muted-foreground font-semibold mt-1">{c.count} venue{c.count > 1 ? "s" : ""}</p>
              </motion.div>
            ))}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: cities.length * 0.05 }}
              onClick={() => navigate("/venues")}
              className="rounded-2xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md p-6 cursor-pointer group hover:border-primary/50 hover:scale-105 hover:shadow-glow-sm shadow-sm dark:shadow-none transition-all duration-300 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-muted/80 to-muted/30 ring-1 ring-border/50 flex items-center justify-center mx-auto mb-4 group-hover:from-primary/15 group-hover:to-primary/5 group-hover:ring-primary/20 transition-all duration-300">
                <Building2 className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.8} />
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
                className="rounded-2xl border-2 border-border/50 bg-card/80 dark:bg-card/50 backdrop-blur-md overflow-hidden cursor-pointer group hover:border-primary/50 hover:shadow-glow-sm hover:scale-[1.02] shadow-sm dark:shadow-none transition-all duration-300">
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
          <div className="absolute inset-0" style={{ background: "rgba(5,10,21,0.82)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(5,10,21,0.5) 50%, rgba(16,185,129,0.1) 100%)" }} />
          <div className="relative p-12 md:p-20 text-center">
            <h2 className="font-display text-display-sm md:text-display-lg font-black tracking-athletic text-white">Ready to play?</h2>
            <p className="text-base md:text-lg text-white/60 font-semibold mt-4 mb-6">
              Join thousands of players already on Horizon
            </p>
            <div className="flex gap-4 justify-center flex-wrap mt-8">
              <Button onClick={() => navigate(user ? "/dashboard" : "/auth")}
                className="bg-gradient-athletic bg-gradient-animated text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-110 active:scale-105 font-black uppercase tracking-wide text-base h-14 px-10 rounded-xl transition-all duration-300"
                data-testid="cta-get-started">
                Get Started Free <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/venues")}
                className="font-black uppercase tracking-wide text-base h-14 px-10 rounded-xl border-2 border-white/20 text-white hover:border-white/50 hover:scale-110 active:scale-105 transition-all duration-300 bg-white/5 backdrop-blur-md hover:bg-white/10"
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
