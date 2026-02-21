import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { socialAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, User, Heart, MessageCircle, MapPin, Users, TrendingUp,
  Loader2, X, UserPlus, Bookmark, Share2
} from "lucide-react";
import { toast } from "sonner";

export default function ExplorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [], venues: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const searchTimeout = useRef(null);

  const doSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await socialAPI.explore(q, "all", 1);
      setResults(res.data || { users: [], posts: [], venues: [] });
    } catch { toast.error("Search failed"); }
    setLoading(false);
  }, []);

  useEffect(() => { doSearch(""); }, [doSearch]);

  const handleSearchChange = (value) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(value), 400);
  };

  const handleFollow = async (userId) => {
    try {
      const res = await socialAPI.toggleFollow(userId);
      setResults((prev) => ({
        ...prev,
        users: prev.users.map((u) => u.id === userId ? { ...u, is_following: res.data.following } : u),
      }));
    } catch { toast.error("Failed"); }
  };

  const handleLike = async (postId) => {
    setResults((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => p.id === postId
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) } : p),
    }));
    try { await socialAPI.toggleLike(postId); }
    catch { setResults((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => p.id === postId
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) } : p),
    })); }
  };

  const handleBookmark = async (postId) => {
    setResults((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p),
    }));
    try { await socialAPI.toggleBookmark(postId); }
    catch { setResults((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p),
    })); }
  };

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const tabs = [
    { id: "all", label: "All" },
    { id: "users", label: "People" },
    { id: "posts", label: "Posts" },
    { id: "venues", label: "Venues" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Search Header */}
      <div className="sticky top-14 md:top-14 z-20 bg-background pb-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search people, posts, venues..."
            className="pl-10 pr-10 h-11 bg-secondary/50 border-border/50 rounded-xl text-sm"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
          {query && (
            <button onClick={() => { setQuery(""); doSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Find Friends Banner */}
        <button onClick={() => navigate("/contacts")}
          className="w-full mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold">Find Friends from Contacts</div>
            <div className="text-[10px] text-muted-foreground">Sync your phone contacts to find friends</div>
          </div>
        </button>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/30 rounded-lg p-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* People Section */}
          {(activeTab === "all" || activeTab === "users") && results.users?.length > 0 && (
            <div>
              {activeTab === "all" && (
                <h3 className="font-display font-bold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" /> People
                </h3>
              )}
              <div className="space-y-2">
                {results.users.map((u) => (
                  <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-border/50 bg-card hover:border-border transition-colors">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer overflow-hidden"
                      onClick={() => navigate(`/player-card/${u.id}`)}>
                      {u.avatar ? <img src={u.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                        : <User className="h-6 w-6 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/player-card/${u.id}`)}>
                      <div className="font-bold text-sm truncate">{u.name}</div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{u.followers_count || 0} followers</span>
                        <span>{u.post_count || 0} posts</span>
                        {u.sport && <Badge variant="outline" className="text-[9px] h-4">{u.sport}</Badge>}
                      </div>
                    </div>
                    {u.id !== user?.id && (
                      <Button
                        variant={u.is_following ? "outline" : "athletic"}
                        size="sm" className="h-8 text-[11px] min-w-[90px]"
                        onClick={() => handleFollow(u.id)}>
                        {u.is_following ? "Following" : <><UserPlus className="h-3 w-3 mr-1" /> Follow</>}
                      </Button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Posts Section */}
          {(activeTab === "all" || activeTab === "posts") && results.posts?.length > 0 && (
            <div>
              {activeTab === "all" && (
                <h3 className="font-display font-bold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> {query ? "Posts" : "Popular Posts"}
                </h3>
              )}
              <div className="space-y-3">
                {results.posts.map((post) => (
                  <motion.div key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl border border-border/50 bg-card">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer overflow-hidden"
                        onClick={() => navigate(`/player-card/${post.user_id}`)}>
                        {post.user_avatar ? <img src={post.user_avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                          : <User className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-xs cursor-pointer hover:text-primary" onClick={() => navigate(`/player-card/${post.user_id}`)}>
                          {post.user_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-2">{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                    {post.content && <p className="text-sm mb-2 line-clamp-3">{post.content}</p>}
                    {post.media_url && <img src={post.media_url} alt="" className="rounded-xl w-full max-h-64 object-cover mb-2" />}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                      <button onClick={() => handleLike(post.id)} className="flex items-center gap-1 text-xs">
                        <Heart className={`h-3.5 w-3.5 ${post.liked_by_me ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                        <span className="text-muted-foreground">{post.likes_count || 0}</span>
                      </button>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5" /> {post.comments_count || 0}
                      </span>
                      <div className="flex-1" />
                      <button onClick={() => handleBookmark(post.id)}>
                        <Bookmark className={`h-3.5 w-3.5 ${post.bookmarked_by_me ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Venues Section */}
          {(activeTab === "all" || activeTab === "venues") && results.venues?.length > 0 && (
            <div>
              {activeTab === "all" && (
                <h3 className="font-display font-bold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Venues
                </h3>
              )}
              <div className="grid grid-cols-2 gap-3">
                {results.venues.map((v) => (
                  <motion.div key={v.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-border transition-colors"
                    onClick={() => navigate(`/venues/${v.id}`)}>
                    {v.image_url && <img src={v.image_url} alt={v.name} className="w-full h-28 object-cover" />}
                    <div className="p-3">
                      <div className="font-bold text-xs truncate">{v.name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {v.area || v.city || ""}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!results.users?.length && !results.posts?.length && !results.venues?.length && (
            <div className="text-center py-20">
              <Search className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-display text-xl font-bold text-muted-foreground">
                {query ? "No results found" : "Discover players & content"}
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-2">
                {query ? "Try a different search term" : "Search for players, posts, or venues"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
