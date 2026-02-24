import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import { Search, MapPin, Star, ArrowRight } from "lucide-react";

// Premium Editorial Images
const HERO_IMAGE = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1920&q=80";
const PLAYERS_IMG = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80";
const OWNERS_IMG = "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80";
const COACHES_IMG = "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80";
const CTA_IMAGE = "https://images.unsplash.com/photo-1461896836934-bd45ba8d7459?auto=format&fit=crop&w=1920&q=80";

const AMBASSADORS = [
  { name: "Arjun K.", role: "Pro Footballer", quote: "Lobbi completely changed how I find turfs. No more phone calls, just instant bookings." },
  { name: "Rahul M.", role: "Cricket Captain", quote: "Splitting payments directly with the team is a massive game changer for our weekend matches." },
  { name: "Priya S.", role: "Tennis Coach", quote: "Managing my entire sports academy through one elegant platform has never been this smooth." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState("");
  const [cities, setCities] = useState([]);
  const [featuredVenues, setFeaturedVenues] = useState([]);

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

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white" data-testid="landing-page">
      {/* ═══ MINIMALIST NAVBAR ═══ */}
      <nav className="fixed top-0 w-full z-50 h-24 flex items-center justify-between px-6 md:px-12 bg-white border-b border-zinc-100">
        <span className="font-display font-black text-3xl tracking-tighter uppercase text-zinc-900">Lobbi</span>
        <div className="hidden lg:flex items-center gap-12">
          {["Players", "Owners", "Coaches"].map(label => (
            <button key={label} onClick={() => scrollTo(label.toLowerCase())}
              className="text-[13px] font-bold tracking-[0.1em] text-zinc-400 hover:text-zinc-900 transition-colors uppercase">
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <Button size="lg" onClick={() => navigate("/auth")}
            className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-none h-14 px-8 font-black uppercase tracking-[0.1em] text-[13px] transition-all"
            data-testid="nav-get-started">
            Access Platform
          </Button>
        </div>
      </nav>

      {/* ═══ EDITORIAL HERO ═══ */}
      <section className="relative min-h-screen flex flex-col lg:flex-row pt-24">
        <div className="w-full lg:w-[55%] flex items-center justify-center p-8 lg:p-24 order-2 lg:order-1 bg-white">
          <div className="max-w-2xl w-full">
            <motion.div initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ duration: 0.8, originY: 0 }} className="w-16 h-1 bg-zinc-900 mb-12" />
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
              className="font-display text-[4rem] md:text-[6rem] lg:text-[7rem] font-black leading-[0.85] tracking-tighter text-zinc-900 uppercase">
              The <br/>
              Standard <br/>
              <span className="text-zinc-300">For Play.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-10 text-zinc-500 text-lg md:text-xl font-medium leading-relaxed max-w-lg">
              Lobbi is the definitive operating system for amateur sports. Discover elite turfs, find competitive opponents, and manage your athletic journey.
            </motion.p>

            {/* Search */}
            <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }} className="mt-14 w-full max-w-xl" data-testid="hero-search-form">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 transition-colors group-focus-within:text-zinc-900" />
                <Input placeholder="Search venues, areas, cities..."
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  className="h-20 pl-16 pr-40 rounded-none border-2 border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900 text-lg font-bold placeholder:text-zinc-400 placeholder:font-medium bg-zinc-50 transition-all"
                  data-testid="hero-search-input" />
                <Button type="submit"
                  className="absolute right-2 top-2 bottom-2 h-16 bg-zinc-900 text-white rounded-none px-8 font-black uppercase tracking-[0.1em] hover:bg-zinc-800 transition-colors"
                  data-testid="hero-search-btn">
                  Explore
                </Button>
              </div>
            </motion.form>
          </div>
        </div>
        
        <div className="w-full lg:w-[45%] h-[60vh] lg:h-screen order-1 lg:order-2 relative bg-zinc-100 mt-24 lg:mt-0">
          <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }}
            src={HERO_IMAGE} alt="Athletic" className="w-full h-full object-cover filter grayscale-[20%] contrast-125" />
          <div className="absolute inset-0 bg-black/10" />
        </div>
      </section>

      {/* ═══ BROWSE BY CITY (Minimal) ═══ */}
      {cities.length > 0 && (
        <section className="py-24 md:py-32 px-6 md:px-12 bg-zinc-50 border-y border-zinc-100" data-testid="popular-cities">
          <div className="max-w-[90rem] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="font-display text-4xl md:text-5xl font-black tracking-tighter uppercase text-zinc-900">Locations</h2>
                <p className="text-zinc-500 font-medium mt-3 text-lg">Active cities across the network.</p>
              </motion.div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-zinc-200 border border-zinc-200">
              {cities.map((c, idx) => (
                <motion.div key={c.city} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
                  onClick={() => goToCity(c.city)}
                  className="bg-white p-8 cursor-pointer group hover:bg-zinc-900 transition-colors duration-300">
                  <h3 className="font-display text-xl font-black text-zinc-900 group-hover:text-white transition-colors">{c.city}</h3>
                  <p className="text-sm text-zinc-400 font-bold mt-2 group-hover:text-zinc-400">{c.count} VENUE{c.count > 1 ? "S" : ""}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ EDITORIAL ROLES SECTIONS ═══ */}
      
      {/* For Players */}
      <section id="players" className="py-24 md:py-40 px-6 md:px-12 max-w-[90rem] mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
        <div className="w-full lg:w-1/2">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-[11px] font-black tracking-[0.2em] text-zinc-400 uppercase block mb-6">01 — For Players</span>
            <h2 className="font-display text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter uppercase mb-8 text-zinc-900">The Athlete's<br/>Network.</h2>
            <p className="text-zinc-500 text-xl font-medium mb-12 leading-relaxed max-w-md">Elevate your game. Connect with like-minded athletes, find perfectly matched opponents, and access the best facilities.</p>
            
            <ul className="space-y-6">
              {["Intelligent Matchmaking", "Instant Turf Booking", "Social Feed & Tournaments", "Seamless Split Payments"].map((feature, idx) => (
                <li key={feature} className="flex items-center gap-6 text-zinc-900 font-black text-lg md:text-xl uppercase tracking-tighter">
                  <span className="text-zinc-300 text-sm font-bold">0{idx + 1}</span> {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
        <div className="w-full lg:w-1/2 aspect-[4/5] bg-zinc-100 relative group overflow-hidden">
          <img src={PLAYERS_IMG} className="w-full h-full object-cover filter grayscale-[30%] group-hover:scale-105 transition-transform duration-1000" alt="Players" />
        </div>
      </section>

      {/* For Venue Owners */}
      <section id="owners" className="py-24 md:py-40 px-6 md:px-12 max-w-[90rem] mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
        <div className="w-full lg:w-1/2 aspect-[4/5] bg-zinc-100 relative group overflow-hidden order-2 lg:order-1">
          <img src={OWNERS_IMG} className="w-full h-full object-cover filter grayscale-[30%] group-hover:scale-105 transition-transform duration-1000" alt="Venue Owners" />
        </div>
        <div className="w-full lg:w-1/2 order-1 lg:order-2 lg:pl-16">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-[11px] font-black tracking-[0.2em] text-zinc-400 uppercase block mb-6">02 — For Owners</span>
            <h2 className="font-display text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter uppercase mb-8 text-zinc-900">Venue<br/>Command.</h2>
            <p className="text-zinc-500 text-xl font-medium mb-12 leading-relaxed max-w-md">Transform your sports facility into a data-driven business. comprehensive operating system for bookings, revenue, and infrastructure.</p>
            
            <ul className="space-y-6">
              {["Revenue Analytics", "Automated Booking Management", "IoT Lighting Control", "Integrated Point of Sale"].map((feature, idx) => (
                <li key={feature} className="flex items-center gap-6 text-zinc-900 font-black text-lg md:text-xl uppercase tracking-tighter">
                  <span className="text-zinc-300 text-sm font-bold">0{idx + 1}</span> {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* For Coaches */}
      <section id="coaches" className="py-24 md:py-40 px-6 md:px-12 max-w-[90rem] mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
        <div className="w-full lg:w-1/2">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-[11px] font-black tracking-[0.2em] text-zinc-400 uppercase block mb-6">03 — For Coaches</span>
            <h2 className="font-display text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter uppercase mb-8 text-zinc-900">Scale Your<br/>Academy.</h2>
            <p className="text-zinc-500 text-xl font-medium mb-12 leading-relaxed max-w-md">The infrastructure to grow your coaching business. Manage students, schedule sessions, and track performance effortlessly.</p>
            
            <ul className="space-y-6">
              {["Academy Dashboard", "Student Roster Management", "Session Scheduling", "Coach Marketplace Directory"].map((feature, idx) => (
                <li key={feature} className="flex items-center gap-6 text-zinc-900 font-black text-lg md:text-xl uppercase tracking-tighter">
                  <span className="text-zinc-300 text-sm font-bold">0{idx + 1}</span> {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
        <div className="w-full lg:w-1/2 aspect-[4/5] bg-zinc-100 relative group overflow-hidden">
          <img src={COACHES_IMG} className="w-full h-full object-cover filter grayscale-[30%] group-hover:scale-105 transition-transform duration-1000" alt="Coaches" />
        </div>
      </section>

      {/* ═══ FEATURED VENUES (Editorial Collection) ═══ */}
      {featuredVenues.length > 0 && (
        <section className="py-24 md:py-32 bg-zinc-900 text-white" data-testid="featured-venues">
          <div className="max-w-[90rem] mx-auto px-6 md:px-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="font-display text-5xl md:text-6xl font-black tracking-tighter uppercase">Curated<br/>Collection.</h2>
                <p className="text-zinc-400 font-medium mt-6 text-xl">The highest-rated facilities on the platform.</p>
              </motion.div>
              <Button variant="link" className="text-white hover:text-zinc-300 font-bold uppercase tracking-widest text-sm"
                onClick={() => navigate("/venues")} data-testid="view-all-venues-btn">
                View All Venues <ArrowRight className="h-4 w-4 ml-3" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {featuredVenues.map((v, idx) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                  onClick={() => navigate(v.slug ? `/venue/${v.slug}` : "/venues")}
                  className="group cursor-pointer">
                  <div className="relative aspect-square overflow-hidden bg-zinc-800 mb-6">
                    {v.images?.[0] ? (
                      <img src={v.images[0]} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter contrast-125" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800" />
                    )}
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-white text-zinc-900 px-4 py-2 font-black text-sm uppercase">
                      <Star className="h-4 w-4 fill-zinc-900" />
                      {v.rating?.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-black uppercase tracking-tighter mb-2 group-hover:text-zinc-400 transition-colors">{v.name}</h3>
                    <div className="flex items-center justify-between text-zinc-400 font-bold uppercase tracking-widest text-[11px]">
                      <span>{v.area ? `${v.area}, ` : ""}{v.city}</span>
                      <span className="text-white">{v.base_price ? `₹${v.base_price}` : ""}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TESTIMONIALS (Monolithic Typography) ═══ */}
      <section className="py-32 md:py-48 px-6 md:px-12 bg-white">
        <div className="max-w-[90rem] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 md:gap-24">
            {AMBASSADORS.map((a, idx) => (
              <motion.div key={a.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                className="flex flex-col">
                <p className="font-display text-2xl md:text-3xl font-black leading-tight tracking-tighter text-zinc-900 mb-10">"{a.quote}"</p>
                <div className="mt-auto pt-8 border-t border-zinc-200">
                  <h3 className="font-bold text-lg text-zinc-900 uppercase tracking-wider">{a.name}</h3>
                  <span className="text-zinc-400 text-sm font-bold uppercase tracking-[0.2em]">{a.role}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CALL TO ACTION (Stark) ═══ */}
      <section className="relative py-40 md:py-56 px-6 text-center border-t border-zinc-100 overflow-hidden bg-zinc-900">
        <img src={CTA_IMAGE} alt="Athletic training" className="absolute inset-0 w-full h-full object-cover opacity-20 filter grayscale" />
        <div className="relative max-w-4xl mx-auto z-10">
          <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white uppercase leading-[0.9] mb-12">
            Initiate <br/> Play.
          </h2>
          <div className="flex flex-col sm:flex-row gap-6 justify-center mt-12">
            <Button onClick={() => navigate(user ? "/dashboard" : "/auth")}
              className="bg-white text-zinc-900 hover:bg-zinc-200 rounded-none h-16 px-12 font-black uppercase tracking-[0.1em] text-sm transition-all"
              data-testid="cta-get-started">
              Access Platform
            </Button>
            <Button variant="outline" onClick={() => navigate("/venues")}
              className="rounded-none h-16 px-12 font-black uppercase tracking-[0.1em] text-sm border-2 border-white text-white hover:bg-white hover:text-zinc-900 transition-all bg-transparent"
              data-testid="cta-browse-venues">
              Explore Venues
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}