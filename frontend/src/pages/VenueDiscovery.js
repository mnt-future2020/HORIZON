import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { venueAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Footer from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Star, IndianRupee, SlidersHorizontal, X, ChevronRight, Users, Zap, Building2, ArrowUpDown, Navigation, Loader2, Trophy, Car, Clock } from "lucide-react";
import { toast } from "sonner";

// Athlete action imagery
const DISCOVERY_BANNER = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1920&q=80";
const EMPTY_STATE_IMG = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=600&q=80";

export default function VenueDiscovery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [venues, setVenues] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [allAmenities, setAllAmenities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState(searchParams.get("q") || "");
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "all");
  const [selectedArea, setSelectedArea] = useState(searchParams.get("area") || "all");
  const [selectedSport, setSelectedSport] = useState(searchParams.get("sport") || "all");
  const [sortBy, setSortBy] = useState("rating");
  const [priceRange, setPriceRange] = useState("all");
  const [selectedAmenity, setSelectedAmenity] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nearMeActive, setNearMeActive] = useState(searchParams.get("nearme") === "1");
  const [userLocation, setUserLocation] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [distanceMap, setDistanceMap] = useState({});
  const [driveTimeMap, setDriveTimeMap] = useState({});
  const [driveTimeMode, setDriveTimeMode] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [citiesRes, areasRes, amenitiesRes] = await Promise.all([
          venueAPI.cities(), venueAPI.areas(), venueAPI.amenities()
        ]);
        setCities(citiesRes.data);
        setAreas(areasRes.data);
        setAllAmenities(amenitiesRes.data);
      } catch { /* ignore */ }
    };
    loadMeta();
  }, []);

  // Load areas when city changes
  useEffect(() => {
    if (selectedCity && selectedCity !== "all") {
      venueAPI.areas(selectedCity).then(res => setAreas(res.data)).catch(() => {});
    } else {
      venueAPI.areas().then(res => setAreas(res.data)).catch(() => {});
    }
    setSelectedArea("all");
  }, [selectedCity]);

  // Near Me handler
  const handleNearMe = () => {
    if (nearMeActive) {
      setNearMeActive(false);
      setUserLocation(null);
      setDistanceMap({});
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMeActive(true);
        setLocatingUser(false);
        setSelectedCity("all");
        setSelectedArea("all");
        toast.success("Location detected! Showing nearest venues.");
      },
      (err) => {
        setLocatingUser(false);
        if (err.code === 1) toast.error("Location permission denied. Please allow location access.");
        else toast.error("Could not detect your location. Please try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Load venues with filters
  const loadVenues = useCallback(async () => {
    setLoading(true);
    try {
      if (nearMeActive && userLocation) {
        let res;
        if (driveTimeMode) {
          res = await venueAPI.nearbyByDriveTime(userLocation.lat, userLocation.lng, 50);
          const dtm = {};
          res.data.forEach(v => {
            if (v.drive_time) dtm[v.id] = v.drive_time;
          });
          setDriveTimeMap(dtm);
        } else {
          res = await venueAPI.nearby(userLocation.lat, userLocation.lng, 50);
          setDriveTimeMap({});
        }
        setVenues(res.data);
        const dm = {};
        res.data.forEach(v => { dm[v.id] = v.distance_km; });
        setDistanceMap(dm);
      } else {
        const params = {};
        if (searchText.trim()) params.search = searchText.trim();
        if (selectedCity !== "all") params.city = selectedCity;
        if (selectedArea !== "all") params.area = selectedArea;
        if (selectedSport !== "all") params.sport = selectedSport;
        if (sortBy) params.sort_by = sortBy;
        if (selectedAmenity !== "all") params.amenity = selectedAmenity;
        if (priceRange === "budget") { params.max_price = 1000; }
        else if (priceRange === "mid") { params.min_price = 1001; params.max_price = 2000; }
        else if (priceRange === "premium") { params.min_price = 2001; }

        const res = await venueAPI.list(params);
        setVenues(res.data);
        setDistanceMap({});
      }
    } catch (err) {
      toast.error("Failed to load venues");
    } finally { setLoading(false); }
  }, [searchText, selectedCity, selectedArea, selectedSport, sortBy, priceRange, selectedAmenity, nearMeActive, userLocation, driveTimeMode]);

  useEffect(() => {
    const timer = setTimeout(loadVenues, 300);
    return () => clearTimeout(timer);
  }, [loadVenues]);

  // Auto-activate Near Me from URL param
  useEffect(() => {
    if (searchParams.get("nearme") === "1" && !nearMeActive && !userLocation) {
      handleNearMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchText) params.set("q", searchText);
    if (selectedCity !== "all") params.set("city", selectedCity);
    if (selectedArea !== "all") params.set("area", selectedArea);
    if (selectedSport !== "all") params.set("sport", selectedSport);
    if (nearMeActive) params.set("nearme", "1");
    setSearchParams(params, { replace: true });
  }, [searchText, selectedCity, selectedArea, selectedSport, nearMeActive, setSearchParams]);

  const activeFilterCount = [
    selectedCity !== "all", selectedArea !== "all", selectedSport !== "all",
    priceRange !== "all", selectedAmenity !== "all", nearMeActive
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchText(""); setSelectedCity("all"); setSelectedArea("all");
    setSelectedSport("all"); setSortBy("rating"); setPriceRange("all");
    setSelectedAmenity("all"); setNearMeActive(false); setUserLocation(null); setDistanceMap({}); setDriveTimeMap({}); setDriveTimeMode(false);
  };

  const sports = ["football", "cricket", "badminton", "basketball", "tennis", "table_tennis"];

  return (
    <div className="min-h-screen bg-background" data-testid="venue-discovery-page">
      {/* Top bar for non-logged-in users */}
      {!user && (
        <nav className="fixed top-0 w-full z-40 h-14 flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur-xl border-b border-border">
          <Link to="/" className="font-display font-black text-base tracking-tighter uppercase text-primary">Horizon</Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-xs font-bold">Log in</Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground text-xs font-bold rounded-lg">Get Started</Button>
          </div>
        </nav>
      )}

      {/* Search Hero - Athletic Style */}
      <div className={`border-b border-border bg-background/95 backdrop-blur-xl sticky z-30 ${user ? "top-16" : "top-14"}`}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Main Search Bar - Larger & Bolder */}
          <div className="flex gap-3 items-center" data-testid="search-bar">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search venue, area, city..."
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                className="pl-12 bg-secondary/50 border-border h-14 text-base font-medium"
                data-testid="search-input"
              />
              {searchText && (
                <button onClick={() => setSearchText("")} className="absolute right-4 top-1/2 -translate-y-1/2 hover:scale-110 transition-transform">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" className={`h-14 w-14 shrink-0 relative transition-all ${filtersOpen ? "border-primary/50 bg-primary/10" : ""}`}
              onClick={() => setFiltersOpen(!filtersOpen)} data-testid="filters-toggle">
              <SlidersHorizontal className="h-5 w-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-glow-pulse">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Quick City Pills + Near Me - Athletic Style */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide" data-testid="city-pills">
            <button onClick={handleNearMe} data-testid="near-me-btn"
              disabled={locatingUser}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all flex items-center gap-2 hover:scale-105 active:scale-100 ${nearMeActive ? "bg-primary text-primary-foreground shadow-glow-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground border-2 border-primary/30"}`}>
              {locatingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
              {locatingUser ? "Locating..." : "Near Me"}
            </button>
            {nearMeActive && (
              <button onClick={() => setDriveTimeMode(!driveTimeMode)} data-testid="drive-time-toggle"
                className={`px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all flex items-center gap-1.5 hover:scale-105 active:scale-100 ${driveTimeMode ? "bg-sky-500/20 text-sky-400 border-2 border-sky-500/30" : "bg-secondary/50 text-muted-foreground hover:text-foreground border-2 border-transparent"}`}>
                <Car className="h-3 w-3" />
                {driveTimeMode ? "Drive Time" : "Drive Time"}
              </button>
            )}
            <button onClick={() => { setSelectedCity("all"); setNearMeActive(false); setUserLocation(null); setDistanceMap({}); setDriveTimeMap({}); setDriveTimeMode(false); }} data-testid="city-pill-all"
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all hover:scale-105 active:scale-100 ${selectedCity === "all" && !nearMeActive ? "bg-primary text-primary-foreground shadow-glow-sm" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
              All Cities
            </button>
            {cities.map(c => (
              <button key={c.city} onClick={() => { setSelectedCity(c.city); setNearMeActive(false); setUserLocation(null); setDistanceMap({}); }} data-testid={`city-pill-${c.city}`}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all hover:scale-105 active:scale-100 ${selectedCity === c.city && !nearMeActive ? "bg-primary text-primary-foreground shadow-glow-sm" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                {c.city} <span className="opacity-60 ml-1">({c.count})</span>
              </button>
            ))}
          </div>

          {/* Expanded Filters Panel */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden" data-testid="filters-panel">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 mt-3 border-t border-border/50">
                  {/* Area */}
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Area</label>
                    <Select value={selectedArea} onValueChange={setSelectedArea}>
                      <SelectTrigger className="h-9 text-xs bg-secondary/50" data-testid="area-filter">
                        <SelectValue placeholder="All Areas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Areas</SelectItem>
                        {areas.map(a => <SelectItem key={a.area} value={a.area}>{a.area} ({a.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Sport */}
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Sport</label>
                    <Select value={selectedSport} onValueChange={setSelectedSport}>
                      <SelectTrigger className="h-9 text-xs bg-secondary/50" data-testid="sport-filter">
                        <SelectValue placeholder="All Sports" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sports</SelectItem>
                        {sports.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Price Range */}
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Price</label>
                    <Select value={priceRange} onValueChange={setPriceRange}>
                      <SelectTrigger className="h-9 text-xs bg-secondary/50" data-testid="price-filter">
                        <SelectValue placeholder="Any Price" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any Price</SelectItem>
                        <SelectItem value="budget">Budget (&le; 1000)</SelectItem>
                        <SelectItem value="mid">Mid (1001-2000)</SelectItem>
                        <SelectItem value="premium">Premium (2000+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Amenity */}
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Amenity</label>
                    <Select value={selectedAmenity} onValueChange={setSelectedAmenity}>
                      <SelectTrigger className="h-9 text-xs bg-secondary/50" data-testid="amenity-filter">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any Amenity</SelectItem>
                        {allAmenities.map(a => <SelectItem key={a.amenity} value={a.amenity}>{a.amenity} ({a.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Sort</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-8 w-[140px] text-xs bg-secondary/50" data-testid="sort-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">Top Rated</SelectItem>
                        <SelectItem value="price_low">Price: Low</SelectItem>
                        <SelectItem value="price_high">Price: High</SelectItem>
                        <SelectItem value="bookings">Most Booked</SelectItem>
                        <SelectItem value="name">Name A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground h-8"
                      data-testid="clear-filters-btn">
                      <X className="h-3 w-3 mr-1" /> Clear all
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Results */}
      <div className={`max-w-7xl mx-auto px-4 py-6 ${!user ? "pt-4" : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground" data-testid="results-count">
            <span className="font-bold text-foreground">{venues.length}</span> venue{venues.length !== 1 ? "s" : ""} found
            {nearMeActive && <> <span className="text-primary font-bold">near you</span> <span className="text-xs">(within 50 km)</span></>}
            {!nearMeActive && selectedCity !== "all" && <> in <span className="text-primary font-bold">{selectedCity}</span></>}
            {selectedArea !== "all" && <>, <span className="text-primary">{selectedArea}</span></>}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="glass-card rounded-xl h-72 animate-pulse" />
            ))}
          </div>
        ) : venues.length === 0 ? (
          <div className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden" data-testid="no-results">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-10 md:p-12 flex flex-col items-center md:items-start justify-center text-center md:text-left">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <p className="font-display text-xl font-black mb-2">No Venues Found</p>
                <p className="text-sm text-muted-foreground font-semibold mb-6">Try adjusting your filters or search a different area.</p>
                <Button
                  className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide h-12 px-8 rounded-xl"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </div>
              <div className="hidden md:block relative min-h-[220px]">
                <img
                  src={EMPTY_STATE_IMG}
                  alt="Basketball player"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-card/70 to-transparent" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {venues.map((venue, idx) => (
                <motion.div key={venue.id} layout initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: idx * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -12, scale: 1.02 }}
                  onClick={() => venue.slug ? navigate(`/venue/${venue.slug}`) : navigate(`/venues/${venue.id}`)}
                  className="rounded-2xl overflow-hidden cursor-pointer group border-2 border-border/50 bg-card/50 backdrop-blur-md hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300"
                  data-testid={`venue-card-${venue.id}`}>
                  {/* Image - Larger with gradient overlay */}
                  <div className="relative h-52 overflow-hidden bg-secondary/30">
                    {venue.images?.[0] ? (
                      <>
                        <img src={mediaUrl(venue.images[0])} alt={venue.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-overlay" />
                      </>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Building2 className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}

                    {/* Distance / Drive-time badge - top left with glow */}
                    {(distanceMap[venue.id] != null || venue.distance_km != null) && (
                      <div className="absolute top-4 left-4 flex gap-1.5" data-testid={`distance-badge-${venue.id}`}>
                        <Badge variant="athletic" className="shadow-glow-primary">
                          <Navigation className="h-3 w-3 mr-1" />
                          {(distanceMap[venue.id] ?? venue.distance_km).toFixed(1)} km
                        </Badge>
                        {driveTimeMap[venue.id]?.duration_minutes != null && (
                          <Badge variant="athletic" className="bg-sky-500/90 shadow-glow-primary">
                            <Clock className="h-3 w-3 mr-1" />
                            {driveTimeMap[venue.id].duration_minutes} min
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Sport badge - top right */}
                    {venue.sports?.[0] && (
                      <div className="absolute top-4 right-4">
                        <Badge variant="sport" className="capitalize">
                          {venue.sports[0].replace("_", " ")}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Info - Athletic Typography */}
                  <div className="p-6">
                    {/* Venue name - athletic typography */}
                    <h3 className="font-display text-xl font-black tracking-athletic text-foreground mb-3 group-hover:text-primary transition-colors duration-300"
                      data-testid={`venue-name-${venue.id}`}>
                      {venue.name}
                    </h3>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">{venue.area || ""}{venue.area ? ", " : ""}{venue.city}</span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      {/* Rating */}
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-display font-bold text-foreground">{venue.rating?.toFixed(1) || "New"}</span>
                        {venue.total_reviews > 0 && (
                          <span className="text-xs text-muted-foreground">({venue.total_reviews})</span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="font-display font-bold text-lg text-primary">
                        ₹{venue.base_price || venue.price_per_hour}
                        <span className="text-xs text-muted-foreground font-normal">/hr</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
