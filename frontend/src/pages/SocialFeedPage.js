import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  socialAPI,
  recommendationAPI,
  uploadAPI,
  chatAPI,
  userSearchAPI,
} from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageSquare,
  Send,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  User,
  Flame,
  X,
  TrendingUp,
  UserPlus,
  Users,
  Shield,
  Zap,
  Bookmark,
  Share2,
  Image,
  Search,
  RefreshCw,
  Trophy,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { FeedSkeleton } from "@/components/SkeletonLoader";
import StoryViewer from "@/components/StoryViewer";

const REACTION_EMOJI = {
  fire: "\uD83D\uDD25",
  trophy: "\uD83C\uDFC6",
  clap: "\uD83D\uDC4F",
  heart: "\u2764\uFE0F",
  100: "\uD83D\uDCAF",
  muscle: "\uD83D\uDCAA",
};

const STORY_COLORS = [
  "from-green-500 to-brand-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-orange-500 to-red-600",
  "from-cyan-500 to-blue-600",
  "from-rose-500 to-pink-600",
];

function safeSessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // QuotaExceededError — clear feed cache and retry once
    try {
      sessionStorage.removeItem("feedPosts");
      sessionStorage.removeItem("feedSnapshot");
      sessionStorage.setItem(key, value);
    } catch { /* give up silently */ }
  }
}

export default function SocialFeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedTab, setFeedTab] = useState(searchParams.get("tab") || "for_you");

  // Post composer
  const [newContent, setNewContent] = useState("");
  const [postType, setPostType] = useState("text");
  const [showComposer, setShowComposer] = useState(false);

  // Stories
  const [storyGroups, setStoryGroups] = useState([]);
  const [storyViewerGroupIdx, setStoryViewerGroupIdx] = useState(null); // null = closed, number = open at group index
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

  // Discover users
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverResults, setDiscoverResults] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const discoverRef = useRef(null);

  // Comments
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentPages, setCommentPages] = useState({}); // {postId: {page, pages, hasMore, loading}}

  // Reaction picker
  const [reactionPickerPost, setReactionPickerPost] = useState(null);

  // Algorithm-powered recommendations
  const [algoPlayers, setAlgoPlayers] = useState([]);
  const [engScore, setEngScore] = useState(null);

  const storiesRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const restoredRef = useRef(false); // prevent double-load on re-render
  const feedAbortRef = useRef(null); // abort in-flight feed requests on tab switch

  const loadFeed = useCallback(
    async (cursor = null, tab = feedTab) => {
      // Abort previous in-flight request
      if (feedAbortRef.current) feedAbortRef.current.abort();
      const controller = new AbortController();
      feedAbortRef.current = controller;
      try {
        const res = await socialAPI.getFeed(tab, cursor, { signal: controller.signal });
        const data = res.data || {};
        const newPosts = data.posts || [];
        if (!cursor) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            return [...prev, ...newPosts.filter((p) => !existing.has(p.id))];
          });
        }
        setNextCursor(data.next_cursor || null);
        setHasMore(data.has_more || false);
      } catch (err) {
        if (err?.name !== "AbortError" && err?.code !== "ERR_CANCELED") {
          toast.error("Failed to load feed");
        }
      } finally {
        setLoading(false);
      }
    },
    [feedTab],
  );

  // Restore all pages up to a saved cursor (for browser back button)
  const restoreToPosition = useCallback(
    async (targetCursor, tab = feedTab) => {
      let cursor = null;
      let allPosts = [];
      const target = parseInt(targetCursor, 10);
      try {
        while (true) {
          const res = await socialAPI.getFeed(tab, cursor);
          const data = res.data || {};
          allPosts = [...allPosts, ...(data.posts || [])];
          const next = data.next_cursor;
          if (!data.has_more || !next || parseInt(next, 10) >= target) {
            setNextCursor(next || null);
            setHasMore(data.has_more || false);
            break;
          }
          cursor = next;
        }
        setPosts(allPosts);
      } catch {
        toast.error("Failed to restore feed");
      } finally {
        setLoading(false);
      }
    },
    [feedTab],
  );

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

  // Save posts + scroll when leaving — so back button restores exact same view
  useEffect(() => {
    return () => {
      const urlCursor = new URLSearchParams(window.location.search).get("cursor");
      if (urlCursor) {
        safeSessionSet("feedSnapshot", JSON.stringify({
          cursor: urlCursor,
          scrollY: window.scrollY,
        }));
        safeSessionSet("feedPosts", JSON.stringify(posts.slice(0, 50)));
      }
    };
  }, [posts]);

  // On mount: restore snapshot or fresh load
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const urlCursor = searchParams.get("cursor");
    const snapshotRaw = sessionStorage.getItem("feedSnapshot");
    const postsRaw = sessionStorage.getItem("feedPosts");
    const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : null;

    if (urlCursor && snapshot && snapshot.cursor === urlCursor && postsRaw) {
      // Restore post ORDER from snapshot (no re-ranking), then refresh counts from server
      const savedPosts = JSON.parse(postsRaw);
      setPosts(savedPosts);
      setNextCursor(urlCursor);
      setHasMore(true);
      setLoading(false);
      sessionStorage.removeItem("feedSnapshot");
      sessionStorage.removeItem("feedPosts");
      setTimeout(() => {
        window.scrollTo({ top: snapshot.scrollY || 0, behavior: "instant" });
      }, 80);
      // Background count refresh: re-fetch all loaded pages silently, merge updated counts by post ID
      const numToRefresh = savedPosts.length;
      (async () => {
        try {
          const allFresh = [];
          let refreshCursor = null;
          while (allFresh.length < numToRefresh) {
            const res = await socialAPI.getFeed(feedTab, refreshCursor);
            const data = res.data || {};
            allFresh.push(...(data.posts || []));
            if (!data.has_more || !data.next_cursor || allFresh.length >= numToRefresh) break;
            refreshCursor = data.next_cursor;
          }
          const freshMap = Object.fromEntries(allFresh.map((p) => [p.id, p]));
          setPosts((prev) =>
            prev.map((p) =>
              freshMap[p.id]
                ? { ...p, likes_count: freshMap[p.id].likes_count, comments_count: freshMap[p.id].comments_count, liked_by_me: freshMap[p.id].liked_by_me }
                : p
            )
          );
        } catch {}
      })();
      Promise.all([loadStories(), loadEngagement(), loadSuggested(), loadAlgoPlayers(), loadEngScore()]).catch(() => {});
      return;
    }

    sessionStorage.removeItem("feedSnapshot");
    sessionStorage.removeItem("feedPosts");

    Promise.all([
      loadFeed(),
      loadStories(),
      loadEngagement(),
      loadSuggested(),
      loadAlgoPlayers(),
      loadEngScore(),
    ]).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Instagram-style: clicking Feed nav button while on feed → scroll top + refresh
  useEffect(() => {
    const handler = () => {
      setSearchParams({});
      sessionStorage.removeItem("feedSnapshot");
      sessionStorage.removeItem("feedPosts");
      loadFeed(null, feedTab);
      loadStories();
      loadEngagement();
    };
    window.addEventListener("feed:refresh", handler);
    return () => window.removeEventListener("feed:refresh", handler);
  }, [feedTab, loadFeed, loadStories, loadEngagement]);

  const handleTabChange = (tab) => {
    setFeedTab(tab);
    setLoading(true);
    setSearchParams(tab !== "for_you" ? { tab } : {}, { replace: true });
    sessionStorage.removeItem("feedScrollY");
    loadFeed(null, tab);
  };

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactionPickerPost) return;
    const handleClickOutside = (e) => {
      if (
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(e.target)
      ) {
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
      setPosts((prev) => [
        {
          ...res.data,
          liked_by_me: false,
          my_reaction: null,
          bookmarked_by_me: false,
        },
        ...prev,
      ]);
      setNewContent("");
      setImagePreview(null);
      setImageFile(null);
      setShowComposer(false);
      toast.success("Posted!");
      loadEngagement();
    } catch {
      toast.error("Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              likes_count: p.likes_count + (p.liked_by_me ? -1 : 1),
            }
          : p,
      ),
    );
    try {
      await socialAPI.toggleLike(postId);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: !p.liked_by_me,
                likes_count: p.likes_count + (p.liked_by_me ? -1 : 1),
              }
            : p,
        ),
      );
    }
  };

  const handleReaction = async (postId, reaction) => {
    setReactionPickerPost(null);
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const reactions = { ...(p.reactions || {}) };
        if (p.my_reaction === reaction) {
          reactions[reaction] = Math.max(0, (reactions[reaction] || 0) - 1);
          return { ...p, my_reaction: null, reactions };
        }
        if (p.my_reaction)
          reactions[p.my_reaction] = Math.max(
            0,
            (reactions[p.my_reaction] || 0) - 1,
          );
        reactions[reaction] = (reactions[reaction] || 0) + 1;
        return { ...p, my_reaction: reaction, reactions };
      }),
    );
    try {
      await socialAPI.react(postId, reaction);
    } catch {
      loadFeed();
    }
  };

  const handleDelete = async (postId) => {
    try {
      await socialAPI.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setComments((prev) => { const c = { ...prev }; delete c[postId]; return c; });
      setCommentPages((prev) => { const c = { ...prev }; delete c[postId]; return c; });
      setExpandedComments((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };


  const handleFollow = async (userId) => {
    try {
      const res = await socialAPI.toggleFollow(userId);
      const isNowFollowing = res.data.following;

      // Update all posts from this user
      setPosts((prev) =>
        prev.map((p) =>
          p.user_id === userId ? { ...p, is_following: isNowFollowing } : p,
        ),
      );

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
          list: prev.list.map((u) =>
            u.id === userId ? { ...u, is_following: isNowFollowing } : u,
          ),
        };
      });

      toast.success(isNowFollowing ? "Following!" : "Unfollowed");
      loadEngagement();
    } catch {
      toast.error("Failed");
    }
  };

  // Discover search
  const handleDiscoverSearch = async (q) => {
    setDiscoverQuery(q);
    if (q.length < 2) { setDiscoverResults([]); return; }
    setDiscoverLoading(true);
    try {
      const res = await userSearchAPI.search(q);
      setDiscoverResults((res.data || []).filter((u) => u.id !== user?.id));
    } catch {} finally { setDiscoverLoading(false); }
  };

  // Close discover on click outside
  useEffect(() => {
    if (!showDiscover) return;
    const handler = (e) => {
      if (discoverRef.current && !discoverRef.current.contains(e.target)) setShowDiscover(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDiscover]);

  const openFollowModal = async (type) => {
    setFollowModalLoading(true);
    setFollowModal({ type, list: [] });
    try {
      const res =
        type === "followers"
          ? await socialAPI.getFollowers(user.id)
          : await socialAPI.getFollowing(user.id);
      const data = res.data || {};
      const list = data.users || data || [];
      // Mark which users we follow
      const followingRes = await socialAPI.getFollowing(user.id);
      const fData = followingRes.data || {};
      const followingList = fData.users || fData || [];
      const followingIds = new Set(followingList.map((u) => u.id));
      setFollowedUsers(followingIds);
      setFollowModal({
        type,
        list: list.map((u) => ({ ...u, is_following: followingIds.has(u.id) })),
      });
    } catch {
      toast.error("Failed to load " + type);
      setFollowModal(null);
    }
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
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p,
      ),
    );
    try {
      await socialAPI.toggleBookmark(postId);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p,
        ),
      );
      toast.error("Failed");
    }
  };

  // ─── Share ───────────────────────────────────────────────────────────────
  const handleShare = async (post) => {
    const url = `${window.location.origin}/feed?post=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${post.user_name} on Horizon`,
          text: post.content?.slice(0, 100),
          url,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  // ─── Share to DM ────────────────────────────────────────────────────────
  const [sharePost, setSharePost] = useState(null);
  const [shareFollowing, setShareFollowing] = useState([]);
  const [shareSearch, setShareSearch] = useState("");
  const [shareResults, setShareResults] = useState([]);
  const [shareSending, setShareSending] = useState(null); // user id being sent to

  const shareFollowingLoaded = useRef(false);
  useEffect(() => {
    if (sharePost && user?.id && !shareFollowingLoaded.current) {
      shareFollowingLoaded.current = true;
      socialAPI
        .getFollowing(user.id)
        .then((r) => { const d = r.data || {}; setShareFollowing(d.users || d || []); })
        .catch(() => {});
    }
  }, [sharePost, user?.id]);

  const handleShareSearch = async (q) => {
    setShareSearch(q);
    if (q.length < 2) {
      setShareResults([]);
      return;
    }
    try {
      const res = await userSearchAPI.search(q);
      setShareResults((res.data || []).filter((u2) => u2.id !== user?.id));
    } catch {}
  };

  const handleSendPost = async (targetUser) => {
    if (!sharePost || shareSending) return;
    setShareSending(targetUser.id);
    try {
      const convo = await chatAPI.startConversation(targetUser.id);
      await chatAPI.sendMessage(convo.data.id, {
        content: `🔗 Shared a post by ${sharePost.user_name}`,
        shared_post: {
          id: sharePost.id,
          user_name: sharePost.user_name,
          user_avatar: sharePost.user_avatar,
          content: (sharePost.content || "").slice(0, 200),
          media_url: sharePost.media_url || "",
        },
      });
      const isRequest = convo.data.status === "request";
      toast.success(
        isRequest
          ? `Sent as request to ${targetUser.name}`
          : `Sent to ${targetUser.name}`,
      );
      setSharePost(null);
      setShareSearch("");
      setShareResults([]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to send");
    } finally {
      setShareSending(null);
    }
  };

  // ─── Pull to refresh ────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchParams({});
    await Promise.all([loadFeed(null, feedTab), loadStories(), loadEngagement()]);
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
      await socialAPI.createStory({
        content: storyText.trim(),
        bg_color: storyColor,
      });
      setStoryText("");
      setShowStoryCreate(false);
      toast.success("Story posted!");
      loadStories();
      loadEngagement();
    } catch {
      toast.error("Failed to post story");
    }
  };

  const openStoryGroup = (group) => {
    const idx = storyGroups.findIndex((g) => g.user_id === group.user_id);
    setStoryViewerGroupIdx(idx >= 0 ? idx : 0);
  };

  // ─── Comments ──────────────────────────────────────────────────────────────

  const toggleComments = async (postId) => {
    const newSet = new Set(expandedComments);
    if (newSet.has(postId)) {
      newSet.delete(postId);
      // Reset cursor so re-expand fetches fresh comments
      setCommentPages((prev) => { const c = { ...prev }; delete c[postId]; return c; });
      setComments((prev) => { const c = { ...prev }; delete c[postId]; return c; });
    } else {
      newSet.add(postId);
      if (!comments[postId]) {
        try {
          const res = await socialAPI.getComments(postId);
          const data = res.data;
          const list = data?.comments || data || [];
          setComments((prev) => ({ ...prev, [postId]: list }));
          setCommentPages((prev) => ({ ...prev, [postId]: { cursor: data?.next_cursor || null, hasMore: data?.has_more || false, loading: false } }));
        } catch {
          toast.error("Failed to load comments");
        }
      }
    }
    setExpandedComments(newSet);
  };

  const loadMoreComments = async (postId) => {
    const pg = commentPages[postId];
    if (!pg || !pg.hasMore || pg.loading) return;
    setCommentPages((prev) => ({ ...prev, [postId]: { ...prev[postId], loading: true } }));
    try {
      const res = await socialAPI.getComments(postId, pg.cursor);
      const data = res.data;
      const newList = data?.comments || [];
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), ...newList] }));
      setCommentPages((prev) => ({
        ...prev,
        [postId]: { cursor: data?.next_cursor || null, hasMore: data?.has_more || false, loading: false },
      }));
    } catch {
      setCommentPages((prev) => ({ ...prev, [postId]: { ...prev[postId], loading: false } }));
      toast.error("Failed to load more comments");
    }
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      const res = await socialAPI.addComment(postId, { content: text });
      setComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), res.data],
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments_count: (p.comments_count || 0) + 1 }
            : p,
        ),
      );
    } catch {
      toast.error("Failed to comment");
    }
  };

  // ─── Trending ──────────────────────────────────────────────────────────────

  const loadTrending = async () => {
    try {
      const res = await socialAPI.trending();
      setTrendingPosts(res.data || []);
      setShowTrending(true);
    } catch {
      toast.error("Failed to load trending");
    }
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

  const totalReactions = (reactions) =>
    Object.values(reactions || {}).reduce((s, v) => s + v, 0);

  if (loading) {
    return <FeedSkeleton />;
  }

  return (
    <div
      className="min-h-screen bg-transparent pb-24 md:pb-8 px-3 sm:px-4 md:px-6 lg:px-8"
      style={{ touchAction: "manipulation" }}
    >
      <div className="w-full py-4 sm:py-6 flex flex-col lg:flex-row gap-5 sm:gap-6 lg:gap-8 items-start mx-auto xl:max-w-[1280px]">
        {/* MAIN FEED COLUMN */}
        <div className="flex-1 min-w-0 w-full">
          {/* ═══ STORIES BAR ═══ */}
          <div className="mb-4 sm:mb-6">
            <div
              ref={storiesRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1 -mx-1"
            >
              {/* Create Story */}
              <button
                onClick={() => setShowStoryCreate(true)}
                className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[72px] sm:min-w-[80px] flex-shrink-0"
                aria-label="Add Story"
              >
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-brand-600/40 flex items-center justify-center cursor-pointer hover:bg-brand-600/5 transition-colors">
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                  Add Story
                </span>
              </button>

              {/* Story Bubbles */}
              {storyGroups.map((group) => (
                <button
                  key={group.user_id}
                  onClick={() => openStoryGroup(group)}
                  aria-label={`View ${group.user_name}'s story`}
                  className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[72px] sm:min-w-[80px] flex-shrink-0"
                >
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2px] ${
                      group.has_unviewed
                        ? "bg-gradient-to-br from-brand-400 to-brand-600"
                        : "bg-muted-foreground/20"
                    }`}
                  >
                    <div className="w-full h-full rounded-full border-2 border-background overflow-hidden relative">
                      {group.user_avatar ? (
                        <img
                          src={mediaUrl(group.user_avatar)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-medium text-foreground truncate max-w-[64px] sm:max-w-[70px]">
                    {group.user_id === user?.id
                      ? "You"
                      : group.user_name?.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ═══ MOBILE INLINE WIDGETS (only visible < lg) ═══ */}

          {/* ── Unified Performance + Prompt Card — mobile only ── */}
          {engagement && (
            <div className="lg:hidden mb-3">
              <div className="rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 text-white">
                {/* Stats row */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-orange-300" />
                      <span className="text-[11px] font-bold text-white/90">
                        {engagement.current_streak} day
                        {engagement.current_streak !== 1 ? "s" : ""} streak
                      </span>
                    </div>
                    {engScore && (
                      <span className="text-[10px] font-bold bg-white/15 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {engScore.level}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => openFollowModal("followers")}
                      className="bg-white/10 backdrop-blur-sm rounded-xl py-2 text-center hover:bg-white/20 transition-colors"
                    >
                      <span className="text-lg font-black block tabular-nums leading-none">
                        {engagement.followers_count}
                      </span>
                      <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mt-1 block">
                        Followers
                      </span>
                    </button>
                    <button
                      onClick={() => openFollowModal("following")}
                      className="bg-white/10 backdrop-blur-sm rounded-xl py-2 text-center hover:bg-white/20 transition-colors"
                    >
                      <span className="text-lg font-black block tabular-nums leading-none">
                        {engagement.following_count}
                      </span>
                      <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mt-1 block">
                        Following
                      </span>
                    </button>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl py-2 text-center">
                      <span className="text-lg font-black block tabular-nums leading-none">
                        {engagement.posts_count || 0}
                      </span>
                      <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mt-1 block">
                        Posts
                      </span>
                    </div>
                  </div>
                </div>
                {/* Prompt row — integrated */}
                <div className="px-3 pb-3 pt-1">
                  <button
                    onClick={() => {
                      setShowComposer(true);
                      setNewContent(
                        (engagement?.daily_prompt ||
                          "What are your training goals for the upcoming season?") +
                          " ",
                      );
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full flex items-center gap-2.5 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-3 py-2 text-left"
                  >
                    <Trophy className="h-4 w-4 text-white/50 flex-shrink-0" />
                    <span className="text-[11px] font-medium text-white/80 flex-1 min-w-0 line-clamp-1">
                      {engagement?.daily_prompt ||
                        "What are your training goals?"}
                    </span>
                    <span className="text-[10px] font-bold bg-white text-brand-600 px-2.5 py-1 rounded-full flex-shrink-0">
                      Reply
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ NAV PILLS ═══ */}
          <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-4 sm:mb-6 overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 sm:gap-8 min-w-max pr-2 sm:pr-4">
              {[
                { id: "for_you", label: "For You" },
                { id: "following", label: "Following" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={`relative pb-2 text-sm font-bold transition-colors ${
                    feedTab === t.id
                      ? "text-brand-600"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {feedTab === t.id && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-brand-600 rounded-t-full"></div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={handleRefresh}
                className="h-11 w-11 sm:h-9 sm:w-9 md:h-8 md:w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-full"
                title="Refresh"
                aria-label="Refresh feed"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={() => { setShowDiscover((v) => !v); setDiscoverQuery(""); setDiscoverResults([]); }}
                className={`sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                  showDiscover ? "bg-brand-600 text-white border-brand-600" : "text-muted-foreground border-border/60 hover:bg-card hover:text-foreground"
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Discover</span>
              </button>
              <button
                onClick={() => navigate("/bookmarks")}
                className="h-11 w-11 sm:h-9 sm:w-9 md:h-8 md:w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-full"
                title="Saved Posts"
                aria-label="Saved Posts"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ═══ POST COMPOSER ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 p-4 sm:p-5 md:p-6 rounded-[20px] sm:rounded-[24px] bg-card border border-border/40 shadow-sm cursor-text"
            onClick={() => !showComposer && setShowComposer(true)}
          >
            {!showComposer ? (
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 rounded-full bg-secondary/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user?.avatar ? (
                    <img
                      src={mediaUrl(user.avatar)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm sm:text-lg text-muted-foreground/60 flex-1 min-w-0 truncate">
                  Share a training tip or update…
                </span>
                <Button
                  size="sm"
                  className="ml-auto bg-brand-600 text-white rounded-full px-5 hover:bg-brand-700 shadow-md shadow-brand-600/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComposer(true);
                  }}
                >
                  Post
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="h-10 w-10 rounded-full bg-secondary/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user?.avatar ? (
                      <img
                        src={mediaUrl(user.avatar)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <textarea
                      className="w-full border-none focus:ring-0 p-0 text-base sm:text-lg text-foreground bg-transparent resize-none h-12 outline-none"
                      placeholder={
                        engagement?.daily_prompt ||
                        "Share a training tip or update\u2026"
                      }
                      name="post_content"
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    {/* Image Preview */}
                    {imagePreview && (
                      <div className="relative mt-2 mb-2">
                        <img
                          src={imagePreview}
                          alt="Upload preview"
                          className="rounded-xl w-full max-h-60 object-cover"
                        />
                        <button
                          onClick={() => {
                            setImagePreview(null);
                            setImageFile(null);
                          }}
                          aria-label="Remove image"
                          className="absolute top-2 right-2 h-7 w-7 sm:h-6 sm:w-6 rounded-full bg-black/60 flex items-center justify-center text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/30">
                      <div className="flex gap-3 sm:gap-4 text-muted-foreground">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="hover:text-brand-600 transition-colors flex items-center gap-1.5"
                          title="Add photo"
                          aria-label="Add photo"
                        >
                          <Image className="h-5 w-5" />
                          <span className="text-xs font-bold hidden sm:inline">
                            Media
                          </span>
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => setShowComposer(false)}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 sm:px-3 py-1 font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreatePost}
                          disabled={!newContent.trim() || posting}
                          className="bg-brand-600 text-white px-4 sm:px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-brand-600/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                        >
                          {posting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Post"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Suggested Follows — horizontal scrollable strip, mobile only */}
          {(algoPlayers.length > 0 || suggestedFollows.length > 0) && (
            <div className="lg:hidden mb-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Suggested for you
                </h3>
                {algoPlayers.length > 0 && (
                  <span className="text-[8px] bg-brand-600/10 text-brand-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    AI
                  </span>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 px-1 -mx-1">
                {(algoPlayers.length > 0 ? algoPlayers : suggestedFollows)
                  .slice(0, 8)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col items-center gap-1.5 min-w-[80px] flex-shrink-0"
                    >
                      <div
                        className="w-14 h-14 rounded-full bg-secondary/30 overflow-hidden border-2 border-border/20 cursor-pointer hover:border-brand-600 transition-colors flex items-center justify-center"
                        onClick={() => navigate(`/player-card/${s.id}`)}
                      >
                        {s.avatar ? (
                          <img
                            src={mediaUrl(s.avatar)}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-foreground truncate max-w-[72px] text-center">
                        {s.name?.split(" ")[0]}
                      </span>
                      <button
                        onClick={() => handleFollow(s.id)}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors ${
                          followedUsers.has(s.id)
                            ? "bg-secondary/40 text-muted-foreground"
                            : "bg-brand-600 text-white hover:bg-brand-700"
                        }`}
                      >
                        {followedUsers.has(s.id) ? "Following" : "Follow"}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ═══ POSTS ═══ */}
          <div className="space-y-3 sm:space-y-4">
            <AnimatePresence>
              {posts.map((post, idx) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-card rounded-[20px] sm:rounded-[24px] overflow-hidden border border-border/40 shadow-sm transition-all hover:shadow-md"
                >
                  {/* Post Header */}
                  <div className="p-4 sm:p-5 md:p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-secondary/30 flex items-center justify-center cursor-pointer overflow-hidden border border-border/20"
                        onClick={() => navigate(`/player-card/${post.user_id}`)}
                      >
                        {post.user_avatar ? (
                          <img
                            src={mediaUrl(post.user_avatar)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span
                            className="font-display font-bold text-[14px] sm:text-[15px] cursor-pointer hover:text-brand-600 transition-colors truncate"
                            onClick={() =>
                              navigate(`/player-card/${post.user_id}`)
                            }
                          >
                            {post.user_name}
                          </span>
                          {post.user_id !== user?.id && (
                            <button
                              onClick={() => handleFollow(post.user_id)}
                              className={`text-[11px] font-bold hover:underline ml-1 sm:ml-2 py-0.5 ${post.is_following ? "text-muted-foreground" : "text-brand-600"}`}
                            >
                              {post.is_following ? "Following" : "Follow"}
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(post.created_at)}
                        </span>
                      </div>
                    </div>
                    {post.post_type !== "text" &&
                      post.post_type !== "photo" && (
                        <Badge className="bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 shadow-none border-none text-[10px] uppercase font-bold tracking-wider">
                          {post.post_type === "match_result"
                            ? "score"
                            : post.post_type}
                        </Badge>
                      )}
                  </div>

                  {/* Content — double tap to like */}
                  <div
                    className="relative select-none"
                    onClick={() => handleDoubleTap(post.id)}
                  >
                    {post.content && (
                      <div className="px-4 sm:px-6 pb-4">
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                          {post.content}
                        </p>
                      </div>
                    )}
                    {post.media_url && (
                      <div className="w-full overflow-hidden bg-black/5">
                        <img
                          src={mediaUrl(post.media_url)}
                          alt="Post media"
                          className="w-full h-auto block object-contain"
                          style={{ maxHeight: "620px" }}
                          draggable={false}
                        />
                      </div>
                    )}
                    {/* Heart animation on double-tap */}
                    <AnimatePresence>
                      {doubleTapHeart === post.id && (
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

                  {/* Reaction Summary */}
                  {totalReactions(post.reactions) > 0 && (
                    <div className="flex items-center gap-1 px-4 sm:px-6 mb-3 text-[11px] text-muted-foreground">
                      {Object.entries(post.reactions || {})
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
                  <div className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-4 flex items-center justify-between border-t border-border/30 bg-muted/5">
                    <div className="flex items-center gap-4 sm:gap-5 md:gap-6">
                      {/* Like */}
                      <button
                        className="flex items-center gap-1.5 sm:gap-2 group transition-colors min-h-[44px] min-w-[44px] justify-center sm:justify-start sm:min-w-0"
                        onClick={() => handleLike(post.id)}
                        aria-label={
                          post.liked_by_me ? "Unlike post" : "Like post"
                        }
                      >
                        <Heart
                          className={`h-5 w-5 transition-colors group-hover:text-brand-600 ${post.liked_by_me ? "fill-pink-500 text-pink-500" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`font-bold text-xs group-hover:text-brand-600 ${post.liked_by_me ? "text-pink-500" : "text-muted-foreground"}`}
                        >
                          {post.likes_count || 0}
                        </span>
                      </button>

                      {/* Reaction Picker */}
                      <div className="relative" ref={reactionPickerRef}>
                        <button
                          onClick={() =>
                            setReactionPickerPost(
                              reactionPickerPost === post.id ? null : post.id,
                            )
                          }
                          className={`flex items-center gap-1 group transition-colors text-muted-foreground hover:text-brand-600 ${post.my_reaction ? "text-brand-600" : ""}`}
                        >
                          <span className="text-base group-hover:scale-110 transition-transform">
                            {post.my_reaction
                              ? REACTION_EMOJI[post.my_reaction]
                              : "+"}
                          </span>
                        </button>
                        <AnimatePresence>
                          {reactionPickerPost === post.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="absolute bottom-full left-1/2 sm:left-0 mb-1 flex gap-1 p-1.5 rounded-xl bg-card border-2 border-border shadow-lg z-10 -translate-x-1/2 sm:translate-x-0"
                            >
                              {Object.entries(REACTION_EMOJI).map(
                                ([key, emoji]) => (
                                  <button
                                    key={key}
                                    onClick={() => handleReaction(post.id, key)}
                                    className={`h-10 w-10 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-lg hover:bg-secondary/50 transition-transform hover:scale-110 ${post.my_reaction === key ? "bg-brand-600/10 ring-2 ring-brand-600" : ""}`}
                                  >
                                    {emoji}
                                  </button>
                                ),
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Comments */}
                      <button
                        className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-brand-600 transition-colors group min-h-[44px] min-w-[44px] justify-center sm:justify-start sm:min-w-0"
                        onClick={() => toggleComments(post.id)}
                        aria-label="Toggle comments"
                      >
                        <MessageSquare className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-xs">
                          {post.comments_count || 0}
                        </span>
                      </button>

                      {/* Share — opens DM sheet */}
                      <button
                        className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-brand-600 transition-colors group min-h-[44px] min-w-[44px] justify-center sm:justify-start sm:min-w-0"
                        onClick={() => setSharePost(post)}
                        title="Share"
                        aria-label="Share post"
                      >
                        <Share2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>

                    {/* Spacer to push bookmarks to right */}
                    <div className="flex-1" />

                    {/* Message author */}
                    {post.user_id !== user?.id && (
                      <button
                        className="text-muted-foreground hover:text-brand-600 transition-colors group min-h-[44px] min-w-[44px] flex items-center justify-center"
                        onClick={() => navigate(`/chat?user=${post.user_id}`)}
                        title="Message"
                        aria-label={`Message ${post.user_name}`}
                      >
                        <MessageSquare className="h-5 w-5 group-hover:scale-110 transition-transform" />
                      </button>
                    )}

                    {/* Bookmark */}
                    <button
                      className="text-muted-foreground hover:text-brand-600 transition-colors group ml-1 sm:ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      onClick={() => handleBookmark(post.id)}
                      title={post.bookmarked_by_me ? "Unsave" : "Save"}
                      aria-label={
                        post.bookmarked_by_me ? "Unsave post" : "Save post"
                      }
                    >
                      <Bookmark
                        className={`h-5 w-5 group-hover:scale-110 transition-transform ${post.bookmarked_by_me ? "fill-brand-600 text-brand-600" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Comments Section */}
                  <AnimatePresence>
                    {expandedComments.has(post.id) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-border/30 overflow-hidden bg-muted/5"
                      >
                        {(comments[post.id] || []).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-start gap-2 mb-2.5"
                          >
                            <div
                              className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden cursor-pointer"
                              onClick={() =>
                                navigate(`/player-card/${c.user_id}`)
                              }
                            >
                              {c.user_avatar ? (
                                <img
                                  src={mediaUrl(c.user_avatar)}
                                  alt=""
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <span
                                className="font-bold text-xs cursor-pointer hover:text-primary"
                                onClick={() =>
                                  navigate(`/player-card/${c.user_id}`)
                                }
                              >
                                {c.user_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">
                                {timeAgo(c.created_at)}
                              </span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {c.content}
                              </p>
                            </div>
                          </div>
                        ))}
                        {commentPages[post.id]?.hasMore && (
                          <button
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline py-1 mb-1 disabled:opacity-50"
                            onClick={() => loadMoreComments(post.id)}
                            disabled={commentPages[post.id]?.loading}
                          >
                            {commentPages[post.id]?.loading ? "Loading..." : "Load more comments"}
                          </button>
                        )}
                        <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4 items-center">
                          <Input
                            placeholder="Write a comment\u2026"
                            className="h-10 sm:h-9 rounded-full text-sm bg-muted border-border/40 focus-visible:ring-brand-600/50"
                            name="comment"
                            autoComplete="off"
                            value={commentInputs[post.id] || ""}
                            onChange={(e) =>
                              setCommentInputs((prev) => ({
                                ...prev,
                                [post.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleComment(post.id)
                            }
                          />
                          <button
                            className="h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0 bg-brand-600 text-white rounded-full flex items-center justify-center hover:bg-brand-700 transition-colors"
                            onClick={() => handleComment(post.id)}
                            disabled={!commentInputs[post.id]?.trim()}
                            aria-label="Send comment"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-8">
              <button
                className="text-sm font-bold text-brand-600 hover:text-brand-700 hover:underline px-6 py-3 sm:py-2 transition-colors min-h-[44px]"
                onClick={() => {
                  loadFeed(nextCursor);
                  if (nextCursor) setSearchParams(feedTab !== "for_you" ? { tab: feedTab, cursor: nextCursor } : { cursor: nextCursor });
                }}
              >
                Load More
              </button>
            </div>
          )}

          {posts.length === 0 && (
            <div className="text-center py-20">
              <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-bold text-muted-foreground">
                {feedTab === "following"
                  ? "Follow people to see their posts"
                  : "No posts yet"}
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-2">
                {feedTab === "following"
                  ? "Discover Lobbians in the 'For You' tab!"
                  : "Be the first to share something!"}
              </p>
            </div>
          )}
        </div>{" "}
        {/* END MAIN FEED COLUMN */}
        {/* ═══ RIGHT SIDEBAR (WIDGETS) — desktop only ═══ */}
        <aside className="hidden lg:flex w-[280px] xl:w-[320px] flex-shrink-0 flex-col gap-6 sticky top-24">
          {/* Engagement Stats Widget */}
          {engagement && (
            <div className="bg-card rounded-3xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-bold text-foreground mb-6 text-sm flex items-center justify-between">
                Performance Stats
                {engScore && (
                  <Badge className="bg-brand-600 text-white border-none shadow-none uppercase text-[10px] tracking-wider hover:bg-brand-700">
                    <Zap className="h-3 w-3 mr-1" /> Level {engScore.level}
                  </Badge>
                )}
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center">
                      <Flame className="opacity-90" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-wider">
                        Streak
                      </p>
                      <p className="text-lg font-bold text-orange-900 dark:text-orange-200">
                        {engagement.current_streak}{" "}
                        {engagement.current_streak === 1 ? "Day" : "Days"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => openFollowModal("followers")}
                    className="flex-1 p-3 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 text-center hover:scale-[1.03] transition-transform"
                  >
                    <p className="text-[10px] uppercase font-bold text-brand-600 dark:text-brand-400">
                      Followers
                    </p>
                    <p className="text-lg font-bold text-brand-900 dark:text-brand-200">
                      {engagement.followers_count}
                    </p>
                  </button>
                  <button
                    onClick={() => openFollowModal("following")}
                    className="flex-1 p-3 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 text-center hover:scale-[1.03] transition-transform"
                  >
                    <p className="text-[10px] uppercase font-bold text-brand-600 dark:text-brand-400">
                      Following
                    </p>
                    <p className="text-lg font-bold text-brand-900 dark:text-brand-200">
                      {engagement.following_count}
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Daily Prompt Widget */}
          <div className="bg-brand-600 p-6 rounded-3xl text-white shadow-xl shadow-brand-600/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-brand-100/80">
                  Daily Prompt
                </p>
              </div>
              <p className="text-lg font-bold leading-tight mb-6 max-w-[240px]">
                {engagement?.daily_prompt ||
                  "What are your training goals for the upcoming season?"}
              </p>
              <button
                onClick={() => {
                  setShowComposer(true);
                  setNewContent(
                    (engagement?.daily_prompt ||
                      "What are your training goals for the upcoming season?") +
                      " ",
                  );
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full bg-white text-brand-600 py-3 rounded-full font-bold text-sm hover:bg-brand-50 transition-colors shadow-sm"
              >
                Post Answer
              </button>
            </div>
            <Trophy className="absolute -bottom-6 -right-6 h-32 w-32 text-white/10 rotate-12" />
          </div>

          {/* Suggested Follows Widget */}
          {(algoPlayers.length > 0 || suggestedFollows.length > 0) && (
            <div className="bg-card rounded-3xl p-6 border border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-foreground text-sm">
                  Suggested for you
                </h3>
                {algoPlayers.length > 0 && (
                  <span className="text-[10px] bg-brand-600/10 text-brand-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    AI Ranked
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-5">
                {(algoPlayers.length > 0 ? algoPlayers : suggestedFollows)
                  .slice(0, 5)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between"
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => navigate(`/player-card/${s.id}`)}
                      >
                        <div className="w-10 h-10 rounded-full bg-secondary/30 overflow-hidden border border-border/20 group-hover:border-brand-600 transition-colors flex items-center justify-center">
                          {s.avatar ? (
                            <img
                              src={mediaUrl(s.avatar)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-bold truncate group-hover:text-brand-600 transition-colors">
                            {s.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {s.rec_reason === "played_together"
                              ? "Played together"
                              : s.rec_reason === "mutual_friends"
                                ? "Mutual friends"
                                : s.reason === "played_together"
                                  ? "Co-Lobbian"
                                  : s.games_together
                                    ? `${s.games_together} games`
                                    : "Recommended"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleFollow(s.id)}
                        className={`text-[11px] font-bold hover:underline ${followedUsers.has(s.id) ? "text-muted-foreground" : "text-brand-600"}`}
                      >
                        {followedUsers.has(s.id) ? "Following" : "Follow"}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ═══ STORY VIEWER (Full screen overlay) ═══ */}
      <AnimatePresence>
        {storyViewerGroupIdx !== null && storyGroups.length > 0 && (
          <StoryViewer
            storyGroups={storyGroups}
            initialGroupIndex={storyViewerGroupIdx}
            onClose={() => setStoryViewerGroupIdx(null)}
            onStoriesChanged={loadStories}
          />
        )}
      </AnimatePresence>

      {/* ═══ CREATE STORY MODAL ═══ */}
      <AnimatePresence>
        {showStoryCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowStoryCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview */}
              <div
                className={`aspect-[9/16] rounded-2xl flex flex-col items-center justify-center p-6 bg-gradient-to-br ${storyColor} mb-4 relative`}
              >
                <button
                  onClick={() => setShowStoryCreate(false)}
                  className="absolute top-3 right-3 text-white/80 hover:text-white"
                >
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
                      <button
                        key={c}
                        onClick={() => setStoryColor(c)}
                        className={`h-6 w-6 rounded-full bg-gradient-to-br ${c} ${storyColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : ""}`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full font-bold"
                    onClick={handleCreateStory}
                    disabled={!storyText.trim()}
                  >
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTrending(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-lg bg-card border-t-2 sm:border-2 border-border rounded-t-2xl sm:rounded-2xl p-6 max-h-[70vh] landscape:max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-bold text-lg">
                    Trending Now
                  </h2>
                </div>
                <button
                  onClick={() => setShowTrending(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {trendingPosts.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No trending posts yet. Be the first!
                </p>
              ) : (
                <div className="space-y-3">
                  {trendingPosts.map((post, idx) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30"
                    >
                      <div className="font-display font-black text-lg text-primary w-6 text-center">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold truncate">
                            {post.user_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(post.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {post.content}
                        </p>
                        <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>{post.likes_count} likes</span>
                          <span>{post.comments_count} comments</span>
                          <span>
                            {totalReactions(post.reactions)} reactions
                          </span>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setFollowModal(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[70vh] landscape:max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h2 className="font-display font-bold text-lg capitalize">
                  {followModal.type}
                </h2>
                <button
                  onClick={() => setFollowModal(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
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
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {followModal.type === "followers"
                        ? "No followers yet"
                        : "Not following anyone yet"}
                    </p>
                  </div>
                ) : (
                  followModal.list.map((u) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer overflow-hidden"
                        onClick={() => {
                          setFollowModal(null);
                          navigate(`/player-card/${u.id}`);
                        }}
                      >
                        {u.avatar ? (
                          <img
                            src={mediaUrl(u.avatar)}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setFollowModal(null);
                          navigate(`/player-card/${u.id}`);
                        }}
                      >
                        <div className="font-bold text-sm truncate">
                          {u.name || u.username}
                        </div>
                        {u.sport && (
                          <div className="text-[10px] text-muted-foreground capitalize">
                            {u.sport}
                          </div>
                        )}
                      </div>
                      {u.id !== user?.id && (
                        <Button
                          variant={
                            u.is_following || followedUsers.has(u.id)
                              ? "outline"
                              : "athletic"
                          }
                          size="sm"
                          className="h-8 text-[11px] min-w-[90px]"
                          onClick={() => handleFollow(u.id)}
                        >
                          {u.is_following || followedUsers.has(u.id)
                            ? "Following"
                            : "Follow"}
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

      {/* ═══ DISCOVER USERS PANEL ═══ */}
      <AnimatePresence>
        {showDiscover && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4"
            onClick={() => setShowDiscover(false)}
          >
            <motion.div
              ref={discoverRef}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-border/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <input
                    autoFocus
                    value={discoverQuery}
                    onChange={(e) => handleDiscoverSearch(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full h-10 pl-9 pr-3 bg-secondary/30 border border-border/30 rounded-xl text-sm placeholder:text-muted-foreground/40 outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10 transition-all"
                  />
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                {discoverLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                  </div>
                ) : discoverResults.length > 0 ? (
                  discoverResults.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                      <div
                        className="h-10 w-10 rounded-full bg-secondary/40 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
                        onClick={() => { setShowDiscover(false); navigate(`/player-card/${u.id}`); }}
                      >
                        {u.avatar ? (
                          <img src={mediaUrl(u.avatar)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => { setShowDiscover(false); navigate(`/player-card/${u.id}`); }}
                      >
                        <p className="text-sm font-semibold truncate">{u.name}</p>
                        {u.sport && <p className="text-[11px] text-muted-foreground capitalize">{u.sport}</p>}
                      </div>
                      <button
                        onClick={() => handleFollow(u.id)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                          followedUsers.has(u.id) || u.is_following
                            ? "bg-secondary/40 text-muted-foreground"
                            : "bg-brand-600 text-white hover:bg-brand-500"
                        }`}
                      >
                        {followedUsers.has(u.id) || u.is_following ? "Following" : "Follow"}
                      </button>
                    </div>
                  ))
                ) : discoverQuery.length >= 2 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground/60">
                    No users found
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground/40">
                    Type a name to search...
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ SHARE TO DM MODAL ═══ */}
      <AnimatePresence>
        {sharePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            onClick={() => {
              setSharePost(null);
              setShareSearch("");
              setShareResults([]);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card rounded-t-2xl border-t border-border p-4 pb-8 max-h-[70vh] landscape:max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />

              {/* Header + post preview */}
              <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                <Send className="h-4 w-4" /> Send to
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3 truncate">
                {sharePost.user_name}:{" "}
                {sharePost.content?.slice(0, 80) || "📷 Photo"}
              </p>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={shareSearch}
                  onChange={(e) => handleShareSearch(e.target.value)}
                  placeholder="Search people..."
                  className="pl-9 bg-secondary/30 border-border/50 rounded-xl"
                  autoFocus
                />
              </div>

              {/* User list */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {(shareSearch.length >= 2 ? shareResults : shareFollowing)
                  .length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {shareSearch.length >= 2
                      ? "No users found"
                      : "Follow people to share posts with them"}
                  </p>
                ) : (
                  (shareSearch.length >= 2 ? shareResults : shareFollowing).map(
                    (u2) => (
                      <button
                        key={u2.id}
                        onClick={() => handleSendPost(u2)}
                        disabled={shareSending === u2.id}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {u2.avatar ? (
                            <img
                              src={mediaUrl(u2.avatar)}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold truncate block">
                            {u2.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {u2.role === "player" ? "lobbian" : u2.role}
                          </span>
                        </div>
                        {shareSending === u2.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <Send className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ),
                  )
                )}
              </div>

              {/* Copy link fallback */}
              <button
                onClick={() => {
                  handleShare(sharePost);
                  setSharePost(null);
                }}
                className="mt-3 w-full py-2.5 rounded-xl bg-secondary/30 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="h-4 w-4" /> Copy Link
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
