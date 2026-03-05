import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { socialAPI, chatAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Eye,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pause,
  Play,
  Send,
} from "lucide-react";
import { toast } from "sonner";

const STORY_DURATION = 8000; // 8 seconds per story

/**
 * Production-grade StoryViewer — Instagram/Facebook style
 *
 * Props:
 * - storyGroups: array of { user_id, user_name, user_avatar, has_unviewed, stories: [{ id, content, bg_color, media_url, view_count, created_at }] }
 * - initialGroupIndex: which group to start on
 * - onClose: () => void
 * - onStoriesChanged: () => void  (refresh stories after delete, etc.)
 */
export default function StoryViewer({ storyGroups, initialGroupIndex = 0, onClose, onStoriesChanged }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState(0); // -1 = left, 1 = right for slide animation
  const [replyText, setReplyText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Touch/swipe
  const [touchStart, setTouchStart] = useState(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startTimeRef = useRef(null);
  const elapsedRef = useRef(0);
  const containerRef = useRef(null);
  const replyInputRef = useRef(null);
  const goNextRef = useRef(null);

  const currentGroup = storyGroups[groupIdx];
  const currentStory = currentGroup?.stories?.[storyIdx];
  const isOwnStory = currentGroup?.user_id === user?.id;

  /* ─── Auto-advance timer ──────────────────────────────────── */
  const startTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    startTimeRef.current = Date.now();

    const remaining = STORY_DURATION - elapsedRef.current;

    // Progress updater — smooth 60fps
    progressRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
    }, 16);

    // Auto-advance via ref to avoid stale closure
    timerRef.current = setTimeout(() => {
      clearInterval(progressRef.current);
      elapsedRef.current = 0;
      goNextRef.current?.();
    }, remaining);
  }, []);

  const pauseTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    elapsedRef.current += Date.now() - (startTimeRef.current || Date.now());
  }, []);

  const resetAndStart = useCallback(() => {
    elapsedRef.current = 0;
    setProgress(0);
    startTimer();
  }, [startTimer]);

  /* ─── Navigation ─────────────────────────────────────────── */
  const goNext = useCallback(() => {
    const group = storyGroups[groupIdx];
    if (!group) { onClose(); return; }

    if (storyIdx + 1 < group.stories.length) {
      // Next story in same group
      setDirection(1);
      setStoryIdx((i) => i + 1);
      elapsedRef.current = 0;
    } else if (groupIdx + 1 < storyGroups.length) {
      // Next group
      setDirection(1);
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
      elapsedRef.current = 0;
    } else {
      // End — close
      onClose();
    }
  }, [groupIdx, storyIdx, storyGroups, onClose]);

  // Keep ref in sync so timer callback always calls latest goNext
  goNextRef.current = goNext;

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setDirection(-1);
      setStoryIdx((i) => i - 1);
      elapsedRef.current = 0;
    } else if (groupIdx > 0) {
      const prevGroup = storyGroups[groupIdx - 1];
      if (!prevGroup?.stories?.length) return;
      setDirection(-1);
      setGroupIdx((g) => g - 1);
      setStoryIdx(prevGroup.stories.length - 1);
      elapsedRef.current = 0;
    }
  }, [groupIdx, storyIdx, storyGroups]);

  // Go to a specific group (from the preview strip)
  const goToGroup = useCallback((idx) => {
    setDirection(idx > groupIdx ? 1 : -1);
    setGroupIdx(idx);
    setStoryIdx(0);
    elapsedRef.current = 0;
  }, [groupIdx]);

  /* ─── Lock body scroll while open ────────────────────────── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ─── Mark story viewed ────────────────────────────────── */
  useEffect(() => {
    if (currentStory?.id) {
      socialAPI.viewStory(currentStory.id).catch(() => {});
    }
  }, [currentStory?.id]);

  /* ─── Start/restart timer on story change ────────────────── */
  useEffect(() => {
    if (!paused && !isSwiping) {
      resetAndStart();
    }
    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, [groupIdx, storyIdx, paused, isSwiping]);

  /* ─── Keyboard controls ──────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowUp":
          e.preventDefault();
          if (groupIdx > 0) goToGroup(groupIdx - 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (groupIdx < storyGroups.length - 1) goToGroup(groupIdx + 1);
          break;
        case "Escape":
          onClose();
          break;
        case "p":
          setPaused((p) => !p);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, goToGroup, groupIdx, storyGroups.length, onClose]);

  /* ─── Pause/Resume ───────────────────────────────────────── */
  useEffect(() => {
    if (paused) {
      pauseTimer();
    } else if (!isSwiping) {
      startTimer();
    }
  }, [paused]);

  /* ─── Touch handlers (swipe up=close, left/right=navigate, hold=pause) ── */
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
    setTouchDelta(0);
    isLongPress.current = false;

    // Long press to pause
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setPaused(true);
    }, 200);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;
    clearTimeout(longPressTimer.current);
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      setIsSwiping(true);
      pauseTimer();
    }
    setTouchDelta(dx);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);

    if (isLongPress.current) {
      setPaused(false);
      isLongPress.current = false;
      setTouchStart(null);
      setTouchDelta(0);
      setIsSwiping(false);
      return;
    }

    if (isSwiping && touchStart) {
      if (touchDelta < -60) {
        goNext();
      } else if (touchDelta > 60) {
        goPrev();
      }
    }

    setTouchStart(null);
    setTouchDelta(0);
    setIsSwiping(false);
  };

  /* ─── Tap zones (desktop) ────────────────────────────────── */
  const handleTapZone = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("[data-ignore-tap]")) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) {
      goPrev();
    } else {
      goNext();
    }
  };

  /* ─── Reply (sends as DM with story preview, like Instagram) ── */
  const handleReply = async () => {
    if (!replyText.trim() || isOwnStory) return;
    const text = replyText.trim();
    setReplyText("");
    try {
      const convo = await chatAPI.startConversation(currentGroup.user_id);
      const convoId = convo.data?.id || convo.data?.conversation?.id;
      await chatAPI.sendMessage(convoId, {
        content: text,
        shared_post: {
          id: currentStory.id,
          user_name: currentGroup.user_name,
          user_avatar: currentGroup.user_avatar,
          content: currentStory.content || "",
          media_url: currentStory.media_url || "",
          bg_color: currentStory.bg_color || "",
          type: "story",
        },
      });
      toast.success("Reply sent!");
    } catch {
      toast.error("Failed to send reply");
    }
  };

  /* ─── Delete ─────────────────────────────────────────────── */
  const promptDelete = () => {
    if (!isOwnStory || !currentStory) return;
    setPaused(true);
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setPaused(false);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await socialAPI.deleteStory(currentStory.id);
      toast.success("Story deleted");
      onStoriesChanged?.();
      if (currentGroup.stories.length <= 1) {
        if (groupIdx + 1 < storyGroups.length) {
          goNext();
        } else {
          onClose();
        }
      } else {
        goNext();
      }
    } catch {
      toast.error("Failed to delete");
    }
    setIsDeleting(false);
    setPaused(false);
  };

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (!currentGroup || !currentStory) return null;

  const STORY_COLORS = [
    "from-green-500 to-brand-600",
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
    "from-rose-500 to-pink-600",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center select-none"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ─── Desktop: Previous group nav ─── */}
      {groupIdx > 0 && (
        <button
          onClick={() => goToGroup(groupIdx - 1)}
          className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-white/10 backdrop-blur-md items-center justify-center text-white hover:bg-white/20 transition-all"
          aria-label="Previous person"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* ─── Desktop: Next group nav ─── */}
      {groupIdx < storyGroups.length - 1 && (
        <button
          onClick={() => goToGroup(groupIdx + 1)}
          className="hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-white/10 backdrop-blur-md items-center justify-center text-white hover:bg-white/20 transition-all"
          aria-label="Next person"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* ─── Desktop: Group preview strip (only when multiple groups) ─── */}
      {storyGroups.length > 1 && (
      <div className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-30 gap-2 px-4 py-2 rounded-2xl bg-white/5 backdrop-blur-md">
        {storyGroups.map((g, i) => (
          <button
            key={g.user_id}
            onClick={() => goToGroup(i)}
            className={`relative h-10 w-10 rounded-full overflow-hidden border-2 transition-all duration-300 ${
              i === groupIdx
                ? "border-brand-500 scale-110 ring-2 ring-brand-500/30"
                : "border-white/20 opacity-50 hover:opacity-80 hover:scale-105"
            }`}
          >
            {g.user_avatar ? (
              <img src={mediaUrl(g.user_avatar)} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-white/10 flex items-center justify-center">
                <User className="h-4 w-4 text-white/60" />
              </div>
            )}
            {g.has_unviewed && i !== groupIdx && (
              <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 border-2 border-black" />
            )}
          </button>
        ))}
      </div>
      )}

      {/* ─── Main story card ─── */}
      <div
        ref={containerRef}
        className="relative w-full h-full md:w-[420px] md:h-[calc(100vh-120px)] md:max-h-[820px] md:rounded-3xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTapZone}
        style={{
          transform: isSwiping ? `translateX(${touchDelta * 0.4}px)` : "none",
          transition: isSwiping ? "none" : "transform 0.3s ease",
        }}
      >
        {/* Story Background/Content */}
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={`${groupIdx}-${storyIdx}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -60, scale: 0.96 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {currentStory.media_url ? (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <img
                  src={mediaUrl(currentStory.media_url)}
                  alt=""
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center p-8 bg-gradient-to-br ${
                  currentStory.bg_color || STORY_COLORS[0]
                }`}
              >
                <p className="text-white text-xl sm:text-2xl md:text-3xl font-bold text-center leading-relaxed drop-shadow-lg max-w-sm">
                  {currentStory.content}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none z-[1]" />

        {/* ─── Progress bars ─── */}
        <div className="absolute top-0 left-0 right-0 flex gap-[3px] px-3 pt-3 z-10">
          {currentGroup.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white"
                style={{
                  width:
                    i < storyIdx
                      ? "100%"
                      : i === storyIdx
                        ? `${progress}%`
                        : "0%",
                }}
                transition={i === storyIdx ? { duration: 0 } : { duration: 0.2 }}
              />
            </div>
          ))}
        </div>

        {/* ─── Header ─── */}
        <div className="absolute top-6 left-0 right-0 px-4 flex items-center gap-3 z-10">
          <div
            className="h-9 w-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center overflow-hidden cursor-pointer ring-2 ring-white/20 hover:ring-white/40 transition-all"
            data-ignore-tap
            onClick={() => { onClose(); navigate(`/player-card/${currentGroup.user_id}`); }}
          >
            {currentGroup.user_avatar ? (
              <img src={mediaUrl(currentGroup.user_avatar)} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0" data-ignore-tap>
            <div className="flex items-center gap-2">
              <span
                className="text-white text-sm font-bold truncate cursor-pointer hover:underline"
                onClick={() => { onClose(); navigate(`/player-card/${currentGroup.user_id}`); }}
              >
                {currentGroup.user_id === user?.id ? "Your Story" : currentGroup.user_name}
              </span>
              <span className="text-white/50 text-[11px] flex-shrink-0">
                {timeAgo(currentStory.created_at)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1" data-ignore-tap>
            <button
              onClick={() => setPaused((p) => !p)}
              className="h-9 w-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            {isOwnStory && (
              <button
                onClick={promptDelete}
                disabled={isDeleting}
                className="h-9 w-9 rounded-full flex items-center justify-center text-white/70 hover:text-red-400 hover:bg-white/10 transition-all disabled:opacity-50"
                aria-label="Delete story"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─── Paused indicator ─── */}
        <AnimatePresence>
          {paused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
            >
              <div className="h-16 w-16 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
                <Pause className="h-8 w-8 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Bottom section ─── */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 flex flex-col gap-3" data-ignore-tap>
          {/* Reply bar (not for own stories) */}
          {!isOwnStory && (
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  ref={replyInputRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setPaused(true)}
                  onBlur={() => { if (!replyText.trim()) setPaused(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleReply()}
                  placeholder={`Reply to ${currentGroup.user_name?.split(" ")[0]}...`}
                  className="w-full h-11 bg-black/30 backdrop-blur-sm border border-white/20 rounded-full pl-4 pr-12 text-sm text-white placeholder:text-gray-300 outline-none focus:bg-black/40 focus:border-white/30 transition-all"
                />
                {replyText.trim() && (
                  <button
                    onClick={handleReply}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white hover:bg-brand-700 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* View count */}
          <div className="flex items-center justify-center">
            <span className="text-xs text-white/50 flex items-center gap-1.5 py-2">
              <Eye className="h-3.5 w-3.5" />
              {currentStory.view_count || 0} {(currentStory.view_count || 0) === 1 ? "view" : "views"}
            </span>
          </div>
        </div>

      </div>

      {/* ─── Delete Confirmation Dialog ─── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-[280px] sm:w-[320px] rounded-2xl overflow-hidden shadow-2xl border border-border/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-4 text-center">
                <h3 className="font-display font-bold text-base text-foreground mb-1">
                  Delete Story?
                </h3>
                <p className="text-sm text-muted-foreground">
                  This story will be permanently removed and can't be recovered.
                </p>
              </div>
              <div className="border-t border-border/30">
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="w-full py-3.5 text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors border-b border-border/30 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={cancelDelete}
                  className="w-full py-3.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
