import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { socialAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Bookmark, Heart, MessageCircle, User, Loader2, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";

export default function BookmarksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await socialAPI.getBookmarks(page);
      setPosts(res.data?.posts || []);
    } catch { toast.error("Failed to load saved posts"); }
    setLoading(false);
  }, [page]);

  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  const handleUnsave = async (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try { await socialAPI.toggleBookmark(postId); }
    catch { loadBookmarks(); }
  };

  const handleLike = async (postId) => {
    setPosts((prev) => prev.map((p) => p.id === postId
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) } : p));
    try { await socialAPI.toggleLike(postId); }
    catch { setPosts((prev) => prev.map((p) => p.id === postId
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) } : p)); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display font-black text-xl">Saved Posts</h1>
          <p className="text-xs text-muted-foreground">{posts.length} saved</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-display text-xl font-bold text-muted-foreground">No saved posts</h3>
          <p className="text-sm text-muted-foreground/70 mt-2">Tap the bookmark icon on posts to save them here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, idx) => (
            <motion.div key={post.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
              className="p-4 rounded-[24px] border border-border/40 bg-card shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/player-card/${post.user_id}`)}>
                  {post.user_avatar ? <img src={mediaUrl(post.user_avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                    : <User className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm cursor-pointer hover:text-primary" onClick={() => navigate(`/player-card/${post.user_id}`)}>
                    {post.user_name}
                  </span>
                  <div className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</div>
                </div>
                <button onClick={() => handleUnsave(post.id)}
                  className="p-2 rounded-lg hover:bg-secondary/50 transition-colors" title="Unsave">
                  <Bookmark className="h-4 w-4 fill-primary text-primary" />
                </button>
              </div>
              {post.content && <p className="text-sm leading-relaxed mb-3">{post.content}</p>}
              {post.media_url && <img src={mediaUrl(post.media_url)} alt="" className="rounded-xl w-full max-h-80 object-cover mb-3" />}
              <div className="flex items-center gap-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                <button onClick={() => handleLike(post.id)} className="flex items-center gap-1">
                  <Heart className={`h-3.5 w-3.5 ${post.liked_by_me ? "fill-red-500 text-red-500" : ""}`} />
                  {post.likes_count || 0}
                </button>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> {post.comments_count || 0}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
