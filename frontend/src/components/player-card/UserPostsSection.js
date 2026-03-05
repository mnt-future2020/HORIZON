import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, MessageCircle, Heart, Camera, MoreVertical, Trash2,
  X, Send, User, MessageSquare, Bookmark,
} from "lucide-react";
import { mediaUrl } from "@/lib/utils";
import { socialAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const timeAgo = (d) => {
  if (!d) return "";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

export default function UserPostsSection({ posts, loading, postCount, card, isOwnProfile, onDeletePost }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Modal state
  const [activePost, setActivePost] = useState(null);
  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentPages, setCommentPages] = useState({});
  const [doubleTapHeart, setDoubleTapHeart] = useState(null);
  const lastTap = useRef({});

  // Close modal on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && activePost) setActivePost(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activePost]);

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
    } catch { /* silent */ }
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
      if (activePost?.id === postId)
        setActivePost((p) => ({ ...p, comments_count: (p.comments_count || 0) + 1 }));
    } catch {
      toast.error("Failed to comment");
    }
  };

  const handleLike = async (postId) => {
    setActivePost((p) => {
      if (!p || p.id !== postId) return p;
      return {
        ...p,
        liked_by_me: !p.liked_by_me,
        likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1),
      };
    });
    try {
      await socialAPI.toggleLike(postId);
    } catch {
      setActivePost((p) => {
        if (!p || p.id !== postId) return p;
        return {
          ...p,
          liked_by_me: !p.liked_by_me,
          likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1),
        };
      });
    }
  };

  const handleDoubleTap = (postId) => {
    const now = Date.now();
    if (lastTap.current[postId] && now - lastTap.current[postId] < 400) {
      if (!activePost?.liked_by_me) handleLike(postId);
      setDoubleTapHeart(postId);
      setTimeout(() => setDoubleTapHeart(null), 800);
      lastTap.current[postId] = 0;
    } else {
      lastTap.current[postId] = now;
    }
  };

  const handleBookmark = async (postId) => {
    const wasSaved = activePost?.bookmarked_by_me;
    try {
      await socialAPI.toggleBookmark(postId);
      setActivePost((p) => {
        if (!p || p.id !== postId) return p;
        return { ...p, bookmarked_by_me: !p.bookmarked_by_me };
      });
      toast.success(wasSaved ? "Removed from saved" : "Saved!");
    } catch {
      toast.error("Failed to save");
    }
  };

  const openPostDetail = async (post) => {
    try {
      const res = await socialAPI.getPost(post.id);
      setActivePost(res.data);
      loadComments(post.id);
    } catch {
      setActivePost(post);
      loadComments(post.id);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          Loading Posts
        </span>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-24 px-6">
        <div className="h-16 w-16 mx-auto rounded-full bg-secondary/40 border border-border/10 flex items-center justify-center mb-4">
          <Camera className="h-7 w-7 text-muted-foreground/25" />
        </div>
        <p className="font-bold text-sm text-muted-foreground/60 mb-1">
          No Posts Yet
        </p>
        <p className="text-xs text-muted-foreground/40">
          Share your first training moment
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-[1px] sm:gap-0.5">
        {posts.map((post, idx) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.04, duration: 0.3 }}
            className="relative aspect-square bg-secondary/30 overflow-hidden cursor-pointer group"
            onClick={() => openPostDetail(post)}
          >
            {post.media_url ? (
              <img
                src={mediaUrl(post.media_url)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-brand-500/5 group-hover:bg-brand-500/10 transition-colors">
                <p className="text-[10px] font-medium text-foreground/60 text-center line-clamp-4 leading-relaxed">
                  {post.content}
                </p>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-5 z-10">
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <Heart className="h-4 w-4 fill-white" />
                <span className="tabular-nums">{post.likes_count || 0}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <MessageCircle className="h-4 w-4 fill-white" />
                <span className="tabular-nums">{post.comments_count || 0}</span>
              </div>
            </div>

            {/* Caption indicator */}
            {post.content && post.media_url && !isOwnProfile && (
              <div className="absolute top-2 right-2 z-20 opacity-60 group-hover:opacity-0 transition-opacity">
                <div className="bg-black/30 backdrop-blur-sm p-1 rounded">
                  <MessageCircle className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
            )}

            {/* Three-dot menu for own posts */}
            {isOwnProfile && (
              <div className="absolute top-1.5 right-1.5 z-30">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === post.id ? null : post.id); }}
                  className="bg-black/60 backdrop-blur-md p-1.5 rounded-full hover:bg-black/80 transition-colors shadow-md"
                >
                  <MoreVertical className="h-4 w-4 text-white" />
                </button>
                <AnimatePresence>
                  {menuOpen === post.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute right-0 mt-1 bg-card border border-border/40 rounded-xl shadow-lg overflow-hidden min-w-[140px]"
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(null); setDeleteTarget(post.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Post
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This post will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onDeletePost?.(deleteTarget); setDeleteTarget(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════ POST DETAIL MODAL ═════════════════════ */}
      <AnimatePresence>
        {activePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-md sm:p-4"
            onClick={() => setActivePost(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="bg-card w-full sm:max-w-[420px] max-h-[85vh] sm:rounded-2xl rounded-t-2xl overflow-hidden border border-border/30 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 rounded-full bg-secondary/30 flex items-center justify-center cursor-pointer overflow-hidden border border-border/20"
                    onClick={() => { setActivePost(null); navigate(`/player-card/${activePost.user_id || card?.user_id}`); }}
                  >
                    {(activePost.user_avatar || card?.avatar_url) ? (
                      <img src={mediaUrl(activePost.user_avatar || card?.avatar_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <span
                      className="font-display font-bold text-xs cursor-pointer hover:text-brand-600 transition-colors block leading-tight"
                      onClick={() => { setActivePost(null); navigate(`/player-card/${activePost.user_id || card?.user_id}`); }}
                    >
                      {activePost.user_name || card?.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{timeAgo(activePost.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isOwnProfile && (
                    <button
                      onClick={() => { setActivePost(null); setDeleteTarget(activePost.id); }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setActivePost(null)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-secondary/50 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Fixed: Post content + actions */}
              <div className="flex-shrink-0">
                {activePost.content && (
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 line-clamp-4">
                      {activePost.content}
                    </p>
                  </div>
                )}

                {activePost.media_url && (
                  <div
                    className="relative mx-4 mt-2 rounded-xl overflow-hidden bg-black/5 cursor-pointer"
                    onClick={() => handleDoubleTap(activePost.id)}
                  >
                    <img
                      src={mediaUrl(activePost.media_url)}
                      alt=""
                      className="w-full h-52 object-cover block"
                      draggable={false}
                    />
                    <AnimatePresence>
                      {doubleTapHeart === activePost.id && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 1.5, opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <Heart className="h-14 w-14 fill-red-500 text-red-500 drop-shadow-lg" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="px-4 py-2.5 flex items-center gap-4">
                  <button
                    className="flex items-center gap-1.5 group transition-colors"
                    onClick={() => handleLike(activePost.id)}
                  >
                    <Heart
                      className={`h-[18px] w-[18px] transition-all group-hover:scale-110 ${activePost.liked_by_me ? "fill-pink-500 text-pink-500" : "text-muted-foreground group-hover:text-pink-500"}`}
                    />
                    <span className={`font-bold text-xs tabular-nums ${activePost.liked_by_me ? "text-pink-500" : "text-muted-foreground"}`}>
                      {activePost.likes_count || 0}
                    </span>
                  </button>

                  <button
                    className="text-muted-foreground hover:text-brand-600 transition-all hover:scale-110"
                    onClick={() => handleBookmark(activePost.id)}
                  >
                    <Bookmark className={`h-[18px] w-[18px] ${activePost.bookmarked_by_me ? "fill-brand-600 text-brand-600" : ""}`} />
                  </button>

                  {!isOwnProfile && (
                    <button
                      className="text-muted-foreground hover:text-brand-600 transition-all hover:scale-110"
                      onClick={() => { setActivePost(null); navigate(`/chat?user=${activePost.user_id || card?.user_id}`); }}
                      title="Message"
                    >
                      <MessageSquare className="h-[18px] w-[18px]" />
                    </button>
                  )}
                </div>

                <div className="px-4">
                  <div className="border-t border-border/20" />
                </div>
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground/70 px-4 pt-2.5 pb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Comments ({activePost.comments_count || 0})
                </h4>
              </div>

              {/* Scrollable: Comments only — capped height */}
              <div className="overflow-y-auto overscroll-contain px-4 pb-2" style={{ maxHeight: "160px" }}>
                {(comments[activePost.id] || []).length === 0 && (
                  <p className="text-[11px] text-muted-foreground/50 text-center py-3">No comments yet</p>
                )}
                {(comments[activePost.id] || []).map((c) => (
                  <div key={c.id} className="flex items-start gap-2 mb-2.5">
                    <div
                      className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden cursor-pointer"
                      onClick={() => { setActivePost(null); navigate(`/player-card/${c.user_id}`); }}
                    >
                      {c.user_avatar ? (
                        <img src={mediaUrl(c.user_avatar)} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <User className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className="font-bold text-[11px] cursor-pointer hover:text-brand-600 transition-colors"
                          onClick={() => { setActivePost(null); navigate(`/player-card/${c.user_id}`); }}
                        >
                          {c.user_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-xs text-foreground/75 mt-0.5 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
                {commentPages[activePost.id]?.hasMore && (
                  <button
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline py-1 disabled:opacity-50"
                    onClick={() => loadMoreComments(activePost.id)}
                    disabled={commentPages[activePost.id]?.loading}
                  >
                    {commentPages[activePost.id]?.loading ? "Loading..." : "Load more"}
                  </button>
                )}
              </div>

              {/* Comment Input — pinned bottom */}
              <div className="flex gap-2 px-4 py-3 border-t border-border/20 flex-shrink-0 bg-card">
                <Input
                  placeholder="Add a comment..."
                  className="h-9 rounded-full text-xs bg-muted/50 border-border/30 focus-visible:ring-brand-600/30"
                  name="comment"
                  autoComplete="off"
                  value={commentInputs[activePost.id] || ""}
                  onChange={(e) =>
                    setCommentInputs((prev) => ({ ...prev, [activePost.id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleComment(activePost.id)}
                />
                <button
                  className="h-9 w-9 flex-shrink-0 bg-brand-600 text-white rounded-full flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-40"
                  onClick={() => handleComment(activePost.id)}
                  disabled={!commentInputs[activePost.id]?.trim()}
                  aria-label="Send comment"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
