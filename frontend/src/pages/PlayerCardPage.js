import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { playerCardAPI, recommendationAPI, socialAPI, careerAPI, coachingAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AthleticStatCard } from "@/components/ui/stat-card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Target, Shield, Zap, Star, Crown, Award, Medal,
  Gamepad2, Calendar, TrendingUp, Loader2, ArrowLeft, User,
  Heart, MessageCircle, UserPlus, Users, Grid3X3, Flame,
  Dumbbell, Building2, BadgeCheck, Info, X, Swords,
  GraduationCap, CheckCircle2, Footprints, MapPin, Briefcase, Package
} from "lucide-react";
import { toast } from "sonner";

const BADGE_ICONS = {
  trophy: Trophy,
  star: Star,
  zap: Zap,
  crown: Crown,
  award: Award,
  shield: Shield,
  medal: Medal,
  "badge-check": BadgeCheck,
};

const BADGE_COLORS = {
  Century: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  Veteran: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  Regular: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  Elite: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  Pro: "text-green-400 bg-green-400/10 border-green-400/30",
  Reliable: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  Champion: "text-red-400 bg-red-400/10 border-red-400/30",
  Verified: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

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
  const [career, setCareer] = useState(null);
  const [showLevelUpGuide, setShowLevelUpGuide] = useState(false);
  const [coachData, setCoachData] = useState(null);
  const [coachPackages, setCoachPackages] = useState([]);
  // Inline booking state (coach profile)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [coachSlots, setCoachSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingSport, setBookingSport] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  // Payment review flow (matches venue booking pattern)
  const [payStep, setPayStep] = useState(null); // null | "review" | "processing" | "done"
  const [pendingSession, setPendingSession] = useState(null);
  const [pendingSubPkg, setPendingSubPkg] = useState(null);

  const isOwnProfile = !userId || userId === "me" || userId === currentUser?.id;

  // Admins don't have player stats — redirect to profile if viewing own card
  useEffect(() => {
    if (isOwnProfile && currentUser?.role === "super_admin") {
      navigate("/profile", { replace: true });
    }
  }, [isOwnProfile, currentUser?.role, navigate]);

  useEffect(() => {
    if (isOwnProfile && currentUser?.role === "super_admin") return;
    const isMe = !userId || userId === "me" || userId === currentUser?.id;
    setLoading(true);
    const resolvedId = isMe ? currentUser?.id : userId;
    const loadCard = (isMe ? playerCardAPI.getMyCard() : playerCardAPI.getCard(userId))
      .then(res => {
        setCard(res.data);
        if (res.data?.role === "coach" && resolvedId) {
          coachingAPI.getCoach(resolvedId).then(r => setCoachData(r.data)).catch(() => {});
          coachingAPI.getCoachPackages(resolvedId).then(r => setCoachPackages(r.data || [])).catch(() => {});
        }
      })
      .catch(() => toast.error("Failed to load Lobbian card"));

    const loadEngagement = recommendationAPI.userEngagement(isMe ? currentUser?.id : userId)
      .then(res => setEngagementScore(res.data))
      .catch(() => {});

    if (!isMe && userId) {
      recommendationAPI.compatibility(userId)
        .then(res => setCompatibility(res.data))
        .catch(() => {});
    }

    // Load user's posts
    const targetId = isMe ? currentUser?.id : userId;
    if (targetId) {
      setPostsLoading(true);
      socialAPI.getUserPosts(targetId, 1)
        .then(res => setUserPosts(res.data?.posts || []))
        .catch(() => {})
        .finally(() => setPostsLoading(false));
    }

    // Load career & performance data
    const careerTargetId = isMe ? currentUser?.id : userId;
    if (careerTargetId) {
      careerAPI.getCareer(careerTargetId)
        .then(res => setCareer(res.data))
        .catch(() => {});
    }

    Promise.all([loadCard, loadEngagement]).finally(() => setLoading(false));
  }, [userId, currentUser?.id]);

  useEffect(() => {
    if (card) setIsFollowing(card.is_following);
  }, [card]);

  const handleFollow = async () => {
    if (!card) return;
    setIsFollowing((prev) => !prev);
    try {
      const res = await socialAPI.toggleFollow(card.user_id);
      setIsFollowing(res.data.following);
    } catch { setIsFollowing((prev) => !prev); toast.error("Failed"); }
  };

  // ── Inline coaching booking ──
  const loadCoachSlots = useCallback(async (coachId, date) => {
    setSlotsLoading(true);
    try {
      const res = await coachingAPI.getCoachSlots(coachId, date);
      setCoachSlots(res.data?.slots || res.data || []);
    } catch { setCoachSlots([]); }
    setSlotsLoading(false);
  }, []);

  useEffect(() => {
    if (coachData && card?.user_id && !isOwnProfile) {
      setBookingSport(coachData.coaching_sports?.[0] || "");
      loadCoachSlots(card.user_id, selectedDate);
    }
  }, [coachData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (card?.user_id) loadCoachSlots(card.user_id, date);
  };

  const loadRazorpayScript = () => new Promise(resolve => {
    if (document.getElementById("rzp-script")) { resolve(true); return; }
    const s = document.createElement("script");
    s.id = "rzp-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

  const handleBook = async () => {
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
        toast.success(`Booked from package! ${session.sessions_remaining} sessions remaining.`);
        setSelectedSlot(null);
        loadCoachSlots(card.user_id, selectedDate);
        setBooking(false);
        return;
      }
      if (session.payment_gateway === "razorpay" && session.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed"); setBooking(false); return; }
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
            } catch { toast.error("Payment verification failed"); }
          },
          modal: { ondismiss: () => toast.info("Payment cancelled.") },
          theme: { color: "#10B981" },
        }).open();
      } else if (session.payment_gateway === "test") {
        // Show review step like venue booking — don't auto-confirm
        setPendingSession(session);
        setPayStep("review");
      } else {
        toast.success("Session booked!");
        setSelectedSlot(null);
        loadCoachSlots(card.user_id, selectedDate);
      }
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to book"); }
    setBooking(false);
  };

  // Test payment confirmation (matches venue booking pattern)
  const handleTestSessionPayment = async () => {
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
  };

  const handleSubscribe = async (pkg) => {
    setSubscribing(true);
    try {
      const res = await coachingAPI.subscribe(pkg.id);
      const sub = res.data;
      if (sub.payment_gateway === "razorpay" && sub.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed"); setSubscribing(false); return; }
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
              coachingAPI.getCoachPackages(card.user_id).then(r => setCoachPackages(r.data || [])).catch(() => {});
            } catch { toast.error("Payment verification failed"); }
          },
          modal: { ondismiss: () => toast.info("Payment cancelled.") },
          theme: { color: "#10B981" },
        }).open();
      } else if (sub.payment_gateway === "test") {
        // Show review step like venue booking — don't auto-confirm
        setPendingSubPkg({ ...pkg, sub_id: sub.id, sub_price: sub.price || pkg.price });
        setPayStep("review");
      }
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to subscribe"); }
    setSubscribing(false);
  };

  // Test subscription payment confirmation
  const handleTestSubPayment = async () => {
    if (!pendingSubPkg) return;
    setPayStep("processing");
    try {
      await coachingAPI.testConfirmSub(pendingSubPkg.sub_id);
      setPayStep("done");
      toast.success("Subscribed successfully!");
      coachingAPI.getCoachPackages(card.user_id).then(r => setCoachPackages(r.data || [])).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
      setPayStep("review");
    }
  };

  const closePaymentReview = () => {
    setPayStep(null);
    setPendingSession(null);
    setPendingSubPkg(null);
  };

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const getRatingTier = (rating) => {
    if (rating >= 2000) return { name: "Elite", color: "text-amber-400" };
    if (rating >= 1700) return { name: "Pro", color: "text-green-400" };
    if (rating >= 1400) return { name: "Intermediate", color: "text-blue-400" };
    return { name: "Beginner", color: "text-muted-foreground" };
  };

  const getPerformanceTypeColor = (type) => {
    const t = (type || "").toLowerCase();
    if (t === "win" || t === "victory") return "bg-green-500/10 text-green-400 border-green-500/20";
    if (t === "loss" || t === "defeat") return "bg-red-500/10 text-red-400 border-red-500/20";
    if (t === "draw") return "bg-muted/50 text-muted-foreground border-border/30";
    if (t === "tournament") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (t === "training") return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-display text-xl font-bold text-muted-foreground">
            Lobbian not found
          </h3>
          <Button variant="athletic-outline" className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const tier = getRatingTier(card.skill_rating);
  const winRate =
    card.total_games > 0
      ? Math.round((card.wins / Math.max(card.wins + card.losses + card.draws, 1)) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back Button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </motion.div>

        {/* Player Card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden shadow-lg"
        >
          {/* Header */}
          <div className="p-8 pb-6 text-center relative">
            <div className="absolute top-4 right-4">
              <Badge variant="athletic" className="text-xs font-bold uppercase">
                {card.role}
              </Badge>
            </div>

            {/* Avatar */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="h-24 w-24 rounded-full bg-primary/20 border-4 border-primary/30 flex items-center justify-center mx-auto mb-4"
            >
              {card.avatar ? (
                <img src={mediaUrl(card.avatar)} alt={card.name} className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-primary" />
              )}
            </motion.div>

            <h1 className="font-display text-2xl font-black tracking-athletic flex items-center justify-center gap-1.5">
              {card.name}
              {card.is_verified && (
                <BadgeCheck className="h-5 w-5 text-blue-400 shrink-0" />
              )}
            </h1>

            {/* Rating / Coach Stats */}
            {card.role === "coach" ? (
              <div className="mt-3">
                {coachData ? (
                  <div className="flex items-center justify-center gap-4">
                    {coachData.coaching_rating > 0 && (
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-amber-400 shrink-0" />
                        <span className="font-display text-4xl font-black text-amber-400">{Number(coachData.coaching_rating).toFixed(1)}</span>
                        <div className="text-left">
                          <Badge className="text-[10px] font-bold bg-amber-400/10 text-amber-400 border-amber-400/30">Rating</Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{coachData.total_sessions || 0} sessions</p>
                        </div>
                      </div>
                    )}
                    {coachData.session_price > 0 && (
                      <div className={`text-right ${coachData.coaching_rating > 0 ? "border-l border-border/40 pl-4" : ""}`}>
                        <p className="font-black text-2xl text-primary">₹{coachData.session_price}</p>
                        <p className="text-[10px] text-muted-foreground">{coachData.session_duration_minutes || 60} min / session</p>
                      </div>
                    )}
                    {!coachData.coaching_rating && !coachData.session_price && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        <span className="font-bold text-sm text-primary">Professional Coach</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <span className="font-bold text-sm text-primary">Professional Coach</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className={`font-display text-4xl font-black ${tier.color}`}>
                  {card.skill_rating}
                </span>
                <div className="text-left">
                  <Badge variant="glow" className="text-[10px] font-bold">
                    {tier.name}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Skill Rating</p>
                </div>
              </div>
            )}

            {/* Primary Sport / Coaching Sports */}
            {card.role === "coach" ? (
              coachData?.coaching_sports?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                  {coachData.coaching_sports.slice(0, 4).map(s => (
                    <Badge key={s} variant="secondary" className="text-xs capitalize font-bold">{s.replace(/_/g, " ")}</Badge>
                  ))}
                  {coachData.years_of_experience > 0 && (
                    <Badge className="text-xs font-bold bg-violet-500/10 text-violet-400 border-violet-500/20">
                      {coachData.years_of_experience}+ yrs exp
                    </Badge>
                  )}
                </div>
              ) : coachData?.years_of_experience > 0 ? (
                <Badge className="mt-3 text-xs font-bold bg-violet-500/10 text-violet-400 border-violet-500/20">
                  {coachData.years_of_experience}+ yrs exp
                </Badge>
              ) : null
            ) : (
              card.primary_sport !== "none" && (
                <Badge variant="sport" className="mt-3 text-xs font-bold uppercase">
                  {card.primary_sport}
                </Badge>
              )
            )}

            {/* City + Venue — coaches only */}
            {card.role === "coach" && coachData?.city && (
              <p className="mt-2 text-xs text-muted-foreground flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {coachData.city}{coachData.coaching_venue && ` · ${coachData.coaching_venue}`}
              </p>
            )}

            {/* Social Stats */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="text-center">
                <div className="font-display font-black text-lg">{card.post_count || 0}</div>
                <div className="text-[10px] text-muted-foreground font-semibold">Posts</div>
              </div>
              <div className="text-center">
                <div className="font-display font-black text-lg">{card.followers_count || 0}</div>
                <div className="text-[10px] text-muted-foreground font-semibold">Followers</div>
              </div>
              <div className="text-center">
                <div className="font-display font-black text-lg">{card.following_count || 0}</div>
                <div className="text-[10px] text-muted-foreground font-semibold">Following</div>
              </div>
              {card.current_streak > 0 && (
                <div className="text-center">
                  <div className="font-display font-black text-lg text-orange-500 flex items-center justify-center gap-1">
                    <Flame className="h-4 w-4" />{card.current_streak}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold">Streak</div>
                </div>
              )}
            </div>

            {/* Follow + Message + Book Buttons */}
            {card.user_id !== currentUser?.id && (
              <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                <Button
                  variant={isFollowing ? "outline" : "athletic"}
                  className="min-w-[100px]"
                  onClick={handleFollow}>
                  {isFollowing ? <><Users className="h-4 w-4 mr-2" /> Following</> : <><UserPlus className="h-4 w-4 mr-2" /> Follow</>}
                </Button>
                <Button variant="athletic-outline"
                  onClick={() => navigate(`/chat?user=${card.user_id}`)}>
                  <MessageCircle className="h-4 w-4 mr-2" /> Message
                </Button>
                {card.role === "coach" && coachData && (
                  <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => document.getElementById("coach-book-section")?.scrollIntoView({ behavior: "smooth" })}>
                    <Calendar className="h-4 w-4 mr-2" /> Book
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Overall Skill Score — players only */}
          {card.role !== "coach" && card.overall_score !== undefined && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border-2 border-border/50 bg-card/80 backdrop-blur-md p-6 mb-6">
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/20" />
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6"
                      strokeDasharray={`${card.overall_score * 2.64} 264`} strokeLinecap="round"
                      className={card.overall_score >= 86 ? "text-amber-400" : card.overall_score >= 71 ? "text-violet-400" : card.overall_score >= 51 ? "text-brand-400" : card.overall_score >= 31 ? "text-blue-400" : "text-muted-foreground"} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-2xl font-black">{card.overall_score}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Score</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display text-lg font-black">Overall Rating</h3>
                    <Badge className={`text-[10px] ${card.overall_score >= 86 ? "bg-amber-400/20 text-amber-400" : card.overall_score >= 71 ? "bg-violet-400/20 text-violet-400" : card.overall_score >= 51 ? "bg-brand-400/20 text-brand-400" : card.overall_score >= 31 ? "bg-blue-400/20 text-blue-400" : "bg-muted text-muted-foreground"}`}>
                      {card.overall_tier}
                    </Badge>
                    {isOwnProfile && (
                      <button onClick={() => setShowLevelUpGuide(true)}
                        className="ml-auto p-1 rounded-full hover:bg-muted transition-colors" title="How to level up">
                        <Info className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </button>
                    )}
                  </div>
                  {isOwnProfile && card.overall_score < 50 && (
                    <p className="text-[10px] text-muted-foreground mb-2">
                      {card.overall_score < 20 ? "Play matches and stay active to start leveling up" :
                       card.overall_score < 35 ? "Keep playing! You're building your stats" :
                       "Almost Intermediate! Focus on winning and tournaments"}
                    </p>
                  )}
                  {card.score_breakdown && (
                    <div className="space-y-1.5">
                      {[
                        { label: "Skill", value: card.score_breakdown.skill, color: "bg-primary", tip: card.score_breakdown.skill < 30 ? "Play rated matches" : null },
                        { label: "Win Rate", value: card.score_breakdown.win_rate, color: "bg-brand-500", tip: card.score_breakdown.win_rate === 0 ? "Win matches to boost" : null },
                        { label: "Tournament", value: card.score_breakdown.tournament, color: "bg-amber-500", tip: card.score_breakdown.tournament === 0 ? "Join a tournament" : null },
                        { label: "Training", value: card.score_breakdown.training, color: "bg-violet-500", tip: card.score_breakdown.training === 0 ? "Book coaching sessions" : null },
                        { label: "Reliability", value: card.score_breakdown.reliability, color: "bg-sky-500", tip: card.score_breakdown.reliability < 80 ? "Don't miss bookings" : null },
                        { label: "Experience", value: card.score_breakdown.experience, color: "bg-rose-500", tip: card.score_breakdown.experience < 10 ? "Play more games" : null },
                      ].map(b => (
                        <div key={b.label}>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground w-16 shrink-0">{b.label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-border/30 overflow-hidden">
                              <div className={`h-full rounded-full ${b.color} transition-all duration-500`} style={{ width: `${b.value}%` }} />
                            </div>
                            <span className="text-[10px] font-bold w-6 text-right">{b.value}</span>
                          </div>
                          {isOwnProfile && b.tip && (
                            <p className="text-[9px] text-muted-foreground/70 ml-[72px] mt-0.5">{b.tip}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* How to Level Up Modal */}
          <AnimatePresence>
            {showLevelUpGuide && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={() => setShowLevelUpGuide(false)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-card border-2 border-border rounded-2xl shadow-2xl"
                  onClick={e => e.stopPropagation()}>
                  <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
                    <h2 className="font-display text-lg font-black">How to Level Up</h2>
                    <button onClick={() => setShowLevelUpGuide(false)} className="p-1 rounded-full hover:bg-muted">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Overall Score Section */}
                    <div>
                      <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" /> Overall Score
                      </h3>
                      <div className="space-y-3">
                        {[
                          { icon: Swords, color: "text-primary", label: "Skill", weight: "40%", items: ["Play rated matches", "Beat higher-rated players for bigger jumps", "Rating starts at 1500 (Bronze)"] },
                          { icon: Trophy, color: "text-brand-400", label: "Win Rate", weight: "20%", items: ["Win your matches", "Higher win % = higher score"] },
                          { icon: Crown, color: "text-amber-400", label: "Tournament", weight: "15%", items: ["Join tournaments on Lobbi", "Win tournaments for bonus points"] },
                          { icon: GraduationCap, color: "text-violet-400", label: "Training", weight: "10%", items: ["Book coaching sessions", "Training hours are tracked"] },
                          { icon: Shield, color: "text-sky-400", label: "Reliability", weight: "10%", items: ["Show up to your bookings", "No-shows will drop your score", "Starts at 100 — keep it there!"] },
                          { icon: Footprints, color: "text-rose-400", label: "Experience", weight: "5%", items: ["Play more games overall", "Every game counts"] },
                        ].map(s => {
                          const Icon = s.icon;
                          return (
                            <div key={s.label} className="rounded-lg bg-background/50 border border-border/50 p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Icon className={`h-4 w-4 ${s.color}`} />
                                <span className="font-bold text-xs">{s.label}</span>
                                <Badge variant="secondary" className="text-[9px] ml-auto">{s.weight}</Badge>
                              </div>
                              <ul className="space-y-0.5">
                                {s.items.map((item, i) => (
                                  <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tier Levels */}
                    <div>
                      <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-400" /> Score Tiers
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { tier: "Elite", range: "86-100", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
                          { tier: "Pro", range: "71-85", color: "text-violet-400 bg-violet-400/10 border-violet-400/30" },
                          { tier: "Advanced", range: "51-70", color: "text-brand-400 bg-brand-400/10 border-brand-400/30" },
                          { tier: "Intermediate", range: "31-50", color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
                          { tier: "Beginner", range: "0-30", color: "text-muted-foreground bg-muted/50 border-border" },
                        ].map(t => (
                          <div key={t.tier} className={`rounded-lg border p-2.5 text-center ${t.color}`}>
                            <div className="font-display font-black text-xs">{t.tier}</div>
                            <div className="text-[10px] opacity-70">{t.range} pts</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Engagement Score Section */}
                    <div>
                      <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-400" /> Engagement Score
                      </h3>
                      <p className="text-[11px] text-muted-foreground mb-3">
                        Separate from Overall Score — measures your weekly activity on the platform.
                      </p>
                      <div className="space-y-2">
                        {[
                          { action: "Post on feed", points: "3 pts/post", max: "max 20" },
                          { action: "Like or comment", points: "2 pts each", max: "max 20" },
                          { action: "Daily streak", points: "2 pts/day", max: "max 15" },
                          { action: "Book a venue", points: "3 pts/booking", max: "max 15" },
                          { action: "Join groups/teams", points: "Community pts", max: "max 10" },
                          { action: "Post stories", points: "3 pts/story", max: "max 10" },
                          { action: "Consistency bonus", points: "Unique active days", max: "max 10" },
                        ].map((e, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-border/30 last:border-0">
                            <span className="text-foreground font-medium">{e.action}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-primary font-bold">{e.points}</span>
                              <span className="text-muted-foreground/60 text-[10px]">({e.max})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                        {[
                          { level: "Legend", min: "80+" },
                          { level: "All-Star", min: "60+" },
                          { level: "Pro", min: "40+" },
                          { level: "Rookie", min: "20+" },
                          { level: "Bench", min: "<20" },
                        ].map(l => (
                          <div key={l.level} className="rounded-md bg-background/50 border border-border/50 p-1.5">
                            <div className="font-bold text-[9px]">{l.level}</div>
                            <div className="text-[8px] text-muted-foreground">{l.min}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pb-6">
            <AthleticStatCard
              icon={Gamepad2}
              label="Games"
              value={card.total_games}
              iconColor="primary"
              delay={0}
            />
            <AthleticStatCard
              icon={Trophy}
              label="Wins"
              value={card.wins}
              iconColor="amber"
              delay={0.1}
            />
            <AthleticStatCard
              icon={Target}
              label="Win Rate"
              value={`${winRate}%`}
              iconColor="green"
              delay={0.2}
            />
            <AthleticStatCard
              icon={Shield}
              label="Reliability"
              value={`${card.reliability_score}%`}
              iconColor="sky"
              delay={0.3}
            />
          </div>

          {/* W/L/D Row */}
          <div className="px-6 pb-4">
            <div className="flex gap-2 justify-center">
              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-bold text-green-400">
                W {card.wins}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400">
                L {card.losses}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30 text-xs font-bold text-muted-foreground">
                D {card.draws}
              </span>
            </div>
          </div>

          {/* Compatibility Score (when viewing another player) */}
          {compatibility && compatibility.score > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="px-6 pb-4"
            >
              <div className="p-4 rounded-2xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Compatibility</span>
                  <Badge variant="glow" className="text-sm font-black">
                    Grade {compatibility.grade}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="font-display text-3xl font-black text-primary">{compatibility.score}</div>
                  <div className="text-xs text-muted-foreground">/100</div>
                  <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden ml-2">
                    <div className="h-full bg-gradient-athletic rounded-full transition-all" style={{ width: `${compatibility.score}%` }} />
                  </div>
                </div>
                {compatibility.breakdown && (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(compatibility.breakdown).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-[11px]">
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="font-bold">{val.score}/{val.max}</span>
                          </div>
                          <div className="h-1 bg-secondary/50 rounded-full overflow-hidden">
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(val.score / val.max) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Engagement Level */}
          {engagementScore && engagementScore.score > 0 && (
            <div className="px-6 pb-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="font-display font-bold text-sm">{engagementScore.level}</span>
                  <span className="text-[10px] text-muted-foreground">({engagementScore.score}/100)</span>
                </div>
              </div>
            </div>
          )}

          {/* Review Rating */}
          {card.avg_review_rating > 0 && (
            <div className="px-6 pb-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                <span className="font-display font-bold text-lg">{card.avg_review_rating}</span>
                <span className="text-xs text-muted-foreground">avg review</span>
              </div>
            </div>
          )}

          {/* Sports Breakdown */}
          {Object.keys(card.sports_played || {}).length > 0 && (
            <div className="px-6 pb-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 text-center">
                Sports Played
              </h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {Object.entries(card.sports_played)
                  .sort(([, a], [, b]) => b - a)
                  .map(([sport, count]) => (
                    <div
                      key={sport}
                      className="px-3 py-1.5 rounded-lg bg-muted/30 border border-border/30"
                    >
                      <span className="font-bold text-xs capitalize">{sport}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{count} games</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Achievement Badges */}
          {card.badges && card.badges.length > 0 && (
            <div className="px-6 pb-8">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 text-center">
                Achievements
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {card.badges.map((badge, idx) => {
                  const Icon = BADGE_ICONS[badge.icon] || Trophy;
                  const colorClass = BADGE_COLORS[badge.name] || "text-primary bg-primary/10 border-primary/30";
                  return (
                    <motion.div
                      key={badge.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 ${colorClass}`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <span className="font-display font-bold text-sm block">{badge.name}</span>
                        <span className="text-[10px] opacity-70">{badge.description}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Member Since */}
          <div className="px-6 pb-6 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                Member since{" "}
                {card.member_since
                  ? new Date(card.member_since).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })
                  : "Unknown"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ═══ COACHING PROFILE ═══ */}
        {card.role === "coach" && coachData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display font-bold text-sm">Coaching Profile</h3>
            </div>

            {/* Bio + price — only render if there's content */}
            {(coachData.coaching_bio || coachData.city || coachData.coaching_sports?.length > 0) && (
              <div className="rounded-2xl border border-border/50 bg-card p-4 mb-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    {coachData.coaching_bio && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">{coachData.coaching_bio}</p>
                    )}
                    {coachData.city && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{coachData.city}
                        {coachData.coaching_venue && <span> · {coachData.coaching_venue}</span>}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-xl text-primary">₹{coachData.session_price || 500}</p>
                    <p className="text-[10px] text-muted-foreground">{coachData.session_duration_minutes || 60} min</p>
                  </div>
                </div>
                {coachData.coaching_sports?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {coachData.coaching_sports.map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px] capitalize font-bold">{s.replace("_", " ")}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Coach Stats */}
            {(coachData.coaching_rating > 0 || coachData.total_sessions > 0 || coachData.years_of_experience > 0) && (
              <div className="flex gap-3 mb-4">
                {coachData.coaching_rating > 0 && (
                  <div className="rounded-2xl border border-border/50 bg-card p-3 text-center flex-1">
                    <Star className="h-4 w-4 mx-auto mb-1 text-amber-400" />
                    <p className="font-black text-base text-amber-400">{Number(coachData.coaching_rating).toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Rating</p>
                  </div>
                )}
                {coachData.total_sessions > 0 && (
                  <div className="rounded-2xl border border-border/50 bg-card p-3 text-center flex-1">
                    <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
                    <p className="font-black text-base text-primary">{coachData.total_sessions}</p>
                    <p className="text-[10px] text-muted-foreground">Sessions</p>
                  </div>
                )}
                {coachData.years_of_experience > 0 && (
                  <div className="rounded-2xl border border-border/50 bg-card p-3 text-center flex-1">
                    <Briefcase className="h-4 w-4 mx-auto mb-1 text-violet-400" />
                    <p className="font-black text-base text-violet-400">{coachData.years_of_experience}+</p>
                    <p className="text-[10px] text-muted-foreground">Yrs Exp</p>
                  </div>
                )}
              </div>
            )}

            {/* Specializations */}
            {coachData.specializations?.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card p-4 mb-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Specializations</h4>
                <div className="flex flex-wrap gap-2">
                  {coachData.specializations.map((s, i) => (
                    <Badge key={i} className="bg-primary/10 text-primary border border-primary/20 text-xs font-medium">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Achievements */}
            {coachData.achievements?.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card p-4 mb-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Achievements</h4>
                <div className="space-y-2">
                  {coachData.achievements.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Trophy className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-sm">{typeof a === "string" ? a : a.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Awards */}
            {coachData.awards?.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card p-4 mb-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Awards</h4>
                <div className="space-y-2">
                  {coachData.awards.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Award className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-sm">{typeof a === "string" ? a : a.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {coachData.certifications_list?.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card p-4 mb-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Certifications</h4>
                <div className="space-y-2">
                  {coachData.certifications_list.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <BadgeCheck className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
                      <p className="text-sm">{typeof c === "string" ? c : c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Playing History */}
            {coachData.playing_history && (
              <div className="rounded-2xl border border-border/50 bg-card p-4 mb-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Playing History</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{coachData.playing_history}</p>
              </div>
            )}

            {/* Packages */}
            {coachPackages.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card p-4 mb-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Coaching Packages</h4>
                <div className="space-y-3">
                  {coachPackages.map(pkg => (
                    <div key={pkg.id} className={`rounded-xl border-2 p-3 transition-all ${pkg.subscribed ? "border-primary/30 bg-primary/5" : "border-border/50 bg-secondary/20"}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{pkg.name}</p>
                          <p className="text-xs text-muted-foreground">{pkg.sessions_per_month} sessions · {pkg.duration_minutes || 60} min each</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-base text-primary">₹{(pkg.price || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">/month</p>
                        </div>
                      </div>
                      {pkg.description && <p className="text-xs text-muted-foreground mb-2">{pkg.description}</p>}
                      {!isOwnProfile && (
                        pkg.subscribed ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs font-bold text-primary">{pkg.sessions_remaining} sessions remaining</span>
                          </div>
                        ) : (
                          <button onClick={() => handleSubscribe(pkg)} disabled={subscribing}
                            className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-60">
                            {subscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                            Subscribe · ₹{(pkg.price || 0).toLocaleString()}/mo
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* ── Inline Book a Session ── */}
            {!isOwnProfile && (() => {
              const next14 = Array.from({ length: 14 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() + i);
                return {
                  value: d.toISOString().slice(0, 10),
                  day: d.toLocaleDateString("en", { weekday: "short" }),
                  date: d.getDate(),
                  month: d.toLocaleDateString("en", { month: "short" }),
                  isToday: i === 0,
                };
              });
              const slotSports = selectedSlot?.sports?.length > 0
                ? selectedSlot.sports
                : (coachData.coaching_sports || []);
              return (
                <div className="rounded-2xl border-2 border-primary/20 bg-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <h4 className="font-bold text-sm">Book a Session</h4>
                    </div>
                    <span className="font-black text-primary">₹{coachData.session_price || 500}<span className="text-[10px] text-muted-foreground font-normal"> / {coachData.session_duration_minutes || 60} min</span></span>
                  </div>

                  {/* Date strip */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Select Date</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
                    {next14.map(d => (
                      <button key={d.value} onClick={() => handleDateChange(d.value)}
                        className={`flex flex-col items-center shrink-0 w-[50px] py-2 rounded-xl border-2 transition-all ${
                          selectedDate === d.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 bg-background/50 hover:border-primary/40"
                        }`}>
                        <span className={`text-[10px] font-bold uppercase ${selectedDate === d.value ? "text-primary" : "text-muted-foreground"}`}>{d.day}</span>
                        <span className="text-base font-black leading-tight">{d.date}</span>
                        <span className={`text-[9px] ${selectedDate === d.value ? "text-primary/70" : "text-muted-foreground"}`}>{d.month}</span>
                        {d.isToday && <span className="text-[8px] font-bold text-primary mt-0.5">Today</span>}
                      </button>
                    ))}
                  </div>

                  {/* Slots */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Available Slots</p>
                  {slotsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : coachSlots.length === 0 ? (
                    <div className="flex flex-col items-center py-8 rounded-xl bg-secondary/20 border border-dashed border-border mb-4">
                      <Calendar className="h-7 w-7 text-muted-foreground/40 mb-2" />
                      <p className="text-sm font-bold text-muted-foreground">No slots on this day</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try a different date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {coachSlots.map(slot => (
                        <button key={slot.start_time}
                          onClick={() => { if (slot.available) setSelectedSlot(slot); }}
                          disabled={!slot.available}
                          className={`flex flex-col items-center px-2 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                            selectedSlot?.start_time === slot.start_time
                              ? "border-primary bg-primary/10 text-primary"
                              : slot.available
                                ? "border-border/50 bg-background hover:border-primary/50 hover:bg-primary/5"
                                : "border-border/20 bg-secondary/20 text-muted-foreground/40 cursor-not-allowed"
                          }`}>
                          <span className={slot.available ? "" : "line-through"}>{slot.start_time}</span>
                          <span className={`text-[10px] font-normal mt-0.5 ${selectedSlot?.start_time === slot.start_time ? "text-primary/70" : "text-muted-foreground"}`}>{slot.end_time}</span>
                          {!slot.available && <span className="text-[9px] text-red-400/70 mt-0.5">Booked</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sport + Notes after slot selected */}
                  {selectedSlot && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 mb-4">
                      {slotSports.length > 1 ? (
                        <div className="flex flex-wrap gap-2">
                          {slotSports.map(s => (
                            <button key={s} onClick={() => setBookingSport(s)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 capitalize transition-all ${
                                bookingSport === s ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/40"
                              }`}>
                              {s.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      ) : slotSports.length === 1 ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-xl">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-bold capitalize text-primary">{slotSports[0].replace("_", " ")}</span>
                        </div>
                      ) : null}
                      <Input value={bookingNotes} onChange={e => setBookingNotes(e.target.value)}
                        placeholder="What do you want to work on? (optional)"
                        className="bg-background border-border text-sm" />
                    </motion.div>
                  )}

                  {/* Summary row */}
                  {selectedSlot && (
                    <div className="flex items-center justify-between text-xs mb-3 px-1">
                      <span className="text-muted-foreground">
                        {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {" · "}{selectedSlot.start_time}–{selectedSlot.end_time}
                        {bookingSport && <> · <span className="capitalize">{bookingSport.replace("_", " ")}</span></>}
                      </span>
                      <span className="font-black text-primary">₹{coachData.session_price || 500}</span>
                    </div>
                  )}

                  {/* Confirm button */}
                  <button disabled={!selectedSlot || booking} onClick={handleBook}
                    className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      selectedSlot && !booking
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                        : "bg-secondary text-muted-foreground cursor-not-allowed"
                    }`}>
                    {booking
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming...</>
                      : selectedSlot
                        ? <>Confirm Booking · ₹{coachData.session_price || 500}</>
                        : "Select a slot to book"}
                  </button>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* ═══ CAREER & PERFORMANCE ═══ */}
        {career && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mt-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display font-bold text-sm">Career & Performance</h3>
            </div>

            {/* Career Stats Row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-4 rounded-2xl border border-border/50 bg-card text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 rounded-xl bg-violet-500/10">
                    <Dumbbell className="h-4 w-4 text-violet-400" />
                  </div>
                </div>
                <div className="font-display text-xl font-black">
                  {career.training_hours ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                  Training Hrs
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-border/50 bg-card text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                </div>
                <div className="font-display text-xl font-black">
                  {career.tournaments_played ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                  Tournaments
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-border/50 bg-card text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 rounded-xl bg-sky-500/10">
                    <Building2 className="h-4 w-4 text-sky-400" />
                  </div>
                </div>
                <div className="font-display text-xl font-black">
                  {career.organizations?.length ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                  Organizations
                </div>
              </div>
            </div>

            {/* Recent Performance */}
            {career.recent_performance && career.recent_performance.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Recent Performance
                </h4>
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/30">
                  {career.recent_performance.slice(0, 5).map((record, idx) => (
                    <motion.div
                      key={record.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.05 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="text-[10px] text-muted-foreground font-mono w-14 flex-shrink-0">
                        {record.date
                          ? new Date(record.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          : "--"}
                      </div>
                      <Badge
                        className={`text-[10px] font-bold px-2 py-0.5 border ${getPerformanceTypeColor(record.type)}`}
                      >
                        {record.type || "Match"}
                      </Badge>
                      <span className="text-sm font-semibold truncate flex-1">
                        {record.title || "Untitled"}
                      </span>
                      {record.sport && (
                        <Badge variant="sport" className="text-[10px] font-bold uppercase ml-auto flex-shrink-0">
                          {record.sport}
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Organizations List */}
            {career.organizations && career.organizations.length > 0 && (
              <div>
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Organizations
                </h4>
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/30">
                  {career.organizations.map((org, idx) => (
                    <motion.div
                      key={org.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.55 + idx * 0.05 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="p-1.5 rounded-lg bg-sky-500/10">
                        <Building2 className="h-3.5 w-3.5 text-sky-400" />
                      </div>
                      <span className="text-sm font-semibold flex-1 truncate">
                        {org.name}
                      </span>
                      {org.type && (
                        <Badge className="text-[10px] font-bold px-2 py-0.5 bg-muted/50 text-muted-foreground border border-border/30">
                          {org.type}
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ USER'S POSTS ═══ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display font-bold text-sm">Posts</h3>
            <span className="text-xs text-muted-foreground">({card.post_count || 0})</span>
          </div>

          {postsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : userPosts.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-border/50 bg-card">
              <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No posts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userPosts.slice(0, 10).map((post, idx) => (
                <motion.div key={post.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + idx * 0.05 }}
                  className="p-4 rounded-2xl border border-border/50 bg-card">
                  {post.content && <p className="text-sm leading-relaxed mb-2">{post.content}</p>}
                  {post.media_url && <img src={mediaUrl(post.media_url)} alt="" className="rounded-xl w-full max-h-60 object-cover mb-2" />}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/30">
                    <span className="flex items-center gap-1">
                      <Heart className={`h-3 w-3 ${post.liked_by_me ? "fill-red-500 text-red-500" : ""}`} />
                      {post.likes_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> {post.comments_count || 0}
                    </span>
                    <span className="ml-auto">{timeAgo(post.created_at)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ══ TEST PAYMENT REVIEW MODAL ══════════════════════════ */}
      <AnimatePresence>
        {payStep && (pendingSession || pendingSubPkg) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => { if (payStep !== "processing") closePaymentReview(); }}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl border border-border/50 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <h2 className="font-display font-black text-lg">
                  {payStep === "done" ? "Booking Confirmed!" :
                   payStep === "processing" ? "Processing Payment..." :
                   "Complete Payment"}
                </h2>
                {payStep !== "processing" && (
                  <button onClick={closePaymentReview}
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="p-5">
                {/* Processing */}
                {payStep === "processing" && (
                  <div className="flex flex-col items-center py-8 gap-4">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">Confirming your booking...</p>
                    <p className="text-xs text-muted-foreground/60">Please do not close this window</p>
                  </div>
                )}

                {/* Review — Session */}
                {payStep === "review" && pendingSession && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border-2 border-border/50 bg-card/50 p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Coach</span>
                        <span className="font-display font-black text-sm">{pendingSession.coach_name || card.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Date</span>
                        <span className="font-bold text-sm">
                          {new Date(pendingSession.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Time</span>
                        <span className="font-bold text-sm">{pendingSession.start_time} – {pendingSession.end_time}</span>
                      </div>
                      {pendingSession.sport && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Sport</span>
                          <span className="font-bold text-sm capitalize">{pendingSession.sport.replace("_", " ")}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t border-border/50">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Total</span>
                        <span className="font-display font-black text-2xl text-primary">₹{pendingSession.price}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</span>
                        <Badge variant="athletic">Awaiting Payment</Badge>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-sky-500/10 border-2 border-sky-500/20 text-sm text-sky-400 font-semibold">
                      Payment gateway is being configured. Please confirm to proceed.
                    </div>

                    <button
                      onClick={handleTestSessionPayment}
                      className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wide text-sm flex items-center justify-center gap-2 hover:bg-primary/90 shadow-lg transition-all"
                    >
                      Confirm Payment · ₹{pendingSession.price}
                    </button>
                  </div>
                )}

                {/* Review — Subscription */}
                {payStep === "review" && pendingSubPkg && !pendingSession && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border-2 border-border/50 bg-card/50 p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Coach</span>
                        <span className="font-display font-black text-sm">{card.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Package</span>
                        <span className="font-bold text-sm">{pendingSubPkg.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Sessions</span>
                        <span className="font-bold text-sm">{pendingSubPkg.sessions_per_month} / month</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Duration</span>
                        <span className="font-bold text-sm">{pendingSubPkg.duration_minutes || 60} min each</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-border/50">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Total</span>
                        <span className="font-display font-black text-2xl text-primary">₹{(pendingSubPkg.sub_price || pendingSubPkg.price || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</span>
                        <Badge variant="athletic">Awaiting Payment</Badge>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-sky-500/10 border-2 border-sky-500/20 text-sm text-sky-400 font-semibold">
                      Payment gateway is being configured. Please confirm to proceed.
                    </div>

                    <button
                      onClick={handleTestSubPayment}
                      className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-wide text-sm flex items-center justify-center gap-2 hover:bg-primary/90 shadow-lg transition-all"
                    >
                      Confirm Payment · ₹{(pendingSubPkg.sub_price || pendingSubPkg.price || 0).toLocaleString()}/mo
                    </button>
                  </div>
                )}

                {/* Done */}
                {payStep === "done" && (
                  <div className="space-y-5">
                    <div className="flex flex-col items-center py-6 gap-3">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                      </div>
                      <p className="font-display font-black text-lg">
                        {pendingSession ? "Session Confirmed!" : "Subscription Active!"}
                      </p>
                      <p className="text-sm text-muted-foreground text-center">
                        {pendingSession
                          ? `${pendingSession.sport?.replace("_", " ") || "Session"} on ${new Date(pendingSession.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${pendingSession.start_time}`
                          : `${pendingSubPkg?.name} — ${pendingSubPkg?.sessions_per_month} sessions/month`}
                      </p>
                    </div>
                    <button
                      onClick={closePaymentReview}
                      className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
