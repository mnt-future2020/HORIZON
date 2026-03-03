import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Users,
  UserPlus,
  ContactRound,
  Loader2,
  MessageCircle,
  Share2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserRow from "./UserRow";
import { userSearchAPI, socialAPI } from "@/lib/api";
import { toast } from "sonner";

const NewChatModal = ({ isOpen, onClose, onStartConvo, user }) => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [tabFollowers, setTabFollowers] = useState([]);
  const [tabFollowing, setTabFollowing] = useState([]);
  const [syncedContacts, setSyncedContacts] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [contactSyncing, setContactSyncing] = useState(false);

  const loadTabData = useCallback(async () => {
    if (!user?.id) return;
    setTabLoading(true);
    try {
      const [followersRes, followingRes, contactsRes] = await Promise.all([
        socialAPI.getFollowers(user.id),
        socialAPI.getFollowing(user.id),
        socialAPI.getSyncedContacts(),
      ]);
      setTabFollowers(followersRes.data || []);
      setTabFollowing(followingRes.data || []);
      setSyncedContacts(contactsRes.data || []);
    } catch {
      toast.error("Failed to load contacts/followers");
    } finally {
      setTabLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadTabData();
    }
  }, [isOpen, loadTabData]);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (activeTab !== "all") return;
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await userSearchAPI.search(q);
      setSearchResults(res.data || []);
    } catch {
      // Keep results same or toast
    } finally {
      setSearching(false);
    }
  };

  const handleSyncContacts = async () => {
    setContactSyncing(true);
    try {
      if (!("contacts" in navigator)) {
        toast.info("Contacts selection not supported on this browser.");
        return;
      }
      const contacts = await navigator.contacts.select(["tel", "email"], {
        multiple: true,
      });
      const phones = contacts.flatMap((c) => c.tel || []);
      const emails = contacts.flatMap((c) => c.email || []);
      if (phones.length === 0 && emails.length === 0) {
        toast.info("No contacts selected");
        return;
      }
      await socialAPI.syncContacts({ phones, emails });
      const freshContacts = await socialAPI.getSyncedContacts();
      setSyncedContacts(freshContacts.data || []);
      toast.success("Contacts synced successfully!");
    } catch (err) {
      toast.error("Failed to sync contacts");
    } finally {
      setContactSyncing(false);
    }
  };

  const handleInvite = async () => {
    try {
      const res = await socialAPI.getInviteLink();
      const msg = res.data?.message || "Join me on Horizon Sports!";
      if (navigator.share) {
        await navigator.share({ title: "Join Horizon", text: msg });
      } else {
        await navigator.clipboard.writeText(msg);
        toast.success("Invite link copied!");
      }
    } catch {}
  };

  const getFilteredTabList = () => {
    const q = searchQuery.toLowerCase();
    switch (activeTab) {
      case "followers":
        return q.length >= 1
          ? tabFollowers.filter((u) => u.name?.toLowerCase().includes(q))
          : tabFollowers;
      case "following":
        return q.length >= 1
          ? tabFollowing.filter((u) => u.name?.toLowerCase().includes(q))
          : tabFollowing;
      case "contacts":
        return q.length >= 1
          ? syncedContacts.filter((u) => u.name?.toLowerCase().includes(q))
          : syncedContacts;
      default:
        return searchResults;
    }
  };

  const filteredList = getFilteredTabList();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-0 sm:p-4"
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
                  placeholder={
                    activeTab === "all"
                      ? "Search name or specialty..."
                      : `Search ${activeTab}...`
                  }
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

            <div className="px-5 sm:px-6 pb-4">
              <div className="flex p-1 bg-secondary/20 rounded-2xl border border-border/50 gap-0.5">
                {[
                  { id: "all", label: "Discovery", icon: Search },
                  { id: "followers", label: "Followers", icon: Users },
                  { id: "following", label: "Following", icon: UserPlus },
                  { id: "contacts", label: "Network", icon: ContactRound },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTab(t.id);
                      setSearchQuery("");
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
                {activeTab === "all" && searchQuery.length === 0
                  ? "Recommended"
                  : "Results"}
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
                  {/* Contacts Tab Special Actions */}
                  {activeTab === "contacts" && !searchQuery && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 gap-3 mb-6"
                    >
                      <button
                        className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl bg-brand-600/5 border border-brand-600/10 hover:bg-brand-600/10 transition-all group active:scale-[0.98]"
                        onClick={handleSyncContacts}
                        disabled={contactSyncing}
                      >
                        <div className="h-10 w-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          {contactSyncing ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <ContactRound className="h-5 w-5" />
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                          Sync Contacts
                        </span>
                      </button>
                      <button
                        className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl bg-secondary/30 border border-border/40 hover:bg-secondary/50 transition-all group active:scale-[0.98]"
                        onClick={handleInvite}
                      >
                        <div className="h-10 w-10 rounded-2xl bg-foreground flex items-center justify-center text-background shadow-lg group-hover:scale-110 transition-transform">
                          <Share2 className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Invite Friends
                        </span>
                      </button>
                    </motion.div>
                  )}

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
                            badge={
                              activeTab === "all" && !searchQuery
                                ? "Top Match"
                                : u.match_type
                            }
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
                            Try searching for something else or check your
                            network
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveTab("all");
                            setSearchQuery("");
                          }}
                          className="rounded-xl text-[10px] font-black uppercase tracking-widest text-brand-600 hover:bg-brand-600/10"
                        >
                          Reset Discovery
                        </Button>
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
