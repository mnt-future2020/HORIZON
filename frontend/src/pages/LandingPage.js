import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Search, MapPin, Star, ChevronRight, Zap, Shield, Users, BarChart3, Smartphone, Building2, Navigation } from "lucide-react";

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

  const totalVenues = cities.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-16 sm:pt-28 sm:pb-24 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge2 text="SPORTS FACILITY OPERATING SYSTEM" />
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-foreground mt-4 leading-[1.1]">
              THE<br /><span className="text-primary">HORIZON</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-lg text-base sm:text-lg leading-relaxed">
              Book turfs. Split costs. Find opponents. One platform that runs the entire amateur sports ecosystem.
            </p>
          </motion.div>

          {/* Hero Search Bar */}
          <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }} className="mt-8 max-w-2xl" data-testid="hero-search-form">
            <div className="flex gap-2 p-2 rounded-2xl bg-card border border-border shadow-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by venue name, area, or city..."
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10 border-0 bg-transparent h-12 text-sm focus-visible:ring-0"
                  data-testid="hero-search-input"
                />
              </div>
              <Button type="submit" className="h-12 px-6 bg-primary text-primary-foreground font-bold uppercase tracking-wider text-xs rounded-xl"
                data-testid="hero-search-btn">
                <Search className="h-4 w-4 mr-2" />Search
              </Button>
            </div>
            {/* Quick city links */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Popular:</span>
              {cities.slice(0, 5).map(c => (
                <button key={c.city} type="button" onClick={() => goToCity(c.city)}
                  className="text-xs text-primary/80 hover:text-primary font-bold transition-colors"
                  data-testid={`hero-city-${c.city}`}>
                  {c.city}
                </button>
              ))}
            </div>
          </motion.form>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="flex gap-8 sm:gap-12 mt-12">
            {[
              { value: `${totalVenues}+`, label: "ACTIVE VENUES" },
              { value: "50K+", label: "PLAYERS" },
              { value: "99.9%", label: "IOT UPTIME" },
              { value: "4.8", label: "AVG RATING" },
            ].map(s => (
              <div key={s.label}>
                <div className="font-display text-xl sm:text-2xl font-black text-foreground">{s.value}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Popular Cities */}
      {cities.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12" data-testid="popular-cities">
          <h2 className="font-display text-lg sm:text-xl font-bold text-foreground mb-1">Browse by City</h2>
          <p className="text-sm text-muted-foreground mb-6">Find venues near you</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {cities.map((c, idx) => (
              <motion.div key={c.city} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => goToCity(c.city)}
                className="glass-card rounded-xl p-4 cursor-pointer group hover:border-primary/30 transition-all text-center"
                data-testid={`city-card-${c.city}`}>
                <MapPin className="h-6 w-6 mx-auto mb-2 text-primary group-hover:scale-110 transition-transform" />
                <h3 className="font-display font-bold text-sm text-foreground">{c.city}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{c.count} venue{c.count > 1 ? "s" : ""}</p>
              </motion.div>
            ))}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: cities.length * 0.05 }}
              onClick={() => navigate("/venues")}
              className="glass-card rounded-xl p-4 cursor-pointer group hover:border-primary/30 transition-all text-center flex flex-col items-center justify-center"
              data-testid="city-card-all">
              <Building2 className="h-6 w-6 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
              <h3 className="font-display font-bold text-sm text-foreground">All Cities</h3>
              <p className="text-xs text-muted-foreground mt-0.5">View all</p>
            </motion.div>
          </div>
        </section>
      )}

      {/* Featured Venues */}
      {featuredVenues.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12" data-testid="featured-venues">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">Top Rated Venues</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Highest rated across all cities</p>
            </div>
            <Button variant="ghost" className="text-xs text-primary" onClick={() => navigate("/venues")}
              data-testid="view-all-venues-btn">
              View All <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredVenues.map((v, idx) => (
              <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(user ? `/venues/${v.id}` : "/auth")}
                className="glass-card rounded-xl overflow-hidden cursor-pointer group hover:border-primary/30 transition-all"
                data-testid={`featured-venue-${v.id}`}>
                <div className="relative h-32 overflow-hidden bg-secondary/30">
                  {v.images?.[0] ? (
                    <img src={v.images[0]} alt={v.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-md">
                    <Star className="h-3 w-3 text-primary fill-primary" />
                    <span className="text-xs font-bold text-primary">{v.rating?.toFixed(1)}</span>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{v.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{v.area ? `${v.area}, ` : ""}{v.city}</span>
                    <span className="ml-auto font-bold text-primary">{"\u20B9"}{v.base_price}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="font-display text-lg sm:text-xl font-bold text-foreground text-center mb-2">Why Horizon?</h2>
        <p className="text-sm text-muted-foreground text-center mb-10">Built for the modern sports ecosystem</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Instant Booking", desc: "Book turfs in seconds with real-time slot availability." },
            { icon: Users, title: "Split Payments", desc: "Split costs with friends. Everyone pays their share." },
            { icon: Shield, title: "Smart Matchmaking", desc: "AI-powered skill matching with Glicko-2 ratings." },
            { icon: BarChart3, title: "Venue Analytics", desc: "Revenue dashboards and booking insights for owners." },
            { icon: Smartphone, title: "IoT Integration", desc: "Smart lighting control for connected venues." },
            { icon: Star, title: "Verified Ratings", desc: "Tamper-proof, blockchain-style rating history." },
          ].map((f, idx) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
              className="glass-card rounded-xl p-5">
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-sm text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-3">Ready to play?</h2>
        <p className="text-sm text-muted-foreground mb-6">Join thousands of players already on Horizon</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate(user ? "/dashboard" : "/auth")}
            className="bg-primary text-primary-foreground font-bold uppercase tracking-wider text-xs h-11 px-8 rounded-xl"
            data-testid="cta-get-started">
            Get Started Free <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button variant="outline" onClick={() => navigate("/venues")}
            className="font-bold uppercase tracking-wider text-xs h-11 px-8 rounded-xl"
            data-testid="cta-browse-venues">
            Browse Venues
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-display text-lg font-black text-primary">HORIZON</span>
          <p className="text-xs text-muted-foreground">Sports Facility Operating System</p>
        </div>
      </footer>
    </div>
  );
}

function Badge2({ text }) {
  return (
    <span className="inline-block px-4 py-1.5 border border-primary/30 bg-primary/5 text-primary text-[11px] font-mono uppercase tracking-widest rounded-full">
      {text}
    </span>
  );
}
