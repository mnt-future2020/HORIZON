import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { playerCardAPI, recommendationAPI, socialAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Target,
  Shield,
  Zap,
  Award,
  Gamepad2,
  TrendingUp,
  Loader2,
  ArrowLeft,
  User,
  MessageCircle,
  UserPlus,
  Users,
  Grid3X3,
  Flame,
  BadgeCheck,
  Info,
  X,
  Share2,
  ChevronRight,
  MapPin,
  Calendar,
  Star,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
/* ─────────────────────────────────────────────────────────────
   Tier config
───────────────────────────────────────────────────────────── */
const TIER_CONFIG = {
  Elite: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    gradient: "from-amber-500 to-yellow-400",
  },
  Pro: {
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.3)",
    gradient: "from-green-500 to-emerald-400",
  },
  Intermediate: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.3)",
    gradient: "from-blue-500 to-cyan-400",
  },
  Beginner: {
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.3)",
    gradient: "from-slate-500 to-slate-400",
  },
};
function getRatingTier(rating) {
  if (rating >= 2000) return { name: "Elite", ...TIER_CONFIG.Elite };
  if (rating >= 1700) return { name: "Pro", ...TIER_CONFIG.Pro };
  if (rating >= 1400)
    return { name: "Intermediate", ...TIER_CONFIG.Intermediate };
  return { name: "Beginner", ...TIER_CONFIG.Beginner };
}
/* Safe date formatter — returns empty string if value is bad */
function formatDate(value, options) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", options);
}
/* ─────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────── */
function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden ${className}`}
    >
      {title && (
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/40">
          {Icon && <Icon className="h-4 w-4 text-primary/70" aria-hidden />}
          <h3 className="font-display font-bold text-sm tracking-wide">
            {title}
          </h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
function MiniBar({ value, max = 100, color = "bg-primary" }) {
  return (
    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
export default function PlayerCardPage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [compatibility, setCompatibility] = useState(null);
  const [engagementScore, setEngagementScore] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("stats");
  const [showStatsModal, setShowStatsModal] = useState(false);
  const isOwnProfile = !userId || userId === "me" || userId === currentUser?.id;
  const prefersReducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const winRate = useMemo(() => {
    if (!card || card.total_games === 0) return 0;
    return Math.round(
      (card.wins / Math.max(card.wins + card.losses + (card.draws ?? 0), 1)) *
        100,
    );
  }, [card]);
  /* ── Admin redirect ─────────────────────────────────────── */
  useEffect(() => {
    if (isOwnProfile && currentUser?.role === "super_admin") {
      navigate("/profile", { replace: true });
    }
  }, [isOwnProfile, currentUser?.role, navigate]);
  /* ── Data loading ───────────────────────────────────────── */
  useEffect(() => {
    if (isOwnProfile && currentUser?.role === "super_admin") return;
    const isMe = !userId || userId === "me" || userId === currentUser?.id;
    setLoading(true);
    const loadCard = (
      isMe ? playerCardAPI.getMyCard() : playerCardAPI.getCard(userId)
    )
      .then((res) => setCard(res.data))
      .catch(() =>
        toast.error("Failed to load player card. Please try again."),
      );
    const loadEngagement = recommendationAPI
      .userEngagement(isMe ? currentUser?.id : userId)
      .then((res) => setEngagementScore(res.data))
      .catch(() => {});
    if (!isMe && userId) {
      recommendationAPI
        .compatibility(userId)
        .then((res) => setCompatibility(res.data))
        .catch(() => {});
    }
    const targetId = isMe ? currentUser?.id : userId;
    if (targetId) {
      setPostsLoading(true);
      socialAPI
        .getUserPosts(targetId, 1)
        .then((res) => setUserPosts(res.data?.posts || []))
        .catch(() => {})
        .finally(() => setPostsLoading(false));
    }
    Promise.all([loadCard, loadEngagement]).finally(() => setLoading(false));
  }, [userId, currentUser?.id]);
  useEffect(() => {
    if (card) setIsFollowing(card.is_following);
  }, [card]);
  /* ── Escape key for modal ───────────────────────────────── */
  useEffect(() => {
    if (!showStatsModal) return;
    const fn = (e) => {
      if (e.key === "Escape") setShowStatsModal(false);
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [showStatsModal]);
  /* ── Follow toggle ──────────────────────────────────────── */
  const handleFollow = async () => {
    if (!card || followLoading) return;
    setFollowLoading(true);
    setIsFollowing((p) => !p);
    try {
      const res = await socialAPI.toggleFollow(card.user_id);
      setIsFollowing(res.data.following);
    } catch {
      setIsFollowing((p) => !p);
      toast.error("Failed to follow player");
    } finally {
      setFollowLoading(false);
    }
  };
  /* ── Tab keyboard nav ───────────────────────────────────── */
  const handleTabKeyDown = (e) => {
    const tabs = ["stats", "posts", "about"];
    const i = tabs.indexOf(activeTab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveTab(tabs[(i + 1) % tabs.length]);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveTab(tabs[(i - 1 + tabs.length) % tabs.length]);
    }
  };
  /* ── Motion helper ──────────────────────────────────────── */
  const anim = (props) => (prefersReducedMotion ? {} : props);
  /* ── Loading screen ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  /* ── Not found screen ───────────────────────────────────── */
  if (!card) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-bold">Player not found</h3>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }
  const tier = getRatingTier(card.skill_rating);
  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen bg-background pb-24 md:pb-8"
      style={{ touchAction: "manipulation" }}
    >
      {/* ══ TOP NAV ══════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted/70 active:scale-90 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-display font-bold text-sm truncate flex-1 text-center mx-3">
            {card.name}
          </span>
          <button
            onClick={() =>
              navigator.share?.({ title: card.name, url: window.location.href })
            }
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted/70 active:scale-90 transition-all"
            aria-label="Share profile"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto">
        {/* ══ HERO ══════════════════════════════════════════ */}
        <div className="relative px-4 pt-8 pb-5 sm:px-6 sm:pt-10">
          {/* Ambient glow */}
          <div className="absolute top-4 left-8 w-48 h-48 rounded-full  opacity-15 pointer-events-none" />
          {/* Avatar + name row */}
          <div className="relative flex items-end gap-4 sm:gap-5">
            {/* Avatar */}
            <motion.div
              {...anim({
                initial: { scale: 0.85, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                transition: { duration: 0.35 },
              })}
              className="relative flex-shrink-0"
            >
              <div
                className="h-24 w-24 sm:h-28 sm:w-28 rounded-full p-[3px] shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${tier.color}, ${tier.color}66)`,
                }}
              >
                <div className="h-full w-full rounded-full bg-background p-[2.5px]">
                  {card.avatar ? (
                    <img
                      src={mediaUrl(card.avatar)}
                      alt={card.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-muted flex items-center justify-center">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              {card.is_verified && (
                <motion.div
                  {...anim({
                    initial: { scale: 0 },
                    animate: { scale: 1 },
                    transition: { delay: 0.25, type: "spring", stiffness: 200 },
                  })}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center border-2 border-background shadow-lg"
                  aria-label="Verified"
                >
                  <BadgeCheck className="h-4 w-4 text-white" />
                </motion.div>
              )}
            </motion.div>
            {/* Name / badges / meta */}
            <motion.div
              {...anim({
                initial: { opacity: 0, x: -8 },
                animate: { opacity: 1, x: 0 },
                transition: { delay: 0.15, duration: 0.35 },
              })}
              className="flex-1 min-w-0 pb-1"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-black text-xl sm:text-2xl leading-tight">
                  {card.name}
                </h1>
                {card.current_streak > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/10 border border-orange-500/25 text-orange-500">
                    <Flame className="h-3 w-3" aria-hidden />
                    {card.current_streak}
                  </span>
                )}
              </div>
              {/* Tier + sport chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                  style={{
                    color: tier.color,
                    background: tier.bg,
                    borderColor: tier.border,
                  }}
                >
                  <Trophy className="h-3 w-3" aria-hidden />
                  {card.skill_rating} · {tier.name}
                </span>
                {card.primary_sport && card.primary_sport !== "none" && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted border border-border/50 capitalize text-muted-foreground">
                    {card.primary_sport}
                  </span>
                )}
              </div>
              {/* Location / joined */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px] text-muted-foreground">
                {card.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden />
                    {card.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" aria-hidden />
                  Joined{" "}
                  {formatDate(card.created_at, {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </motion.div>
          </div>
          {/* ── SOCIAL STATS GRID ──────────────────────────── */}
          <motion.div
            {...anim({
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              transition: { delay: 0.2, duration: 0.35 },
            })}
            className="mt-6 grid grid-cols-3 gap-px rounded-2xl overflow-hidden border border-border/40 bg-border/40"
          >
            {[
              {
                label: "Games",
                value: card.total_games,
                onClick: () => setShowStatsModal(true),
              },
              {
                label: "Followers",
                value: card.followers_count ?? 0,
                onClick: null,
              },
              {
                label: "Following",
                value: card.following_count ?? 0,
                onClick: null,
              },
            ].map(({ label, value, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={!onClick}
                className="flex flex-col items-center gap-0.5 py-4 bg-card hover:bg-muted/50 transition-colors active:scale-95 disabled:cursor-default disabled:hover:bg-card"
                aria-label={`${value} ${label}`}
              >
                <span className="font-display font-black text-lg sm:text-xl tabular-nums">
                  {value}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </span>
              </button>
            ))}
          </motion.div>
          {/* ── ACTION BUTTONS ─────────────────────────────── */}
          <motion.div
            {...anim({
              initial: { opacity: 0, y: 10 },
              animate: { opacity: 1, y: 0 },
              transition: { delay: 0.28, duration: 0.3 },
            })}
            className="flex gap-2 mt-4"
          >
            {card.user_id !== currentUser?.id ? (
              <>
                <Button
                  variant={isFollowing ? "outline" : "athletic"}
                  className="flex-1 h-10 text-sm font-bold shadow-sm"
                  onClick={handleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <>
                      <Loader2
                        className="h-4 w-4 mr-2 animate-spin"
                        aria-hidden
                      />
                      {isFollowing ? "Unfollowing…" : "Following…"}
                    </>
                  ) : isFollowing ? (
                    <>
                      <Users className="h-4 w-4 mr-2" aria-hidden />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" aria-hidden />
                      Follow
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-10 text-sm font-bold"
                  onClick={() => navigate(`/chat?user=${card.user_id}`)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" aria-hidden />
                  Message
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="flex-1 h-10 text-sm font-bold"
                onClick={() => navigate("/profile")}
              >
                Edit Profile
              </Button>
            )}
          </motion.div>
        </div>
        {/* ══ QUICK STATS STRIP ═════════════════════════════ */}
        <motion.div
          {...anim({
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { delay: 0.32, duration: 0.4 },
          })}
          className="mx-4 sm:mx-6 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden mb-1"
        >
          <div className="flex divide-x divide-border/40">
            {[
              { label: "Wins", value: card.wins, color: "#22c55e" },
              { label: "Losses", value: card.losses, color: "#ef4444" },
              { label: "Win Rate", value: `${winRate}%`, color: tier.color },
              {
                label: "Reliable",
                value: `${card.reliability_score}%`,
                color: "#38bdf8",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex-1 flex flex-col items-center py-4 gap-0.5"
              >
                <span
                  className="font-display font-black text-lg tabular-nums"
                  style={{ color }}
                >
                  {value}
                </span>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
        {/* ══ TABS ══════════════════════════════════════════ */}
        <div
          className="flex border-b border-border/40 bg-background sticky top-14 z-30 mt-4"
          role="tablist"
          aria-label="Profile sections"
        >
          {[
            { id: "posts", label: "Posts", icon: Grid3X3 },
            { id: "stats", label: "Stats", icon: BarChart3 },
            { id: "about", label: "About", icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={handleTabKeyDown}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {tab.label}
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-t-full"
                    style={{ background: tier.color }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 380, damping: 30 }
                    }
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
        {/* ══ TAB PANELS ════════════════════════════════════ */}
        <div className="p-4 sm:p-6 space-y-4">
          <AnimatePresence mode="wait">
            {/* ── STATS ─────────────────────────────────── */}
            {activeTab === "stats" && (
              <motion.div
                key="stats"
                role="tabpanel"
                id="stats-panel"
                aria-labelledby="stats-tab"
                {...anim({
                  initial: { opacity: 0, y: 16 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: -12 },
                  transition: { duration: 0.25 },
                })}
                className="space-y-4"
              >
                {/* Overall Rating */}
                {card.overall_score !== undefined && (
                  <SectionCard title="Overall Rating" icon={Star}>
                    <div className="flex items-center gap-5">
                      {/* Circular gauge */}
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <svg
                          className="w-20 h-20 -rotate-90"
                          viewBox="0 0 100 100"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-muted/30"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            strokeWidth="8"
                            strokeDasharray={`${card.overall_score * 2.64} 264`}
                            strokeLinecap="round"
                            stroke={tier.color}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-display font-black text-xl leading-none">
                            {card.overall_score}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                            /100
                          </span>
                        </div>
                      </div>
                      {/* Breakdown bars */}
                      <div className="flex-1 space-y-2.5">
                        <div className="mb-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full border"
                            style={{
                              color: tier.color,
                              borderColor: tier.border,
                              background: tier.bg,
                            }}
                          >
                            {card.overall_tier}
                          </span>
                        </div>
                        {card.score_breakdown &&
                          Object.entries({
                            Skill: card.score_breakdown.skill,
                            "Win Rate": card.score_breakdown.win_rate,
                            Tournament: card.score_breakdown.tournament,
                          }).map(([label, value]) => (
                            <div
                              key={label}
                              className="flex items-center gap-2.5"
                            >
                              <span className="text-[11px] text-muted-foreground w-16 shrink-0">
                                {label}
                              </span>
                              <MiniBar value={value} color="bg-primary" />
                              <span className="text-[11px] font-bold w-7 text-right tabular-nums">
                                {value}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <button
                        onClick={() => setShowStatsModal(true)}
                        className="mt-4 w-full flex items-center justify-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        View detailed stats{" "}
                        <ChevronRight className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </SectionCard>
                )}
                {/* Compatibility */}
                {compatibility && compatibility.score > 0 && (
                  <SectionCard title="Compatibility" icon={Target}>
                    <div className="flex items-center gap-4">
                      <div
                        className="font-display font-black text-4xl"
                        style={{ color: tier.color }}
                      >
                        {compatibility.score}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Match grade
                          </span>
                          <span
                            className="text-xs font-black px-2 py-0.5 rounded-full border"
                            style={{
                              color: tier.color,
                              borderColor: tier.border,
                              background: tier.bg,
                            }}
                          >
                            {compatibility.grade}
                          </span>
                        </div>
                        <MiniBar value={compatibility.score} />
                        <p className="text-[11px] text-muted-foreground">
                          Based on play style, skill level &amp; activity
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                )}
                {/* Engagement */}
                {engagementScore && engagementScore.score > 0 && (
                  <SectionCard title="Engagement" icon={Zap}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-display font-bold text-base">
                          {engagementScore.level}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Community engagement level
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-black text-2xl text-primary tabular-nums">
                          {engagementScore.score}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          /100
                        </div>
                      </div>
                    </div>
                    <MiniBar value={engagementScore.score} color="bg-primary" />
                  </SectionCard>
                )}
                {/* Sports Played */}
                {Object.keys(card.sports_played || {}).length > 0 && (
                  <SectionCard title="Sports Played" icon={Gamepad2}>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(card.sports_played)
                        .sort(([, a], [, b]) => b - a)
                        .map(([sport, count]) => (
                          <div
                            key={sport}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/40"
                          >
                            <span className="text-xs font-bold capitalize">
                              {sport}
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                              {count}×
                            </span>
                          </div>
                        ))}
                    </div>
                  </SectionCard>
                )}
                {/* Achievements */}
                {card.badges && card.badges.length > 0 && (
                  <SectionCard title="Achievements" icon={Award}>
                    <div className="grid grid-cols-2 gap-2">
                      {card.badges.map((badge, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/30"
                        >
                          <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Award
                              className="h-4 w-4 text-amber-400"
                              aria-hidden
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate">
                              {badge.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {badge.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </motion.div>
            )}
            {/* ── POSTS ─────────────────────────────────── */}
            {activeTab === "posts" && (
              <motion.div
                key="posts"
                role="tabpanel"
                id="posts-panel"
                aria-labelledby="posts-tab"
                {...anim({
                  initial: { opacity: 0, y: 12 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: -8 },
                  transition: { duration: 0.2 },
                })}
              >
                {postsLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2
                      className="h-6 w-6 animate-spin text-primary"
                      aria-label="Loading posts"
                    />
                  </div>
                ) : userPosts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
                    {userPosts.map((post) => (
                      <button
                        key={post.id}
                        className="aspect-square bg-muted rounded-lg overflow-hidden hover:opacity-80 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                        onClick={() => navigate(`/feed?post=${post.id}`)}
                        aria-label="View post"
                      >
                        {post.media_url ? (
                          <img
                            src={mediaUrl(post.media_url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-2 bg-muted/60">
                            <p className="text-xs text-center line-clamp-4 text-muted-foreground">
                              {post.content}
                            </p>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 space-y-3">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Grid3X3
                        className="h-7 w-7 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      No posts yet
                    </p>
                  </div>
                )}
              </motion.div>
            )}
            {/* ── ABOUT ─────────────────────────────────── */}
            {activeTab === "about" && (
              <motion.div
                key="about"
                role="tabpanel"
                id="about-panel"
                aria-labelledby="about-tab"
                {...anim({
                  initial: { opacity: 0, y: 12 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: -8 },
                  transition: { duration: 0.2 },
                })}
                className="space-y-4"
              >
                <SectionCard title="Profile Info" icon={Info}>
                  <dl className="space-y-0">
                    {[
                      { label: "Role", value: card.role },
                      {
                        label: "Member Since",
                        value: formatDate(card.created_at, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }),
                      },
                      card.primary_sport && card.primary_sport !== "none"
                        ? { label: "Primary Sport", value: card.primary_sport }
                        : null,
                      card.location
                        ? { label: "Location", value: card.location }
                        : null,
                    ]
                      .filter(Boolean)
                      .map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                        >
                          <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {label}
                          </dt>
                          <dd className="text-sm font-semibold capitalize">
                            {value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </SectionCard>
                {/* Skill Rating card */}
                <SectionCard title="Skill Rating" icon={TrendingUp}>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-2xl flex flex-col items-center justify-center border flex-shrink-0"
                      style={{ background: tier.bg, borderColor: tier.border }}
                    >
                      <span
                        className="font-display font-black text-lg leading-none"
                        style={{ color: tier.color }}
                      >
                        {card.skill_rating}
                      </span>
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider"
                        style={{ color: tier.color }}
                      >
                        pts
                      </span>
                    </div>
                    <div className="flex-1">
                      <div
                        className="font-bold text-sm"
                        style={{ color: tier.color }}
                      >
                        {tier.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {tier.name === "Elite" &&
                          "Top percentile player — exceptional skill."}
                        {tier.name === "Pro" &&
                          "Above-average ranking. Keep pushing!"}
                        {tier.name === "Intermediate" &&
                          "Solid foundations. Room to grow."}
                        {tier.name === "Beginner" &&
                          "Just getting started — every game counts."}
                      </div>
                      <div className="mt-2.5">
                        <MiniBar
                          value={Math.min(card.skill_rating, 2000)}
                          max={2000}
                          color="bg-primary"
                        />
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* ══ STATS DETAIL MODAL ════════════════════════════ */}
      <AnimatePresence>
        {showStatsModal && (
          <motion.div
            {...anim({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
            })}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowStatsModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stats-modal-title"
          >
            <motion.div
              {...anim({
                initial: { y: "100%" },
                animate: { y: 0 },
                exit: { y: "100%" },
                transition: { type: "spring", damping: 30, stiffness: 300 },
              })}
              className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-2xl border border-border/50 max-h-[85vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between">
                <h2
                  id="stats-modal-title"
                  className="font-display font-black text-lg"
                >
                  Detailed Stats
                </h2>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Grid */}
              <div className="p-5 grid grid-cols-2 gap-3">
                {[
                  {
                    icon: Gamepad2,
                    label: "Total Games",
                    value: card.total_games,
                    color: "#a78bfa",
                  },
                  {
                    icon: Trophy,
                    label: "Wins",
                    value: card.wins,
                    color: "#fbbf24",
                  },
                  {
                    icon: Target,
                    label: "Win Rate",
                    value: `${winRate}%`,
                    color: "#4ade80",
                  },
                  {
                    icon: Shield,
                    label: "Reliability",
                    value: `${card.reliability_score}%`,
                    color: "#38bdf8",
                  },
                  {
                    icon: Flame,
                    label: "Streak",
                    value: card.current_streak ?? 0,
                    color: "#fb923c",
                  },
                  {
                    icon: Star,
                    label: "Skill Rating",
                    value: card.skill_rating,
                    color: tier.color,
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-center space-y-1.5"
                  >
                    <Icon
                      className="h-5 w-5 mx-auto"
                      style={{ color }}
                      aria-hidden
                    />
                    <div
                      className="font-display font-black text-2xl tabular-nums"
                      style={{ color }}
                    >
                      {value}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}