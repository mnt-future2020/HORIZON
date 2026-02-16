import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingAPI, analyticsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { MapPin, Swords, Calendar, Trophy, TrendingUp, Clock, ChevronRight, Star, Search } from "lucide-react";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass-card rounded-lg p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-display font-black text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function BookingCard({ booking, onClick }) {
  const isPast = new Date(booking.date) < new Date(new Date().toDateString());
  return (
    <div onClick={onClick}
      className="glass-card rounded-lg p-4 hover:border-primary/30 transition-all cursor-pointer flex items-center justify-between gap-4"
      data-testid={`booking-card-${booking.id}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm text-foreground truncate">{booking.venue_name}</span>
          <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "pending" ? "secondary" : "destructive"}
            className="text-[10px] shrink-0">
            {booking.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{booking.date}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{booking.start_time}-{booking.end_time}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display font-bold text-foreground">{booking.total_amount?.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</div>
        {booking.payment_mode === "split" && (
          <span className="text-[10px] text-primary font-mono">SPLIT {booking.split_config?.shares_paid}/{booking.split_config?.total_shares}</span>
        )}
      </div>
    </div>
  );
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bookingAPI.list().catch(() => ({ data: [] })),
      analyticsAPI.player().catch(() => ({ data: null })),
    ]).then(([bRes, sRes]) => {
      setBookings(bRes.data || []);
      setStats(sRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const upcoming = bookings.filter(b => b.status !== "cancelled" && new Date(b.date) >= new Date(new Date().toDateString()));
  const past = bookings.filter(b => new Date(b.date) < new Date(new Date().toDateString()));

  const getRatingTier = (r) => {
    if (r >= 2500) return { label: "Diamond", color: "text-cyan-400" };
    if (r >= 2000) return { label: "Gold", color: "text-amber-400" };
    if (r >= 1500) return { label: "Silver", color: "text-slate-300" };
    return { label: "Bronze", color: "text-orange-400" };
  };

  const tier = getRatingTier(user?.skill_rating || 1500);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="player-dashboard">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Dashboard</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">
          Welcome back, <span className="text-primary">{user?.name?.split(" ")[0]}</span>
        </h1>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Trophy} label="Skill Rating" value={<span className={tier.color}>{user?.skill_rating || 1500}</span>} color="bg-primary/10 text-primary" />
        <StatCard icon={TrendingUp} label="Games Played" value={user?.total_games || 0} color="bg-violet-500/10 text-violet-400" />
        <StatCard icon={Star} label="Win Rate" value={user?.total_games ? `${Math.round((user.wins / user.total_games) * 100)}%` : "0%"} color="bg-amber-500/10 text-amber-400" />
        <StatCard icon={Calendar} label="Upcoming" value={upcoming.length} color="bg-sky-500/10 text-sky-400" />
      </div>

      {/* Quick Venue Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="mb-8 glass-card rounded-xl p-4" data-testid="quick-venue-search">
        <form onSubmit={(e) => { e.preventDefault(); navigate(`/venues?q=${encodeURIComponent(searchQ)}`); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search venue, area, or city..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
              className="pl-10 bg-secondary/50 border-border h-10 text-sm" data-testid="dashboard-search-input" />
          </div>
          <Button type="submit" className="bg-primary text-primary-foreground font-bold text-xs h-10 px-5" data-testid="dashboard-search-btn">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { icon: MapPin, label: "Find Venue", desc: "Browse available turfs", to: "/venues", color: "bg-primary/10 text-primary" },
          { icon: Swords, label: "Find Game", desc: "Join or create matches", to: "/matchmaking", color: "bg-violet-500/10 text-violet-400" },
          { icon: Trophy, label: "My Profile", desc: "Stats & match history", to: "/profile", color: "bg-amber-500/10 text-amber-400" },
        ].map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Button variant="ghost" onClick={() => navigate(a.to)} data-testid={`quick-action-${a.label.toLowerCase().replace(/\s/g, "-")}`}
              className="w-full h-auto p-5 justify-start glass-card rounded-lg hover:border-primary/30 transition-all">
              <div className={`p-2 rounded-lg mr-4 ${a.color}`}>
                <a.icon className="h-5 w-5" />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-sm text-foreground">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.desc}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Upcoming Bookings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold">Upcoming Bookings</h2>
          {upcoming.length > 3 && (
            <Button variant="link" className="text-primary text-xs" data-testid="view-all-bookings">View All</Button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <div className="glass-card rounded-lg p-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No upcoming bookings</p>
            <Button size="sm" className="mt-4 bg-primary text-primary-foreground" onClick={() => navigate("/venues")} data-testid="book-now-btn">
              Book a Venue
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 5).map(b => (
              <BookingCard key={b.id} booking={b} onClick={() => {}} />
            ))}
          </div>
        )}
      </div>

      {/* Past Games */}
      {past.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-bold mb-4">Recent Games</h2>
          <div className="space-y-3">
            {past.slice(0, 3).map(b => (
              <BookingCard key={b.id} booking={b} onClick={() => {}} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
