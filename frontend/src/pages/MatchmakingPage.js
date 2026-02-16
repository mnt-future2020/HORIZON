import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { matchAPI, mercenaryAPI, bookingAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Swords, Users, Plus, Clock, Trophy, Target, MapPin,
  IndianRupee, CheckCircle, XCircle, CreditCard, Loader2, Star, UserCheck
} from "lucide-react";

function MatchCard({ match, onJoin, userId }) {
  const isCreator = match.creator_id === userId;
  const hasJoined = match.players_joined?.includes(userId);
  const spotsLeft = match.players_needed - (match.players_joined?.length || 0);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-lg p-5" data-testid={`match-card-${match.id}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground">{match.sport?.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</h3>
            <Badge variant="secondary" className="text-[10px]">{match.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{match.description || "No description"}</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">{spotsLeft} spots</Badge>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{match.date} at {match.time}</span>
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.venue_name}</span>
        <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{match.min_skill}-{match.max_skill}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">by <span className="text-foreground font-medium">{match.creator_name}</span></span>
        {!isCreator && !hasJoined && spotsLeft > 0 && match.status === "open" && (
          <Button size="sm" onClick={() => onJoin(match.id)} data-testid={`join-match-${match.id}`}
            className="bg-primary text-primary-foreground font-bold text-xs h-8">Join</Button>
        )}
        {hasJoined && <Badge className="bg-primary/20 text-primary">Joined</Badge>}
      </div>
    </motion.div>
  );
}

function MercenaryCard({ post, userId, onApply, onAccept, onReject, onPay, paying }) {
  const isHost = post.host_id === userId;
  const hasApplied = post.applicants?.some(a => a.id === userId);
  const isAccepted = post.accepted?.some(a => a.id === userId);
  const hasPaid = post.paid_players?.some(p => p.id === userId);
  const spotsLeft = post.spots_available - (post.spots_filled || 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-lg p-5" data-testid={`mercenary-card-${post.id}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-400" />
            {post.position_needed}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{post.venue_name}</span>
            <span>{post.sport}</span>
          </p>
          {post.description && <p className="text-xs text-muted-foreground/70 mt-1">{post.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display font-bold text-violet-400 flex items-center gap-0.5">
            <IndianRupee className="h-3.5 w-3.5" />{post.amount_per_player}
          </div>
          <div className="text-[10px] text-muted-foreground">{spotsLeft} of {post.spots_available} open</div>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.date} at {post.time}</span>
        <span>by <span className="text-foreground font-medium">{post.host_name}</span></span>
      </div>

      {/* Host view: show applicants */}
      {isHost && post.applicants?.length > 0 && (
        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Applicants</span>
          {post.applicants.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-2.5" data-testid={`applicant-${a.id}`}>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">{a.name?.[0]}</div>
                <div>
                  <div className="text-xs font-semibold">{a.name}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Star className="h-2.5 w-2.5" /> {a.skill_rating}</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => onAccept(post.id, a.id)} data-testid={`accept-${a.id}`}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10"
                  onClick={() => onReject(post.id, a.id)} data-testid={`reject-${a.id}`}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Host view: show accepted & paid */}
      {isHost && post.accepted?.length > 0 && (
        <div className="border-t border-border pt-3 mt-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Accepted</span>
          {post.accepted.map(a => {
            const paid = post.paid_players?.some(p => p.id === a.id);
            return (
              <div key={a.id} className="flex items-center justify-between bg-secondary/20 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold">{a.name}</span>
                </div>
                <Badge className={`text-[10px] ${paid ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                  {paid ? "Paid" : "Awaiting Payment"}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {/* Player actions */}
      <div className="mt-3 flex items-center justify-end gap-2">
        {!isHost && !hasApplied && !isAccepted && !hasPaid && post.status === "open" && (
          <Button size="sm" onClick={() => onApply(post.id)} data-testid={`apply-mercenary-${post.id}`}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-8">
            <Target className="h-3.5 w-3.5 mr-1" /> Apply
          </Button>
        )}
        {hasApplied && !isAccepted && <Badge className="bg-violet-500/20 text-violet-400">Applied — Waiting</Badge>}
        {isAccepted && !hasPaid && (
          <Button size="sm" onClick={() => onPay(post.id)} disabled={paying === post.id}
            data-testid={`pay-mercenary-${post.id}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8">
            {paying === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
            Pay {"\u20B9"}{post.amount_per_player}
          </Button>
        )}
        {hasPaid && <Badge className="bg-emerald-500/20 text-emerald-400">Confirmed — You're In!</Badge>}
      </div>
    </motion.div>
  );
}

export default function MatchmakingPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [mercenaries, setMercenaries] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [formType, setFormType] = useState("match");
  const [paying, setPaying] = useState(null);
  const [form, setForm] = useState({
    sport: "football", date: "", time: "18:00", venue_name: "",
    players_needed: 10, min_skill: 0, max_skill: 3000, description: "",
    booking_id: "", position_needed: "", amount_per_player: 200, spots_available: 1,
  });

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      matchAPI.list().catch(() => ({ data: [] })),
      mercenaryAPI.list().catch(() => ({ data: [] })),
      mercenaryAPI.myPosts().catch(() => ({ data: [] })),
      bookingAPI.list().catch(() => ({ data: [] })),
    ]).then(([m, mer, mp, bk]) => {
      setMatches(m.data || []);
      setMercenaries(mer.data || []);
      setMyPosts(mp.data || []);
      setMyBookings((bk.data || []).filter(b => b.status === "confirmed" && b.host_id === user?.id));
    }).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleJoin = async (id) => {
    try { await matchAPI.join(id); toast.success("Joined match!"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to join"); }
  };

  const handleApply = async (id) => {
    try { await mercenaryAPI.apply(id); toast.success("Applied! Host will review."); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to apply"); }
  };

  const handleAccept = async (postId, applicantId) => {
    try { await mercenaryAPI.accept(postId, applicantId); toast.success("Player accepted!"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleReject = async (postId, applicantId) => {
    try { await mercenaryAPI.reject(postId, applicantId); toast.success("Applicant removed"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById("razorpay-script")) { resolve(true); return; }
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePay = async (postId) => {
    setPaying(postId);
    try {
      const res = await mercenaryAPI.pay(postId);
      const result = res.data;

      if (result.payment_gateway === "razorpay" && result.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); setPaying(null); return; }
        const options = {
          key: result.razorpay_key_id,
          amount: result.amount * 100,
          currency: "INR",
          order_id: result.razorpay_order_id,
          name: "Horizon Sports",
          description: "Mercenary Fee",
          handler: async (response) => {
            try {
              await mercenaryAPI.verifyPayment(postId, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment confirmed — you're in the game!");
              loadData();
            } catch { toast.error("Payment verification failed"); }
            setPaying(null);
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); setPaying(null); } },
          theme: { color: "#7C3AED" }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

      // Mock
      toast.success("Payment confirmed — you're in the game!");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
    } finally {
      setPaying(null);
    }
  };

  const handleCreate = async () => {
    try {
      if (formType === "match") {
        await matchAPI.create({
          sport: form.sport, date: form.date, time: form.time,
          venue_name: form.venue_name, players_needed: Number(form.players_needed),
          min_skill: Number(form.min_skill), max_skill: Number(form.max_skill),
          description: form.description,
        });
        toast.success("Match created!");
      } else {
        if (!form.booking_id) { toast.error("Select a booking"); return; }
        await mercenaryAPI.create({
          booking_id: form.booking_id, position_needed: form.position_needed,
          amount_per_player: Number(form.amount_per_player),
          spots_available: Number(form.spots_available),
          description: form.description,
        });
        toast.success("Mercenary post created!");
      }
      setCreateOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Creation failed");
    }
  };

  // Combine open posts (not mine) + my posts for display
  const allMercenaryPosts = [
    ...myPosts.filter(p => !mercenaries.some(m => m.id === p.id)),
    ...mercenaries
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="matchmaking-page">
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Matchmaking</span>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Find Your <span className="text-primary">Game</span></h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-bold text-xs h-9" data-testid="create-match-btn">
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Create {formType === "match" ? "Match" : "Mercenary Post"}</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 mb-4">
              <Button size="sm" variant={formType === "match" ? "default" : "outline"} onClick={() => setFormType("match")} data-testid="form-type-match">Match</Button>
              <Button size="sm" variant={formType === "mercenary" ? "default" : "outline"} onClick={() => setFormType("mercenary")} data-testid="form-type-mercenary">Mercenary</Button>
            </div>
            <div className="space-y-3">
              {formType === "match" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Sport</Label>
                      <Select value={form.sport} onValueChange={v => setForm(p => ({ ...p, sport: v }))}>
                        <SelectTrigger className="mt-1 bg-background border-border text-sm" data-testid="create-sport-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["football", "cricket", "badminton", "tennis", "basketball"].map(s => (
                            <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Time</Label>
                      <Input value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                        className="mt-1 bg-background border-border text-sm" data-testid="create-time-input" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date (YYYY-MM-DD)</Label>
                    <Input value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      placeholder="2026-02-20" className="mt-1 bg-background border-border text-sm" data-testid="create-date-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Venue Name</Label>
                    <Input value={form.venue_name} onChange={e => setForm(p => ({ ...p, venue_name: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-venue-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Players Needed</Label>
                    <Input type="number" value={form.players_needed} onChange={e => setForm(p => ({ ...p, players_needed: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-players-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-description-input" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Select Your Booking</Label>
                    {myBookings.length === 0 ? (
                      <p className="text-xs text-amber-400 mt-1">You need a confirmed booking first. Book a slot then come back.</p>
                    ) : (
                      <Select value={form.booking_id} onValueChange={v => setForm(p => ({ ...p, booking_id: v }))}>
                        <SelectTrigger className="mt-1 bg-background border-border text-sm" data-testid="select-booking">
                          <SelectValue placeholder="Choose a booking..." />
                        </SelectTrigger>
                        <SelectContent>
                          {myBookings.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.venue_name} — {b.date} at {b.start_time} ({b.sport})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Position Needed</Label>
                    <Input value={form.position_needed} onChange={e => setForm(p => ({ ...p, position_needed: e.target.value }))}
                      placeholder="Goalkeeper, Defender, Doubles Partner..." className="mt-1 bg-background border-border text-sm" data-testid="create-position-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Fee Per Player</Label>
                      <Input type="number" value={form.amount_per_player} onChange={e => setForm(p => ({ ...p, amount_per_player: e.target.value }))}
                        className="mt-1 bg-background border-border text-sm" data-testid="create-amount-input" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Spots Available</Label>
                      <Input type="number" min={1} max={20} value={form.spots_available} onChange={e => setForm(p => ({ ...p, spots_available: e.target.value }))}
                        className="mt-1 bg-background border-border text-sm" data-testid="create-spots-input" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                    <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Any details about what you're looking for..."
                      className="mt-1 bg-background border-border text-sm" data-testid="create-merc-description" />
                  </div>
                </>
              )}
              <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreate} data-testid="submit-create-btn">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="mercenary" data-testid="matchmaking-tabs">
        <TabsList className="bg-secondary/50 mb-6">
          <TabsTrigger value="mercenary" className="font-bold gap-1" data-testid="tab-mercenary"><Users className="h-3.5 w-3.5" /> Mercenary</TabsTrigger>
          <TabsTrigger value="matches" className="font-bold gap-1" data-testid="tab-matches"><Swords className="h-3.5 w-3.5" /> Find Games</TabsTrigger>
        </TabsList>

        <TabsContent value="mercenary">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : allMercenaryPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No mercenary posts yet</p>
              <p className="text-xs mt-1">Book a slot and create a post to find players!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allMercenaryPosts.map(m => (
                <MercenaryCard key={m.id} post={m} userId={user?.id}
                  onApply={handleApply} onAccept={handleAccept} onReject={handleReject}
                  onPay={handlePay} paying={paying} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="matches">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No open matches</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map(m => <MatchCard key={m.id} match={m} onJoin={handleJoin} userId={user?.id} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
