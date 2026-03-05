import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/* ─── URL param utils (zero re-renders, no useSearchParams) ──── */
function replaceParams(updates) {
  const url = new URL(window.location);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === false) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}
function getInitParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
import { socialAPI, chatAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Heart,
  MessageSquare,
  User,
  ArrowLeft,
  Send,
  Share2,
  Loader2,
  Search,
  X,
  ChevronDown,
  Grid3X3,
  List,
  Clock,
  ArrowUpDown,
  BookmarkMinus,
  Image,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  SkeletonBox,
  SkeletonText,
} from "@/components/SkeletonLoader";

const REACTION_EMOJI = {
  fire: "\uD83D\uDD25",
  trophy: "\uD83C\uDFC6",
  clap: "\uD83D\uDC4F",
  heart: "\u2764\uFE0F",
  100: "\uD83D\uDCAF",
  muscle: "\uD83D\uDCAA",
};

/* ─── Skeleton ─────────────────────────────────────────────────── */
function BookmarksSkeleton() {
  return (
    <div className="min-h-screen bg-transparent pb-24 md:pb-8 px-3 sm:px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-[960px] mx-auto py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-6">
          <SkeletonBox className="h-10 w-10 rounded-xl" />
          <div className="flex-1">
            <SkeletonText className="w-32 h-6 mb-2" />
            <SkeletonText className="w-20 h-3" />
          </div>
        </div>
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <SkeletonBox className="flex-1 h-11 rounded-full" />
          <SkeletonBox className="h-11 w-11 rounded-xl" />
          <SkeletonBox className="h-11 w-11 rounded-xl" />
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[...Array(6)].map((_, i) => (
            <SkeletonBox key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────── */
export default function BookmarksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Data
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  // View & Filters — initialized from URL
  const [viewMode, setViewMode] = useState(() => getInitParam("view") || "grid");
  const [searchQuery, setSearchQuery] = useState(() => getInitParam("q") || "");
  const [sortOrder, setSortOrder] = useState(() => getInitParam("sort") || "newest");
  const [filterType, setFilterType] = useState(() => getInitParam("filter") || "all");
  const [showSearch, setShowSearch] = useState(() => !!getInitParam("q"));

  // Post detail modal
  const [activePost, setActivePost] = useState(null);

  // Comments (for detail modal)
  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentPages, setCommentPages] = useState({});

  // Reaction picker
  const [reactionPickerPost, setReactionPickerPost] = useState(null);
  const reactionPickerRef = useRef(null);

  // Share
  const [sharePost, setSharePost] = useState(null);
  const [shareSearch, setShareSearch] = useState("");
  const [shareUsers, setShareUsers] = useState([]);
  const [shareSending, setShareSending] = useState(null);

  // Double-tap
  const [doubleTapHeart, setDoubleTapHeart] = useState(null);
  const lastTap = useRef({});

  const searchInputRef = useRef(null);

  /* ─── Helpers ─────────────────────────────────────────────────── */
  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const totalReactions = (reactions) =>
    Object.values(reactions || {}).reduce((s, v) => s + v, 0);

  /* ─── Filtered & Sorted Posts ─────────────────────────────────── */
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.content?.toLowerCase().includes(q) ||
          p.user_name?.toLowerCase().includes(q),
      );
    }

    // Filter by type
    if (filterType === "media") {
      result = result.filter((p) => p.media_url);
    } else if (filterType === "text") {
      result = result.filter((p) => !p.media_url);
    }

    // Sort
    if (sortOrder === "oldest") {
      result.reverse();
    }

    return result;
  }, [posts, searchQuery, sortOrder, filterType]);

  /* ─── Load Bookmarks ─────────────────────────────────────────── */
  const loadBookmarks = useCallback(async (cursor = null) => {
    try {
      const res = await socialAPI.getBookmarks(cursor);
      const data = res.data || {};
      const newPosts = data.posts || [];
      if (!cursor) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }
      setNextCursor(data.next_cursor || null);
      setHasMore(data.has_more || false);
    } catch {
      toast.error("Failed to load saved posts");
    }
  }, []);

  useEffect(() => {
    loadBookmarks().finally(() => setLoading(false));
  }, [loadBookmarks]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadBookmarks(nextCursor);
    setLoadingMore(false);
  };

  /* ─── Post Interactions ──────────────────────────────────────── */
  const handleUnsave = async (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (activePost?.id === postId) setActivePost(null);
    try {
      await socialAPI.toggleBookmark(postId);
      toast.success("Removed from saved");
    } catch {
      loadBookmarks();
    }
  };

  const handleLike = async (postId) => {
    const update = (arr) =>
      arr.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1),
            }
          : p,
      );
    setPosts(update);
    if (activePost?.id === postId) {
      setActivePost((p) => ({
        ...p,
        liked_by_me: !p.liked_by_me,
        likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1),
      }));
    }
    try {
      await socialAPI.toggleLike(postId);
    } catch {
      setPosts(update);
    }
  };

  const handleDoubleTap = (postId) => {
    const now = Date.now();
    if (lastTap.current[postId] && now - lastTap.current[postId] < 400) {
      const post = posts.find((p) => p.id === postId);
      if (!post?.liked_by_me) handleLike(postId);
      setDoubleTapHeart(postId);
      setTimeout(() => setDoubleTapHeart(null), 800);
      lastTap.current[postId] = 0;
    } else {
      lastTap.current[postId] = now;
    }
  };

  const handleReaction = async (postId, reaction) => {
    const post = posts.find((p) => p.id === postId);
    const prev = post?.my_reaction;
    const updater = (p) => {
      if (p.id !== postId) return p;
      const reactions = { ...(p.reactions || {}) };
      if (prev) reactions[prev] = Math.max(0, (reactions[prev] || 0) - 1);
      if (prev !== reaction) reactions[reaction] = (reactions[reaction] || 0) + 1;
      return { ...p, my_reaction: prev === reaction ? null : reaction, reactions };
    };
    setPosts((ps) => ps.map(updater));
    if (activePost?.id === postId) setActivePost(updater);
    setReactionPickerPost(null);
    try {
      await socialAPI.react(postId, reaction);
    } catch {
      toast.error("Failed to react");
    }
  };

  /* ─── Comments ───────────────────────────────────────────────── */
  const loadComments = async (postId) => {
    if (comments[postId]) return;
    try {
      const res = await socialAPI.getComments(postId);
      const data = res.data;
      const list = data?.comments || data || [];
      setComments((prev) => ({ ...prev, [postId]: list }));
      setCommentPages((prev) => ({
        ...prev,
        [postId]: { cursor: data?.next_cursor || null, hasMore: data?.has_more || false, loading: false },
      }));
    } catch {
      toast.error("Failed to load comments");
    }
  };

  const loadMoreComments = async (postId) => {
    const pg = commentPages[postId];
    if (!pg || !pg.hasMore || pg.loading) return;
    setCommentPages((prev) => ({ ...prev, [postId]: { ...prev[postId], loading: true } }));
    try {
      const res = await socialAPI.getComments(postId, pg.cursor);
      const data = res.data;
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), ...(data?.comments || [])] }));
      setCommentPages((prev) => ({
        ...prev,
        [postId]: { cursor: data?.next_cursor || null, hasMore: data?.has_more || false, loading: false },
      }));
    } catch {
      setCommentPages((prev) => ({ ...prev, [postId]: { ...prev[postId], loading: false } }));
    }
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      const res = await socialAPI.addComment(postId, { content: text });
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p)),
      );
      if (activePost?.id === postId)
        setActivePost((p) => ({ ...p, comments_count: (p.comments_count || 0) + 1 }));
    } catch {
      toast.error("Failed to comment");
    }
  };

  /* ─── Share ──────────────────────────────────────────────────── */
  const openShare = async (post) => {
    setSharePost(post);
    setShareSearch("");
    try {
      const res = await chatAPI.conversations();
      setShareUsers((res.data || []).map((c) => c.other_user).filter(Boolean));
    } catch {
      setShareUsers([]);
    }
  };

  const handleShareSend = async (targetUserId) => {
    if (!sharePost || shareSending) return;
    setShareSending(targetUserId);
    try {
      await chatAPI.send(targetUserId, { content: `Check out this post! \uD83D\uDC49 /feed?post=${sharePost.id}` });
      toast.success("Shared!");
      setSharePost(null);
    } catch {
      toast.error("Failed to share");
    }
    setShareSending(null);
  };

  /* ─── Open Detail ────────────────────────────────────────────── */
  const openPostDetail = (post) => {
    setActivePost(post);
    loadComments(post.id);
  };

  /* ─── Effects ────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target))
        setReactionPickerPost(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  // Escape to close modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (sharePost) setSharePost(null);
        else if (activePost) setActivePost(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activePost, sharePost]);

  if (loading) return <BookmarksSkeleton />;

  const mediaCount = posts.filter((p) => p.media_url).length;
  const textCount = posts.filter((p) => !p.media_url).length;

  return (
    <div
      className="min-h-screen bg-transparent pb-24 md:pb-8 px-3 sm:px-4 md:px-6 lg:px-8"
      style={{ touchAction: "manipulation" }}
    >
      <div className="w-full max-w-[960px] mx-auto py-4 sm:py-6">
        {/* ═══════════════════════ HEADER ═══════════════════════ */}
        <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary active:bg-secondary/70 transition-all touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="admin-page-title text-lg sm:text-2xl">
              Saved
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </p>
          </div>
        </div>

        {/* ═══════════════════════ STATS BAR ════════════════════ */}
        {posts.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3 mb-5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => { setFilterType("all"); replaceParams({ filter: null }); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                filterType === "all"
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                  : "bg-card border border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              All ({posts.length})
            </button>
            <button
              onClick={() => { setFilterType("media"); replaceParams({ filter: "media" }); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                filterType === "media"
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                  : "bg-card border border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
              }`}
            >
              <Image className="h-3.5 w-3.5" />
              Media ({mediaCount})
            </button>
            <button
              onClick={() => { setFilterType("text"); replaceParams({ filter: "text" }); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                filterType === "text"
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                  : "bg-card border border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Text ({textCount})
            </button>
          </div>
        )}

        {/* ═══════════════════ TOOLBAR ══════════════════════════ */}
        {posts.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3 mb-5 sm:mb-6">
            {/* Search */}
            <div className="flex-1 relative">
              <AnimatePresence>
                {showSearch ? (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "100%", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="relative"
                  >
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); replaceParams({ q: e.target.value || null }); }}
                      placeholder="Search saved posts..."
                      className="w-full h-11 bg-card border border-border/40 rounded-full pl-10 pr-10 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 outline-none transition-all placeholder:text-muted-foreground/60"
                    />
                    <button
                      onClick={() => { setShowSearch(false); setSearchQuery(""); replaceParams({ q: null }); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full hover:bg-secondary/50 flex items-center justify-center"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="h-11 px-4 bg-card border border-border/40 rounded-full flex items-center gap-2.5 text-sm text-muted-foreground hover:border-brand-600/30 hover:text-foreground transition-all w-full"
                  >
                    <Search className="h-4 w-4" />
                    <span>Search saved posts...</span>
                  </button>
                )}
              </AnimatePresence>
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => { const next = sortOrder === "newest" ? "oldest" : "newest"; setSortOrder(next); replaceParams({ sort: next === "newest" ? null : next }); }}
              className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-all ${
                sortOrder === "oldest"
                  ? "bg-brand-600/10 border-brand-600/30 text-brand-600"
                  : "bg-card border-border/40 text-muted-foreground hover:border-brand-600/30 hover:text-foreground"
              }`}
              title={sortOrder === "newest" ? "Newest first" : "Oldest first"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>

            {/* View Toggle */}
            <div className="h-11 flex rounded-xl border border-border/40 overflow-hidden bg-card">
              <button
                onClick={() => { setViewMode("grid"); replaceParams({ view: null }); }}
                className={`w-11 flex items-center justify-center transition-all ${
                  viewMode === "grid"
                    ? "bg-brand-600 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                }`}
                title="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setViewMode("list"); replaceParams({ view: "list" }); }}
                className={`w-11 flex items-center justify-center transition-all ${
                  viewMode === "list"
                    ? "bg-brand-600 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ EMPTY STATE ══════════════════════ */}
        {posts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 sm:py-24"
          >
            <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 rounded-full bg-brand-600/5 flex items-center justify-center">
              <Bookmark className="h-12 w-12 sm:h-14 sm:w-14 text-brand-600/30" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
              No saved posts yet
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground/70 max-w-sm mx-auto mb-8">
              Tap the bookmark icon on any post to save it here for later
            </p>
            <Button
              onClick={() => navigate("/feed")}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-8 py-3 font-bold text-sm shadow-lg shadow-brand-600/20"
            >
              Browse Feed
            </Button>
          </motion.div>
        )}

        {/* Search empty */}
        {posts.length > 0 && filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-display text-lg font-bold text-muted-foreground mb-1">
              No results found
            </h3>
            <p className="text-sm text-muted-foreground/60">
              Try a different search or filter
            </p>
          </div>
        )}

        {/* ═══════════════════ GRID VIEW ════════════════════════ */}
        {viewMode === "grid" && filteredPosts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
            {filteredPosts.map((post, idx) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.015 }}
                layout
                className="relative group cursor-pointer aspect-square rounded-2xl sm:rounded-[20px] overflow-hidden bg-card border border-border/30"
                onClick={() => openPostDetail(post)}
              >
                {/* Thumbnail */}
                {post.media_url ? (
                  <img
                    src={mediaUrl(post.media_url)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full p-3 sm:p-4 flex flex-col justify-between bg-gradient-to-br from-card to-secondary/30">
                    <p className="text-xs sm:text-sm font-medium text-foreground/80 line-clamp-5 sm:line-clamp-6 leading-relaxed">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-5 w-5 rounded-full bg-secondary/50 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {post.user_avatar ? (
                          <img src={mediaUrl(post.user_avatar)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground truncate">
                        {post.user_name}
                      </span>
                    </div>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-4 sm:gap-5 text-white">
                    <div className="flex items-center gap-1.5">
                      <Heart className={`h-5 w-5 ${post.liked_by_me ? "fill-white" : ""}`} />
                      <span className="font-bold text-sm">{post.likes_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-5 w-5" />
                      <span className="font-bold text-sm">{post.comments_count || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Top-right unsave button (grid) */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnsave(post.id); }}
                  className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/80"
                  title="Unsave"
                >
                  <BookmarkMinus className="h-4 w-4" />
                </button>

                {/* Multi-content badge */}
                {post.media_url && post.content && (
                  <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                    <FileText className="h-3 w-3 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* ═══════════════════ LIST VIEW ════════════════════════ */}
        {viewMode === "list" && filteredPosts.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            <AnimatePresence>
              {filteredPosts.map((post, idx) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -80, scale: 0.96 }}
                  transition={{ delay: idx * 0.02 }}
                  layout
                  className="bg-card rounded-[20px] sm:rounded-[24px] overflow-hidden border border-border/40 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => openPostDetail(post)}
                >
                  <div className="flex gap-3 sm:gap-4 p-3.5 sm:p-4 md:p-5">
                    {/* Thumbnail */}
                    {post.media_url && (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-secondary/20">
                        <img
                          src={mediaUrl(post.media_url)}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-6 w-6 rounded-full bg-secondary/30 overflow-hidden flex items-center justify-center flex-shrink-0 border border-border/20">
                            {post.user_avatar ? (
                              <img src={mediaUrl(post.user_avatar)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                            {post.user_name}
                          </span>
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(post.created_at)}
                          </span>
                        </div>
                        {post.content && (
                          <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                            {post.content}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className={`h-3.5 w-3.5 ${post.liked_by_me ? "fill-pink-500 text-pink-500" : ""}`} />
                          {post.likes_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {post.comments_count || 0}
                        </span>
                      </div>
                    </div>

                    {/* Unsave */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnsave(post.id); }}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-brand-600 hover:bg-brand-600/10 transition-all touch-manipulation flex-shrink-0 self-start"
                      title="Unsave"
                    >
                      <Bookmark className="h-4.5 w-4.5 fill-current text-brand-600" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="text-center mt-8 sm:mt-10">
            <button
              className="text-sm font-bold text-brand-600 hover:text-brand-700 hover:underline px-6 py-3 transition-colors min-h-[44px] flex items-center gap-2 mx-auto disabled:opacity-50"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Load More
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════ POST DETAIL MODAL ═════════════════════ */}
      <AnimatePresence>
        {activePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
            onClick={() => setActivePost(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-border/40 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/30 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full bg-secondary/30 flex items-center justify-center cursor-pointer overflow-hidden border border-border/20"
                    onClick={() => { setActivePost(null); navigate(`/player-card/${activePost.user_id}`); }}
                  >
                    {activePost.user_avatar ? (
                      <img src={mediaUrl(activePost.user_avatar)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <span
                      className="font-display font-bold text-sm cursor-pointer hover:text-brand-600 transition-colors"
                      onClick={() => { setActivePost(null); navigate(`/player-card/${activePost.user_id}`); }}
                    >
                      {activePost.user_name}
                    </span>
                    <div className="text-[11px] text-muted-foreground">{timeAgo(activePost.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUnsave(activePost.id)}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-brand-600 hover:bg-brand-600/10 transition-all"
                    title="Unsave"
                  >
                    <Bookmark className="h-5 w-5 fill-current text-brand-600" />
                  </button>
                  <button
                    onClick={() => setActivePost(null)}
                    className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-secondary/50 transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Post content — fixed */}
                <div className="flex-shrink-0">
                {/* Double-tap area */}
                <div className="relative select-none" onClick={() => handleDoubleTap(activePost.id)}>
                  {activePost.content && (
                    <div className="px-5 sm:px-6 pt-4 pb-3">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                        {activePost.content}
                      </p>
                    </div>
                  )}
                  {activePost.media_url && (
                    <div className="w-full overflow-hidden bg-black/5">
                      <img
                        src={mediaUrl(activePost.media_url)}
                        alt=""
                        className="w-full h-auto block object-contain"
                        style={{ maxHeight: "500px" }}
                        draggable={false}
                      />
                    </div>
                  )}
                  <AnimatePresence>
                    {doubleTapHeart === activePost.id && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-lg" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Reaction summary */}
                {totalReactions(activePost.reactions) > 0 && (
                  <div className="flex items-center gap-1.5 px-5 sm:px-6 mt-3 text-[11px] text-muted-foreground">
                    {Object.entries(activePost.reactions || {})
                      .filter(([, v]) => v > 0)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <span key={k} className="flex items-center gap-0.5">
                          <span className="text-sm">{REACTION_EMOJI[k]}</span>
                          <span className="font-bold">{v}</span>
                        </span>
                      ))}
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 sm:px-6 py-3 flex items-center justify-between border-t border-b border-border/30 mt-3 bg-muted/5">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <button
                      className="flex items-center gap-1.5 group transition-colors min-h-[44px]"
                      onClick={() => handleLike(activePost.id)}
                    >
                      <Heart
                        className={`h-5 w-5 transition-colors group-hover:text-brand-600 ${activePost.liked_by_me ? "fill-pink-500 text-pink-500" : "text-muted-foreground"}`}
                      />
                      <span className={`font-bold text-xs ${activePost.liked_by_me ? "text-pink-500" : "text-muted-foreground"}`}>
                        {activePost.likes_count || 0}
                      </span>
                    </button>

                    <div className="relative" ref={reactionPickerRef}>
                      <button
                        onClick={() => setReactionPickerPost(reactionPickerPost === activePost.id ? null : activePost.id)}
                        className={`text-base transition-transform hover:scale-110 min-h-[44px] flex items-center ${activePost.my_reaction ? "text-brand-600" : "text-muted-foreground"}`}
                      >
                        {activePost.my_reaction ? REACTION_EMOJI[activePost.my_reaction] : "+"}
                      </button>
                      <AnimatePresence>
                        {reactionPickerPost === activePost.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-xl bg-card border-2 border-border shadow-lg z-10"
                          >
                            {Object.entries(REACTION_EMOJI).map(([key, emoji]) => (
                              <button
                                key={key}
                                onClick={() => handleReaction(activePost.id, key)}
                                className={`h-9 w-9 rounded-full flex items-center justify-center text-lg hover:bg-secondary/50 transition-transform hover:scale-110 ${activePost.my_reaction === key ? "bg-brand-600/10 ring-2 ring-brand-600" : ""}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-brand-600 transition-colors min-h-[44px]"
                      onClick={() => openShare(activePost)}
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {activePost.user_id !== user?.id && (
                      <button
                        className="text-muted-foreground hover:text-brand-600 transition-colors min-h-[44px] flex items-center"
                        onClick={() => { setActivePost(null); navigate(`/chat?user=${activePost.user_id}`); }}
                        title="Message"
                      >
                        <MessageSquare className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                </div>
                {/* Comments Section — scrollable */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                  <h4 className="font-bold text-sm text-foreground mb-4 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-brand-600" />
                    Comments ({activePost.comments_count || 0})
                  </h4>
                  {(comments[activePost.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground/60 text-center py-4">No comments yet</p>
                  )}
                  {(comments[activePost.id] || []).map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5 mb-3">
                      <div
                        className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden cursor-pointer"
                        onClick={() => { setActivePost(null); navigate(`/player-card/${c.user_id}`); }}
                      >
                        {c.user_avatar ? (
                          <img src={mediaUrl(c.user_avatar)} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className="font-bold text-xs cursor-pointer hover:text-brand-600 transition-colors"
                            onClick={() => { setActivePost(null); navigate(`/player-card/${c.user_id}`); }}
                          >
                            {c.user_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {commentPages[activePost.id]?.hasMore && (
                    <button
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline py-1 mb-2 disabled:opacity-50"
                      onClick={() => loadMoreComments(activePost.id)}
                      disabled={commentPages[activePost.id]?.loading}
                    >
                      {commentPages[activePost.id]?.loading ? "Loading..." : "Load more comments"}
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Input — pinned bottom */}
              <div className="flex gap-2 sm:gap-3 p-4 sm:p-5 border-t border-border/30 flex-shrink-0 bg-card">
                <Input
                  placeholder="Write a comment..."
                  className="h-10 sm:h-11 rounded-full text-sm bg-muted border-border/40 focus-visible:ring-brand-600/50"
                  name="comment"
                  autoComplete="off"
                  value={commentInputs[activePost.id] || ""}
                  onChange={(e) =>
                    setCommentInputs((prev) => ({ ...prev, [activePost.id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleComment(activePost.id)}
                />
                <button
                  className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-brand-600 text-white rounded-full flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-50"
                  onClick={() => handleComment(activePost.id)}
                  disabled={!commentInputs[activePost.id]?.trim()}
                  aria-label="Send comment"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ SHARE MODAL ═══════════════════════════ */}
      <AnimatePresence>
        {sharePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setSharePost(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-card w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[70vh] overflow-hidden border border-border/40 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/30">
                <h3 className="font-display font-bold text-base">Share Post</h3>
                <button
                  onClick={() => setSharePost(null)}
                  className="h-8 w-8 rounded-full hover:bg-secondary/50 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 sm:p-5 overflow-y-auto max-h-[50vh]">
                {shareUsers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No conversations yet. Start a chat first!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shareUsers
                      .filter((u) => !shareSearch || u.name?.toLowerCase().includes(shareSearch.toLowerCase()))
                      .map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleShareSend(u.id)}
                          disabled={shareSending === u.id}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/50 active:bg-secondary/70 transition-all touch-manipulation"
                        >
                          <div className="h-10 w-10 rounded-full bg-secondary/30 overflow-hidden border border-border/20 flex items-center justify-center flex-shrink-0">
                            {u.avatar ? (
                              <img src={mediaUrl(u.avatar)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <span className="font-bold text-sm flex-1 text-left truncate">{u.name}</span>
                          {shareSending === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                          ) : (
                            <Send className="h-4 w-4 text-brand-600" />
                          )}
                        </button>
                      ))}
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
