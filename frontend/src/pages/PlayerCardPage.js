import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  playerCardAPI,
  recommendationAPI,
  socialAPI,
  careerAPI,
  coachingAPI,
} from "@/lib/api";
import {
  Loader2,
  ArrowLeft,
  User,
  Zap,
  Grid,
  BarChart3,
  Users,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Extracted Components
import LevelUpGuideModal from "@/components/player-card/LevelUpGuideModal";
import PaymentReviewModal from "@/components/player-card/PaymentReviewModal";
import CoachingSection from "@/components/player-card/CoachingSection";
import CareerSection from "@/components/player-card/CareerSection";
import UserPostsSection from "@/components/player-card/UserPostsSection";
import PlayerCardHeader from "@/components/player-card/PlayerCardHeader";
import OverallScoreSection from "@/components/player-card/OverallScoreSection";
import AchievementsSection from "@/components/player-card/AchievementsSection";

/* ─── Tab definition for cleaner rendering ─────────────────────────────── */
const BASE_TABS = [
  { key: "posts", icon: Grid, label: "Posts" },
  { key: "stats", icon: BarChart3, label: "Stats" },
];
const COACH_TAB = { key: "coaching", icon: Users, label: "Coaching" };
const BADGES_TAB = { key: "badges", icon: Award, label: "Badges" };

export default function PlayerCardPage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // State
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [compatibility, setCompatibility] = useState(null);
  const [engagementScore, setEngagementScore] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [career, setCareer] = useState(null);
  const [showLevelUpGuide, setShowLevelUpGuide] = useState(false);
  const [coachData, setCoachData] = useState(null);
  const [coachPackages, setCoachPackages] = useState([]);

  // Coaching / Booking State
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [coachSlots, setCoachSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingSport, setBookingSport] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const [payStep, setPayStep] = useState(null);
  const [pendingSession, setPendingSession] = useState(null);
  const [pendingSubPkg, setPendingSubPkg] = useState(null);
  const [activeTab, setActiveTab] = useState("stats");

  const isOwnProfile = useMemo(
    () => !userId || userId === "me" || userId === currentUser?.id,
    [userId, currentUser?.id],
  );

  // Derived Values
  const tier = useMemo(() => {
    if (!card) return { name: "Beginner", color: "text-muted-foreground" };
    const rating = card.skill_rating;
    if (rating >= 2000) return { name: "Elite", color: "text-brand-400" };
    if (rating >= 1700) return { name: "Pro", color: "text-brand-500" };
    if (rating >= 1400)
      return { name: "Intermediate", color: "text-brand-600" };
    return { name: "Beginner", color: "text-muted-foreground" };
  }, [card]);

  const winRate = useMemo(() => {
    if (!card || card.total_games === 0) return 0;
    return Math.round(
      (card.wins / Math.max(card.wins + card.losses + card.draws, 1)) * 100,
    );
  }, [card]);

  const tabs = useMemo(() => {
    const t = [...BASE_TABS];
    if (card?.role === "coach") t.push(COACH_TAB);
    t.push(BADGES_TAB);
    return t;
  }, [card?.role]);

  // Data Fetching
  const loadCoachSlots = useCallback(async (coachId, date) => {
    setSlotsLoading(true);
    try {
      const res = await coachingAPI.getCoachSlots(coachId, date);
      setCoachSlots(res.data?.slots || res.data || []);
    } catch {
      setCoachSlots([]);
    }
    setSlotsLoading(false);
  }, []);

  const loadProfileData = useCallback(async () => {
    if (isOwnProfile && currentUser?.role === "super_admin") {
      navigate("/profile", { replace: true });
      return;
    }

    const isMe = !userId || userId === "me" || userId === currentUser?.id;
    const targetId = isMe ? currentUser?.id : userId;
    if (!targetId) return;

    setLoading(true);

    // Eliminating Waterfalls: Fetch independent data in parallel
    const promises = [
      (isMe ? playerCardAPI.getMyCard() : playerCardAPI.getCard(userId)).then(
        (res) => {
          setCard(res.data);
          setIsFollowing(res.data.is_following);
          if (res.data?.role === "coach") {
            coachingAPI
              .getCoach(targetId)
              .then((r) => setCoachData(r.data))
              .catch(() => {});
            coachingAPI
              .getCoachPackages(targetId)
              .then((r) => setCoachPackages(r.data || []))
              .catch(() => {});
          }
        },
      ),
      recommendationAPI
        .userEngagement(targetId)
        .then((res) => setEngagementScore(res.data))
        .catch(() => {}),
      careerAPI
        .getCareer(targetId)
        .then((res) => setCareer(res.data))
        .catch(() => {}),
    ];

    if (!isMe) {
      promises.push(
        recommendationAPI
          .compatibility(targetId)
          .then((res) => setCompatibility(res.data))
          .catch(() => {}),
      );
    }

    setPostsLoading(true);
    promises.push(
      socialAPI
        .getUserPosts(targetId, 1)
        .then((res) => setUserPosts(res.data?.posts || []))
        .catch(() => {})
        .finally(() => setPostsLoading(false)),
    );

    await Promise.all(promises).finally(() => setLoading(false));
  }, [userId, currentUser?.id, isOwnProfile, navigate]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    if (coachData && card?.user_id && !isOwnProfile) {
      setBookingSport(coachData.coaching_sports?.[0] || "");
      loadCoachSlots(card.user_id, selectedDate);
    }
  }, [coachData, card?.user_id, isOwnProfile, selectedDate, loadCoachSlots]);

  // Handlers
  const handleFollow = useCallback(async () => {
    if (!card) return;
    const prev = isFollowing;
    const prevCount = card.followers_count || 0;

    setIsFollowing(!prev);
    setCard((c) => ({
      ...c,
      followers_count: !prev ? prevCount + 1 : Math.max(0, prevCount - 1),
    }));

    try {
      const res = await socialAPI.toggleFollow(card.user_id);
      setIsFollowing(res.data.following);
    } catch {
      setIsFollowing(prev);
      setCard((c) => ({ ...c, followers_count: prevCount }));
      toast.error("Failed to update follow status");
    }
  }, [card, isFollowing]);

  const handleDateChange = useCallback(
    (date) => {
      setSelectedDate(date);
      setSelectedSlot(null);
      if (card?.user_id) loadCoachSlots(card.user_id, date);
    },
    [card?.user_id, loadCoachSlots],
  );

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (document.getElementById("rzp-script")) {
        resolve(true);
        return;
      }
      const s = document.createElement("script");
      s.id = "rzp-script";
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleBook = useCallback(async () => {
    if (!selectedSlot || !card) return;
    setBooking(true);
    try {
      const res = await coachingAPI.bookSession({
        coach_id: card.user_id,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        sport: bookingSport,
        notes: bookingNotes,
      });
      const session = res.data;
      if (session.booked_from_package) {
        toast.success(
          `Booked from package! ${session.sessions_remaining} sessions remaining.`,
        );
        setSelectedSlot(null);
        loadCoachSlots(card.user_id, selectedDate);
        setBooking(false);
        return;
      }
      if (session.payment_gateway === "razorpay" && session.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          toast.error("Payment gateway failed");
          setBooking(false);
          return;
        }
        new window.Razorpay({
          key: session.razorpay_key_id,
          amount: session.price * 100,
          currency: "INR",
          order_id: session.razorpay_order_id,
          name: card.name || "Coaching Session",
          description: `${session.sport} · ${session.date} · ${session.start_time}`,
          handler: async (response) => {
            try {
              await coachingAPI.verifyPayment(session.id, response);
              toast.success("Payment successful! Session confirmed.");
              setSelectedSlot(null);
              loadCoachSlots(card.user_id, selectedDate);
            } catch {
              toast.error("Payment verification failed");
            }
          },
          modal: { ondismiss: () => toast.info("Payment cancelled.") },
          theme: { color: "#10B981" },
        }).open();
      } else if (session.payment_gateway === "test") {
        setPendingSession(session);
        setPayStep("review");
      } else {
        toast.success("Session booked!");
        setSelectedSlot(null);
        loadCoachSlots(card.user_id, selectedDate);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to book");
    }
    setBooking(false);
  }, [
    selectedSlot,
    card,
    selectedDate,
    bookingSport,
    bookingNotes,
    loadCoachSlots,
  ]);

  const handleSubscribe = useCallback(
    async (pkg) => {
      setSubscribing(true);
      try {
        const res = await coachingAPI.subscribe(pkg.id);
        const sub = res.data;
        if (sub.payment_gateway === "razorpay" && sub.razorpay_order_id) {
          const loaded = await loadRazorpayScript();
          if (!loaded) {
            toast.error("Payment gateway failed");
            setSubscribing(false);
            return;
          }
          new window.Razorpay({
            key: sub.razorpay_key_id,
            amount: sub.price * 100,
            currency: "INR",
            order_id: sub.razorpay_order_id,
            name: pkg.coach_name || "Coaching Package",
            description: `${pkg.name} - ${pkg.sessions_per_month} sessions/month`,
            handler: async (response) => {
              try {
                await coachingAPI.verifySubPayment(sub.id, response);
                toast.success("Subscribed successfully!");
                coachingAPI
                  .getCoachPackages(card.user_id)
                  .then((r) => setCoachPackages(r.data || []))
                  .catch(() => {});
              } catch {
                toast.error("Payment verification failed");
              }
            },
            modal: { ondismiss: () => toast.info("Payment cancelled.") },
            theme: { color: "#10B981" },
          }).open();
        } else if (sub.payment_gateway === "test") {
          setPendingSubPkg({
            ...pkg,
            sub_id: sub.id,
            sub_price: sub.price || pkg.price,
          });
          setPayStep("review");
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to subscribe");
      }
      setSubscribing(false);
    },
    [card?.user_id],
  );

  const handleTestSessionPayment = useCallback(async () => {
    if (!pendingSession) return;
    setPayStep("processing");
    try {
      await coachingAPI.testConfirm(pendingSession.id);
      setPayStep("done");
      toast.success("Payment successful! Session confirmed.");
      setSelectedSlot(null);
      loadCoachSlots(card.user_id, selectedDate);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
      setPayStep("review");
    }
  }, [pendingSession, card?.user_id, selectedDate, loadCoachSlots]);

  const handleTestSubPayment = useCallback(async () => {
    if (!pendingSubPkg) return;
    setPayStep("processing");
    try {
      await coachingAPI.testConfirmSub(pendingSubPkg.sub_id);
      setPayStep("done");
      toast.success("Subscribed successfully!");
      coachingAPI
        .getCoachPackages(card.user_id)
        .then((r) => setCoachPackages(r.data || []))
        .catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
      setPayStep("review");
    }
  }, [pendingSubPkg, card?.user_id]);

  const closePaymentReview = useCallback(() => {
    setPayStep(null);
    setPendingSession(null);
    setPendingSubPkg(null);
  }, []);

  /* ─── Loading / Empty States ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-background via-background to-brand-50/30 dark:to-brand-950/20"
        role="status"
        aria-busy="true"
      >
        <div className="relative">
          <Loader2
            className="h-8 w-8 animate-spin text-brand-600"
            aria-hidden="true"
          />
          <div className="absolute inset-0 h-8 w-8 animate-ping text-brand-600/20 rounded-full" />
        </div>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Loading Profile…
        </span>
      </div>
    );
  }

  if (!card) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20"
        role="alert"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center px-6 max-w-md"
        >
          <div className="h-24 w-24 mx-auto rounded-2xl bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/20 flex items-center justify-center mb-6 shadow-lg">
            <Avatar className="h-12 w-12">
              {/* placeholder icon inside fallback */}
              <AvatarFallback>
                <User
                  className="h-6 w-6 text-muted-foreground/40"
                  aria-hidden="true"
                />
              </AvatarFallback>
            </Avatar>
          </div>
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            Profile Not Found
          </h3>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            This athlete doesn't exist or is no longer available.
          </p>
          <Button
            variant="athletic-outline"
            className="rounded-xl min-h-[48px] px-6 hover:bg-secondary/50 active:bg-secondary/70 transition-colors duration-200"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" /> Go Back
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-brand-50/20 dark:to-brand-950/10 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl -z-10" />

      <div className="mx-auto relative z-10 sm:border-x border-border/20 min-h-screen bg-background/80 backdrop-blur-sm">
        {/* ── Top App Bar ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/20 flex items-center justify-between px-4 h-14 shadow-sm">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-secondary/50 dark:hover:bg-secondary/40 active:bg-secondary/70 dark:active:bg-secondary/60 rounded-full transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 outline-none touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="font-bold text-sm tracking-tight">
            {card.name.toLowerCase().replace(/\s+/g, "_")}
          </span>
          <div className="w-10" />
        </div>

        {/* ── Profile Header ─────────────────────────────────────────── */}
        <PlayerCardHeader
          card={card}
          coachData={coachData}
          currentUser={currentUser}
          isFollowing={isFollowing}
          handleFollow={handleFollow}
          navigate={navigate}
          tier={tier}
        />

        {/* ── Tab Navigation ─────────────────────────────────────────── */}
        <div className="flex border-t border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-14 z-30 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-4 flex flex-col items-center justify-center gap-1.5 relative cursor-pointer group touch-manipulation transition-all duration-200 ${
                  isActive
                    ? "bg-brand-600/5"
                    : "hover:bg-secondary/30 active:bg-secondary/50"
                }`}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={`h-[22px] w-[22px] transition-all duration-300 ${
                    isActive
                      ? "text-brand-600 scale-110 stroke-[2.5]"
                      : "text-muted-foreground/50 group-hover:text-muted-foreground group-hover:scale-105"
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`text-[10px] font-medium transition-all duration-200 ${
                    isActive
                      ? "text-brand-600 font-semibold"
                      : "text-muted-foreground/70 group-hover:text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500 rounded-b shadow-lg shadow-brand-500/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────── */}
        <div className="min-h-[500px] overflow-hidden bg-gradient-to-b from-background to-background/95">
          <AnimatePresence mode="wait">
            {/* ── Stats Tab ── */}
            {activeTab === "stats" && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {/* Overall Score */}
                <div className="px-4 sm:px-5 pt-5 sm:pt-6 pb-2">
                  <OverallScoreSection
                    card={card}
                    isOwnProfile={isOwnProfile}
                    onShowGuide={() => setShowLevelUpGuide(true)}
                  />
                </div>

                {/* Core Stats Grid */}
                <div className="px-4 sm:px-5 py-4 sm:py-6">
                  <div className="grid grid-cols-3 gap-0 border border-border/20 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                    {[
                      {
                        value: card.total_games,
                        label: "Games",
                        highlight: false,
                      },
                      {
                        value: `${winRate}%`,
                        label: "Win Rate",
                        highlight: true,
                      },
                      {
                        value: `${card.reliability_score}%`,
                        label: "Reliability",
                        highlight: false,
                      },
                    ].map((stat, i) => (
                      <div
                        key={stat.label}
                        className={`py-5 sm:py-7 px-2 flex flex-col items-center transition-colors duration-200 hover:shadow-lg cursor-default ${
                          i < 2 ? "border-r border-border/20" : ""
                        } ${stat.highlight ? "bg-gradient-to-br from-brand-500/10 to-brand-600/5 hover:from-brand-500/20 hover:to-brand-600/10" : "bg-gradient-to-br from-secondary/10 to-secondary/5 hover:from-secondary/20 hover:to-secondary/10"}`}
                      >
                        <div
                          className={`font-display text-xl sm:text-2xl font-black tracking-tighter tabular-nums ${stat.highlight ? "text-brand-600" : "text-foreground"}`}
                        >
                          {stat.value}
                        </div>
                        <div
                          className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${stat.highlight ? "text-brand-600/70" : "text-muted-foreground/60"}`}
                        >
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* W / L / D Row */}
                  <div className="flex justify-center items-center gap-3 sm:gap-10 mt-4 sm:mt-6">
                    {[
                      {
                        value: card.wins,
                        label: "Wins",
                        color: "text-brand-600",
                        bgColor: "bg-brand-600/10",
                      },
                      {
                        value: card.losses,
                        label: "Losses",
                        color: "text-red-500",
                        bgColor: "bg-red-500/10",
                      },
                      {
                        value: card.draws,
                        label: "Draws",
                        color: "text-muted-foreground",
                        bgColor: "bg-muted-foreground/10",
                      },
                    ].map((s, i) => (
                      <div key={s.label} className="flex items-center gap-3 sm:gap-6">
                        <div
                          className={`text-center group px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl ${s.bgColor} hover:scale-110 transition-all duration-300 cursor-default`}
                        >
                          <div
                            className={`text-base sm:text-lg font-bold ${s.color} tabular-nums leading-none mb-1`}
                          >
                            {s.value}
                          </div>
                          <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] opacity-50">
                            {s.label}
                          </div>
                        </div>
                        {i < 2 && <span className="h-4 w-px bg-border/20" />}
                      </div>
                    ))}
                  </div>

                  {/* Performance Rating */}
                  {card.avg_review_rating > 0 && (
                    <div className="flex justify-center mt-6 sm:mt-10">
                      <div className="flex flex-col items-center px-6 sm:px-8 py-4 sm:py-5 rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-600/5 border border-brand-500/20 hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/20 transition-all duration-300 cursor-default">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="font-display text-3xl font-black text-brand-600 leading-none">
                            {Number(card.avg_review_rating).toFixed(1)}
                          </span>
                        </div>
                        <div className="text-[10px] font-black text-brand-600/50 uppercase tracking-widest flex items-center gap-1.5">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`h-2.5 w-2.5 transition-all duration-300 ${i < Math.floor(card.avg_review_rating) ? "fill-brand-600 scale-110" : "fill-brand-600/20"}`}
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                              </svg>
                            ))}
                          </div>
                          Performance
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compatibility */}
                {compatibility && compatibility.score > 0 && (
                  <div className="mx-4 sm:mx-5 mb-5 sm:mb-6 p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-600/5 border border-brand-500/20 relative overflow-hidden hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/20 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -z-10" />
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 mb-0.5 block">
                          Compatibility
                        </span>
                        <h4 className="text-sm font-bold text-foreground">
                          AI Match Analysis
                        </h4>
                      </div>
                      <div className="bg-gradient-to-r from-brand-600 to-brand-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide shadow-lg shadow-brand-500/30">
                        {compatibility.grade}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="font-display text-3xl font-black tracking-tighter leading-none text-foreground">
                        {compatibility.score}%
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        match
                      </span>
                    </div>

                    <div className="h-2 w-full bg-background/50 rounded-full overflow-hidden border border-border/20 mb-5 shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${compatibility.score}%` }}
                        transition={{ duration: 1.2, ease: "circOut" }}
                        className="h-full bg-gradient-to-r from-brand-600 to-brand-500 rounded-full shadow-lg"
                      />
                    </div>

                    {compatibility.breakdown && (
                      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                        {Object.entries(compatibility.breakdown).map(
                          ([key, val]) => (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">
                                  {key.replace(/_/g, " ")}
                                </span>
                                <span className="text-[10px] font-bold text-foreground tabular-nums opacity-50">
                                  {val.score}/{val.max}
                                </span>
                              </div>
                              <div className="h-1 bg-background rounded-full overflow-hidden border border-border/5">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${(val.score / val.max) * 100}%`,
                                  }}
                                  transition={{ duration: 1, delay: 0.5 }}
                                  className="h-full bg-brand-500/40 rounded-full"
                                />
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Engagement */}
                {engagementScore && engagementScore.score > 0 && (
                  <div className="mx-4 sm:mx-5 mb-5 sm:mb-6 p-4 sm:p-5 rounded-2xl border border-border/10 bg-secondary/5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shrink-0">
                        <Zap className="h-5 w-5 text-brand-500 fill-brand-500/30" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 block mb-0.5">
                              Arena Engagement
                            </span>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">
                                Level {engagementScore.level}
                              </h4>
                              <span className="text-[10px] font-bold text-brand-500 px-1.5 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 tabular-nums">
                                {engagementScore.score}/100
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${engagementScore.score}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                            className="h-full bg-brand-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Career */}
                <CareerSection career={career} />

                {/* Sports Mastery */}
                {Object.keys(card.sports_played || {}).length > 0 && (
                  <div className="mx-4 sm:mx-5 mb-5 sm:mb-6 p-4 sm:p-5 rounded-2xl border border-border/20 bg-gradient-to-br from-secondary/10 to-secondary/5 hover:border-brand-500/30 hover:shadow-lg transition-all duration-300">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 mb-4 flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-brand-600" />
                      Sports Mastery
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(card.sports_played)
                        .sort(([, a], [, b]) => b - a)
                        .map(([sport, count]) => (
                          <div
                            key={sport}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border/20 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all duration-200 cursor-default group"
                          >
                            <span className="text-xs font-semibold text-foreground capitalize group-hover:text-brand-600 transition-colors">
                              {sport}
                            </span>
                            <span className="text-[10px] font-bold text-brand-600 tabular-nums px-1.5 py-0.5 rounded-full bg-brand-600/10 border border-brand-600/20">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Posts Tab ── */}
            {activeTab === "posts" && (
              <motion.div
                key="posts"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <UserPostsSection
                  posts={userPosts}
                  loading={postsLoading}
                  postCount={card.post_count}
                  card={card}
                />
              </motion.div>
            )}

            {/* ── Coaching Tab ── */}
            {activeTab === "coaching" && card.role === "coach" && (
              <motion.div
                key="coaching"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="px-4 pb-6"
              >
                <CoachingSection
                  card={card}
                  coachData={coachData}
                  coachPackages={coachPackages}
                  isOwnProfile={isOwnProfile}
                  subscribing={subscribing}
                  onSubscribe={handleSubscribe}
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  coachSlots={coachSlots}
                  slotsLoading={slotsLoading}
                  bookingSport={bookingSport}
                  bookingNotes={bookingNotes}
                  booking={booking}
                  onDateChange={handleDateChange}
                  onSlotSelect={setSelectedSlot}
                  onSportSelect={setBookingSport}
                  onNotesChange={setBookingNotes}
                  onBook={handleBook}
                />
              </motion.div>
            )}

            {/* ── Badges Tab ── */}
            {activeTab === "badges" && (
              <motion.div
                key="badges"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <AchievementsSection badges={card.badges} />

                <div className="px-6 py-12 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                    Joined{" "}
                    {new Date(
                      card.member_since || card.created_at || Date.now(),
                    ).toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <LevelUpGuideModal
        isOpen={showLevelUpGuide}
        onClose={() => setShowLevelUpGuide(false)}
      />

      <PaymentReviewModal
        payStep={payStep}
        pendingSession={pendingSession}
        pendingSubPkg={pendingSubPkg}
        card={card}
        onClose={closePaymentReview}
        onConfirmSession={handleTestSessionPayment}
        onConfirmSub={handleTestSubPayment}
      />
    </div>
  );
}
