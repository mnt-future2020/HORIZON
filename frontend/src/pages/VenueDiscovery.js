import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Search, MapPin, Star, Clock, IndianRupee } from "lucide-react";

const SPORTS = ["all", "football", "cricket", "badminton", "table_tennis", "tennis", "basketball"];

function VenueCard({ venue, onClick }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick} data-testid={`venue-card-${venue.id}`}
      className="glass-card rounded-lg overflow-hidden hover:border-primary/30 transition-all cursor-pointer group">
      <div className="h-40 overflow-hidden relative">
        <img src={venue.images?.[0] || "https://images.unsplash.com/photo-1750716413756-b66624b64ce4?w=600&q=80"}
          alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 right-3 flex gap-1.5">
          {venue.sports?.map(s => (
            <Badge key={s} className="bg-background/80 backdrop-blur text-foreground text-[10px] border-0">{s}</Badge>
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-display font-bold text-foreground">{venue.name}</h3>
          <div className="flex items-center gap-1 text-amber-400 shrink-0">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="text-xs font-bold">{venue.rating?.toFixed(1)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{venue.address}, {venue.city}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-primary font-display font-bold">
            <IndianRupee className="h-3.5 w-3.5" />
            <span>{venue.base_price?.toLocaleString()}/hr</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{venue.opening_hour}:00-{venue.closing_hour}:00</span>
          </div>
        </div>
        {venue.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {venue.amenities.slice(0, 3).map(a => (
              <Badge key={a} variant="secondary" className="text-[10px] bg-secondary/50">{a}</Badge>
            ))}
            {venue.amenities.length > 3 && (
              <Badge variant="secondary" className="text-[10px] bg-secondary/50">+{venue.amenities.length - 3}</Badge>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function VenueDiscovery() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (sport && sport !== "all") params.sport = sport;
    setLoading(true);
    venueAPI.list(params)
      .then(res => setVenues(res.data || []))
      .catch(() => setVenues([]))
      .finally(() => setLoading(false));
  }, [search, sport]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="venue-discovery">
      <div className="mb-8">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Explore</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Find Your <span className="text-primary">Arena</span></h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search venues..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-background border-border h-11"
            data-testid="venue-search-input" />
        </div>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger className="w-full sm:w-44 bg-background border-border h-11" data-testid="sport-filter-select">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
            {SPORTS.map(s => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Sports" : s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : venues.length === 0 ? (
        <div className="text-center py-20">
          <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No venues found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((v, i) => (
            <VenueCard key={v.id} venue={v} onClick={() => navigate(`/venues/${v.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
