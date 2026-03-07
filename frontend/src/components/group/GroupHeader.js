import { motion, AnimatePresence } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import {
  ArrowLeft, Users, Lock, Globe, Search, Pin, Settings, Loader2, X,
} from "lucide-react";

export default function GroupHeader({
  group,
  onlineMembers,
  tab,
  onTabToggle,
  isAdmin,
  showSearch,
  onToggleSearch,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  searching,
  searchResults,
  onOpenPinned,
  onOpenEdit,
  onNavigateBack,
  formatTime,
}) {
  return (
    <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-xl border-b border-border/15 flex-shrink-0">
      <div className="h-[56px] sm:h-[60px] max-w-5xl mx-auto px-2 sm:px-3 flex items-center gap-2.5">
        <button
          onClick={onNavigateBack}
          className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/40 active:scale-90 transition-all lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <div className="relative h-10 w-10 rounded-full bg-brand-600/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {group.avatar_url ? (
            <img src={mediaUrl(group.avatar_url)} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <Users className="h-5 w-5 text-brand-600" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-[14px] truncate">{group.name}</h2>
            {group.is_private ? (
              <Lock className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            ) : (
              <Globe className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            {group.member_count} members{onlineMembers.length > 0 && ` \u00b7 ${onlineMembers.length} online`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {group.is_member && (
            <>
              <button
                onClick={() => onToggleSearch(!showSearch)}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 hover:bg-secondary/40 hover:text-foreground transition-colors active:scale-90"
              >
                {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
              <button
                onClick={onOpenPinned}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 hover:bg-secondary/40 hover:text-foreground transition-colors active:scale-90"
              >
                <Pin className="h-4 w-4" />
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={onOpenEdit}
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 hover:bg-secondary/40 hover:text-foreground transition-colors active:scale-90"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onTabToggle}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              tab === "info"
                ? "bg-brand-600 text-white"
                : "text-muted-foreground/60 hover:bg-secondary/40 hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-border/10"
          >
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5">
              <div className="relative flex gap-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                  placeholder="Search messages..."
                  autoFocus
                  className="flex-1 pl-9 h-9 bg-secondary/30 border-none rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-brand-600/20 placeholder:text-muted-foreground/35 transition-all"
                />
                <button
                  onClick={onSearch}
                  disabled={searching}
                  className="h-9 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-medium flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50"
                >
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-[28vh] overflow-y-auto space-y-0.5 custom-scrollbar">
                  {searchResults.map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-lg hover:bg-secondary/40 active:bg-secondary/60 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold text-brand-600">{r.sender_name}</span>
                        <span className="text-[10px] text-muted-foreground/40">{formatTime(r.created_at)}</span>
                      </div>
                      <p className="text-[12px] truncate text-foreground/60">{r.content?.substring(0, 100)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
