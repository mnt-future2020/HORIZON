import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingAPI, analyticsAPI, waitlistAPI, coachingAPI, recommendationAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AthleticStatCard } from "@/components/ui/stat-card";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { MapPin, Swords, Calendar, Trophy, TrendingUp, Clock, ChevronRight, Star, Search, Play, ListOrdered, X, User, Loader2, Dumbbell, BarChart3, Target, QrCode, Zap, Flame, Building2 } from "lucide-react";

// Brand ambassador athlete images
const PLAYER_HERO = "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80";
const MOTIVATION_IMG = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=600&q=80";

function BookingCard({ booking, onClick, delay = 0, onGetQR }) {
  const isPast = new Date(booking.date) < new Date(new Date().toDateString());
  const isUpcoming = !isPast && booking.status === "confirmed";
  const badgeVariant = booking.status === "confirmed" ? "athletic" : booking.status === "pending" ? "secondary" : "destructive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 hover:border-primary/50 hover:scale-[1.02] hover:shadow-glow-sm transition-all duration-300 cursor-pointer group"
      data-testid={`booking-card-${booking.id}`}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="font-display text-lg font-black text-foreground truncate group-hover:text-primary transition-colors">
          {booking.venue_name}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {booking.checked_in && (
            <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">Checked In</Badge>
          )}
          <Badge variant={badgeVariant} className="uppercase">
            {booking.status}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground font-semibold mb-4">
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {booking.date}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-400" />
          {booking.start_time}-{booking.end_time}
        </span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <div className="font-display text-xl font-black text-primary">
          {booking.total_amount?.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
        </div>
        <div className="flex items-center gap-2">
          {booking.payment_mode === "split" && (
            <Badge variant="sport" className="text-xs">
              SPLIT {booking.split_config?.shares_paid}/{booking.split_config?.total_shares}
            </Badge>
          )}
          {isUpcoming && !booking.checked_in && onGetQR && (
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-7 font-bold"
              onClick={(e) => { e.stopPropagation(); onGetQR(booking.id); }}
              data-testid={`qr-btn-${booking.id}`}
            >
              <QrCode className="h-3 w-3 mr-1" /> Check-in QR
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [leavingWaitlist, setLeavingWaitlist] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [venueRecs, setVenueRecs] = useState([]);
  const [engagementScore, setEngagementScore] = useState(null);

  useEffect(() => {
    Promise.all([
      bookingAPI.list().catch(() => ({ data: [] })),
      analyticsAPI.player().catch(() => ({ data: null })),
      waitlistAPI.myWaitlist().catch(() => ({ data: [] })),
      recommendationAPI.venues(6).catch(() => ({ data: { venues: [] } })),
      recommendationAPI.engagementScore().catch(() => ({ data: null })),
    ]).then(([bRes, sRes, wRes, vRecRes, engRes]) => {
      setBookings(bRes.data || []);
      setStats(sRes.data);
      setWaitlistEntries(wRes.data || []);
      setVenueRecs(vRecRes.data?.venues || []);
      setEngagementScore(engRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleLeaveWaitlist = async (entryId) => {
    setLeavingWaitlist(entryId);
    try {
      await waitlistAPI.leave(entryId);
      setWaitlistEntries(prev => prev.filter(e => e.id !== entryId));
    } catch {
      // silently fail
    } finally {
      setLeavingWaitlist(null);
    }
  };

  const handleGetQR = async (bookingId) => {
    setQrLoading(true);
    try {
      const res = await coachingAPI.getCheckinQR(bookingId);
      setQrData(res.data);
    } catch { /* ignore */ }
    setQrLoading(false);
  };

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
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-20 md:pb-6" data-testid="player-dashboard">
      {/* Welcome Hero - Split Layout with Athlete Image */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden"
      >
        <div className="grid md:grid-cols-3 gap-0">
          {/* Text Content */}
          <div className="md:col-span-2 p-8 md:p-10 flex flex-col justify-center">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dashboard</span>
            <h1 className="font-display text-display-md md:text-display-lg font-black tracking-athletic mt-2">
              Welcome back, <span className="bg-gradient-athletic bg-clip-text text-transparent">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="text-muted-foreground font-semibold mt-3 text-base">
              Ready to play? Book your next game and dominate the field.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <Button
                onClick={() => navigate("/venues")}
                className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide h-12 px-6 rounded-xl transition-all duration-300"
              >
                <Play className="h-4 w-4 mr-2 fill-white" /> Find a Game
              </Button>
              <Button
                variant="athletic-outline"
                onClick={() => navigate("/player-card/me")}
                className="h-12 px-6 rounded-xl font-black uppercase tracking-wide"
              >
                <User className="h-4 w-4 mr-2" /> My Lobbian Card
              </Button>
            </div>
          </div>
          {/* Athlete Image */}
          <div className="hidden md:block relative h-full min-h-[220px]">
            <img
              src={PLAYER_HERO}
              alt="Athletes celebrating"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-card/80 to-transparent" />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid - Athletic Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <AthleticStatCard
          icon={Trophy}
          label="Skill Rating"
          value={<span className={tier.color}>{user?.skill_rating || 1500}</span>}
          iconColor="primary"
          delay={0}
        />
        <AthleticStatCard
          icon={TrendingUp}
          label="Games Played"
          value={user?.total_games || 0}
          iconColor="violet"
          delay={0.1}
        />
        <AthleticStatCard
          icon={Star}
          label="Win Rate"
          value={user?.total_games ? `${Math.round((user.wins / user.total_games) * 100)}%` : "0%"}
          iconColor="amber"
          delay={0.2}
        />
        <AthleticStatCard
          icon={Calendar}
          label="Upcoming"
          value={upcoming.length}
          iconColor="sky"
          delay={0.3}
        />
      </div>

      {/* Quick Venue Search - Athletic Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-10 rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6"
        data-testid="quick-venue-search"
      >
        <form onSubmit={(e) => { e.preventDefault(); navigate(`/venues?q=${encodeURIComponent(searchQ)}`); }} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search venue, area, or city..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="pl-12 bg-background/50 border-2 border-border/50 h-14 text-base rounded-xl font-semibold"
              data-testid="dashboard-search-input"
            />
          </div>
          <Button
            type="submit"
            className="h-14 px-6 bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide rounded-xl"
            data-testid="dashboard-search-btn"
          >
            <Search className="h-5 w-5" />
          </Button>
        </form>
      </motion.div>

      {/* Quick Actions - Athletic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { icon: MapPin, label: "Find Venue", desc: "Browse available turfs", to: "/venues", iconColor: "primary" },
          { icon: Swords, label: "Find Game", desc: "Join or create matches", to: "/matchmaking", iconColor: "violet" },
          { icon: Dumbbell, label: "Find Coach", desc: "Book 1-on-1 sessions", to: "/coaching", iconColor: "sky" },
          { icon: Trophy, label: "My Profile", desc: "Stats & match history", to: "/rating-profile", iconColor: "amber" },
        ].map((a, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            <button
              onClick={() => navigate(a.to)}
              data-testid={`quick-action-${a.label.toLowerCase().replace(/\s/g, "-")}`}
              className="w-full rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 hover:border-primary/50 hover:scale-105 hover:shadow-glow-sm transition-all duration-300 text-left group"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  a.iconColor === "primary" ? "bg-primary/10" :
                  a.iconColor === "violet" ? "bg-violet-500/10" :
                  a.iconColor === "sky" ? "bg-sky-500/10" :
                  "bg-amber-500/10"
                }`}>
                  <a.icon className={`h-6 w-6 ${
                    a.iconColor === "primary" ? "text-primary" :
                    a.iconColor === "violet" ? "text-violet-400" :
                    a.iconColor === "sky" ? "text-sky-400" :
                    "text-amber-400"
                  }`} />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
              </div>
              <div className="font-display text-base font-black text-foreground group-hover:text-primary transition-colors">
                {a.label}
              </div>
              <div className="text-sm text-muted-foreground font-semibold mt-1">{a.desc}</div>
            </button>
          </motion.div>
        ))}
      </div>

      {/* Engagement Score + Venue Recommendations */}
      {(engagementScore || venueRecs.length > 0) && (
        <div className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Engagement Score Card */}
          {engagementScore && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-sm uppercase tracking-wide">Engagement</h3>
              </div>
              <div className="text-center mb-4">
                <div className="font-display text-4xl font-black text-primary">{engagementScore.score}</div>
                <Badge variant="glow" className="mt-1 text-xs font-bold">{engagementScore.level}</Badge>
              </div>
              <div className="space-y-2">
                {Object.entries(engagementScore.breakdown || {}).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground capitalize w-20 truncate">{key}</span>
                    <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(val * 5, 100)}%` }} />
                    </div>
                    <span className="font-bold w-6 text-right">{val}</span>
                  </div>
                ))}
              </div>
              {engagementScore.current_streak > 0 && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="font-bold text-orange-500">{engagementScore.current_streak}-day streak</span>
                </div>
              )}
              {engagementScore.score < 40 && (
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  {engagementScore.score < 10 ? "Post, like, and book venues to earn points" :
                   engagementScore.score < 25 ? "Keep posting daily to build your streak" :
                   "Almost Pro! Stay active this week"}
                </p>
              )}
              <button onClick={() => navigate(`/lobbian/${user?.id}`)}
                className="mt-3 w-full text-[10px] text-center text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-wider">
                How to earn points →
              </button>
            </motion.div>
          )}

          {/* Venue Recommendations */}
          {venueRecs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className={`rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6 ${engagementScore ? "lg:col-span-2" : "lg:col-span-3"}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-sm uppercase tracking-wide">Recommended Venues</h3>
                </div>
                <button onClick={() => navigate("/venues")} className="text-xs font-bold text-primary hover:underline">
                  View All →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {venueRecs.slice(0, 6).map((v, idx) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + idx * 0.05 }}
                    onClick={() => v.slug ? navigate(`/venue/${v.slug}`) : navigate(`/venues/${v.id}`)}
                    className="p-3 rounded-xl border border-border/30 bg-secondary/10 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {v.images?.[0] ? (
                          <img src={mediaUrl(v.images[0])} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <Building2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs truncate group-hover:text-primary transition-colors">{v.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground truncate">{v.area || v.city}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {v.average_rating > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px]">
                              <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                              {v.average_rating?.toFixed(1)}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[8px] px-1 py-0 capitalize">
                            {v.rec_reason?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Upcoming Bookings - Athletic Style */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-black uppercase tracking-wide">Upcoming Bookings</h2>
          {upcoming.length > 3 && (
            <Button variant="link" className="text-primary text-sm font-bold" data-testid="view-all-bookings">
              View All →
            </Button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md overflow-hidden"
          >
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-10 flex flex-col items-center md:items-start justify-center text-center md:text-left">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <p className="font-display text-xl font-black mb-2">No Upcoming Games</p>
                <p className="text-sm text-muted-foreground font-semibold mb-6">Get back on the field — book your next session now!</p>
                <Button
                  className="bg-gradient-athletic text-white shadow-glow-primary hover:shadow-glow-hover hover:scale-105 font-black uppercase tracking-wide h-12 px-8"
                  onClick={() => navigate("/venues")}
                  data-testid="book-now-btn"
                >
                  Book a Venue
                </Button>
              </div>
              <div className="hidden md:block relative min-h-[200px]">
                <img
                  src={MOTIVATION_IMG}
                  alt="Athlete running"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-card/70 to-transparent" />
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {upcoming.slice(0, 5).map((b, idx) => (
              <BookingCard key={b.id} booking={b} onClick={() => {}} delay={0.8 + idx * 0.05} onGetQR={handleGetQR} />
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Analytics */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-10 rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-md p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-black uppercase tracking-wide">Performance Insights</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-secondary/20 rounded-xl">
              <div className="text-2xl font-black text-primary">{stats.total_bookings || 0}</div>
              <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Total Bookings</div>
            </div>
            <div className="text-center p-3 bg-secondary/20 rounded-xl">
              <div className="text-2xl font-black text-emerald-400">{stats.total_matches || user?.total_games || 0}</div>
              <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Matches Played</div>
            </div>
            <div className="text-center p-3 bg-secondary/20 rounded-xl">
              <div className="text-2xl font-black text-amber-400">{user?.wins || 0}</div>
              <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Wins</div>
            </div>
            <div className="text-center p-3 bg-secondary/20 rounded-xl">
              <div className="text-2xl font-black text-sky-400">
                ₹{(stats.total_spent || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Total Spent</div>
            </div>
          </div>

          {/* Sport Breakdown */}
          {stats.sport_breakdown && Object.keys(stats.sport_breakdown).length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Sports Breakdown
              </h4>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.sport_breakdown).map(([sport, count]) => {
                  const total = Object.values(stats.sport_breakdown).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={sport} className="flex items-center gap-2 bg-secondary/30 rounded-full px-3 py-1.5">
                      <span className="text-xs font-bold capitalize">{sport.replace("_", " ")}</span>
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Trend */}
          {stats.monthly_bookings && stats.monthly_bookings.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Monthly Activity
              </h4>
              <div className="flex items-end gap-1 h-24">
                {stats.monthly_bookings.slice(-6).map((m, i) => {
                  const maxVal = Math.max(...stats.monthly_bookings.slice(-6).map(x => x.count || 0), 1);
                  const height = ((m.count || 0) / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full max-w-[40px] rounded-t-md bg-primary/80 hover:bg-primary transition-colors"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${m.month}: ${m.count} bookings`} />
                      <span className="text-[9px] text-muted-foreground font-bold">{m.month?.slice(-2) || ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* My Waitlist */}
      {waitlistEntries.length > 0 && (
        <div className="mb-10">
          <h2 className="font-display text-xl font-black uppercase tracking-wide mb-6 flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-violet-400" /> My Waitlist
          </h2>
          <div className="space-y-3">
            {waitlistEntries.map((entry, idx) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 rounded-2xl border-2 border-violet-500/20 bg-card/50 backdrop-blur-md hover:border-violet-500/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <ListOrdered className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm">{entry.venue_name || "Venue"}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {entry.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.start_time}</span>
                      <Badge variant="sport" className="text-[10px]">#{entry.position || "?"} in queue</Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleLeaveWaitlist(entry.id)}
                  disabled={leavingWaitlist === entry.id}
                >
                  {leavingWaitlist === entry.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Past Games - Athletic Style */}
      {past.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-black uppercase tracking-wide mb-6">Recent Games</h2>
          <div className="space-y-4">
            {past.slice(0, 3).map((b, idx) => (
              <BookingCard key={b.id} booking={b} onClick={() => {}} delay={1.0 + idx * 0.05} />
            ))}
          </div>
        </div>
      )}

      {/* QR Check-in Dialog */}
      <Dialog open={!!qrData} onOpenChange={open => { if (!open) setQrData(null); }}>
        <DialogContent className="bg-card border-border max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="font-display">Check-in QR Code</DialogTitle>
          </DialogHeader>
          {qrData && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-xl mx-auto w-fit">
                <QRCodeSVG
                  value={qrData.qr_data}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Show this to the venue staff to check in at <span className="font-bold text-foreground">{qrData.venue_name}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {qrData.date} · {qrData.start_time}
                </p>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground/50 break-all px-2">
                {qrData.qr_data}
              </p>
              {qrData.expires_at && (
                <p className="text-[10px] text-muted-foreground/60">
                  Expires: {new Date(qrData.expires_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
