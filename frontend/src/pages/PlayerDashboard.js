import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bookingAPI, analyticsAPI, waitlistAPI, recommendationAPI } from "@/lib/api";
import { mediaUrl, fmt12h } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  MapPin, Swords, Calendar, Trophy, TrendingUp, Clock,
  Star, Play, ListOrdered, X, User, Loader2, Dumbbell,
  BarChart3, Target, Zap, Flame, Building2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import BookingReceipt from "@/components/BookingReceipt";
import { PlayerDashboardSkeleton } from "@/components/SkeletonLoader";

const SPORT_HERO_IMAGES = {
  football:    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
  cricket:     "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80",
  badminton:   "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80",
  tennis:      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80",
  basketball:  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80",
  volleyball:  "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=800&q=80",
  default:     "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80",
};
const QUICK_ACTION_IMAGES = {
  "Find Venue":  "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=400&q=80",
  "Find Game":   "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=400&q=80",
  "Find Coach":  "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80",
  "My Profile":  "https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=400&q=80",
};
const SPORT_EMOJI = { football: "\u26BD", cricket: "\uD83C\uDFCF", badminton: "\uD83C\uDFF8", tennis: "\uD83C\uDFBE", basketball: "\uD83C\uDFC0", volleyball: "\uD83C\uDFD0", table_tennis: "\uD83C\uDFD3", swimming: "\uD83C\uDFCA", hockey: "\uD83C\uDFD1" };
const MOTIVATION_IMG = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=600&q=80";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── Local stat card (admin-style) ─────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, colorClass = "text-brand-600", bgClass = "bg-brand-600/10", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="bg-card rounded-[28px] p-4 sm:p-6 border border-border/40 shadow-sm flex flex-col justify-between transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="admin-label">{label}</div>
        <div className={`p-2 sm:p-3 rounded-2xl ${bgClass} border border-border/40 flex items-center justify-center`}>
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
      className="rounded-[28px] bg-card border border-border/40 shadow-sm p-4 sm:p-6 hover:bg-white/5 hover:shadow-md transition-all duration-200 cursor-pointer group"
      data-testid={`booking-card-${booking.id}`}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-base text-foreground truncate group-hover:text-brand-600 transition-colors">
            {booking.venue_name}
          </h3>
          {booking.sport && (
            <span className="text-[10px] admin-label capitalize mt-0.5 block">
              {SPORT_EMOJI[booking.sport] || "\uD83C\uDFC5"} {booking.sport.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {booking.checked_in && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium admin-badge bg-brand-600/10 text-brand-600 border border-brand-600/20">
              Checked In
            </span>
          )}
          <span className={`px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] sm:text-[10px] font-medium admin-badge uppercase ${STATUS_STYLE[booking.status] || STATUS_STYLE.pending}`}>
            {booking.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 text-sm text-muted-foreground mb-4 flex-wrap">
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
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [leavingWaitlist, setLeavingWaitlist] = useState(null);
  const [venueRecs, setVenueRecs] = useState([]);
  const [engagementScore, setEngagementScore] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    Promise.all([
      bookingAPI.list(1, 50).catch(() => ({ data: { bookings: [] } })),
      analyticsAPI.player().catch(() => ({ data: null })),
      waitlistAPI.myWaitlist().catch(() => ({ data: [] })),
      recommendationAPI.venues(6).catch(() => ({ data: { venues: [] } })),
      recommendationAPI.engagementScore().catch(() => ({ data: null })),
    ]).then(([bRes, sRes, wRes, vRecRes, engRes]) => {
      setBookings(bRes.data?.bookings || []);
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
  const primarySport = stats?.sport_breakdown ? Object.entries(stats.sport_breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
  const heroImage = SPORT_HERO_IMAGES[primarySport] || SPORT_HERO_IMAGES.default;

  if (loading) return <PlayerDashboardSkeleton />;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 pb-20 md:pb-6" data-testid="player-dashboard">

      {/* ── Welcome Hero ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 rounded-[28px] bg-card border border-border/40 shadow-sm overflow-hidden"
      >
        <div className="grid md:grid-cols-3 gap-0">
          <div className="md:col-span-2 p-4 sm:p-7 md:p-10 flex flex-col justify-center">
            <span className="admin-section-label mb-2">Dashboard</span>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mt-1 [text-wrap:balance]">
              {getGreeting()},{" "}
              <span className="text-brand-600">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="admin-label text-sm mt-2">
              {new Date().getHours() < 17
                ? "Ready to play? Book your next game and dominate the field."
                : "Wind down with a game tonight or plan tomorrow's session."}
            </p>
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <button
                onClick={() => navigate("/venues")}
                className="flex items-center justify-center gap-2 px-6 h-12 sm:h-11 w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white rounded-xl admin-btn shadow-md shadow-brand-600/20 active:scale-[0.98] transition-all duration-200 font-semibold text-sm"
              >
                <Play className="h-4 w-4 fill-white" /> Find a Game
              </button>
              <button
                onClick={() => navigate("/player-card/me")}
                className="flex items-center justify-center gap-2 px-6 h-12 sm:h-11 w-full sm:w-auto border border-brand-600/40 text-brand-600 rounded-xl admin-btn hover:bg-brand-600/10 transition-all duration-200 font-semibold text-sm"
              >
                <User className="h-4 w-4" /> My Lobbian Card
              </button>
            </div>
          </div>
          <div className="hidden md:block relative h-full min-h-[220px]">
            <img src={heroImage} alt="Sport" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-card/80 to-transparent" />
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-10">
        <StatCard icon={Trophy}     label="Skill Rating"  value={<span className={tier.color}>{user?.skill_rating || 1500}</span>} colorClass="text-brand-600"  bgClass="bg-brand-600/10"  delay={0} />
        <StatCard icon={TrendingUp} label="Games Played"  value={user?.total_games || 0}                                           colorClass="text-emerald-500" bgClass="bg-emerald-500/10" delay={0.08} />
        <StatCard icon={Star}       label="Win Rate"      value={user?.total_games ? `${Math.round((user.wins / user.total_games) * 100)}%` : "0%"} colorClass="text-amber-500"  bgClass="bg-amber-500/10"  delay={0.16} />
        <StatCard icon={Calendar}   label="Upcoming"      value={upcoming.length}                                                   colorClass="text-sky-500"    bgClass="bg-sky-500/10"    delay={0.24} />
      </div>

      {/* ── Quick Venue Search ────────────────────────────────────────────── */}

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mb-10">
        {[
          { icon: MapPin,   label: "Find Venue",  desc: "Browse available turfs",    to: "/venues"        },
          { icon: Swords,   label: "Find Game",   desc: "Join or create matches",    to: "/matchmaking"   },
          { icon: Dumbbell, label: "Find Coach",  desc: "Book 1-on-1 sessions",      to: "/coaching"      },
          { icon: Trophy,   label: "My Profile",  desc: "Stats & match history",     to: "/rating-profile" },
        ].map((a, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.07 }}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(a.to)}
            data-testid={`quick-action-${a.label.toLowerCase().replace(/\s/g, "-")}`}
            className="relative rounded-[28px] overflow-hidden shadow-sm h-40 sm:h-40 group text-left"
          >
            <img
              src={QUICK_ACTION_IMAGES[a.label]}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            <div className="relative h-full flex flex-col justify-end p-5 sm:p-5 pb-6 sm:pb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2 bg-white/15 backdrop-blur-sm border border-white/10">
                <a.icon className="h-4 w-4 text-white" />
              </div>
              <div className="font-semibold text-sm text-white">{a.label}</div>
              <div className="text-[11px] text-white/70 mt-0.5">{a.desc}</div>
            </div>
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
              className="rounded-[28px] bg-card border border-border/40 shadow-sm p-5 sm:p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-2xl bg-brand-600/10 border border-border/40">
                  <Zap className="h-4 w-4 text-brand-600" />
                </div>
                <span className="admin-heading text-sm">Engagement</span>
              </div>
              <div className="flex flex-col items-center mb-5 text-center">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                  <svg className="w-20 h-20 sm:w-24 sm:h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/10" />
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6"
                      strokeDasharray={`${Math.min(engagementScore.score, 100) * 2.64} 264`}
                      strokeLinecap="round" className="text-brand-600 transition-all duration-700" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-xl sm:text-2xl font-bold text-brand-600">{engagementScore.score}</span>
                  </div>
                </div>
                <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-medium admin-badge bg-brand-600/10 text-brand-600 border border-brand-600/20">
                  {engagementScore.level}
                </span>
              </div>
              <div className="space-y-3 sm:space-y-2.5">
                {Object.entries(engagementScore.breakdown || {}).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-[11px]">
                    <span className="admin-label capitalize w-20 truncate text-[11px]">{key}</span>
                    <div className="flex-1 h-2.5 sm:h-1.5 bg-secondary/50 rounded-full overflow-hidden">
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
                    whileHover={{ y: -4 }}
                    onClick={() => v.slug ? navigate(`/venue/${v.slug}`) : navigate(`/venues/${v.id}`)}
                    className="rounded-2xl border border-border/40 bg-secondary/20 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="relative h-32 sm:h-32 overflow-hidden">
                      <img
                        src={v.images?.[0] ? mediaUrl(v.images[0]) : `/turf/unnamed (${(idx % 10) + 1}).png`}
                        alt={v.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      {v.average_rating > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold">
                          <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                          {v.average_rating?.toFixed(1)}
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-3">
                      <h4 className="font-semibold text-sm sm:text-xs truncate group-hover:text-brand-600 transition-colors">{v.name}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 sm:h-2.5 sm:w-2.5 text-muted-foreground" />
                        <span className="text-[11px] sm:text-[10px] admin-label truncate">{v.area || v.city}</span>
                      </div>
                      {v.rec_reason && (
                        <span className="mt-1.5 inline-block text-[8px] px-1.5 py-0.5 rounded-full bg-brand-600/10 text-brand-600 border border-brand-600/20 capitalize font-medium">
                          {v.rec_reason.replace(/_/g, " ")}
                        </span>
                      )}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Bookings",  value: stats.total_bookings || 0,                       color: "text-brand-600" },
              { label: "Matches Played",  value: stats.total_matches || user?.total_games || 0,    color: "text-emerald-500" },
              { label: "Wins",            value: user?.wins || 0,                                  color: "text-amber-500" },
              { label: "Total Spent",     value: `₹${(stats.total_spent || 0).toLocaleString()}`,  color: "text-sky-500" },
            ].map((s, i) => (
              <div key={i} className="text-center p-3 sm:p-4 bg-secondary/20 rounded-2xl border border-border/40">
                <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
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
                      <span className="text-xs font-semibold capitalize">{SPORT_EMOJI[sport] || "\uD83C\uDFC5"} {sport.replace("_", " ")}</span>
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
              <div className="h-32 sm:h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthly_bookings.slice(-6).map(m => ({ month: m.month?.slice(-2) || "", count: m.count || 0 }))}>
                    <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} width={24} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: "#F8FAFC" }}
                      cursor={{ fill: "#1E293B", radius: 4 }}
                      formatter={(value) => [`${value} bookings`, "Activity"]}
                    />
                    <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-[28px] bg-card border border-brand-600/20 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-brand-600/10 border border-border/40 flex items-center justify-center">
                    <ListOrdered className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{entry.venue_name || "Venue"}</h4>
                    <div className="flex items-center gap-2 flex-wrap text-xs admin-label mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {entry.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmt12h(entry.start_time)}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-500 border border-purple-500/20 font-medium">
                        #{entry.position || "?"} in queue
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  aria-label="Leave waitlist"
                  className="h-11 w-11 flex items-center justify-center rounded-xl border border-border/40 text-muted-foreground hover:text-red-500 hover:border-red-500/30 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
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
