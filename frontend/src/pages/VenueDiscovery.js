import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

/* ─── URL param utils (zero re-renders, no useSearchParams) ──── */
function replaceParams(updates) {
  const url = new URL(window.location);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === false) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}
function getInitParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
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
import Logo from "@/components/Logo";
import { VenueDiscoverySkeleton } from "@/components/SkeletonLoader";

// Athlete action imagery
const DISCOVERY_BANNER = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1920&q=80";
const EMPTY_STATE_IMG = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=600&q=80";


function VenueCard({ venue, idx, onClick, distanceBadge, driveTimeBadge }) {
  const displayPrice = venue.base_price || venue.price_per_hour || 2000;
  const isMultiSport = (venue.sports?.length || 0) > 1;

  return (
    <motion.div layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group cursor-pointer flex flex-col h-full bg-card border border-border/40 hover:border-brand-400 rounded-2xl sm:rounded-[28px] shadow-sm hover:shadow-xl transition-all duration-300 active:scale-[0.98]"
      data-testid={`venue-card-${venue.id}`}>

      {/* Image */}
      <div className="relative aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-secondary/20 p-1 sm:p-2">
        <div className="relative w-full h-full overflow-hidden rounded-lg">
          {venue.images?.[0] ? (
            <img src={mediaUrl(venue.images[0])} alt={venue.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full bg-secondary/30 flex items-center justify-center rounded-lg">
              <Building2 className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Distance / Drive-time badge */}
        {(distanceBadge != null) && (
          <div className="absolute top-4 left-4 flex gap-2">
            <div className="bg-card text-foreground px-2 py-1 sm:px-3 sm:py-1.5 admin-badge flex items-center shadow-md rounded-full">
              <Navigation className="h-3 w-3 mr-1.5 text-brand-600" />
              {distanceBadge.toFixed(1)} km
            </div>
            {driveTimeBadge != null && (
              <div className="bg-brand-600 text-white px-2 py-1 sm:px-3 sm:py-1.5 admin-badge flex items-center shadow-md rounded-full">
                <Clock className="h-3 w-3 mr-1.5" />
                {driveTimeBadge} min
              </div>
            )}
          </div>
        )}

        {/* Top-right: sport badge (single sport) + offer badge */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
          {!isMultiSport && venue.sports?.[0] && (
            <div className="bg-brand-600 text-white px-2 py-1 sm:px-3 sm:py-1.5 admin-badge shadow-md rounded-full">
              {venue.sports[0].replace("_", " ")}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 sm:p-5 flex flex-col flex-grow">
        <div className="flex items-center gap-2 mb-1 sm:mb-2">
          <h3 className="admin-heading text-xs sm:text-base truncate group-hover:text-brand-600 uppercase tracking-tighter transition-colors duration-300"
            data-testid={`venue-name-${venue.id}`}>
            {venue.name}
          </h3>
          {venue.badge === "bookable" && (
            <Badge className="text-[10px] px-2 py-0.5 shrink-0 bg-brand-600 text-white border border-brand-500 font-semibold">Bookable</Badge>
          )}
          {venue.badge === "enquiry" && (
            <Badge className="admin-badge px-3 py-1 rounded-full border-none bg-amber-500/10 text-amber-600">Enquiry</Badge>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 sm:gap-2 admin-section-label mb-2 sm:mb-3">
          <MapPin className="h-3.5 w-3.5 text-brand-500" />
          <span className="truncate">{venue.area || ""}{venue.area ? ", " : ""}{venue.city}</span>
        </div>

        {/* Stats row */}
        <div className="mt-auto flex items-center justify-between pt-2.5 sm:pt-4 border-t border-border/20">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="admin-name">{venue.rating?.toFixed(1) || "NEW"}</span>
            {venue.total_reviews > 0 && (
              <span className="text-[10px] uppercase admin-badge text-muted-foreground ml-1">({venue.total_reviews})</span>
            )}
          </div>
          <div className="text-right">
            <div className="admin-value text-brand-600 flex items-baseline gap-1 text-sm sm:text-base">
              <span className="text-[10px] font-normal text-muted-foreground">from</span>
              ₹{displayPrice}
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">/HR</span>
            </div>
            {venue.has_active_offer && (
              <p className="text-[10px] admin-btn text-rose-500 leading-none mt-0.5">Offers available</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function VenueDiscovery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [venues, setVenues] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [allAmenities, setAllAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  useScrollRestoration("venues", !loading);

  // All filter state initialized from URL (one-time read, no subscription)
  const [searchText, setSearchText] = useState(() => getInitParam("q") || "");
  const [selectedCity, setSelectedCity] = useState(() => getInitParam("city") || "all");
  const [selectedArea, setSelectedArea] = useState(() => getInitParam("area") || "all");
  const [selectedSport, setSelectedSport] = useState(() => getInitParam("sport") || "all");
  const [sortBy, setSortBy] = useState(() => getInitParam("sort") || "rating");
  const [priceRange, setPriceRange] = useState(() => getInitParam("price") || "all");
  const [selectedAmenity, setSelectedAmenity] = useState(() => getInitParam("amenity") || "all");
  // Auto-open filters panel if any panel-level filter was active when navigating back
  const [filtersOpen, setFiltersOpen] = useState(
    () => !!(getInitParam("sort") || getInitParam("price") || getInitParam("amenity") ||
       getInitParam("area") || getInitParam("sport"))
  );
  const [nearMeActive, setNearMeActive] = useState(() => getInitParam("nearme") === "1");
  const [userLocation, setUserLocation] = useState(null);
  const [userLocationName, setUserLocationName] = useState("");
  const [locatingUser, setLocatingUser] = useState(false);
  const [distanceMap, setDistanceMap] = useState({});
  const [driveTimeMap, setDriveTimeMap] = useState({});
  const [driveTimeMode, setDriveTimeMode] = useState(() => getInitParam("drivetime") === "1");
  const isInitialMount = useRef(true);

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

  // Load areas when city changes; skip area reset on initial mount so URL-restored area is kept
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (selectedCity !== "all") {
        venueAPI.areas(selectedCity).then(res => setAreas(res.data)).catch(() => {});
      }
      return;
    }
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
      setUserLocationName("");
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
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setNearMeActive(true);
        setLocatingUser(false);
        setSelectedCity("all");
        setSelectedArea("all");
        // Reverse geocode to get location name
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`)
          .then(r => r.json())
          .then(data => {
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.state_district || addr.state || "";
            // Pick most granular area name, skip fields that match the city name
            const areaCandidates = [addr.neighbourhood, addr.suburb, addr.quarter, addr.residential, addr.road, addr.village, addr.city_district, addr.town];
            const area = areaCandidates.find(a => a && a !== city) || "";
            setUserLocationName(area ? (city && city !== area ? `${area}, ${city}` : area) : city);
          })
          .catch(() => {});
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

  // Immediate URL sync — uses replaceParams (native history.replaceState),
  // NOT setSearchParams, so no React Router subscription = zero re-render cascade.
  useEffect(() => {
    replaceParams({
      q: searchText || null,
      city: selectedCity !== "all" ? selectedCity : null,
      area: selectedArea !== "all" ? selectedArea : null,
      sport: selectedSport !== "all" ? selectedSport : null,
      nearme: nearMeActive ? "1" : null,
      sort: sortBy !== "rating" ? sortBy : null,
      price: priceRange !== "all" ? priceRange : null,
      amenity: selectedAmenity !== "all" ? selectedAmenity : null,
      drivetime: driveTimeMode ? "1" : null,
    });
  }, [searchText, selectedCity, selectedArea, selectedSport, nearMeActive, sortBy, priceRange, selectedAmenity, driveTimeMode]);

  // Auto-activate Near Me from URL param
  useEffect(() => {
    if (getInitParam("nearme") === "1" && !nearMeActive && !userLocation) {
      handleNearMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFilterCount = [
    selectedCity !== "all", selectedArea !== "all", selectedSport !== "all",
    priceRange !== "all", selectedAmenity !== "all", nearMeActive
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchText(""); setSelectedCity("all"); setSelectedArea("all");
    setSelectedSport("all"); setSortBy("rating"); setPriceRange("all");
    setSelectedAmenity("all"); setNearMeActive(false); setUserLocation(null); setUserLocationName(""); setDistanceMap({}); setDriveTimeMap({}); setDriveTimeMode(false);
    replaceParams({ q: null, city: null, area: null, sport: null, nearme: null, sort: null, price: null, amenity: null, drivetime: null });
  };

  const sports = ["football", "cricket", "badminton", "basketball", "tennis", "table_tennis"];

  return (
    <div className="min-h-screen bg-secondary/20 text-foreground selection:bg-brand-600 selection:text-white" data-testid="venue-discovery-page">
      {/* Top bar for non-logged-in users */}
      {!user && (
        <nav className="fixed top-0 w-full z-40 h-16 flex items-center justify-between px-4 sm:px-6 md:px-12 bg-card/80 backdrop-blur-xl border-b border-border/20 shadow-sm">
          <Link to="/" className="text-brand-600"><Logo size="md" /></Link>
          <div className="flex items-center gap-6">
            <Button variant="link" size="sm" onClick={() => navigate("/auth")} className="admin-btn text-muted-foreground hover:text-brand-600">Log in</Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="bg-brand-600 text-white rounded-full h-10 px-6 admin-btn hover:bg-brand-500 shadow-lg shadow-brand-600/20">Get Started</Button>
          </div>
        </nav>
      )}

      {/* Spacer between navbar and search header */}
      {!user && <div className="h-16" />}
      <div className="h-1 sm:h-4 bg-secondary/20" />

      {/* Search Hero */}
      <div className="border-b border-border/40 bg-card sticky z-30 shadow-sm top-16">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex h-9 w-9 rounded-xl bg-brand-600/10 items-center justify-center">
                <MapPin className="h-4 w-4 text-brand-600" />
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-black text-foreground tracking-tight">Discover Venues</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Find & book sports facilities near you</p>
              </div>
            </div>
            {!loading && venues.length > 0 && (
              <span className="text-[11px] sm:text-xs font-bold text-muted-foreground bg-secondary/40 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
                {venues.length} venue{venues.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex gap-2 sm:gap-4 items-center" data-testid="search-bar">
            <div className="relative flex-1">
              <Search className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <Input
                placeholder="Search venue, area, city..."
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                className="pl-10 sm:pl-16 pr-8 sm:pr-12 bg-secondary/30 border-border/30 rounded-2xl h-10 sm:h-13 text-xs sm:text-base font-medium focus-visible:ring-0 focus-visible:border-brand-500 placeholder:text-muted-foreground/60 transition-all shadow-sm"
                name="venue-search"
                autoComplete="off"
                data-testid="search-input"
              />
              {searchText && (
                <button onClick={() => setSearchText("")} aria-label="Clear search" className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded">
                  <X className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" aria-label={filtersOpen ? "Close filters" : "Open filters"} className={`h-10 w-10 sm:h-13 sm:w-13 shrink-0 relative rounded-xl sm:rounded-2xl border transition-all shadow-sm ${filtersOpen ? "border-brand-600 bg-brand-600 text-white" : "border-border/50 bg-card text-foreground hover:bg-card hover:text-brand-600 hover:border-brand-400"}`}
              onClick={() => setFiltersOpen(!filtersOpen)} data-testid="filters-toggle">
              <SlidersHorizontal className="h-5 w-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-brand-600 text-white text-[10px] w-6 h-6 flex items-center justify-center admin-badge rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Quick City Pills + Near Me */}
          <div className="flex gap-1.5 sm:gap-3 mt-2 sm:mt-3 overflow-x-auto pb-1.5 sm:pb-2 scrollbar-hide" data-testid="city-pills">
            <button onClick={handleNearMe} data-testid="near-me-btn"
              disabled={locatingUser}
              className={`px-2.5 sm:px-5 py-1.5 sm:py-2.5 min-h-[36px] sm:min-h-[40px] admin-btn text-[10px] sm:text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 border rounded-full ${nearMeActive ? "bg-brand-600 text-white border-brand-600" : "bg-card text-muted-foreground border-border/40 hover:border-brand-500 hover:text-brand-600"}`}>
              {locatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {locatingUser ? "Locating..." : nearMeActive && userLocationName ? userLocationName : "Near Me"}
            </button>
            {nearMeActive && (
              <button onClick={() => setDriveTimeMode(!driveTimeMode)} data-testid="drive-time-toggle"
                className={`px-2.5 sm:px-5 py-1.5 sm:py-2.5 min-h-[36px] sm:min-h-[40px] admin-btn text-[10px] sm:text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 border rounded-full ${driveTimeMode ? "bg-brand-600/10 text-brand-600 border-brand-600" : "bg-transparent text-muted-foreground border-transparent hover:text-brand-600"}`}>
                <Car className="h-4 w-4" />
                Drive Time
              </button>
            )}
            <button onClick={() => { setSelectedCity("all"); setNearMeActive(false); setUserLocation(null); setUserLocationName(""); setDistanceMap({}); setDriveTimeMap({}); setDriveTimeMode(false); }} data-testid="city-pill-all"
              className={`px-2.5 sm:px-5 py-1.5 sm:py-2.5 min-h-[36px] sm:min-h-[40px] admin-btn text-[10px] sm:text-[11px] whitespace-nowrap transition-all border rounded-full ${selectedCity === "all" && !nearMeActive ? "bg-brand-600 text-white border-brand-600" : "bg-card text-muted-foreground border-border/40 hover:border-brand-500 hover:text-brand-600"}`}>
              All Cities
            </button>
            {cities.map(c => (
              <button key={c.city} onClick={() => { setSelectedCity(c.city); setNearMeActive(false); setUserLocation(null); setUserLocationName(""); setDistanceMap({}); }} data-testid={`city-pill-${c.city}`}
                className={`px-2.5 sm:px-5 py-1.5 sm:py-2.5 min-h-[36px] sm:min-h-[40px] admin-btn text-[10px] sm:text-[11px] whitespace-nowrap transition-all border rounded-full ${selectedCity === c.city && !nearMeActive ? "bg-brand-600 text-white border-brand-600" : "bg-card text-muted-foreground border-border/40 hover:border-brand-500 hover:text-brand-600"}`}>
                {c.city} <span className="opacity-50 ml-1">({c.count})</span>
              </button>
            ))}
          </div>

          {/* Expanded Filters Panel */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden" data-testid="filters-panel">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-border/40">
                  {/* Area */}
                  <div>
                    <label className="admin-section-label mb-2 block">Area</label>
                    <Select value={selectedArea} onValueChange={setSelectedArea}>
                      <SelectTrigger className="h-12 rounded-xl bg-secondary/20 border-border/40 admin-btn" data-testid="area-filter">
                        <SelectValue placeholder="All Areas" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 shadow-md">
                        <SelectItem value="all" className="admin-btn">All Areas</SelectItem>
                        {areas.map(a => <SelectItem key={a.area} value={a.area} className="admin-btn">{a.area} ({a.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Sport */}
                  <div>
                    <label className="admin-section-label mb-2 block">Sport</label>
                    <Select value={selectedSport} onValueChange={setSelectedSport}>
                      <SelectTrigger className="h-12 rounded-xl bg-secondary/20 border-border/40 admin-btn" data-testid="sport-filter">
                        <SelectValue placeholder="All Sports" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 shadow-md">
                        <SelectItem value="all" className="admin-btn">All Sports</SelectItem>
                        {sports.map(s => <SelectItem key={s} value={s} className="capitalize admin-btn">{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Price Range */}
                  <div>
                    <label className="admin-section-label mb-2 block">Price</label>
                    <Select value={priceRange} onValueChange={setPriceRange}>
                      <SelectTrigger className="h-12 rounded-xl bg-secondary/20 border-border/40 admin-btn" data-testid="price-filter">
                        <SelectValue placeholder="Any Price" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 shadow-md">
                        <SelectItem value="all" className="admin-btn">Any Price</SelectItem>
                        <SelectItem value="budget" className="admin-btn">Budget (&le; 1000)</SelectItem>
                        <SelectItem value="mid" className="admin-btn">Mid (1001-2000)</SelectItem>
                        <SelectItem value="premium" className="admin-btn">Premium (2000+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Amenity */}
                  <div>
                    <label className="admin-section-label mb-2 block">Amenity</label>
                    <Select value={selectedAmenity} onValueChange={setSelectedAmenity}>
                      <SelectTrigger className="h-12 rounded-xl bg-secondary/20 border-border/40 admin-btn" data-testid="amenity-filter">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 shadow-md max-h-60">
                        <SelectItem value="all" className="admin-btn">Any Amenity</SelectItem>
                        {allAmenities.map(a => <SelectItem key={a.amenity} value={a.amenity} className="admin-btn">{a.amenity} ({a.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 pt-6 border-t border-border/40 gap-4">
                  <div className="flex items-center gap-4">
                    <label className="admin-section-label">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-10 w-full sm:w-[160px] rounded-xl bg-secondary/20 border-border/40 admin-btn" data-testid="sort-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 shadow-md">
                        <SelectItem value="rating" className="admin-btn">Top Rated</SelectItem>
                        <SelectItem value="price_low" className="admin-btn">Price: Low</SelectItem>
                        <SelectItem value="price_high" className="admin-btn">Price: High</SelectItem>
                        <SelectItem value="bookings" className="admin-btn">Most Booked</SelectItem>
                        <SelectItem value="name" className="admin-btn">Name A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="admin-btn text-muted-foreground hover:text-brand-600 hover:bg-brand-600/10 rounded-lg h-10 px-4"
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
      <div className={`max-w-[90rem] mx-auto px-3 sm:px-6 py-3 sm:py-8 ${!user ? "pt-3 sm:pt-8" : ""}`}>
        {!loading && venues.length > 0 && (nearMeActive || selectedCity !== "all" || selectedArea !== "all") && (
          <p className="admin-label mb-4 sm:mb-6" data-testid="results-count">
            Showing results
            {nearMeActive && <> <span className="text-brand-600 font-black">near you</span>{userLocationName && <> in <span className="text-foreground font-black">{userLocationName}</span></>}</>}
            {!nearMeActive && selectedCity !== "all" && <> in <span className="text-foreground font-black">{selectedCity}</span></>}
            {selectedArea !== "all" && <>, <span className="text-foreground">{selectedArea}</span></>}
          </p>
        )}

        {loading ? (
          <VenueDiscoverySkeleton />
        ) : venues.length === 0 ? (
          <div className="border border-border/40 bg-card overflow-hidden rounded-2xl sm:rounded-[28px] shadow-sm" data-testid="no-results">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-5 sm:p-10 md:p-24 flex flex-col items-center md:items-start justify-center text-center md:text-left">
                <div className="w-16 h-16 bg-secondary/30 rounded-2xl flex items-center justify-center mb-6">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="admin-page-title mb-4">Zero Results</p>
                <p className="admin-label mb-8">Adjust your filters or broaden your search criteria to discover facilities.</p>
                <Button
                  className="bg-brand-600 text-white hover:bg-brand-600 rounded-xl h-12 sm:h-14 w-full sm:w-auto px-8 admin-btn transition-all"
                  onClick={clearFilters}
                >
                  Reset Parameters
                </Button>
              </div>
              <div className="hidden md:block relative min-h-[300px]">
                <img
                  src={EMPTY_STATE_IMG}
                  alt="Empty court"
                  className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <AnimatePresence mode="popLayout">
              {venues.map((venue, idx) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  idx={idx}
                  onClick={() => venue.slug ? navigate(`/venue/${venue.slug}`) : navigate(`/venues/${venue.id}`)}
                  distanceBadge={distanceMap[venue.id] ?? venue.distance_km ?? null}
                  driveTimeBadge={driveTimeMap[venue.id]?.duration_minutes ?? null}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
