import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingAPI, analyticsAPI, waitlistAPI, recommendationAPI } from "@/lib/api";
import { mediaUrl, fmt12h } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  MapPin, Swords, Calendar, Trophy, TrendingUp, Clock, ChevronRight,
  Star, Search, Play, ListOrdered, X, User, Loader2, Dumbbell,
  BarChart3, Target, Zap, Flame, Building2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import BookingReceipt from "@/components/BookingReceipt";

const PLAYER_HERO = "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80";
const MOTIVATION_IMG = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=600&q=80";

/* ─── Local stat card (admin-style) ─────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, colorClass = "text-brand-600", bgClass = "bg-brand-600/10", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="bg-card rounded-[28px] p-6 border border-border/40 shadow-sm flex flex-col justify-between transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="admin-label">{label}</div>
        <div className={`p-3 rounded-2xl ${bgClass} border border-border/40 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
      </div>
      <div className="admin-value">{value}</div>
    </motion.div>
  );
}

/* ─── Booking card ───────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  confirmed: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  pending:   "bg-amber-500/10 text-amber-500 border border-amber-500/20",
  cancelled: "bg-red-500/10 text-red-500 border border-red-500/20",
};

function BookingCard({ booking, onClick, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className="rounded-[28px] bg-card border border-border/40 shadow-sm p-6 hover:bg-white/5 hover:shadow-md transition-all duration-200 cursor-pointer group"
      data-testid={`booking-card-${booking.id}`}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="font-semibold text-base text-foreground truncate group-hover:text-brand-600 transition-colors">
          {booking.venue_name}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {booking.checked_in && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium admin-badge bg-brand-600/10 text-brand-600 border border-brand-600/20">
              Checked In
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium admin-badge uppercase ${STATUS_STYLE[booking.status] || STATUS_STYLE.pending}`}>
            {booking.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-600" />
          {booking.date}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-400" />
          {fmt12h(booking.start_time)}–{fmt12h(booking.end_time)}
        </span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/20">
        <div className="font-bold text-lg text-brand-600">
          {booking.total_amount?.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
        </div>
        {booking.payment_mode === "split" && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium admin-badge bg-purple-500/10 text-purple-500 border border-purple-500/20">
            SPLIT {booking.split_config?.shares_paid}/{booking.split_config?.total_shares}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function PlayerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [leavingWaitlist, setLeavingWaitlist] = useState(null);
  const [venueRecs, setVenueRecs] = useState([]);
  const [engagementScore, setEngagementScore] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

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
    } catch { /* silent */ }
    finally { setLeavingWaitlist(null); }
  };

  const upcoming = bookings.filter(b => b.status !== "cancelled" && new Date(b.date) >= new Date(new Date().toDateString()));
  const past = bookings.filter(b => new Date(b.date) < new Date(new Date().toDateString()));

  const getRatingTier = (r) => {
    if (r >= 2500) return { label: "Diamond", color: "text-cyan-400" };
    if (r >= 2000) return { label: "Gold",    color: "text-amber-400" };
    if (r >= 1500) return { label: "Silver",  color: "text-muted-foreground" };
    return { label: "Bronze", color: "text-orange-400" };
  };
  const tier = getRatingTier(user?.skill_rating || 1500);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-20 md:pb-6" data-testid="player-dashboard">

      {/* ── Welcome Hero ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 rounded-[28px] bg-card border border-border/40 shadow-sm overflow-hidden"
      >
        <div className="grid md:grid-cols-3 gap-0">
          <div className="md:col-span-2 p-8 md:p-10 flex flex-col justify-center">
            <span className="admin-section-label mb-2">Dashboard</span>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-1">
              Welcome back,{" "}
              <span className="text-brand-600">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="admin-label text-sm mt-2">
              Ready to play? Book your next game and dominate the field.
            </p>
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <button
                onClick={() => navigate("/venues")}
                className="flex items-center gap-2 px-6 h-11 bg-brand-600 hover:bg-brand-500 text-white rounded-xl admin-btn shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all duration-200 font-semibold text-sm"
              >
                <Play className="h-4 w-4 fill-white" /> Find a Game
              </button>
              <button
                onClick={() => navigate("/player-card/me")}
                className="flex items-center gap-2 px-6 h-11 border border-brand-600/40 text-brand-600 rounded-xl admin-btn hover:bg-brand-600/10 transition-all duration-200 font-semibold text-sm"
              >
                <User className="h-4 w-4" /> My Lobbian Card
              </button>
            </div>
          </div>
          <div className="hidden md:block relative h-full min-h-[220px]">
            <img src={PLAYER_HERO} alt="Athletes" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-card/80 to-transparent" />
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
        <StatCard icon={Trophy}     label="Skill Rating"  value={<span className={tier.color}>{user?.skill_rating || 1500}</span>} colorClass="text-brand-600"  bgClass="bg-brand-600/10"  delay={0} />
        <StatCard icon={TrendingUp} label="Games Played"  value={user?.total_games || 0}                                           colorClass="text-emerald-500" bgClass="bg-emerald-500/10" delay={0.08} />
        <StatCard icon={Star}       label="Win Rate"      value={user?.total_games ? `${Math.round((user.wins / user.total_games) * 100)}%` : "0%"} colorClass="text-amber-500"  bgClass="bg-amber-500/10"  delay={0.16} />
        <StatCard icon={Calendar}   label="Upcoming"      value={upcoming.length}                                                   colorClass="text-sky-500"    bgClass="bg-sky-500/10"    delay={0.24} />
      </div>

      {/* ── Quick Venue Search ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-10 rounded-[28px] bg-card border border-border/40 shadow-sm p-6"
        data-testid="quick-venue-search"
      >
        <p className="admin-section-label mb-4">Quick Search</p>
        <form
          onSubmit={(e) => { e.preventDefault(); navigate(`/venues?q=${encodeURIComponent(searchQ)}`); }}
          className="flex gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search venue, area, or city…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="pl-11 h-11 bg-secondary/20 border-border/40 rounded-xl text-sm"
              data-testid="dashboard-search-input"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl admin-btn shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all"
            data-testid="dashboard-search-btn"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </motion.div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mb-10">
        {[
          { icon: MapPin,   label: "Find Venue",  desc: "Browse available turfs",    to: "/venues",       colorClass: "text-brand-600",  bgClass: "bg-brand-600/10"  },
          { icon: Swords,   label: "Find Game",   desc: "Join or create matches",    to: "/matchmaking",  colorClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
          { icon: Dumbbell, label: "Find Coach",  desc: "Book 1-on-1 sessions",      to: "/coaching",     colorClass: "text-sky-500",    bgClass: "bg-sky-500/10"    },
          { icon: Trophy,   label: "My Profile",  desc: "Stats & match history",     to: "/rating-profile", colorClass: "text-amber-500",  bgClass: "bg-amber-500/10"  },
        ].map((a, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.07 }}
            onClick={() => navigate(a.to)}
            data-testid={`quick-action-${a.label.toLowerCase().replace(/\s/g, "-")}`}
            className="rounded-[28px] bg-card border border-border/40 shadow-sm p-5 hover:bg-white/5 hover:shadow-md transition-all duration-200 text-left group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-border/40 ${a.bgClass}`}>
                <a.icon className={`h-5 w-5 ${a.colorClass}`} />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-colors" />
            </div>
            <div className="font-semibold text-sm text-foreground group-hover:text-brand-600 transition-colors">{a.label}</div>
            <div className="admin-label text-[11px] mt-0.5">{a.desc}</div>
          </motion.button>
        ))}
      </div>

      {/* ── Engagement + Venue Recommendations ───────────────────────────── */}
      {(engagementScore || venueRecs.length > 0) && (
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">

          {/* Engagement score */}
          {engagementScore && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-[28px] bg-card border border-border/40 shadow-sm p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-2xl bg-brand-600/10 border border-border/40">
                  <Zap className="h-4 w-4 text-brand-600" />
                </div>
                <span className="admin-heading text-sm">Engagement</span>
              </div>
              <div className="text-center mb-5">
                <div className="admin-value text-4xl text-brand-600">{engagementScore.score}</div>
                <span className="mt-1 inline-block px-3 py-1 rounded-full text-xs font-medium admin-badge bg-brand-600/10 text-brand-600 border border-brand-600/20">
                  {engagementScore.level}
                </span>
              </div>
              <div className="space-y-2.5">
                {Object.entries(engagementScore.breakdown || {}).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-[11px]">
                    <span className="admin-label capitalize w-20 truncate text-[11px]">{key}</span>
                    <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-600/60 rounded-full" style={{ width: `${Math.min(val * 5, 100)}%` }} />
                    </div>
                    <span className="font-bold w-6 text-right text-foreground">{val}</span>
                  </div>
                ))}
              </div>
              {engagementScore.current_streak > 0 && (
                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="font-semibold text-orange-500">{engagementScore.current_streak}-day streak</span>
                </div>
              )}
              {engagementScore.score < 40 && (
                <p className="text-[10px] admin-label text-center mt-2">
                  {engagementScore.score < 10 ? "Post, like, and book venues to earn points" :
                   engagementScore.score < 25 ? "Keep posting daily to build your streak" :
                   "Almost Pro! Stay active this week"}
                </p>
              )}
              <button
                onClick={() => navigate(`/lobbian/${user?.id}`)}
                className="mt-3 w-full text-[10px] text-center admin-label hover:text-brand-600 transition-colors font-semibold uppercase tracking-wider"
              >
                How to earn points →
              </button>
            </motion.div>
          )}

          {/* Venue recommendations */}
          {venueRecs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={`rounded-[28px] bg-card border border-border/40 shadow-sm p-6 ${engagementScore ? "lg:col-span-2" : "lg:col-span-3"}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-2xl bg-brand-600/10 border border-border/40">
                    <Building2 className="h-4 w-4 text-brand-600" />
                  </div>
                  <span className="admin-heading text-sm">Recommended Venues</span>
                </div>
                <button
                  onClick={() => navigate("/venues")}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-500 transition-colors"
                >
                  View All →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {venueRecs.slice(0, 6).map((v, idx) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 + idx * 0.05 }}
                    onClick={() => v.slug ? navigate(`/venue/${v.slug}`) : navigate(`/venues/${v.id}`)}
                    className="p-3 rounded-2xl border border-border/40 bg-secondary/20 hover:bg-white/5 hover:shadow-sm transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-brand-600/10 border border-border/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {v.images?.[0] ? (
                          <img src={mediaUrl(v.images[0])} alt="" className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                          <Building2 className="h-5 w-5 text-brand-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs truncate group-hover:text-brand-600 transition-colors">{v.name}</h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] admin-label truncate">{v.area || v.city}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {v.average_rating > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px]">
                              <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                              {v.average_rating?.toFixed(1)}
                            </span>
                          )}
                          {v.rec_reason && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground border border-border/40 capitalize">
                              {v.rec_reason.replace(/_/g, " ")}
                            </span>
                          )}
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

      {/* ── Upcoming Bookings ─────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="admin-heading">Upcoming Bookings</h2>
          {upcoming.length > 3 && (
            <button className="text-xs font-semibold text-brand-600 hover:text-brand-500 transition-colors" data-testid="view-all-bookings">
              View All →
            </button>
          )}
        </div>

        {upcoming.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] bg-card border border-border/40 shadow-sm overflow-hidden"
          >
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-10 flex flex-col items-center md:items-start justify-center text-center md:text-left">
                <div className="w-16 h-16 rounded-3xl bg-brand-600/10 border border-border/40 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-brand-600" />
                </div>
                <p className="font-semibold text-lg text-foreground mb-1">No Upcoming Games</p>
                <p className="admin-label text-sm mb-6">Get back on the field — book your next session now!</p>
                <button
                  className="flex items-center gap-2 px-8 h-11 bg-brand-600 hover:bg-brand-500 text-white rounded-xl admin-btn shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all font-semibold text-sm"
                  onClick={() => navigate("/venues")}
                  data-testid="book-now-btn"
                >
                  Book a Venue
                </button>
              </div>
              <div className="hidden md:block relative min-h-[200px]">
                <img src={MOTIVATION_IMG} alt="Athlete running" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-card/70 to-transparent" />
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 5).map((b, idx) => (
              <BookingCard key={b.id} booking={b} onClick={() => setSelectedBooking(b)} delay={0.6 + idx * 0.05} />
            ))}
          </div>
        )}
      </div>

      {/* ── Performance Insights ──────────────────────────────────────────── */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-10 rounded-[28px] bg-card border border-border/40 shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-2xl bg-brand-600/10 border border-border/40">
              <BarChart3 className="h-4 w-4 text-brand-600" />
            </div>
            <h2 className="admin-heading">Performance Insights</h2>
          </div>

          {/* Mini stat boxes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Bookings",  value: stats.total_bookings || 0,                       color: "text-brand-600" },
              { label: "Matches Played",  value: stats.total_matches || user?.total_games || 0,    color: "text-emerald-500" },
              { label: "Wins",            value: user?.wins || 0,                                  color: "text-amber-500" },
              { label: "Total Spent",     value: `₹${(stats.total_spent || 0).toLocaleString()}`,  color: "text-sky-500" },
            ].map((s, i) => (
              <div key={i} className="text-center p-4 bg-secondary/20 rounded-2xl border border-border/40">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="admin-label text-[10px] uppercase tracking-wide mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sports breakdown */}
          {stats.sport_breakdown && Object.keys(stats.sport_breakdown).length > 0 && (
            <div className="mb-5">
              <p className="admin-section-label mb-3 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Sports Breakdown
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.sport_breakdown).map(([sport, count]) => {
                  const total = Object.values(stats.sport_breakdown).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={sport} className="flex items-center gap-2 bg-secondary/30 border border-border/40 rounded-full px-3 py-1.5">
                      <span className="text-xs font-semibold capitalize">{sport.replace("_", " ")}</span>
                      <div className="w-14 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] admin-label">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly activity chart */}
          {stats.monthly_bookings?.length > 0 && (
            <div>
              <p className="admin-section-label mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Monthly Activity
              </p>
              <div className="flex items-end gap-1.5 h-24">
                {stats.monthly_bookings.slice(-6).map((m, i) => {
                  const maxVal = Math.max(...stats.monthly_bookings.slice(-6).map(x => x.count || 0), 1);
                  const height = ((m.count || 0) / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full max-w-[36px] rounded-t-lg bg-brand-600/70 hover:bg-brand-600 transition-colors"
                        style={{ height: `${Math.max(height, 6)}%` }}
                        title={`${m.month}: ${m.count} bookings`}
                      />
                      <span className="text-[10px] admin-label">{m.month?.slice(-2) || ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── My Waitlist ───────────────────────────────────────────────────── */}
      {waitlistEntries.length > 0 && (
        <div className="mb-10">
          <h2 className="admin-heading mb-5 flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-brand-600" /> My Waitlist
          </h2>
          <div className="space-y-2">
            {waitlistEntries.map((entry, idx) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 rounded-[28px] bg-card border border-brand-600/20 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-brand-600/10 border border-border/40 flex items-center justify-center">
                    <ListOrdered className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{entry.venue_name || "Venue"}</h4>
                    <div className="flex items-center gap-3 text-xs admin-label mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {entry.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.start_time}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-500 border border-purple-500/20 font-medium">
                        #{entry.position || "?"} in queue
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  className="h-8 w-8 flex items-center justify-center rounded-xl border border-border/40 text-muted-foreground hover:text-red-500 hover:border-red-500/30 transition-colors"
                  onClick={() => handleLeaveWaitlist(entry.id)}
                  disabled={leavingWaitlist === entry.id}
                >
                  {leavingWaitlist === entry.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <X className="h-4 w-4" />
                  }
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Games ──────────────────────────────────────────────────── */}
      {past.length > 0 && (
        <div>
          <h2 className="admin-heading mb-5">Recent Games</h2>
          <div className="space-y-3">
            {past.slice(0, 3).map((b, idx) => (
              <BookingCard key={b.id} booking={b} onClick={() => setSelectedBooking(b)} delay={0.8 + idx * 0.05} />
            ))}
          </div>
        </div>
      )}

      {/* ── Booking Receipt Dialog ────────────────────────────────────────── */}
      <Dialog open={!!selectedBooking} onOpenChange={open => { if (!open) setSelectedBooking(null); }}>
        <DialogContent className="rounded-[28px] bg-card border-border/40 max-w-[95vw] sm:max-w-sm p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20">
            <DialogTitle className="admin-heading">Booking Receipt</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {selectedBooking && <BookingReceipt booking={selectedBooking} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
