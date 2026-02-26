import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import Footer from "@/components/Footer";
import { Search, MapPin, Star, ArrowRight, Trophy, Users, Zap, Wallet, Activity, CreditCard, Crosshair } from "lucide-react";

// Premium Editorial Images
const HERO_IMAGE = "https://images.unsplash.com/photo-1487466365202-1afdb86c764e?auto=format&fit=crop&w=1920&q=80";
const CTA_IMAGE = "https://images.unsplash.com/photo-1461896836934-bd45ba8d7459?auto=format&fit=crop&w=1920&q=80";

const CITY_IMAGES = {
  madurai: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80",
  vilupuram: "https://images.unsplash.com/photo-1629807496522-83ecd8af4152?auto=format&fit=crop&w=800&q=80",
  chennai: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/0j7/x20/oav/360_F_275034287_RwBdkQQIvoYjxvHPocTR5MBrgQXFaZqr.jpg",
  coimbatore: "https://images.unsplash.com/photo-1621689032733-4df4249a0225?auto=format&fit=crop&w=800&q=80",
  bangalore: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/ifp/8jh/ak3/istockphoto-1192261427-612x612.jpg",
  bengaluru: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/ifp/8jh/ak3/istockphoto-1192261427-612x612.jpg",
  delhi: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/9kj/gle/h29/istockphoto-505239248-612x612.jpg",
  mumbai: "https://6dfa0433ff.imgdist.com/pub/bfra/9ghkfuy7/ebv/o6u/qsu/istockphoto-1307189136-612x612.jpg",
  default: "https://images.unsplash.com/photo-1518605368461-1e1292237fac?auto=format&fit=crop&w=800&q=80"
};

const getCityImage = (cityName) => {
  if (!cityName) return CITY_IMAGES.default;
  const normalized = cityName.toLowerCase();
  for (const [key, url] of Object.entries(CITY_IMAGES)) {
    if (normalized.includes(key)) return url;
  }
  return CITY_IMAGES.default;
};

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
    <div className="min-h-screen bg-white text-slate-800 selection:bg-brand-600 selection:text-white" data-testid="landing-page">
      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 w-full z-50 h-20 flex items-center justify-between px-6 md:px-12 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <span className="font-display font-black text-3xl tracking-tighter uppercase text-brand-700">Lobbi</span>
        <div className="hidden lg:flex items-center gap-12">
          {["Features", "Locations", "Community"].map(label => (
            <button key={label} onClick={() => scrollTo(label.toLowerCase())}
              className="text-[13px] font-bold tracking-[0.1em] text-slate-400 hover:text-brand-600 transition-colors uppercase">
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <Button size="lg" onClick={() => navigate("/auth")}
            className="bg-brand-600 text-white hover:bg-brand-700 rounded-full h-12 px-8 font-black uppercase tracking-[0.1em] text-[13px] transition-all"
            data-testid="nav-get-started">
            Get Started
          </Button>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative flex flex-col lg:flex-row pt-20 min-h-screen items-stretch">
        <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-24 order-2 lg:order-1 bg-gradient-to-br from-brand-800 via-brand-900 to-slate-900">
          <div className="max-w-2xl w-full mx-auto lg:mx-0">
            <motion.div initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ duration: 0.8, originY: 0 }} className="w-16 h-1.5 bg-gradient-to-r from-brand-500 to-brand-400 rounded-full mb-12" />
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
              className="font-display text-[4rem] md:text-[6rem] lg:text-[7rem] font-black leading-[0.85] tracking-tighter text-white uppercase">
              The <br/>
              Standard <br/>
              <span className="text-brand-400">For Play.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-10 text-brand-100/70 text-lg md:text-xl font-medium leading-relaxed max-w-lg">
              Lobbi is the definitive operating system for amateur sports. Discover elite turfs, find competitive opponents, and manage your athletic journey.
            </motion.p>

            {/* Search */}
            <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }} className="mt-14 w-full max-w-xl" data-testid="hero-search-form">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-brand-600" />
                <Input placeholder="Search venues, areas, cities..."
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  className="h-16 pl-16 pr-36 rounded-2xl border-none focus-visible:ring-2 focus-visible:ring-brand-500 text-lg font-bold placeholder:text-slate-400 placeholder:font-medium bg-white transition-all text-slate-900"
                  data-testid="hero-search-input" />
                <Button type="submit"
                  className="absolute right-2 top-2 bottom-2 h-12 bg-brand-600 text-white rounded-xl px-8 font-black uppercase tracking-[0.1em] hover:bg-brand-700 transition-all"
                  data-testid="hero-search-btn">
                  Explore
                </Button>
              </div>
            </motion.form>
          </div>
        </div>

        <div className="w-full lg:w-1/2 min-h-[50vh] order-1 lg:order-2 relative overflow-hidden">
          <motion.img initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5 }}
            src={HERO_IMAGE} alt="Athletic" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </section>

      {/* ═══ BROWSE BY CITY ═══ */}
      {cities.length > 0 && (
        <section className="py-24 md:py-32 px-6 md:px-12 bg-white" id="locations" data-testid="popular-cities">
          <div className="max-w-[90rem] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <span className="text-[11px] font-black tracking-[0.2em] text-brand-600 uppercase block mb-6">02 — Territories</span>
                <h2 className="font-display text-5xl md:text-7xl font-black tracking-tighter uppercase text-slate-900 leading-[0.85]">
                  Active <span className="text-brand-500 font-medium italic">Locations.</span>
                </h2>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {cities.slice(0, 5).map((c, idx) => (
                <motion.div key={c.city} initial={{ opacity: 0, scale: 0.95, y: 20 }} whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.1, duration: 0.5 }}
                  onClick={() => goToCity(c.city)}
                  className="group relative aspect-[3/4] rounded-[2rem] overflow-hidden cursor-pointer shadow-lg hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] border border-slate-100 hover:border-brand-500/30 transition-all duration-500">
                  <div className="absolute inset-0 bg-slate-900">
                    <img 
                      src={getCityImage(c.city)} 
                      alt={c.city} 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700" 
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-500" />
                  
                  <div className="absolute inset-x-8 bottom-8 flex flex-col justify-end">
                    <div className="mb-4 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 transform -translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-display text-3xl font-black text-white uppercase tracking-tighter leading-none mb-2 group-hover:text-brand-300 transition-colors duration-300">{c.city}</h3>
                    <p className="text-brand-400 font-bold text-[11px] tracking-widest uppercase">{c.count} VENUE{c.count > 1 ? "S" : ""}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ PLATFORM ECOSYSTEM BENTO ═══ */}
      <section className="py-24 md:py-32 px-6 md:px-12 bg-white relative overflow-hidden" id="features">
        <div className="max-w-[90rem] mx-auto">
          {/* Header */}
          <div className="mb-16">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="text-[11px] font-black tracking-[0.2em] text-brand-600 uppercase block mb-6">01 — The Ecosystem</span>
              <h2 className="font-display text-5xl md:text-7xl font-black tracking-tighter uppercase text-slate-900 leading-[0.85] max-w-4xl">
                Everything you need. <br/>
                <span className="text-brand-500 font-medium italic">Nothing you don't.</span>
              </h2>
            </motion.div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:auto-rows-[280px]">
            
            {/* 1. Matchmaking (2x2) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2 bg-slate-900 rounded-[2rem] p-8 md:p-12 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <Crosshair className="w-10 h-10 text-brand-400 mb-6" />
                  <h3 className="font-display text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4 leading-none">Intelligent<br/>Matchmaking</h3>
                  <p className="text-slate-400 font-medium text-lg max-w-sm leading-relaxed">Find perfect opponents based on skill rating, availability, and location. Stop searching, start playing.</p>
                </div>
                {/* Abstract UI representation */}
                <div className="mt-12 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 transform translate-y-8 group-hover:translate-y-0 opacity-80 group-hover:opacity-100 transition-all duration-500 shadow-2xl">
                  <div className="flex items-center justify-between mb-5 pb-5 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                        <Users className="w-6 h-6 text-brand-400" />
                      </div>
                      <div>
                        <div className="text-white font-black text-base uppercase tracking-tight">FC Mavericks</div>
                        <div className="text-brand-400 text-xs font-bold uppercase tracking-widest mt-1">Rating: 1850</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-black text-sm uppercase tracking-wider">Challenge</div>
                      <div className="text-slate-400 text-xs mt-1">Tonite, 8PM</div>
                    </div>
                  </div>
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[85%] bg-gradient-to-r from-brand-600 to-brand-400 rounded-full" />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-[0.2em]">85% Playstyle Match</div>
                </div>
              </div>
            </motion.div>

            {/* 2. Player Cards (1x2) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
              className="col-span-1 md:col-span-1 lg:col-span-1 row-span-2 bg-brand-600 rounded-[2rem] p-8 md:p-10 relative overflow-hidden group flex flex-col justify-between">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579952520845-ff1ca44e13ec?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay group-hover:scale-110 transition-transform duration-1000" />
              <div className="relative z-10">
                <Trophy className="w-8 h-8 text-white mb-6" />
                <h3 className="font-display text-4xl font-black text-white uppercase tracking-tighter leading-none mb-4">Player<br/>Cards</h3>
                <p className="text-brand-100 font-medium text-sm leading-relaxed">Your athletic identity, quantified. Track stats and climb global leaderboards.</p>
              </div>
              {/* 3D Card Hover Effect */}
              <div className="relative z-10 mt-12 mx-auto w-4/5 aspect-[3/4] bg-white rounded-xl shadow-2xl p-4 rotate-12 group-hover:rotate-6 group-hover:-translate-y-4 transition-all duration-500 border border-white/50 backdrop-blur-sm bg-white/90">
                <div className="w-full aspect-square bg-slate-100 rounded-lg mb-4 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-100 to-slate-50" />
                  <Users className="w-10 h-10 text-brand-600/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="h-4 w-3/4 bg-slate-800 rounded mb-2" />
                <div className="flex gap-2 mb-2">
                  <div className="h-3 w-1/3 bg-brand-500 rounded" />
                  <div className="h-3 w-1/3 bg-slate-200 rounded" />
                </div>
              </div>
            </motion.div>

            {/* 3. Split Payments (1x1) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}
              className="col-span-1 md:col-span-1 lg:col-span-1 row-span-1 bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-brand-500 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.1)] transition-all duration-300 group flex flex-col justify-center">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-display text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2 group-hover:text-brand-600 transition-colors">Split Pay</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">Divide turf costs instantly among your squad seamlessly.</p>
            </motion.div>

            {/* 4. Social Feed (1x1) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
              className="col-span-1 md:col-span-1 lg:col-span-1 row-span-1 bg-slate-100 rounded-[2rem] p-8 hover:bg-slate-200 transition-colors duration-300 group flex flex-col justify-center border border-transparent hover:border-slate-300">
               <Activity className="w-8 h-8 text-slate-800 mb-6 group-hover:rotate-12 transition-transform duration-300" />
              <h3 className="font-display text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">Social Feed</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">Share highlights, organize matches, and banter with the community.</p>
            </motion.div>

            {/* 5. IoT & Automation (2x1) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }}
              className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 bg-slate-900 rounded-[2rem] p-8 md:p-10 relative overflow-hidden group flex items-center border border-slate-800">
              <div className="absolute right-0 top-0 bottom-0 w-2/3 bg-gradient-to-l from-brand-900/60 to-transparent" />
              <div className="relative z-10 w-full flex justify-between items-center gap-6">
                <div className="max-w-xs">
                  <Zap className="w-8 h-8 text-brand-400 mb-6 group-hover:animate-pulse" />
                  <h3 className="font-display text-3xl font-black text-white uppercase tracking-tighter mb-3 leading-none">IoT Control</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">Automate stadium lighting and access gates directly from your venue dashboard.</p>
                </div>
                {/* Glowing switch */}
                <div className="hidden sm:flex w-24 h-12 bg-slate-800/80 rounded-full p-1 shadow-inner relative items-center cursor-pointer border border-white/5">
                  <motion.div animate={{ x: [0, 48, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="w-10 h-10 bg-brand-400 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.5)]" />
                </div>
              </div>
            </motion.div>

            {/* 6. Tournaments (2x1) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.5 }}
              className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 bg-[#f0f9ff] rounded-[2rem] p-8 md:p-10 relative group flex items-center border border-blue-100 hover:border-blue-300 hover:bg-[#e0f2fe] transition-colors duration-300">
              <div className="relative w-full flex justify-between items-center">
                <div className="max-w-md">
                  <Trophy className="w-8 h-8 text-blue-600 mb-6 group-hover:-translate-y-2 transition-transform duration-300" />
                  <h3 className="font-display text-3xl font-black text-slate-900 uppercase tracking-tighter mb-3 leading-none">Tournaments</h3>
                  <p className="text-slate-600 text-sm font-medium leading-relaxed">Create brackets, manage signups, and host epic sporting events with automated progression.</p>
                </div>
              </div>
            </motion.div>

             {/* 7. Point of Sale (1x1) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.6 }}
              className="col-span-1 md:col-span-1 lg:col-span-1 row-span-1 bg-white border border-slate-200 rounded-[2rem] p-8 hover:shadow-xl transition-all duration-300 group flex flex-col justify-center hover:-translate-y-1">
              <CreditCard className="w-8 h-8 text-slate-800 mb-6 group-hover:text-amber-500 transition-colors duration-300" />
              <h3 className="font-display text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">POS System</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">Sell gear, drinks, and snacks directly at the venue.</p>
            </motion.div>

             {/* 8. Coaching (1x1) */}
             <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.7 }}
              className="col-span-1 md:col-span-1 lg:col-span-1 row-span-1 bg-slate-900 rounded-[2rem] p-8 flex flex-col justify-center group relative overflow-hidden hover:shadow-2xl transition-all duration-300">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=400&q=80')] bg-cover opacity-10 group-hover:opacity-30 group-hover:scale-105 transition-all duration-700" />
              <div className="relative z-10">
                <Users className="w-8 h-8 text-white mb-6" />
                <h3 className="font-display text-2xl font-black text-white uppercase tracking-tighter mb-2">Coaching</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">Manage student rosters and training sessions.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURED VENUES ═══ */}
      {featuredVenues.length > 0 && (
        <section className="py-24 md:py-32 bg-gradient-to-br from-brand-900 via-brand-950 to-slate-900 text-white" data-testid="featured-venues">
          <div className="max-w-[90rem] mx-auto px-6 md:px-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className="font-display text-5xl md:text-6xl font-black tracking-tighter uppercase">Curated<br/>Collection.</h2>
                <p className="text-brand-300/70 font-medium mt-6 text-xl">The highest-rated facilities on the platform.</p>
              </motion.div>
              <Button variant="link" className="text-brand-300 hover:text-white font-bold uppercase tracking-widest text-sm"
                onClick={() => navigate("/venues")} data-testid="view-all-venues-btn">
                View All Venues <ArrowRight className="h-4 w-4 ml-3" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredVenues.map((v, idx) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                  onClick={() => navigate(v.slug ? `/venue/${v.slug}` : "/venues")}
                  className="group cursor-pointer bg-white/5 rounded-2xl overflow-hidden backdrop-blur-sm border border-white/10 hover:border-brand-400/40 transition-all duration-300 hover:shadow-xl">
                  <div className="relative aspect-[4/3] overflow-hidden">
                     {v.images?.[0] ? (
                       <img src={v.images[0]} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-brand-900/50" />
                     )}
                     <div className="absolute top-4 right-4 flex items-center gap-2 bg-white text-brand-700 px-4 py-2 rounded-full font-black text-sm shadow-md">
                      <Star className="h-4 w-4 fill-brand-600 text-brand-600" />
                      {v.rating?.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-display text-2xl font-black uppercase tracking-tighter group-hover:text-brand-300 transition-colors">{v.name}</h3>
                      <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${v.badge === "bookable" ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                        {v.badge === "bookable" ? "Bookable" : "Enquiry"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-brand-300/60 font-bold uppercase tracking-widest text-[11px]">
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

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="py-32 md:py-48 px-6 md:px-12 bg-white">
        <div className="max-w-[90rem] mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-20 border-b-2 border-slate-900 pb-12" id="community">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="text-[11px] font-black tracking-[0.2em] text-brand-600 uppercase block mb-6">03 — Community</span>
              <h2 className="font-display text-6xl md:text-8xl font-black tracking-tighter uppercase text-slate-900 leading-[0.85]">
                Word <br/>
                On The <span className="text-brand-600 italic font-medium">Turf.</span>
              </h2>
            </motion.div>
            <motion.p initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mt-8 md:mt-0 text-left md:text-right max-w-[280px] leading-loose">
              Real perspectives from athletes pushing their limits.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-slate-200 border border-slate-200">
            {AMBASSADORS.map((a, idx) => (
              <motion.div key={a.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                className="group relative bg-white p-10 md:p-14 flex flex-col hover:bg-slate-900 transition-colors duration-500 overflow-hidden min-h-[420px]">
                
                {/* Huge Background Number */}
                <span className="absolute -bottom-10 -right-6 font-display text-[16rem] font-black text-slate-50 group-hover:text-brand-900/40 transition-colors duration-700 pointer-events-none select-none leading-none">
                  0{idx + 1}
                </span>

                <div className="relative z-10 flex-grow pt-4">
                  {/* Modern Quote Icon */}
                  <svg className="w-10 h-10 text-brand-500 mb-10 transform -translate-x-1 group-hover:text-brand-400 transition-colors duration-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  
                  <p className="font-display text-2xl md:text-3xl font-bold leading-[1.3] tracking-tighter text-slate-800 group-hover:text-white transition-colors duration-500">
                    "{a.quote}"
                  </p>
                </div>
                
                <div className="relative z-10 mt-16 pt-8 border-t-2 border-slate-900 group-hover:border-brand-500 transition-colors duration-500 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-lg text-slate-900 group-hover:text-white uppercase tracking-widest">{a.name}</h3>
                    <span className="text-brand-600 group-hover:text-brand-400 text-xs font-bold uppercase tracking-[0.2em] block mt-2">{a.role}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CALL TO ACTION ═══ */}
      <section className="relative py-40 md:py-56 px-6 text-center overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-slate-900">
        <img src={CTA_IMAGE} alt="Athletic training" className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-luminosity" />
        <div className="relative max-w-4xl mx-auto z-10">
          <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white uppercase leading-[0.9] mb-12">
            Initiate <br/> Play.
          </h2>
          <div className="flex flex-col sm:flex-row gap-6 justify-center mt-12">
            <Button onClick={() => navigate(user ? "/dashboard" : "/auth")}
              className="bg-white text-brand-800 hover:bg-brand-50 rounded-full h-16 px-12 font-black uppercase tracking-[0.1em] text-sm transition-all"
              data-testid="cta-get-started">
              Access Platform
            </Button>
            <Button variant="outline" onClick={() => navigate("/venues")}
              className="rounded-full h-16 px-12 font-black uppercase tracking-[0.1em] text-sm border-2 border-white/30 text-white hover:bg-white hover:text-brand-900 transition-all bg-transparent"
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
