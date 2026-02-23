import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { socialAPI, recommendationAPI, uploadAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Send, Trash2, Loader2, Plus,
  ChevronDown, ChevronUp, User, Flame, X, TrendingUp,
  UserPlus, Users, Shield, Zap, Eye, Bookmark, Share2, Image, Search, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const REACTION_EMOJI = {
  fire: "\uD83D\uDD25",
  trophy: "\uD83C\uDFC6",
  clap: "\uD83D\uDC4F",
  heart: "\u2764\uFE0F",
  "100": "\uD83D\uDCAF",
  muscle: "\uD83D\uDCAA",
};

const STORY_COLORS = [
  "from-green-500 to-emerald-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-orange-500 to-red-600",
  "from-cyan-500 to-blue-600",
  "from-rose-500 to-pink-600",
];

export default function SocialFeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [posting, setPosting] = useState(false);
  const [feedTab, setFeedTab] = useState("for_you");

  // Post composer
  const [newContent, setNewContent] = useState("");
  const [postType, setPostType] = useState("text");
  const [showComposer, setShowComposer] = useState(false);

  // Stories
  const [storyGroups, setStoryGroups] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [showStoryCreate, setShowStoryCreate] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storyColor, setStoryColor] = useState(STORY_COLORS[0]);

  // Engagement
  const [engagement, setEngagement] = useState(null);
  const [suggestedFollows, setSuggestedFollows] = useState([]);

  // Followers modal
  const [followModal, setFollowModal] = useState(null); // { type: "followers"|"following", list: [] }
  const [followModalLoading, setFollowModalLoading] = useState(false);
  const [followedUsers, setFollowedUsers] = useState(new Set()); // track who we follow

  // Trending
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [showTrending, setShowTrending] = useState(false);

  // Comments
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

  // Reaction picker
  const [reactionPickerPost, setReactionPickerPost] = useState(null);

  // Algorithm-powered recommendations
  const [algoPlayers, setAlgoPlayers] = useState([]);
  const [engScore, setEngScore] = useState(null);

  const storiesRef = useRef(null);
  const reactionPickerRef = useRef(null);

  const loadFeed = useCallback(async (p = 1, tab = feedTab) => {
    try {
      const res = await socialAPI.getFeed(p, tab);
      const data = res.data || {};
      if (p === 1) {
        setPosts(data.posts || []);
      } else {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
      }
      setTotalPages(data.pages || 1);
      setPage(p);
    } catch {
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [feedTab]);

  const loadStories = useCallback(async () => {
    try {
      const res = await socialAPI.getStories();
      setStoryGroups(res.data || []);
    } catch {}
  }, []);

  const loadEngagement = useCallback(async () => {
    try {
      const res = await socialAPI.myEngagement();
      setEngagement(res.data);
    } catch {}
  }, []);

  const loadSuggested = useCallback(async () => {
    try {
      const res = await socialAPI.suggestedFollows();
      setSuggestedFollows(res.data || []);
    } catch {}
  }, []);

  const loadAlgoPlayers = useCallback(async () => {
    try {
      const res = await recommendationAPI.players(10);
      setAlgoPlayers(res.data?.players || []);
    } catch {}
  }, []);

  const loadEngScore = useCallback(async () => {
    try {
      const res = await recommendationAPI.engagementScore();
      setEngScore(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadFeed(1), loadStories(), loadEngagement(), loadSuggested(), loadAlgoPlayers(), loadEngScore()]);
  }, [loadFeed, loadStories, loadEngagement, loadSuggested, loadAlgoPlayers, loadEngScore]);

  const handleTabChange = (tab) => {
    setFeedTab(tab);
    setLoading(true);
    loadFeed(1, tab);
  };

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactionPickerPost) return;
    const handleClickOutside = (e) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
        setReactionPickerPost(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [reactionPickerPost]);

  // ─── Post Actions ──────────────────────────────────────────────────────────

  const handleCreatePost = async () => {
    if (!newContent.trim() && !imageFile && !imagePreview) return;
    setPosting(true);
    try {
      const postData = { content: newContent.trim(), post_type: postType };
      if (imageFile) {
        const uploadRes = await uploadAPI.image(imageFile);
        postData.media_url = uploadRes.data.url;
      }
      const res = await socialAPI.createPost(postData);
      setPosts((prev) => [{ ...res.data, liked_by_me: false, my_reaction: null, bookmarked_by_me: false }, ...prev]);
      setNewContent("");
      setImagePreview(null);
      setImageFile(null);
      setShowComposer(false);
      toast.success("Posted!");
      loadEngagement();
    } catch { toast.error("Failed to post"); }
    finally { setPosting(false); }
  };

  const handleLike = async (postId) => {
    setPosts((prev) => prev.map((p) => p.id === postId
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) } : p));
    try { await socialAPI.toggleLike(postId); }
    catch { setPosts((prev) => prev.map((p) => p.id === postId
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) } : p)); }
  };

  const handleReaction = async (postId, reaction) => {
    setReactionPickerPost(null);
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const reactions = { ...(p.reactions || {}) };
      if (p.my_reaction === reaction) {
        reactions[reaction] = Math.max(0, (reactions[reaction] || 1) - 1);
        return { ...p, my_reaction: null, reactions };
      }
      if (p.my_reaction) reactions[p.my_reaction] = Math.max(0, (reactions[p.my_reaction] || 1) - 1);
      reactions[reaction] = (reactions[reaction] || 0) + 1;
      return { ...p, my_reaction: reaction, reactions };
    }));
    try { await socialAPI.react(postId, reaction); }
    catch { loadFeed(1); }
  };

  const handleDelete = async (postId) => {
    try { await socialAPI.deletePost(postId); setPosts((prev) => prev.filter((p) => p.id !== postId)); toast.success("Post deleted"); }
    catch { toast.error("Failed to delete"); }
  };

  const handleFollow = async (userId) => {
    try {
      const res = await socialAPI.toggleFollow(userId);
      const isNowFollowing = res.data.following;

      // Update all posts from this user
      setPosts((prev) => prev.map((p) => p.user_id === userId ? { ...p, is_following: isNowFollowing } : p));

      // Update followed set for suggested follows UI
      setFollowedUsers((prev) => {
        const next = new Set(prev);
        if (isNowFollowing) next.add(userId);
        else next.delete(userId);
        return next;
      });

      // Update followers modal list if open
      setFollowModal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          list: prev.list.map((u) => u.id === userId ? { ...u, is_following: isNowFollowing } : u),
        };
      });

      toast.success(isNowFollowing ? "Following!" : "Unfollowed");
      loadEngagement();
    } catch { toast.error("Failed"); }
  };

  const openFollowModal = async (type) => {
    setFollowModalLoading(true);
    setFollowModal({ type, list: [] });
    try {
      const res = type === "followers"
        ? await socialAPI.getFollowers(user.id)
        : await socialAPI.getFollowing(user.id);
      const list = res.data || [];
      // Mark which users we follow
      const followingRes = await socialAPI.getFollowing(user.id);
      const followingIds = new Set((followingRes.data || []).map((u) => u.id));
      setFollowedUsers(followingIds);
      setFollowModal({ type, list: list.map((u) => ({ ...u, is_following: followingIds.has(u.id) })) });
    } catch { toast.error("Failed to load " + type); setFollowModal(null); }
    setFollowModalLoading(false);
  };

  // ─── Double-tap to like ────────────────────────────────────────────────────
  const [doubleTapHeart, setDoubleTapHeart] = useState(null);
  const lastTap = useRef({});

  const handleDoubleTap = (postId) => {
    const now = Date.now();
    const last = lastTap.current[postId] || 0;
    if (now - last < 300) {
      // Double tap detected
      const post = posts.find((p) => p.id === postId);
      if (post && !post.liked_by_me) handleLike(postId);
      setDoubleTapHeart(postId);
      setTimeout(() => setDoubleTapHeart(null), 900);
      lastTap.current[postId] = 0;
    } else {
      lastTap.current[postId] = now;
    }
  };

  // ─── Bookmark ────────────────────────────────────────────────────────────
  const handleBookmark = async (postId) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p));
    try {
      await socialAPI.toggleBookmark(postId);
    } catch {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p));
      toast.error("Failed");
    }
  };

  // ─── Share ───────────────────────────────────────────────────────────────
  const handleShare = async (post) => {
    const url = `${window.location.origin}/feed?post=${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${post.user_name} on Horizon`, text: post.content?.slice(0, 100), url }); }
      catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  // ─── Pull to refresh ────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(1, feedTab), loadStories(), loadEngagement()]);
    setRefreshing(false);
  };

  // ─── Image upload ───────────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    setPostType("photo");
  };

  // ─── Stories ───────────────────────────────────────────────────────────────

  const handleCreateStory = async () => {
    if (!storyText.trim()) return;
    try {
      await socialAPI.createStory({ content: storyText.trim(), bg_color: storyColor });
      setStoryText("");
      setShowStoryCreate(false);
      toast.success("Story posted!");
      loadStories();
      loadEngagement();
    } catch { toast.error("Failed to post story"); }
  };

  const openStoryGroup = (group) => {
    setActiveStory(group);
    setStoryIdx(0);
    if (group.stories[0]) socialAPI.viewStory(group.stories[0].id).catch(() => {});
  };

  const nextStory = () => {
    if (!activeStory) return;
    const next = storyIdx + 1;
    if (next < activeStory.stories.length) {
      setStoryIdx(next);
      socialAPI.viewStory(activeStory.stories[next].id).catch(() => {});
    } else {
      const currentIdx = storyGroups.findIndex((g) => g.user_id === activeStory.user_id);
      if (currentIdx >= 0 && currentIdx < storyGroups.length - 1) {
        const nextGroup = storyGroups[currentIdx + 1];
        setActiveStory(nextGroup);
        setStoryIdx(0);
        if (nextGroup.stories[0]) socialAPI.viewStory(nextGroup.stories[0].id).catch(() => {});
      } else {
        setActiveStory(null);
      }
    }
  };

  const prevStory = () => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1);
  };

  // ─── Comments ──────────────────────────────────────────────────────────────

  const toggleComments = async (postId) => {
    const newSet = new Set(expandedComments);
    if (newSet.has(postId)) { newSet.delete(postId); }
    else {
      newSet.add(postId);
      if (!comments[postId]) {
        try { const res = await socialAPI.getComments(postId); setComments((prev) => ({ ...prev, [postId]: res.data || [] })); }
        catch { toast.error("Failed to load comments"); }
      }
    }
    setExpandedComments(newSet);
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      const res = await socialAPI.addComment(postId, { content: text });
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
    } catch { toast.error("Failed to comment"); }
  };

  // ─── Trending ──────────────────────────────────────────────────────────────

  const loadTrending = async () => {
    try { const res = await socialAPI.trending(); setTrendingPosts(res.data || []); setShowTrending(true); }
    catch { toast.error("Failed to load trending"); }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const totalReactions = (reactions) => Object.values(reactions || {}).reduce((s, v) => s + v, 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ═══ STORIES BAR ═══ */}
        <div className="mb-6">
          <div ref={storiesRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {/* Create Story */}
            <button onClick={() => setShowStoryCreate(true)}
              className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center border-2 border-dashed border-primary/40 hover:border-primary transition-colors">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">Your Story</span>
            </button>

            {/* Story Bubbles */}
            {storyGroups.map((group) => (
              <button key={group.user_id} onClick={() => openStoryGroup(group)}
                className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={`h-16 w-16 rounded-full p-[2px] ${
                  group.has_unviewed
                    ? "bg-gradient-to-br from-primary via-green-400 to-emerald-500"
                    : "bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/20"
                }`}>
                  <div className="h-full w-full rounded-full bg-card flex items-center justify-center border-2 border-card overflow-hidden">
                    {group.user_avatar
                      ? <img src={mediaUrl(group.user_avatar)} alt="" className="h-full w-full object-cover" />
                      : <User className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[64px]">
                  {group.user_id === user?.id ? "You" : group.user_name?.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ ENGAGEMENT CARD ═══ */}
        {engagement && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl border-2 border-border/50 bg-card">
            <div className="flex items-center gap-4">
              {/* Streak */}
              <div className="flex items-center gap-2">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  engagement.current_streak > 0 ? "bg-orange-500/10" : "bg-secondary/50"
                }`}>
                  <Flame className={`h-5 w-5 ${engagement.current_streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <div className="font-display font-black text-lg leading-none">
                    {engagement.current_streak}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold">day streak</div>
                </div>
              </div>

              <div className="h-8 w-px bg-border" />

              {/* Stats */}
              <div className="flex gap-4 text-center">
                <button onClick={() => openFollowModal("followers")} className="hover:bg-secondary/50 rounded-lg px-2 py-1 transition-colors">
                  <div className="font-bold text-sm">{engagement.followers_count}</div>
                  <div className="text-[10px] text-muted-foreground">followers</div>
                </button>
                <button onClick={() => openFollowModal("following")} className="hover:bg-secondary/50 rounded-lg px-2 py-1 transition-colors">
                  <div className="font-bold text-sm">{engagement.following_count}</div>
                  <div className="text-[10px] text-muted-foreground">following</div>
                </button>
                <div className="px-2 py-1">
                  <div className="font-bold text-sm">{engagement.total_posts}</div>
                  <div className="text-[10px] text-muted-foreground">posts</div>
                </div>
              </div>

              {/* Engagement Score Level */}
              {engScore && (
                <>
                  <div className="h-8 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-bold text-xs text-primary">{engScore.level}</div>
                      <div className="text-[9px] text-muted-foreground">{engScore.score}/100</div>
                    </div>
                  </div>
                </>
              )}

              <div className="ml-auto flex gap-1">
                <button onClick={loadTrending}
                  className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
                  title="Trending">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Daily prompt */}
            {!engagement.posted_today && engagement.daily_prompt && (
              <button onClick={() => { setShowComposer(true); setNewContent(engagement.daily_prompt + " "); }}
                className="mt-3 w-full text-left p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">Daily prompt:</span> {engagement.daily_prompt}
                  </span>
                </div>
              </button>
            )}
            {engagement.posted_today && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-green-500 font-bold">
                <Zap className="h-3.5 w-3.5" /> You've posted today! Keep the streak going tomorrow.
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ ALGORITHM-POWERED SUGGESTED FOLLOWS ═══ */}
        {(algoPlayers.length > 0 || suggestedFollows.length > 0) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {algoPlayers.length > 0 ? "Recommended Players" : "Suggested for you"}
              </span>
              {algoPlayers.length > 0 && (
                <span className="text-[9px] text-muted-foreground/60 font-mono">AI-powered</span>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {(algoPlayers.length > 0 ? algoPlayers : suggestedFollows).slice(0, 10).map((s) => (
                <div key={s.id} className="flex-shrink-0 w-36 p-3 rounded-2xl border border-border/50 bg-card text-center">
                  <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2 cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/player-card/${s.id}`)}>
                    {s.avatar ? <img src={mediaUrl(s.avatar)} alt="" className="h-12 w-12 rounded-full object-cover" />
                      : <User className="h-6 w-6 text-primary" />}
                  </div>
                  <div className="text-xs font-bold truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize mb-1">
                    {s.rec_reason === "played_together" ? "Played together" :
                     s.rec_reason === "mutual_friends" ? "Mutual friends" :
                     s.reason === "played_together" ? "Co-player" : "Suggested"}
                  </div>
                  {s.rec_score > 0 && (
                    <div className="text-[9px] text-primary/70 font-bold mb-1">
                      {Math.round(s.rec_score)} match score
                    </div>
                  )}
                  {s.games_together > 0 && (
                    <div className="text-[9px] text-muted-foreground mb-1">
                      {s.games_together} games together
                    </div>
                  )}
                  <Button variant={followedUsers.has(s.id) ? "outline" : "athletic"} size="sm" className="w-full h-7 text-[10px]" onClick={() => handleFollow(s.id)}>
                    {followedUsers.has(s.id) ? <><Users className="h-3 w-3 mr-1" /> Following</> : <><UserPlus className="h-3 w-3 mr-1" /> Follow</>}
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ NAV PILLS ═══ */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 bg-secondary/30 rounded-lg p-1">
            {[{ id: "for_you", label: "For You" }, { id: "following", label: "Following" }].map((t) => (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  feedTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <button onClick={handleRefresh}
              className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
              title="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => navigate("/explore")}
              className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
              title="Explore">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => navigate("/bookmarks")}
              className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
              title="Saved Posts">
              <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ═══ POST COMPOSER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl border-2 border-border/50 bg-card cursor-text"
          onClick={() => !showComposer && setShowComposer(true)}>
          {!showComposer ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">What's happening on the field?</span>
              <Button variant="athletic" size="sm" className="ml-auto" onClick={(e) => { e.stopPropagation(); setShowComposer(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Post
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <textarea
                    className="w-full bg-transparent border-none outline-none resize-none text-sm placeholder:text-muted-foreground min-h-[80px]"
                    placeholder={engagement?.daily_prompt || "What's happening on the field?"}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="relative mt-2 mb-2">
                      <img src={imagePreview} alt="Upload preview" className="rounded-xl w-full max-h-60 object-cover" />
                      <button onClick={() => { setImagePreview(null); setImageFile(null); }}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <div className="flex gap-1 items-center">
                      <button onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-primary transition-colors" title="Add photo">
                        <Image className="h-4 w-4" />
                      </button>
                      <div className="w-px h-4 bg-border/50 mx-1" />
                      {["text", "highlight", "photo", "match_result"].map((t) => (
                        <button key={t} onClick={() => setPostType(t)}
                          className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wide font-bold transition-all ${
                            postType === t ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                          }`}>
                          {t === "match_result" ? "Score" : t}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowComposer(false)} className="h-7 text-xs text-muted-foreground">
                        Cancel
                      </Button>
                      <Button variant="athletic" size="sm" onClick={handleCreatePost}
                        disabled={!newContent.trim() || posting} className="h-7">
                        {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3 w-3 mr-1" /> Post</>}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ═══ POSTS ═══ */}
        <div className="space-y-4">
          <AnimatePresence>
            {posts.map((post, idx) => (
              <motion.div key={post.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.02 }}
                className="p-5 rounded-2xl border-2 border-border/50 bg-card hover:border-border transition-colors">
                {/* Post Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors overflow-hidden"
                    onClick={() => navigate(`/player-card/${post.user_id}`)}>
                    {post.user_avatar
                      ? <img src={mediaUrl(post.user_avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : <User className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-sm cursor-pointer hover:text-primary transition-colors truncate"
                        onClick={() => navigate(`/player-card/${post.user_id}`)}>
                        {post.user_name}
                      </span>
                      {post.user_id !== user?.id && (
                        <button onClick={() => handleFollow(post.user_id)}
                          className={`text-[10px] font-bold hover:underline ${post.is_following ? "text-muted-foreground" : "text-primary"}`}>
                          {post.is_following ? "Following" : "Follow"}
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
                  </div>
                  {post.post_type !== "text" && (
                    <Badge variant="sport" className="text-[10px]">{post.post_type === "match_result" ? "score" : post.post_type}</Badge>
                  )}
                  {post.user_id === user?.id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(post.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Content — double tap to like */}
                <div className="relative select-none" onClick={() => handleDoubleTap(post.id)}>
                  {post.content && <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>}
                  {post.media_url && (
                    <img src={mediaUrl(post.media_url)} alt="Post media" className="rounded-xl w-full max-h-96 object-cover mb-3" draggable={false} />
                  )}
                  {/* Heart animation on double-tap */}
                  <AnimatePresence>
                    {doubleTapHeart === post.id && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-lg" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Reaction Summary */}
                {totalReactions(post.reactions) > 0 && (
                  <div className="flex items-center gap-1 mb-2 text-[11px] text-muted-foreground">
                    {Object.entries(post.reactions || {}).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 4).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-0.5">
                        <span className="text-sm">{REACTION_EMOJI[k]}</span>
                        <span className="font-bold">{v}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 pt-2 border-t border-border/30">
                  {/* Like */}
                  <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
                    onClick={() => handleLike(post.id)}>
                    <Heart className={`h-4 w-4 transition-all ${post.liked_by_me ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground"}`} />
                    <span className={`font-bold text-xs ${post.liked_by_me ? "text-red-500" : "text-muted-foreground"}`}>
                      {post.likes_count || 0}
                    </span>
                  </button>

                  {/* Reaction Picker */}
                  <div className="relative" ref={reactionPickerRef}>
                    <button onClick={() => setReactionPickerPost(reactionPickerPost === post.id ? null : post.id)}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors ${post.my_reaction ? "" : "text-muted-foreground"}`}>
                      <span className="text-base">{post.my_reaction ? REACTION_EMOJI[post.my_reaction] : "+"}</span>
                    </button>
                    <AnimatePresence>
                      {reactionPickerPost === post.id && (
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-xl bg-card border-2 border-border shadow-lg z-10">
                          {Object.entries(REACTION_EMOJI).map(([key, emoji]) => (
                            <button key={key} onClick={() => handleReaction(post.id, key)}
                              className={`h-8 w-8 rounded-lg flex items-center justify-center text-lg hover:bg-secondary/50 transition-all hover:scale-110 ${post.my_reaction === key ? "bg-primary/10 ring-2 ring-primary" : ""}`}>
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Comments */}
                  <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary/50 transition-colors"
                    onClick={() => toggleComments(post.id)}>
                    <MessageCircle className="h-4 w-4" />
                    <span className="font-bold text-xs">{post.comments_count || 0}</span>
                    {expandedComments.has(post.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Share */}
                  <button className="px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary/50 transition-colors"
                    onClick={() => handleShare(post)} title="Share">
                    <Share2 className="h-4 w-4" />
                  </button>

                  {/* Bookmark */}
                  <button className="px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
                    onClick={() => handleBookmark(post.id)} title={post.bookmarked_by_me ? "Unsave" : "Save"}>
                    <Bookmark className={`h-4 w-4 transition-all ${post.bookmarked_by_me ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>

                  {/* Message author */}
                  {post.user_id !== user?.id && (
                    <button className="px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary/50 transition-colors"
                      onClick={() => navigate(`/chat?user=${post.user_id}`)} title="Message">
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Comments Section */}
                <AnimatePresence>
                  {expandedComments.has(post.id) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-border/30 overflow-hidden">
                      {(comments[post.id] || []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2 mb-2.5">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden cursor-pointer"
                            onClick={() => navigate(`/player-card/${c.user_id}`)}>
                            {c.user_avatar ? <img src={mediaUrl(c.user_avatar)} alt="" className="h-6 w-6 rounded-full object-cover" />
                              : <User className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <div>
                            <span className="font-bold text-xs cursor-pointer hover:text-primary" onClick={() => navigate(`/player-card/${c.user_id}`)}>{c.user_name}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">{timeAgo(c.created_at)}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{c.content}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <Input placeholder="Write a comment..." className="h-8 text-xs bg-muted/50 border-border/30"
                          value={commentInputs[post.id] || ""}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && handleComment(post.id)} />
                        <Button variant="athletic" size="icon" className="h-8 w-8 flex-shrink-0"
                          onClick={() => handleComment(post.id)} disabled={!commentInputs[post.id]?.trim()}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Load More */}
        {page < totalPages && (
          <div className="text-center mt-8">
            <Button variant="athletic-outline" onClick={() => loadFeed(page + 1)}>Load More</Button>
          </div>
        )}

        {posts.length === 0 && (
          <div className="text-center py-20">
            <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-display text-xl font-bold text-muted-foreground">
              {feedTab === "following" ? "Follow people to see their posts" : "No posts yet"}
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2">
              {feedTab === "following" ? "Discover players in the 'For You' tab!" : "Be the first to share something!"}
            </p>
          </div>
        )}
      </div>

      {/* ═══ STORY VIEWER (Full screen overlay) ═══ */}
      <AnimatePresence>
        {activeStory && activeStory.stories[storyIdx] && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
            {/* Progress bars */}
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
              {activeStory.stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${
                    i < storyIdx ? "w-full bg-white" : i === storyIdx ? "w-full bg-white animate-pulse" : "w-0"
                  }`} />
                </div>
              ))}
            </div>

            {/* Story Header */}
            <div className="absolute top-8 left-4 right-4 flex items-center gap-3 z-10">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                {activeStory.user_avatar
                  ? <img src={mediaUrl(activeStory.user_avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
                  : <User className="h-4 w-4 text-white" />}
              </div>
              <span className="text-white text-sm font-bold">{activeStory.user_name}</span>
              <span className="text-white/60 text-xs">{timeAgo(activeStory.stories[storyIdx].created_at)}</span>
              <button onClick={() => setActiveStory(null)} className="ml-auto text-white/80 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Story Content */}
            <div className={`w-full max-w-md aspect-[9/16] mx-auto rounded-2xl flex items-center justify-center p-8 bg-gradient-to-br ${
              activeStory.stories[storyIdx].bg_color || STORY_COLORS[0]
            }`}>
              {activeStory.stories[storyIdx].media_url ? (
                <img src={mediaUrl(activeStory.stories[storyIdx].media_url)} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
              ) : (
                <p className="text-white text-xl font-bold text-center leading-relaxed drop-shadow-lg">
                  {activeStory.stories[storyIdx].content}
                </p>
              )}
            </div>

            {/* View count */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/60 text-xs z-10">
              <Eye className="h-3.5 w-3.5" /> {activeStory.stories[storyIdx].view_count || 0} views
            </div>

            {/* Tap areas */}
            <button onClick={prevStory} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
            <button onClick={nextStory} className="absolute right-0 top-0 bottom-0 w-2/3 z-10" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ CREATE STORY MODAL ═══ */}
      <AnimatePresence>
        {showStoryCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowStoryCreate(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              {/* Preview */}
              <div className={`aspect-[9/16] rounded-2xl flex flex-col items-center justify-center p-6 bg-gradient-to-br ${storyColor} mb-4 relative`}>
                <button onClick={() => setShowStoryCreate(false)} className="absolute top-3 right-3 text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Type your story..."
                  className="w-full bg-transparent border-none outline-none resize-none text-white text-lg font-bold text-center placeholder:text-white/50 min-h-[120px]"
                  maxLength={280}
                  autoFocus
                />
                <div className="absolute bottom-4 left-4 right-4">
                  {/* Color picker */}
                  <div className="flex gap-2 justify-center mb-3">
                    {STORY_COLORS.map((c) => (
                      <button key={c} onClick={() => setStoryColor(c)}
                        className={`h-6 w-6 rounded-full bg-gradient-to-br ${c} ${storyColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : ""}`} />
                    ))}
                  </div>
                  <Button variant="secondary" className="w-full font-bold" onClick={handleCreateStory}
                    disabled={!storyText.trim()}>
                    Share Story
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ TRENDING MODAL ═══ */}
      <AnimatePresence>
        {showTrending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTrending(false)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full max-w-lg bg-card border-t-2 sm:border-2 border-border rounded-t-2xl sm:rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-bold text-lg">Trending Now</h2>
                </div>
                <button onClick={() => setShowTrending(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {trendingPosts.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No trending posts yet. Be the first!</p>
              ) : (
                <div className="space-y-3">
                  {trendingPosts.map((post, idx) => (
                    <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
                      <div className="font-display font-black text-lg text-primary w-6 text-center">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold truncate">{post.user_name}</span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{post.content}</p>
                        <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>{post.likes_count} likes</span>
                          <span>{post.comments_count} comments</span>
                          <span>{totalReactions(post.reactions)} reactions</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ FOLLOWERS / FOLLOWING MODAL ═══ */}
      <AnimatePresence>
        {followModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setFollowModal(null)}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h2 className="font-display font-bold text-lg capitalize">{followModal.type}</h2>
                <button onClick={() => setFollowModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {followModalLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : followModal.list.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {followModal.type === "followers" ? "No followers yet" : "Not following anyone yet"}
                    </p>
                  </div>
                ) : (
                  followModal.list.map((u) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer overflow-hidden"
                        onClick={() => { setFollowModal(null); navigate(`/player-card/${u.id}`); }}>
                        {u.avatar ? <img src={mediaUrl(u.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                          : <User className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setFollowModal(null); navigate(`/player-card/${u.id}`); }}>
                        <div className="font-bold text-sm truncate">{u.name || u.username}</div>
                        {u.sport && <div className="text-[10px] text-muted-foreground capitalize">{u.sport}</div>}
                      </div>
                      {u.id !== user?.id && (
                        <Button
                          variant={u.is_following || followedUsers.has(u.id) ? "outline" : "athletic"}
                          size="sm"
                          className="h-8 text-[11px] min-w-[90px]"
                          onClick={() => handleFollow(u.id)}>
                          {u.is_following || followedUsers.has(u.id) ? "Following" : "Follow"}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
