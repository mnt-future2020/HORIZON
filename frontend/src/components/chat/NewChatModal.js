import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Users,
  UserPlus,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import UserRow from "./UserRow";
import { userSearchAPI, socialAPI } from "@/lib/api";
import { toast } from "sonner";

const NewChatModal = ({ isOpen, onClose, onStartConvo, user }) => {
  const [activeTab, setActiveTab] = useState("followers");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [tabFollowers, setTabFollowers] = useState([]);
  const [tabFollowing, setTabFollowing] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadTabData = useCallback(async () => {
    if (!user?.id) return;
    setTabLoading(true);
    const results = await Promise.allSettled([
      socialAPI.getFollowers(user.id),
      socialAPI.getFollowing(user.id),
    ]);
    if (results[0].status === "fulfilled") setTabFollowers(results[0].value.data?.users || []);
    if (results[1].status === "fulfilled") setTabFollowing(results[1].value.data?.users || []);
    setTabLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadTabData();
    }
  }, [isOpen, loadTabData]);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await userSearchAPI.search(q);
      setSearchResults(res.data || []);
    } catch {
      // Keep results same
    } finally {
      setSearching(false);
    }
  };

  const getFilteredList = () => {
    const q = searchQuery.toLowerCase();
    // If searching, always show search results across all users
    if (q.length >= 2) return searchResults;
    // Otherwise show tab data
    if (activeTab === "following") return tabFollowing;
    return tabFollowers;
  };

  const filteredList = getFilteredList();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-[2px] p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              type: "spring",
              damping: 32,
              stiffness: 300,
              mass: 1,
            }}
            className="w-full max-w-xl bg-card rounded-t-[32px] sm:rounded-[40px] h-[95vh] sm:h-[80vh] flex flex-col overflow-hidden border border-border/40 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Decorative Element */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-600/5 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-600/5 blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-2">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2 truncate">
                  New Message
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse flex-shrink-0" />
                </h2>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1 opacity-50 truncate">
                  Select a player for chat
                </p>
              </div>
              <button
                onClick={onClose}
                className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl sm:rounded-2xl bg-secondary/30 hover:bg-secondary/60 transition-all text-muted-foreground hover:text-foreground border border-border/20 active:scale-95 flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input Container */}
            <div className="px-5 sm:px-6 py-3 sm:py-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 group-focus-within:text-brand-600 group-focus-within:scale-110 transition-all pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search name or specialty..."
                  className="pl-12 h-12 sm:h-14 bg-secondary/40 border-border/40 rounded-2xl text-[15px] sm:text-base font-medium focus-visible:ring-brand-600/20 focus-visible:border-brand-600/30 shadow-none transition-all placeholder:text-muted-foreground/40"
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="px-5 sm:px-6 pb-4">
              <div className="flex p-1 bg-secondary/20 rounded-2xl border border-border/50 gap-0.5">
                {[
                  { id: "followers", label: "Followers", icon: Users },
                  { id: "following", label: "Following", icon: UserPlus },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTab(t.id);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className={`flex-1 flex items-center justify-center py-2.5 rounded-[12px] sm:rounded-[14px] transition-all relative overflow-hidden ${
                      activeTab === t.id
                        ? "text-white shadow-lg shadow-brand-600/20"
                        : "text-muted-foreground hover:text-foreground active:scale-95"
                    }`}
                  >
                    {activeTab === t.id && (
                      <motion.div
                        layoutId="activeTabBg"
                        className="absolute inset-0 bg-brand-600 z-0"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.5,
                        }}
                      />
                    )}
                    <div className="relative z-10 flex items-center justify-center gap-1.5">
                      <t.icon className="h-3.5 w-3.5 hidden min-[440px]:inline" />
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight sm:tracking-wider">
                        {t.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* List Header */}
            <div className="px-7 py-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                {searchQuery.length >= 2 ? "Search Results" : activeTab === "followers" ? "Followers" : "Following"}
              </span>
              <span className="text-[10px] font-bold text-brand-600/80">
                {filteredList.length} Found
              </span>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-10 custom-scrollbar">
              {tabLoading || searching ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-brand-600/20 animate-ping absolute" />
                    <Loader2 className="h-12 w-12 animate-spin text-brand-600 relative z-10" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
                    Scanning Network
                  </p>
                </div>
              ) : (
                <div className="space-y-2 px-2">
                  <AnimatePresence mode="popLayout">
                    {filteredList.length > 0 ? (
                      filteredList.map((u, idx) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                            delay: Math.min(idx * 0.04, 0.4),
                          }}
                        >
                          <UserRow
                            u={u}
                            onSelect={() => onStartConvo(u.id)}
                            badge={u.match_type}
                          />
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-24 opacity-60 flex flex-col items-center gap-6"
                      >
                        <div className="h-24 w-24 rounded-[32px] bg-secondary/30 flex items-center justify-center border border-border/20 rotate-6 hover:rotate-0 transition-transform duration-500">
                          <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                        <div className="max-w-[200px]">
                          <p className="text-base font-black tracking-tight">
                            No results found
                          </p>
                          <p className="text-[10px] uppercase tracking-widest mt-2 leading-relaxed font-bold opacity-60">
                            Try searching for a name above
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewChatModal;
