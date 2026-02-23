import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import {
  Search, MapPin, Star, ArrowRight, Quote, Medal,
  Building2, Users, Flame, Calendar
} from "lucide-react";

// Ticker data for the unforgettable scrolling ticker
const TICKER_ITEMS = [
  "PREMIUM VENUES",
  "FIND YOUR NEXT OPPONENT",
  "ELEGANT COURT DESIGNS",
  "ELITE COACHING",
  "SPLIT COSTS SEAMLESSLY",
  "LUXURY ATHLETICS",
  "JOIN THE EXCLUSIVE LEAGUE"
];

const AMBASSADORS = [
  { src: "https://images.unsplash.com/photo-1542201509-53e7dccc3486?auto=format&fit=crop&w=800&q=80", name: "Alexander K.", role: "Pro Tennis", quote: "The most refined platform for finding premium courts." },
  { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80", name: "Sophia M.", role: "Padel Instructor", quote: "Horizon beautifully manages my entire coaching schedule." },
  { src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80", name: "James V.", role: "Club Owner", quote: "Our luxury turf bookings increased tenfold since joining." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState("");
  const [cities, setCities] = useState([]);
  const [featuredVenues, setFeaturedVenues] = useState([]);
  const [heroSlide, setHeroSlide] = useState(0);

  const HERO_SLIDES = [
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1920&q=80", // Elegant tennis court
    "https://images.unsplash.com/photo-1526676037598-33151eb23c21?auto=format&fit=crop&w=1920&q=80", // Clean golf/turf
  ];

  useEffect(() => {
    // Standard backend API calls intact
    venueAPI.cities().then(res => setCities(res.data)).catch(() => {});
    venueAPI.list({ sort_by: "rating" }).then(res => setFeaturedVenues(res.data.slice(0, 3))).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setHeroSlide(p => (p + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Force entirely light mode
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
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
    <div className="min-h-screen bg-background text-foreground" data-testid="landing-page">
      {/* ═══ MINIMALIST EDITORIAL NAVBAR ═══ */}
      <nav className="fixed top-0 w-full z-50 h-[80px] flex items-center justify-between px-8 md:px-16 bg-white/80 backdrop-blur-md border-b border-border/40">
        <span className="font-display font-medium text-2xl tracking-tighter text-primary">Horizon.</span>
        <div className="hidden md:flex items-center gap-12">
          {[
            { label: "Features", id: "features" },
            { label: "Lobbians", id: "players" },
            { label: "Partners", id: "partners" },
          ].map(l => (
            <button key={l.id} onClick={() => scrollTo(l.id)}
              className="text-[13px] uppercase tracking-wide font-semibold text-muted-foreground hover:text-primary transition-colors duration-300">
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/auth")}
            className="text-[13px] uppercase tracking-wide font-semibold text-primary hover:text-accent transition-colors duration-300 hidden md:block">
            Sign In
          </button>
          <Button onClick={() => navigate("/auth")}
            className="bg-primary text-primary-foreground hover:bg-black rounded-none h-12 px-8 font-medium text-[13px] uppercase tracking-wide transition-all duration-300 shadow-elevated"
            data-testid="nav-get-started">
            Get Started
          </Button>
        </div>
      </nav>

      {/* ═══ EDITORIAL HERO SECTION ═══ */}
      <section className="relative w-full min-h-screen pt-20 flex flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="max-w-xl xl:max-w-2xl z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="mb-6">
              <span className="text-accent text-[11px] font-bold uppercase tracking-ultra-wide">The Standard of Play</span>
            </motion.div>
            
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="font-display font-medium text-foreground leading-[1.05] mb-8">
              Elevate your <br/><span className="italic text-accent">sporting</span> lifestyle.
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-muted-foreground text-lg mb-10 leading-relaxed font-light max-w-md">
              Discover and book premium sporting venues. Seamlessly split costs and find your next formidable opponent.
            </motion.p>
            
            {/* Search Form */}
            <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }} className="flex w-full max-w-lg shadow-elevated" data-testid="hero-search-form">
              <div className="relative flex-1 bg-white border border-border/60">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                <Input placeholder="Search luxury venues, cities..."
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  className="pl-14 border-0 bg-transparent h-16 text-base focus-visible:ring-0 rounded-none shadow-none font-light placeholder:text-muted-foreground/50"
                  data-testid="hero-search-input" />
              </div>
              <Button type="submit"
                className="h-16 px-10 bg-primary text-white rounded-none hover:bg-black transition-colors duration-300 font-medium tracking-wide text-sm"
                data-testid="hero-search-btn">
                EXAMINE
              </Button>
            </motion.form>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[600px] lg:h-[750px] w-full animate-reveal">
            {HERO_SLIDES.map((src, i) => (
              <img key={i} src={src} alt="Hero" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ${i === heroSlide ? "opacity-100" : "opacity-0"}`} />
            ))}
            {/* Elegant inner border */}
            <div className="absolute inset-4 border border-white/30 pointer-events-none z-10" />
          </motion.div>
        </div>
      </section>

      {/* ═══ SCROLLING SPORTS TICKER ═══ */}
      <section className="py-8 border-y border-border bg-secondary/30 overflow-hidden flex items-center">
        <div className="flex whitespace-nowrap animate-ticker group">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
            <div key={idx} className="flex items-center">
              <span className="mx-8 font-display italic text-2xl md:text-3xl text-foreground/80">{item}</span>
              <div className="w-2 h-2 rounded-full bg-accent mx-4" />
            </div>
          ))}
        </div>
      </section>

      {/* ═══ MINIMALIST LUXURY FEATURE HIGHLIGHTS ═══ */}
      <section id="features" className="py-32 bg-background px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-24">
            <span className="text-accent text-[11px] font-bold uppercase tracking-ultra-wide mb-4 block">Our Philosophy</span>
            <h2 className="font-display">Refined. Powerful. <span className="italic">Seamless.</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              { title: "Curated Venues", desc: "Access the most immaculate courts and turfs in the city. Meticulously maintained for your gameplay.", icon: Building2 },
              { title: "Elite Matchmaking", desc: "Our proprietary algorithm ensures you only play against athletes matching your exact caliber and style.", icon: Flame },
              { title: "Concierge Coaching", desc: "Book private sessions with world-class professionals to elevate your technique to the absolute pinnacle.", icon: Medal },
            ].map((feature, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8, delay: idx * 0.2 }}
                className="flex flex-col items-center text-center group cursor-default">
                <div className="w-16 h-16 rounded-full border border-border flex items-center justify-center mb-8 group-hover:bg-primary group-hover:border-primary transition-colors duration-500">
                  <feature.icon className="h-6 w-6 text-foreground group-hover:text-white transition-colors duration-500" strokeWidth={1} />
                </div>
                <h3 className="font-display text-2xl mb-4">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-light">{feature.desc}</p>
                <div className="h-12 w-[1px] bg-border mt-8 group-hover:bg-accent transition-colors duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3D VENUE CARDS (THE UNFORGETTABLE ELEMENT) ═══ */}
      {featuredVenues.length > 0 && (
        <section className="py-32 bg-secondary/20 border-y border-border px-6" data-testid="featured-venues">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
              <div>
                <span className="text-accent text-[11px] font-bold uppercase tracking-ultra-wide mb-4 block">The Collection</span>
                <h2 className="font-display">Signature <span className="italic text-muted-foreground">Venues</span></h2>
              </div>
              <Button variant="outline" className="rounded-none border-border font-medium text-[12px] uppercase tracking-wide h-12 px-8 hover:bg-primary hover:text-white transition-all shadow-none" onClick={() => navigate("/venues")}>
                View Gallery
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {featuredVenues.map((v, idx) => (
                <div key={v.id} className="card-3d-wrapper perspective-1000">
                  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, delay: idx * 0.15 }}
                    onClick={() => navigate(v.slug ? `/venue/${v.slug}` : "/venues")}
                    className="card-3d relative bg-white border border-border/60 overflow-hidden cursor-pointer flex flex-col h-[500px]">
                    <div className="card-3d-shine" />
                    <div className="relative h-[65%] w-full overflow-hidden">
                      {v.images?.[0] ? (
                        <img src={v.images[0]} alt={v.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center">
                          <Building2 className="h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 flex items-center gap-2 shadow-sm">
                        <Star className="h-3 w-3 text-accent fill-accent" />
                        <span className="text-[12px] font-bold">{v.rating?.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="p-8 flex-1 flex flex-col justify-between bg-white relative z-20">
                      <div>
                        <h3 className="font-display text-xl mb-2">{v.name}</h3>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm font-light">
                          <MapPin className="h-4 w-4" strokeWidth={1} />
                          <span>{v.area ? `${v.area}, ` : ""}{v.city}</span>
                        </div>
                      </div>
                      <div className="editorial-separator my-4 w-full h-[1px] bg-border" />
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Starting from</span>
                        <span className="font-display text-xl">{v.base_price ? `₹${v.base_price}` : "Enquire"}</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ HIGH-FASHION PLAYER CARDS / TESTIMONIALS ═══ */}
      <section id="players" className="py-32 bg-background px-6">
        <div className="max-w-[1400px] mx-auto text-center">
          <div className="mb-20">
            <span className="text-accent text-[11px] font-bold uppercase tracking-ultra-wide mb-4 block">The Elite Circle</span>
            <h2 className="font-display">Spoken by our <span className="italic">members</span>.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {AMBASSADORS.map((a, idx) => (
              <motion.div key={a.name} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: idx * 0.2 }}
                className="relative h-[600px] group overflow-hidden bg-black text-white cursor-default">
                <img src={a.src} alt={a.name} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 group-hover:scale-105 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0 p-10 flex flex-col justify-end text-left">
                  <Quote className="h-8 w-8 text-accent mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0" />
                  <p className="font-display italic text-2xl leading-tight mb-8">"{a.quote}"</p>
                  <div>
                    <h4 className="font-medium text-lg uppercase tracking-widest">{a.name}</h4>
                    <span className="text-accent font-light text-sm">{a.role}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EDITORIAL CALL TO ACTION ═══ */}
      <section className="relative py-40 border-t border-border bg-white flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-secondary/50 to-transparent pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}
          className="relative max-w-4xl mx-auto text-center z-10">
          <h2 className="font-display text-[4rem] md:text-[6rem] leading-[0.95] mb-8">Enter the <span className="italic text-accent">Arena.</span></h2>
          <p className="text-xl text-muted-foreground font-light mb-12 max-w-xl mx-auto">
            Experience the zenith of amateur sports operations. Join the community of distinguished athletes and prestigious venues.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button onClick={() => navigate(user ? "/dashboard" : "/auth")}
              className="bg-primary hover:bg-black text-white rounded-none h-14 px-12 font-medium text-[13px] uppercase tracking-wide transition-all shadow-elevated">
              Join The Club
            </Button>
            <button onClick={() => navigate("/venues")}
              className="group flex items-center gap-3 text-[13px] font-bold uppercase tracking-wide text-primary border-b border-primary pb-1 hover:text-accent hover:border-accent transition-colors">
              Explore Venues <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
