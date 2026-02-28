import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { socialAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, User, UserPlus, Users, Loader2, Phone,
  ContactRound, Share2, Copy, Check, Search, Mail, MessageCircle
} from "lucide-react";
import { toast } from "sonner";

export default function ContactSyncPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matchedUsers, setMatchedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);
  const [stats, setStats] = useState(null);
  const [manualPhone, setManualPhone] = useState("");
  const [manualResults, setManualResults] = useState([]);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("sync");

  // ─── Contact Picker API (mobile) ─────────────────────────────────
  const supportsContactPicker = "contacts" in navigator && "ContactsManager" in window;

  const handleContactSync = async () => {
    setLoading(true);
    try {
      let phones = [];
      let emails = [];

      if (supportsContactPicker) {
        // Use native Contact Picker API
        const contacts = await navigator.contacts.select(
          ["tel", "email"],
          { multiple: true }
        );
        phones = contacts.flatMap((c) => c.tel || []);
        emails = contacts.flatMap((c) => c.email || []);
      } else {
        // Fallback: request permission for contacts via phone input
        // Show a prompt asking user to enter numbers manually
        toast.info("Contact Picker not supported. Use manual search below.");
        setActiveTab("manual");
        setLoading(false);
        return;
      }

      if (phones.length === 0 && emails.length === 0) {
        toast.info("No contacts selected");
        setLoading(false);
        return;
      }

      const res = await socialAPI.syncContacts({ phones, emails });
      setMatchedUsers(res.data?.matched || []);
      setStats({
        checked: res.data?.total_checked || 0,
        found: res.data?.total_found || 0,
      });
      setSynced(true);
    } catch (err) {
      if (err.name === "TypeError" || err.message?.includes("contacts")) {
        toast.info("Contact access not available. Use manual search.");
        setActiveTab("manual");
      } else {
        toast.error("Failed to sync contacts");
      }
    }
    setLoading(false);
  };

  // ─── Manual phone/email search ─────────────────────────────────
  const handleManualSearch = async () => {
    if (!manualPhone.trim()) return;
    setLoading(true);
    try {
      const input = manualPhone.trim();
      const isEmail = input.includes("@");
      const res = await socialAPI.syncContacts({
        phones: isEmail ? [] : [input],
        emails: isEmail ? [input] : [],
      });
      setManualResults(res.data?.matched || []);
      if ((res.data?.matched || []).length === 0) {
        toast.info("No users found with that number/email");
      }
    } catch { toast.error("Search failed"); }
    setLoading(false);
  };

  // ─── Follow ──────────────────────────────────────────────────────
  const handleFollow = async (userId, listType) => {
    const setter = listType === "manual" ? setManualResults : setMatchedUsers;
    try {
      const res = await socialAPI.toggleFollow(userId);
      setter((prev) =>
        prev.map((u) => u.id === userId ? { ...u, is_following: res.data.following } : u)
      );
      toast.success(res.data.following ? "Following!" : "Unfollowed");
    } catch { toast.error("Failed"); }
  };

  // ─── Invite ──────────────────────────────────────────────────────
  const handleGetInvite = async () => {
    try {
      const res = await socialAPI.getInviteLink();
      setInviteLink(res.data?.message || "");
    } catch { toast.error("Failed to get invite link"); }
  };

  const handleCopyInvite = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    if (!inviteLink) await handleGetInvite();
    const msg = inviteLink || `Join me on Horizon Sports! 🏟️`;
    if (navigator.share) {
      try { await navigator.share({ title: "Join Horizon", text: msg }); }
      catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(msg);
      toast.success("Invite link copied!");
    }
  };

  const renderUserCard = (u, listType) => (
    <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-4 rounded-2xl border border-border/50 bg-card hover:border-brand-600/30 hover:shadow-sm transition-all">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={() => navigate(`/player-card/${u.id}`)}>
        {u.avatar ? <img src={mediaUrl(u.avatar)} alt="" className="h-12 w-12 rounded-full object-cover" />
          : <User className="h-6 w-6 text-primary" />}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/player-card/${u.id}`)}>
        <div className="font-bold text-sm truncate">{u.name}</div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {u.match_type === "phone" && <><Phone className="h-3 w-3" /> Phone contact</>}
          {u.match_type === "email" && <><Mail className="h-3 w-3" /> Email contact</>}
          {u.sport && <span className="capitalize">• {u.sport}</span>}
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <Button variant="outline" size="sm" className="h-11 w-11 sm:h-8 sm:w-8 p-0"
          onClick={() => navigate(`/chat?user=${u.id}`)}>
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
        </Button>
        <Button
          variant={u.is_following ? "outline" : "athletic"}
          size="sm" className="h-11 sm:h-8 text-[11px] min-w-[80px]"
          onClick={() => handleFollow(u.id, listType)}>
          {u.is_following ? "Following" : <><UserPlus className="h-3 w-3 mr-1" /> Follow</>}
        </Button>
      </div>
    </motion.div>
  );

  return (
    <div className=" mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="h-11 w-11 sm:h-9 sm:w-9 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display font-black text-xl">Find Friends</h1>
          <p className="text-xs text-muted-foreground">Sync contacts to find friends on Horizon</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 mb-6">
        {[
          { id: "sync", label: "Sync Contacts", shortLabel: "Sync", icon: ContactRound },
          { id: "manual", label: "Search", shortLabel: "Search", icon: Search },
          { id: "invite", label: "Invite", shortLabel: "Invite", icon: Share2 },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 sm:py-2 rounded-md text-[9px] sm:text-xs font-bold transition-all min-h-[44px] ${
              activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-label={t.label}>
            <t.icon className="h-4 w-4 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="leading-tight text-center">{t.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* ═══ SYNC TAB ═══ */}
      {activeTab === "sync" && (
        <div>
          {!synced ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-center py-12">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <ContactRound className="h-12 w-12 text-primary" />
              </div>
              <h2 className="font-display font-bold text-xl mb-2">Find your friends</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-8">
                Sync your phone contacts to discover friends who are already on Horizon. We only match numbers — nothing is stored.
              </p>
              <Button variant="athletic" size="lg" onClick={handleContactSync} disabled={loading}
                className="min-w-[200px]">
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Users className="h-5 w-5 mr-2" />}
                {loading ? "Syncing..." : "Sync Contacts"}
              </Button>
              {!supportsContactPicker && (
                <p className="text-[10px] text-muted-foreground mt-4">
                  Contact Picker not available on this browser. Try the Search tab to find friends manually.
                </p>
              )}
            </motion.div>
          ) : (
            <div>
              {/* Stats */}
              {stats && (
                <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="text-center">
                    <div className="font-display font-black text-lg text-primary">{stats.found}</div>
                    <div className="text-[10px] text-muted-foreground">Friends found</div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center">
                    <div className="font-bold text-sm">{stats.checked}</div>
                    <div className="text-[10px] text-muted-foreground">Contacts checked</div>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => { setSynced(false); setMatchedUsers([]); }}>
                    Sync Again
                  </Button>
                </div>
              )}

              {/* Matched Users */}
              {matchedUsers.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-muted-foreground">Friends on Horizon</h3>
                  {matchedUsers.map((u) => renderUserCard(u, "matched"))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No friends found from your contacts</p>
                  <Button variant="athletic-outline" onClick={() => setActiveTab("invite")}>
                    <Share2 className="h-4 w-4 mr-2" /> Invite Friends
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ MANUAL SEARCH TAB ═══ */}
      {activeTab === "manual" && (
        <div>
          <div className="flex gap-2 mb-6">
            <div className="flex-1 flex">
              <span className="inline-flex items-center px-2.5 bg-secondary border border-r-0 border-border rounded-l-md text-xs font-bold text-muted-foreground select-none">+91</span>
              <Input
                placeholder="Phone or email..."
                className="h-11 bg-secondary/50 rounded-l-none flex-1"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
              />
            </div>
            <Button variant="athletic" onClick={handleManualSearch} disabled={loading || !manualPhone.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {manualResults.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-muted-foreground">{manualResults.length} found</h3>
              {manualResults.map((u) => renderUserCard(u, "manual"))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Enter a phone number or email to find friends</p>
              <p className="text-[10px] text-muted-foreground mt-1">Example: 9876543210 or friend@email.com</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ INVITE TAB ═══ */}
      {activeTab === "invite" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-8">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Share2 className="h-12 w-12 text-primary" />
          </div>
          <h2 className="font-display font-bold text-xl mb-2">Invite Friends</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-8">
            Share your invite link and play together on Horizon!
          </p>

          {/* Invite actions */}
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button variant="athletic" size="lg" onClick={handleShareInvite} className="w-full">
              <Share2 className="h-5 w-5 mr-2" /> Share Invite
            </Button>

            {!inviteLink && (
              <Button variant="athletic-outline" size="lg" onClick={handleGetInvite} className="w-full">
                <Copy className="h-5 w-5 mr-2" /> Get Invite Link
              </Button>
            )}

            {inviteLink && (
              <div className="mt-4 p-4 rounded-xl bg-secondary/30 border border-border/50 text-left">
                <p className="text-xs text-muted-foreground mb-2 font-bold">Your invite message:</p>
                <p className="text-sm mb-3">{inviteLink}</p>
                <Button variant="outline" size="sm" onClick={handleCopyInvite} className="w-full">
                  {copied ? <><Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> Copied!</>
                    : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy to Clipboard</>}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
