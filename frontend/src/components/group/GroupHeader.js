import { motion, AnimatePresence } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Users, Lock, Globe, Search, Pin, Settings, Loader2,
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
    <div className="sticky top-0 z-10 bg-card backdrop-blur-xl border-b border-border px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <button onClick={onNavigateBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-10 w-10 rounded-xl bg-brand-600/10 flex items-center justify-center flex-shrink-0">
          {group.avatar_url ? <img src={mediaUrl(group.avatar_url)} alt="" className="h-10 w-10 rounded-xl object-cover" />
            : <Users className="h-5 w-5 text-brand-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-sm truncate">{group.name}</h2>
            {group.is_private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {group.member_count} members{onlineMembers.length > 0 && ` · ${onlineMembers.length} online`}
          </p>
        </div>
        <div className="flex gap-1">
          {group.is_member && (
            <>
              <button onClick={() => onToggleSearch(!showSearch)} className="h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                <Search className="h-4 w-4" />
              </button>
              <button onClick={onOpenPinned} className="h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                <Pin className="h-4 w-4" />
              </button>
            </>
          )}
          {isAdmin && (
            <button onClick={onOpenEdit} className="h-8 w-8 rounded-xl flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="h-4 w-4" />
            </button>
          )}
          <button onClick={onTabToggle}
            className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${tab === "info" ? "bg-brand-600 text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            <Users className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="max-w-3xl mx-auto overflow-hidden">
            <div className="flex gap-2 mt-3">
              <Input value={searchQuery} onChange={e => onSearchQueryChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onSearch()}
                placeholder="Search messages..." className="flex-1 bg-secondary/30 border-border/40 h-8 text-sm" />
              <Button size="sm" onClick={onSearch} disabled={searching} className="h-8 px-3 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl text-xs">
                {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {searchResults.map(r => (
                  <div key={r.id} className="text-xs p-3 rounded-xl bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors">
                    <span className="font-bold text-brand-600">{r.sender_name}:</span> {r.content?.substring(0, 100)}
                    <span className="text-muted-foreground ml-2">{formatTime(r.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
