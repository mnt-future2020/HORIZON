import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { playerCardAPI, recommendationAPI, socialAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AthleticStatCard } from "@/components/ui/stat-card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Target, Shield, Zap, Star, Crown, Award, Medal,
  Gamepad2, Calendar, TrendingUp, Loader2, ArrowLeft, User,
  Heart, MessageCircle, UserPlus, Users, Grid3X3, Flame
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
};

const BADGE_COLORS = {
  Century: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  Veteran: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  Regular: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  Elite: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  Pro: "text-green-400 bg-green-400/10 border-green-400/30",
  Reliable: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  Champion: "text-red-400 bg-red-400/10 border-red-400/30",
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

  useEffect(() => {
    const isMe = !userId || userId === "me" || userId === currentUser?.id;
    setLoading(true);
    const loadCard = (isMe ? playerCardAPI.getMyCard() : playerCardAPI.getCard(userId))
      .then(res => setCard(res.data))
      .catch(() => toast.error("Failed to load player card"));

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
          <User className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-display text-xl font-bold text-muted-foreground">
            Player not found
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
                <img src={card.avatar} alt={card.name} className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-primary" />
              )}
            </motion.div>

            <h1 className="font-display text-2xl font-black tracking-athletic">
              {card.name}
            </h1>

            {/* Rating */}
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

            {/* Primary Sport */}
            {card.primary_sport !== "none" && (
              <Badge variant="sport" className="mt-3 text-xs font-bold uppercase">
                {card.primary_sport}
              </Badge>
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

            {/* Follow + Message Buttons */}
            {card.user_id !== currentUser?.id && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button
                  variant={isFollowing ? "outline" : "athletic"}
                  className="min-w-[120px]"
                  onClick={handleFollow}>
                  {isFollowing ? <><Users className="h-4 w-4 mr-2" /> Following</> : <><UserPlus className="h-4 w-4 mr-2" /> Follow</>}
                </Button>
                <Button variant="athletic-outline"
                  onClick={() => navigate(`/chat?user=${card.user_id}`)}>
                  <MessageCircle className="h-4 w-4 mr-2" /> Message
                </Button>
              </div>
            )}
          </div>

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
              <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No posts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userPosts.slice(0, 10).map((post, idx) => (
                <motion.div key={post.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + idx * 0.05 }}
                  className="p-4 rounded-2xl border border-border/50 bg-card">
                  {post.content && <p className="text-sm leading-relaxed mb-2">{post.content}</p>}
                  {post.media_url && <img src={post.media_url} alt="" className="rounded-xl w-full max-h-60 object-cover mb-2" />}
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
    </div>
  );
}
