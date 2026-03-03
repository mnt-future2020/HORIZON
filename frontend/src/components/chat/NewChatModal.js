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
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-card rounded-t-[32px] sm:rounded-[32px] h-[85vh] sm:h-auto sm:max-h-[80vh] flex flex-col overflow-hidden border border-border/40 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/50 bg-secondary/20">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  New Message
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5 opacity-60">
                  Search your network
                </p>
              </div>
              <button
                onClick={onClose}
                className="h-10 w-10 flex items-center justify-center rounded-2xl hover:bg-secondary/80 transition-all text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-4 gap-2 mt-4 pb-2 overflow-x-auto no-scrollbar scroll-smooth">
              {[
                { id: "all", label: "Global", icon: Search },
                { id: "followers", label: "Followers", icon: Users },
                { id: "following", label: "Following", icon: UserPlus },
                { id: "contacts", label: "Contacts", icon: ContactRound },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    setSearchQuery("");
                  }}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-bold transition-all whitespace-nowrap border-2 ${
                    activeTab === t.id
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "bg-white/5 border-transparent text-muted-foreground hover:text-foreground hover:border-border/30"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="px-5 pt-3 group">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-brand-600 transition-colors" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={
                    activeTab === "all"
                      ? "Search millions of players..."
                      : `Search your ${activeTab}...`
                  }
                  className="pl-12 h-12 bg-secondary/50 border-none rounded-2xl text-sm focus-visible:ring-offset-0 focus-visible:ring-brand-600/20 shadow-inner"
                  autoFocus
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {tabLoading || searching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                  <p className="text-xs font-bold uppercase tracking-widest">
                    Finding matches...
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Contacts Tab Special Actions */}
                  {activeTab === "contacts" && (
                    <div className="flex gap-3 mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-11 border-dashed rounded-2xl text-[11px] font-bold"
                        onClick={handleSyncContacts}
                        disabled={contactSyncing}
                      >
                        {contactSyncing ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        ) : (
                          <ContactRound className="h-4 w-4 mr-2" />
                        )}
                        Sync Phones
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-11 border-dashed rounded-2xl text-[11px] font-bold"
                        onClick={handleInvite}
                      >
                        <Share2 className="h-3 w-3 mr-2" /> Invite
                      </Button>
                    </div>
                  )}

                  {filteredList.length > 0 ? (
                    filteredList.map((u, idx) => (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        <UserRow
                          u={u}
                          onSelect={() => onStartConvo(u.id)}
                          badge={u.match_type}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-16 opacity-40 flex flex-col items-center gap-4">
                      <div className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center">
                        <MessageCircle className="h-10 w-10" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">No players found</p>
                        <p className="text-[11px] uppercase tracking-tighter mt-1">
                          Try a different search term
                        </p>
                      </div>
                    </div>
                  )}
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
