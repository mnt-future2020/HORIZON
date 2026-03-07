import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, User } from "lucide-react";
import { socialAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

/* ── Memoized row — prevents re-render of all rows on new page load (rule 5.5) ── */
const FollowUserRow = memo(function FollowUserRow({ user, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate(user.id)}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 active:bg-secondary/50 transition-colors touch-manipulation text-left"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
    >
      <Avatar className="h-11 w-11 flex-shrink-0">
        {user.avatar ? (
          <AvatarImage src={mediaUrl(user.avatar)} alt={user.name} />
        ) : null}
        <AvatarFallback>
          <User className="h-4 w-4 text-muted-foreground/40" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-foreground truncate">
          {user.name}
        </p>
        <p className="text-[11px] text-muted-foreground/60 capitalize">
          {user.role === "coach" ? "Coach" : "Athlete"}
          {user.skill_rating ? ` · ${user.skill_rating} SR` : ""}
        </p>
      </div>
    </button>
  );
});

/* ── Sentinel element for infinite scroll via IntersectionObserver ── */
function ScrollSentinel({ onIntersect, loading }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) onIntersect();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, loading]);

  return (
    <div ref={ref} className="flex items-center justify-center py-4">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
      ) : null}
    </div>
  );
}

export default function FollowListModal({ isOpen, onClose, userId, type }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /* Stable navigate callback — no deps needed (rule 5.9) */
  const handleNavigate = useCallback(
    (id) => {
      onClose();
      navigate(`/player-card/${id}`);
    },
    [onClose, navigate],
  );

  /* Fetch page — uses refs for cursor to avoid stale closures (rule 5.9, 5.12) */
  const fetchPage = useCallback(
    async (isLoadMore) => {
      if (!userId) return;
      const setter = isLoadMore ? setLoadingMore : setLoading;
      setter(true);
      try {
        const fn =
          type === "followers"
            ? socialAPI.getFollowers
            : socialAPI.getFollowing;
        const afterCursor = isLoadMore ? cursorRef.current : undefined;
        const res = await fn(userId, afterCursor);
        const data = res.data;
        const newUsers = data.users || [];

        if (isLoadMore) {
          setUsers((prev) => [...prev, ...newUsers]);
        } else {
          setUsers(newUsers);
        }
        cursorRef.current = data.next_cursor || null;
        setHasMore(!!data.has_more);
      } catch {
        if (!isLoadMore) setUsers([]);
      }
      setter(false);
    },
    [userId, type],
  );

  /* Load first page when modal opens */
  useEffect(() => {
    if (isOpen && userId) {
      setUsers([]);
      cursorRef.current = null;
      setHasMore(false);
      fetchPage(false);
    }
  }, [isOpen, userId, type, fetchPage]);

  /* Stable callback for sentinel (rule 5.9 — functional setState avoids deps) */
  const loadMore = useCallback(() => {
    if (!loadingMore) fetchPage(true);
  }, [fetchPage, loadingMore]);

  if (!isOpen) return null;

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <AnimatePresence>
      <motion.div
        key="follow-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          key="follow-panel"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-full sm:max-w-sm bg-card border border-border/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[75vh] flex flex-col"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-border/60" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
            <h2 className="text-sm font-bold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-secondary/50 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 px-4">
                <User className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {type === "followers"
                    ? "No followers yet"
                    : "Not following anyone yet"}
                </p>
              </div>
            ) : (
              <>
                {users.map((u) => (
                  <FollowUserRow
                    key={u.id}
                    user={u}
                    onNavigate={handleNavigate}
                  />
                ))}

                {/* Infinite scroll sentinel — auto-loads next page when visible */}
                {hasMore ? (
                  <ScrollSentinel
                    onIntersect={loadMore}
                    loading={loadingMore}
                  />
                ) : null}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
