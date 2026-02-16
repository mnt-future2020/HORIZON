import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Star, IndianRupee, SlidersHorizontal, X, ChevronRight, Users, Zap, Building2, ArrowUpDown, Navigation, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function VenueDiscovery() {
  const navigate = useNavigate();
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
      } catch (err) { console.error(err); }
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
        const res = await venueAPI.nearby(userLocation.lat, userLocation.lng, 50);
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
  }, [searchText, selectedCity, selectedArea, selectedSport, sortBy, priceRange, selectedAmenity, nearMeActive, userLocation]);

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
    setSelectedAmenity("all"); setNearMeActive(false); setUserLocation(null); setDistanceMap({});
  };

  const sports = ["football", "cricket", "badminton", "basketball", "tennis", "table_tennis"];

  return (
    <div className="min-h-screen bg-background" data-testid="venue-discovery-page">
      {/* Search Hero */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Main Search Bar */}
          <div className="flex gap-2 items-center" data-testid="search-bar">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search venue, area, city..."
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                className="pl-10 bg-secondary/50 border-border h-11 text-sm"
                data-testid="search-input"
              />
              {searchText && (
                <button onClick={() => setSearchText("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 relative"
              onClick={() => setFiltersOpen(!filtersOpen)} data-testid="filters-toggle">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Quick City Pills + Near Me */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide" data-testid="city-pills">
            <button onClick={handleNearMe} data-testid="near-me-btn"
              disabled={locatingUser}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${nearMeActive ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-primary/30"}`}>
              {locatingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
              {locatingUser ? "Locating..." : nearMeActive ? "Near Me" : "Near Me"}
            </button>
            <button onClick={() => { setSelectedCity("all"); setNearMeActive(false); setUserLocation(null); setDistanceMap({}); }} data-testid="city-pill-all"
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCity === "all" && !nearMeActive ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
              All Cities
            </button>
            {cities.map(c => (
              <button key={c.city} onClick={() => setSelectedCity(c.city)} data-testid={`city-pill-${c.city}`}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCity === c.city ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                {c.city} <span className="opacity-60 ml-0.5">({c.count})</span>
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
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground" data-testid="results-count">
            <span className="font-bold text-foreground">{venues.length}</span> venue{venues.length !== 1 ? "s" : ""} found
            {selectedCity !== "all" && <> in <span className="text-primary font-bold">{selectedCity}</span></>}
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
          <div className="text-center py-16" data-testid="no-results">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-bold text-muted-foreground">No venues found</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Try adjusting your filters or search term</p>
            <Button variant="outline" className="mt-4 text-xs" onClick={clearFilters}>Clear filters</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {venues.map((venue, idx) => (
                <motion.div key={venue.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate(`/venues/${venue.id}`)}
                  className="glass-card rounded-xl overflow-hidden cursor-pointer group hover:border-primary/30 transition-all"
                  data-testid={`venue-card-${venue.id}`}>
                  {/* Image */}
                  <div className="relative h-40 overflow-hidden bg-secondary/30">
                    {venue.images?.[0] ? (
                      <img src={venue.images[0]} alt={venue.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="h-12 w-12 text-muted-foreground/20" />
                      </div>
                    )}
                    {/* Overlay badges */}
                    <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                      {venue.sports?.map(s => (
                        <Badge key={s} className="text-[10px] bg-background/80 backdrop-blur-sm border-none text-foreground capitalize">
                          {s.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-background/80 backdrop-blur-sm border-none text-primary text-xs font-display font-black">
                        {"\u20B9"}{venue.base_price}
                      </Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors"
                          data-testid={`venue-name-${venue.id}`}>
                          {venue.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{venue.area || ""}{venue.area ? ", " : ""}{venue.city}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 bg-primary/10 px-2 py-1 rounded-md">
                        <Star className="h-3 w-3 text-primary fill-primary" />
                        <span className="text-xs font-bold text-primary">{venue.rating?.toFixed(1) || "N/A"}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{venue.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Zap className="h-3 w-3" />{venue.turfs} turf{venue.turfs > 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{venue.total_bookings || 0} bookings</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>

                    {/* Amenity pills */}
                    {venue.amenities?.length > 0 && (
                      <div className="flex gap-1 mt-2.5 flex-wrap">
                        {venue.amenities.slice(0, 3).map(a => (
                          <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary/80 text-muted-foreground">{a}</span>
                        ))}
                        {venue.amenities.length > 3 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary/80 text-muted-foreground">+{venue.amenities.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
