import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { socialAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, User, Heart, MessageCircle, MapPin, Users, TrendingUp,
  Loader2, X, UserPlus, Bookmark, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "all",    label: "All",    icon: Sparkles },
  { id: "users",  label: "People", icon: Users },
  { id: "posts",  label: "Posts",  icon: TrendingUp },
  { id: "venues", label: "Venues", icon: MapPin },
];

function EmptyState({ query }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="h-20 w-20 rounded-3xl bg-secondary/30 flex items-center justify-center mb-5">
        <Search className="h-9 w-9 text-muted-foreground" />
      </div>
      <h3 className="admin-heading mb-1">
        {query ? "No results found" : "Discover Players & Content"}
      </h3>
      <p className="admin-label text-sm">
        {query ? "Try a different search term" : "Search for players, posts, or venues"}
      </p>
    </motion.div>
  );
}

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
    } catch {
      toast.error("Search failed");
    }
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
        users: prev.users.map((u) =>
          u.id === userId ? { ...u, is_following: res.data.following } : u
        ),
      }));
    } catch {
      toast.error("Failed");
    }
  };

  const handleLike = async (postId) => {
    setResults((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) }
          : p
      ),
    }));
    try {
      await socialAPI.toggleLike(postId);
    } catch {
      setResults((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p.id === postId
            ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) }
            : p
        ),
      }));
    }
  };

  const handleBookmark = async (postId) => {
    setResults((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p
      ),
    }));
    try {
      await socialAPI.toggleBookmark(postId);
    } catch {
      setResults((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p.id === postId ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p
        ),
      }));
    }
  };

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const hasResults =
    results.users?.length > 0 ||
    results.posts?.length > 0 ||
    results.venues?.length > 0;

  return (
    <div className="mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Sticky header */}
      <div className="sticky top-14 z-20 bg-background pb-4">
        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players, posts, venues…"
            className="pl-10 pr-10 h-11 bg-secondary/20 border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-brand-600/20"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(""); doSearch(""); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Find Friends banner */}
        <button
          onClick={() => navigate("/contacts")}
          className="w-full mb-4 p-3 rounded-[20px] bg-brand-600/5 border border-brand-600/15 hover:bg-brand-600/10 transition-colors flex items-center gap-3"
        >
          <div className="h-9 w-9 rounded-2xl bg-brand-600/10 border border-brand-600/15 flex items-center justify-center flex-shrink-0">
            <UserPlus className="h-4 w-4 text-brand-600" />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-foreground">Find Friends from Contacts</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Sync your phone contacts to find friends</div>
          </div>
        </button>

        {/* Tab navigation — underline style */}
        <div className="flex items-center gap-0 border-b border-border/40 overflow-x-auto hide-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium tracking-wide transition-colors whitespace-nowrap ${
                  active ? "text-brand-600" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-brand-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-6 pt-4"
          >
            {/* ---- People ---- */}
            {(activeTab === "all" || activeTab === "users") && results.users?.length > 0 && (
              <section>
                {activeTab === "all" && (
                  <p className="admin-section-label mb-3 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> People
                  </p>
                )}
                <div className="space-y-2">
                  {results.users.map((u, i) => (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 p-4 rounded-[28px] border border-border/40 bg-card hover:bg-white/5 transition-colors"
                    >
                      {/* Avatar */}
                      <div
                        className="h-12 w-12 rounded-2xl bg-brand-600/10 border border-border/40 flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
                        onClick={() => navigate(`/player-card/${u.id}`)}
                      >
                        {u.avatar
                          ? <img src={mediaUrl(u.avatar)} alt="" className="h-12 w-12 object-cover" />
                          : <User className="h-5 w-5 text-brand-600" />
                        }
                      </div>

                      {/* Info */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/player-card/${u.id}`)}
                      >
                        <div className="font-semibold text-sm truncate text-foreground">{u.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="admin-label text-[10px]">{u.followers_count || 0} followers</span>
                          <span className="admin-label text-[10px]">·</span>
                          <span className="admin-label text-[10px]">{u.post_count || 0} posts</span>
                          {u.sport && (
                            <span className="px-2 py-0.5 rounded-full bg-brand-600/10 text-brand-600 text-[10px] font-medium border border-brand-600/15">
                              {u.sport}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Follow button */}
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleFollow(u.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl admin-btn text-[11px] font-medium transition-all active:scale-[0.97] ${
                            u.is_following
                              ? "bg-secondary/60 border border-border/40 text-muted-foreground hover:text-foreground"
                              : "bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/20"
                          }`}
                        >
                          {u.is_following ? (
                            "Following"
                          ) : (
                            <><UserPlus className="h-3 w-3" /> Follow</>
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ---- Posts ---- */}
            {(activeTab === "all" || activeTab === "posts") && results.posts?.length > 0 && (
              <section>
                {activeTab === "all" && (
                  <p className="admin-section-label mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {query ? "Posts" : "Popular Posts"}
                  </p>
                )}
                <div className="space-y-3">
                  {results.posts.map((post, i) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-5 rounded-[28px] border border-border/40 bg-card"
                    >
                      {/* Post header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="h-9 w-9 rounded-2xl bg-brand-600/10 border border-border/40 flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
                          onClick={() => navigate(`/player-card/${post.user_id}`)}
                        >
                          {post.user_avatar
                            ? <img src={mediaUrl(post.user_avatar)} alt="" className="h-9 w-9 object-cover" />
                            : <User className="h-4 w-4 text-brand-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <span
                            className="font-semibold text-xs cursor-pointer hover:text-brand-600 transition-colors"
                            onClick={() => navigate(`/player-card/${post.user_id}`)}
                          >
                            {post.user_name}
                          </span>
                          <span className="admin-label text-[10px] ml-2">{timeAgo(post.created_at)}</span>
                        </div>
                      </div>

                      {/* Content */}
                      {post.content && (
                        <p className="text-sm text-foreground mb-3 line-clamp-3 leading-relaxed">
                          {post.content}
                        </p>
                      )}
                      {post.media_url && (
                        <img
                          src={mediaUrl(post.media_url)}
                          alt=""
                          className="rounded-2xl w-full max-h-64 object-cover mb-3"
                        />
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-3 border-t border-border/20">
                        <button
                          onClick={() => handleLike(post.id)}
                          className="flex items-center gap-1.5 text-xs transition-colors"
                        >
                          <Heart
                            className={`h-3.5 w-3.5 transition-colors ${
                              post.liked_by_me ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-400"
                            }`}
                          />
                          <span className="text-muted-foreground">{post.likes_count || 0}</span>
                        </button>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {post.comments_count || 0}
                        </span>
                        <div className="flex-1" />
                        <button onClick={() => handleBookmark(post.id)} className="transition-colors">
                          <Bookmark
                            className={`h-3.5 w-3.5 transition-colors ${
                              post.bookmarked_by_me ? "fill-brand-600 text-brand-600" : "text-muted-foreground hover:text-brand-600"
                            }`}
                          />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ---- Venues ---- */}
            {(activeTab === "all" || activeTab === "venues") && results.venues?.length > 0 && (
              <section>
                {activeTab === "all" && (
                  <p className="admin-section-label mb-3 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Venues
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {results.venues.map((v, i) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-[28px] border border-border/40 bg-card overflow-hidden cursor-pointer hover:bg-white/5 hover:shadow-md transition-all duration-200"
                      onClick={() => navigate(`/venues/${v.id}`)}
                    >
                      {v.image_url && (
                        <img src={mediaUrl(v.image_url)} alt={v.name} className="w-full h-28 object-cover" />
                      )}
                      <div className="p-3">
                        <div className="font-semibold text-xs truncate text-foreground mb-1">{v.name}</div>
                        <div className="flex items-center justify-between gap-1">
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {v.area || v.city || ""}
                          </div>
                          <span
                            className={`text-[8px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              v.badge === "bookable"
                                ? "bg-brand-600/10 text-brand-600 border border-brand-600/20"
                                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}
                          >
                            {v.badge === "bookable" ? "Bookable" : "Enquiry"}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {!loading && !hasResults && <EmptyState query={query} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
