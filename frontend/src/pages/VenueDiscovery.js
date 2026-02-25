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
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white" data-testid="venue-discovery-page">
      {/* Top bar for non-logged-in users */}
      {!user && (
        <nav className="fixed top-0 w-full z-40 h-16 flex items-center justify-between px-6 md:px-12 bg-white border-b border-zinc-100">
          <Link to="/" className="font-display font-black text-2xl tracking-tighter uppercase text-zinc-900">Lobbi</Link>
          <div className="flex items-center gap-6">
            <Button variant="link" size="sm" onClick={() => navigate("/auth")} className="text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900">Log in</Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="bg-zinc-900 text-white rounded-none h-10 px-6 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-800">Get Started</Button>
          </div>
        </nav>
      )}

      {/* Search Hero - Editorial Style */}
      <div className={`border-b border-zinc-100 bg-white sticky z-30 ${user ? "top-16" : "top-16"}`}>
        <div className="max-w-[90rem] mx-auto px-6 py-8">
          {/* Main Search Bar - Minimalist Heavy */}
          <div className="flex gap-4 items-center" data-testid="search-bar">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                placeholder="Search venue, area, city..."
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                className="pl-16 pr-12 bg-zinc-50 border-2 border-zinc-200 rounded-none h-16 text-lg font-bold focus-visible:ring-0 focus-visible:border-zinc-900 placeholder:text-zinc-400 placeholder:font-medium transition-all"
                data-testid="search-input"
              />
              {searchText && (
                <button onClick={() => setSearchText("")} className="absolute right-6 top-1/2 -translate-y-1/2">
                  <X className="h-5 w-5 text-zinc-400 hover:text-zinc-900 transition-colors" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" className={`h-16 w-16 shrink-0 relative rounded-none border-2 transition-all ${filtersOpen ? "border-zinc-900 bg-zinc-100 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400"}`}
              onClick={() => setFiltersOpen(!filtersOpen)} data-testid="filters-toggle">
              <SlidersHorizontal className="h-5 w-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-zinc-900 text-white text-[10px] w-6 h-6 flex items-center justify-center font-black">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Quick City Pills + Near Me - Minimalist Style */}
          <div className="flex gap-3 mt-6 overflow-x-auto pb-2 scrollbar-hide" data-testid="city-pills">
            <button onClick={handleNearMe} data-testid="near-me-btn"
              disabled={locatingUser}
              className={`px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all flex items-center gap-2 border-2 ${nearMeActive ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900"}`}>
              {locatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {locatingUser ? "Locating..." : "Near Me"}
            </button>
            {nearMeActive && (
              <button onClick={() => setDriveTimeMode(!driveTimeMode)} data-testid="drive-time-toggle"
                className={`px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all flex items-center gap-2 border-2 ${driveTimeMode ? "bg-zinc-100 text-zinc-900 border-zinc-900" : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-900"}`}>
                <Car className="h-4 w-4" />
                Drive Time
              </button>
            )}
            <button onClick={() => { setSelectedCity("all"); setNearMeActive(false); setUserLocation(null); setDistanceMap({}); setDriveTimeMap({}); setDriveTimeMode(false); }} data-testid="city-pill-all"
              className={`px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all border-2 ${selectedCity === "all" && !nearMeActive ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900"}`}>
              All Cities
            </button>
            {cities.map(c => (
              <button key={c.city} onClick={() => { setSelectedCity(c.city); setNearMeActive(false); setUserLocation(null); setDistanceMap({}); }} data-testid={`city-pill-${c.city}`}
                className={`px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all border-2 ${selectedCity === c.city && !nearMeActive ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900"}`}>
                {c.city} <span className="opacity-50 ml-1">({c.count})</span>
              </button>
            ))}
          </div>

          {/* Expanded Filters Panel */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden" data-testid="filters-panel">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 mt-6 border-t border-zinc-200">
                  {/* Area */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">Area</label>
                    <Select value={selectedArea} onValueChange={setSelectedArea}>
                      <SelectTrigger className="h-12 text-sm font-bold bg-zinc-50 border-2 border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-900" data-testid="area-filter">
                        <SelectValue placeholder="All Areas" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-zinc-200">
                        <SelectItem value="all" className="font-bold">All Areas</SelectItem>
                        {areas.map(a => <SelectItem key={a.area} value={a.area} className="font-bold">{a.area} ({a.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Sport */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">Sport</label>
                    <Select value={selectedSport} onValueChange={setSelectedSport}>
                      <SelectTrigger className="h-12 text-sm font-bold bg-zinc-50 border-2 border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-900" data-testid="sport-filter">
                        <SelectValue placeholder="All Sports" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-zinc-200">
                        <SelectItem value="all" className="font-bold">All Sports</SelectItem>
                        {sports.map(s => <SelectItem key={s} value={s} className="capitalize font-bold">{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Price Range */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">Price</label>
                    <Select value={priceRange} onValueChange={setPriceRange}>
                      <SelectTrigger className="h-12 text-sm font-bold bg-zinc-50 border-2 border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-900" data-testid="price-filter">
                        <SelectValue placeholder="Any Price" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-zinc-200">
                        <SelectItem value="all" className="font-bold">Any Price</SelectItem>
                        <SelectItem value="budget" className="font-bold">Budget (≤ 1000)</SelectItem>
                        <SelectItem value="mid" className="font-bold">Mid (1001-2000)</SelectItem>
                        <SelectItem value="premium" className="font-bold">Premium (2000+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Amenity */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">Amenity</label>
                    <Select value={selectedAmenity} onValueChange={setSelectedAmenity}>
                      <SelectTrigger className="h-12 text-sm font-bold bg-zinc-50 border-2 border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-900" data-testid="amenity-filter">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-zinc-200">
                        <SelectItem value="all" className="font-bold">Any Amenity</SelectItem>
                        {allAmenities.map(a => <SelectItem key={a.amenity} value={a.amenity} className="font-bold">{a.amenity} ({a.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 pt-6 border-t border-zinc-200 gap-4">
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-10 w-[160px] text-xs font-bold bg-white border-2 border-zinc-200 rounded-none focus:ring-0 focus:border-zinc-900" data-testid="sort-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-zinc-200">
                        <SelectItem value="rating" className="font-bold uppercase tracking-widest text-[10px]">Top Rated</SelectItem>
                        <SelectItem value="price_low" className="font-bold uppercase tracking-widest text-[10px]">Price: Low</SelectItem>
                        <SelectItem value="price_high" className="font-bold uppercase tracking-widest text-[10px]">Price: High</SelectItem>
                        <SelectItem value="bookings" className="font-bold uppercase tracking-widest text-[10px]">Most Booked</SelectItem>
                        <SelectItem value="name" className="font-bold uppercase tracking-widest text-[10px]">Name A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-none h-10 px-4"
                      data-testid="clear-filters-btn">
                      <X className="h-3 w-3 mr-2" /> Clear Fields
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Results */}
      <div className={`max-w-[90rem] mx-auto px-6 py-12 ${!user ? "pt-12" : ""}`}>
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest" data-testid="results-count">
            <span className="font-black text-zinc-900">{venues.length}</span> venue{venues.length !== 1 ? "s" : ""} found
            {nearMeActive && <> <span className="text-zinc-900 font-black">near you</span> <span className="text-[10px]">(within 50 km)</span></>}
            {!nearMeActive && selectedCity !== "all" && <> in <span className="text-zinc-900 font-black">{selectedCity}</span></>}
            {selectedArea !== "all" && <>, <span className="text-zinc-900">{selectedArea}</span></>}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-zinc-100 rounded-none h-80 animate-pulse border border-zinc-200" />
            ))}
          </div>
        ) : venues.length === 0 ? (
          <div className="border border-zinc-200 bg-zinc-50 overflow-hidden" data-testid="no-results">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-12 md:p-24 flex flex-col items-center md:items-start justify-center text-center md:text-left">
                <div className="w-16 h-16 bg-zinc-200 flex items-center justify-center mb-6">
                  <Search className="h-6 w-6 text-zinc-400" />
                </div>
                <p className="font-display text-4xl font-black mb-4 tracking-tighter uppercase text-zinc-900">Zero Results</p>
                <p className="text-sm text-zinc-500 font-bold mb-8 uppercase tracking-widest leading-relaxed">Adjust your filters or broaden your search criteria to discover facilities.</p>
                <Button
                  className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-none h-14 px-8 font-black uppercase tracking-[0.1em] text-sm transition-all"
                  onClick={clearFilters}
                >
                  Reset Parameters
                </Button>
              </div>
              <div className="hidden md:block relative min-h-[300px]">
                <img
                  src={EMPTY_STATE_IMG}
                  alt="Empty court"
                  className="absolute inset-0 w-full h-full object-cover filter grayscale contrast-125 opacity-20"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {venues.map((venue, idx) => (
                <motion.div key={venue.id} layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => venue.slug ? navigate(`/venue/${venue.slug}`) : navigate(`/venues/${venue.id}`)}
                  className="group cursor-pointer flex flex-col h-full bg-white border border-zinc-200 hover:border-zinc-900 transition-colors duration-300"
                  data-testid={`venue-card-${venue.id}`}>
                  {/* Image - Strict framing */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 p-2">
                    <div className="relative w-full h-full overflow-hidden">
                      {venue.images?.[0] ? (
                        <img src={mediaUrl(venue.images[0])} alt={venue.name}
                          className="w-full h-full object-cover filter contrast-125 transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full bg-zinc-200 flex items-center justify-center">
                          <Building2 className="h-10 w-10 text-zinc-400" />
                        </div>
                      )}
                    </div>

                    {/* Distance / Drive-time badge - stark absolute */}
                    {(distanceMap[venue.id] != null || venue.distance_km != null) && (
                      <div className="absolute top-4 left-4 flex gap-2" data-testid={`distance-badge-${venue.id}`}>
                        <div className="bg-white text-zinc-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center shadow-md">
                          <Navigation className="h-3 w-3 mr-1.5" />
                          {(distanceMap[venue.id] ?? venue.distance_km).toFixed(1)} km
                        </div>
                        {driveTimeMap[venue.id]?.duration_minutes != null && (
                          <div className="bg-zinc-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center shadow-md">
                            <Clock className="h-3 w-3 mr-1.5" />
                            {driveTimeMap[venue.id].duration_minutes} min
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sport badge - top right absolute */}
                    {venue.sports?.[0] && (
                      <div className="absolute top-4 right-4">
                        <div className="bg-zinc-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-md">
                          {venue.sports[0].replace("_", " ")}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info - Editorial Typography */}
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-display text-2xl font-black tracking-tighter uppercase text-zinc-900 truncate group-hover:text-zinc-500 transition-colors duration-300"
                        data-testid={`venue-name-${venue.id}`}>
                        {venue.name}
                      </h3>
                      <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${venue.badge === "bookable" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                        {venue.badge === "bookable" ? "Bookable" : "Enquiry"}
                      </Badge>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-6">
                      <MapPin className="h-4 w-4 text-zinc-900" />
                      <span className="truncate">{venue.area || ""}{venue.area ? ", " : ""}{venue.city}</span>
                    </div>

                    {/* Stats row - strict border */}
                    <div className="mt-auto flex items-center justify-between pt-6 border-t border-zinc-100">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-zinc-900 text-zinc-900" />
                        <span className="font-black text-sm text-zinc-900">{venue.rating?.toFixed(1) || "NEW"}</span>
                        {venue.total_reviews > 0 && (
                          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest ml-1">({venue.total_reviews})</span>
                        )}
                      </div>

                      <div className="font-black text-xl text-zinc-900">
                        ₹{venue.base_price || venue.price_per_hour}
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest ml-1">/HR</span>
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
