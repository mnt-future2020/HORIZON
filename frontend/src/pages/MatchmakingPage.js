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
  IndianRupee, CheckCircle, XCircle, CreditCard, Loader2, Star, UserCheck,
  Sparkles, Zap, ChevronRight, FileCheck, BarChart3, ThumbsUp, ThumbsDown
} from "lucide-react";

function CompatBadge({ score }) {
  const color = score >= 80 ? "bg-brand-500/15 text-brand-400 border-brand-500/20"
    : score >= 50 ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
    : "bg-red-500/15 text-red-400 border-red-500/20";
  return (
    <Badge className={`text-[10px] border ${color}`} data-testid="compat-badge">
      <Zap className="h-2.5 w-2.5 mr-0.5" />{score}% match
    </Badge>
  );
}

function MatchCard({ match, onJoin, userId, showCompat }) {
  const isCreator = match.creator_id === userId;
  const hasJoined = match.players_joined?.includes(userId);
  const spotsLeft = match.players_needed - (match.players_joined?.length || 0);
  const hasResult = !!match.result;
  const resultConfirmed = match.result?.confirmed;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-lg p-5" data-testid={`match-card-${match.id}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground">{match.sport?.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</h3>
            <Badge variant="secondary" className="text-[10px]">{match.status}</Badge>
            {showCompat && match.compatibility_score != null && (
              <CompatBadge score={match.compatibility_score} />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{match.description || "No description"}</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">{spotsLeft > 0 ? `${spotsLeft} spots` : "Full"}</Badge>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{match.date} at {match.time}</span>
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.venue_name || "TBD"}</span>
        <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{match.min_skill}-{match.max_skill}</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{match.players_joined?.length || 0}/{match.players_needed}</span>
      </div>

      {hasResult && (
        <div className={`rounded-lg p-3 mb-3 text-xs ${resultConfirmed ? "bg-brand-500/10 border border-brand-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <FileCheck className="h-3 w-3" />
            {resultConfirmed ? "Result Confirmed" : "Result Pending Confirmation"}
          </div>
          <span className="text-muted-foreground">
            Winner: {match.result.winner === "draw" ? "Draw" : match.result.winner === "team_a" ? "Team A" : "Team B"}
            {match.result.score_a != null && ` (${match.result.score_a}-${match.result.score_b})`}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">by <span className="text-foreground font-medium">{match.creator_name}</span></span>
        <div className="flex gap-2">
          {!isCreator && !hasJoined && spotsLeft > 0 && match.status === "open" && (
            <Button size="sm" onClick={() => onJoin(match.id)} data-testid={`join-match-${match.id}`}
              className="bg-primary text-primary-foreground font-bold text-xs h-8">Join</Button>
          )}
          {hasJoined && !hasResult && <Badge className="bg-primary/20 text-primary">Joined</Badge>}
        </div>
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
                <Button size="sm" variant="ghost" className="h-7 px-2 text-brand-400 hover:bg-brand-500/10"
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
      {isHost && post.accepted?.length > 0 && (
        <div className="border-t border-border pt-3 mt-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Accepted</span>
          {post.accepted.map(a => {
            const paid = post.paid_players?.some(p => p.id === a.id);
            return (
              <div key={a.id} className="flex items-center justify-between bg-secondary/20 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-brand-400" />
                  <span className="text-xs font-semibold">{a.name}</span>
                </div>
                <Badge className={`text-[10px] ${paid ? "bg-brand-500/20 text-brand-400" : "bg-amber-500/20 text-amber-400"}`}>
                  {paid ? "Paid" : "Awaiting Payment"}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
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
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs h-8">
            {paying === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
            Pay {"\u20B9"}{post.amount_per_player}
          </Button>
        )}
        {hasPaid && <Badge className="bg-brand-500/20 text-brand-400">Confirmed — You're In!</Badge>}
      </div>
    </motion.div>
  );
}

function ResultDialog({ match, onSubmit, userId }) {
  const [open, setOpen] = useState(false);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [winner, setWinner] = useState("team_a");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [suggestedTeams, setSuggestedTeams] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const players = (match.players_joined || []).map((id, i) => ({
    id, name: match.player_names?.[i] || "Lobbian " + (i + 1),
    rating: match.player_ratings?.[id] || 1500
  }));

  const loadSuggestion = async () => {
    setLoadingSuggestion(true);
    try {
      const res = await matchAPI.suggestTeams(match.id);
      const data = res.data;
      setSuggestedTeams(data);
      setTeamA(data.team_a.map(p => p.id));
      setTeamB(data.team_b.map(p => p.id));
    } catch { toast.error("Failed to get team suggestion"); }
    finally { setLoadingSuggestion(false); }
  };

  const togglePlayer = (playerId, team) => {
    if (team === "a") {
      if (teamA.includes(playerId)) {
        setTeamA(prev => prev.filter(id => id !== playerId));
      } else {
        setTeamB(prev => prev.filter(id => id !== playerId));
        setTeamA(prev => [...prev, playerId]);
      }
    } else {
      if (teamB.includes(playerId)) {
        setTeamB(prev => prev.filter(id => id !== playerId));
      } else {
        setTeamA(prev => prev.filter(id => id !== playerId));
        setTeamB(prev => [...prev, playerId]);
      }
    }
  };

  const handleSubmit = () => {
    if (teamA.length === 0 || teamB.length === 0) {
      toast.error("Both teams need at least 1 Lobbian");
      return;
    }
    onSubmit(match.id, {
      team_a: teamA, team_b: teamB, winner,
      score_a: scoreA ? Number(scoreA) : null,
      score_b: scoreB ? Number(scoreB) : null
    });
    setOpen(false);
  };

  const hasResult = !!match.result;
  const isPlayerInMatch = match.players_joined?.includes(userId);
  if (!isPlayerInMatch || hasResult) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" data-testid={`submit-result-${match.id}`}>
          <FileCheck className="h-3 w-3" /> Report Result
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Report Match Result</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Button size="sm" variant="outline" onClick={loadSuggestion} disabled={loadingSuggestion}
            className="w-full text-xs gap-1.5" data-testid="suggest-teams-btn">
            {loadingSuggestion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Suggest Balanced Teams
          </Button>

          {suggestedTeams && (
            <div className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-2">
              <BarChart3 className="h-3 w-3" />
              Balance Quality: {suggestedTeams.balance_quality}% | Avg: {suggestedTeams.avg_rating_a} vs {suggestedTeams.avg_rating_b}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-brand-400 font-mono uppercase">Team A</Label>
              <div className="space-y-1.5 mt-2">
                {players.map(p => (
                  <button key={p.id} onClick={() => togglePlayer(p.id, "a")}
                    data-testid={`team-a-${p.id}`}
                    className={`w-full text-left rounded-lg p-2 text-xs transition-all ${
                      teamA.includes(p.id) ? "bg-brand-500/15 border border-brand-500/30 text-brand-400" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}>
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[10px] ml-1 opacity-70">({p.rating})</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-sky-400 font-mono uppercase">Team B</Label>
              <div className="space-y-1.5 mt-2">
                {players.map(p => (
                  <button key={p.id} onClick={() => togglePlayer(p.id, "b")}
                    data-testid={`team-b-${p.id}`}
                    className={`w-full text-left rounded-lg p-2 text-xs transition-all ${
                      teamB.includes(p.id) ? "bg-sky-500/15 border border-sky-500/30 text-sky-400" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}>
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[10px] ml-1 opacity-70">({p.rating})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Winner</Label>
            <Select value={winner} onValueChange={setWinner}>
              <SelectTrigger className="mt-1 bg-background border-border text-sm" data-testid="winner-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="team_a">Team A Won</SelectItem>
                <SelectItem value="team_b">Team B Won</SelectItem>
                <SelectItem value="draw">Draw</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Score A (optional)</Label>
              <Input type="number" value={scoreA} onChange={e => setScoreA(e.target.value)}
                className="mt-1 bg-background border-border text-sm" placeholder="0" data-testid="score-a-input" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Score B (optional)</Label>
              <Input type="number" value={scoreB} onChange={e => setScoreB(e.target.value)}
                className="mt-1 bg-background border-border text-sm" placeholder="0" data-testid="score-b-input" />
            </div>
          </div>

          <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleSubmit} data-testid="submit-result-btn">
            <FileCheck className="h-4 w-4 mr-1.5" /> Submit Result
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmResultBar({ match, userId, onConfirm }) {
  const result = match.result;
  if (!result || result.confirmed) return null;
  const alreadyResponded = result.confirmations?.some(c => c.user_id === userId);
  const isInMatch = match.players_joined?.includes(userId);
  if (!isInMatch || alreadyResponded || result.submitted_by === userId) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-3 flex items-center justify-between" data-testid="confirm-result-bar">
      <div className="text-xs">
        <span className="font-semibold text-amber-400">Confirm result?</span>
        <span className="text-muted-foreground ml-1">
          {result.winner === "draw" ? "Draw" : result.winner === "team_a" ? "Team A won" : "Team B won"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-brand-400 hover:bg-brand-500/10"
          onClick={() => onConfirm(match.id, true)} data-testid={`confirm-yes-${match.id}`}>
          <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Confirm
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:bg-red-500/10"
          onClick={() => onConfirm(match.id, false)} data-testid={`confirm-no-${match.id}`}>
          <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Dispute
        </Button>
      </div>
    </div>
  );
}

export default function MatchmakingPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [mercenaries, setMercenaries] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [formType, setFormType] = useState("match");
  const [paying, setPaying] = useState(null);
  const [autoMatchResult, setAutoMatchResult] = useState(null);
  const [autoMatching, setAutoMatching] = useState(false);
  const [form, setForm] = useState({
    sport: "football", date: "", time: "18:00", venue_name: "",
    players_needed: 10, min_skill: 0, max_skill: 3000, description: "",
    booking_id: "", position_needed: "", amount_per_player: 200, spots_available: 1,
  });

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      matchAPI.list().catch(() => ({ data: [] })),
      matchAPI.recommended().catch(() => ({ data: [] })),
      mercenaryAPI.list().catch(() => ({ data: [] })),
      mercenaryAPI.myPosts().catch(() => ({ data: [] })),
      bookingAPI.list().catch(() => ({ data: [] })),
    ]).then(([m, rec, mer, mp, bk]) => {
      setMatches(m.data || []);
      setRecommended(rec.data || []);
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

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const res = await matchAPI.autoMatch({ sport: form.sport });
      setAutoMatchResult(res.data);
      if (res.data.found) toast.success(`Found a ${res.data.match.compatibility_score}% compatible match!`);
      else toast.info(res.data.message);
    } catch { toast.error("Auto-match failed"); }
    finally { setAutoMatching(false); }
  };

  const handleSubmitResult = async (matchId, data) => {
    try {
      const res = await matchAPI.submitResult(matchId, data);
      toast.success(res.data.message);
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to submit result"); }
  };

  const handleConfirmResult = async (matchId, confirmed) => {
    try {
      const res = await matchAPI.confirmResult(matchId, { confirmed });
      toast.success(res.data.message);
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleApply = async (id) => {
    try { await mercenaryAPI.apply(id); toast.success("Applied! Host will review."); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to apply"); }
  };
  const handleAccept = async (postId, applicantId) => {
    try { await mercenaryAPI.accept(postId, applicantId); toast.success("Lobbian accepted!"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleReject = async (postId, applicantId) => {
    try { await mercenaryAPI.reject(postId, applicantId); toast.success("Applicant removed"); loadData(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) { resolve(true); return; }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handlePay = async (postId) => {
    setPaying(postId);
    try {
      const res = await mercenaryAPI.pay(postId);
      const result = res.data;
      if (result.payment_gateway === "razorpay" && result.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); setPaying(null); return; }
        const options = {
          key: result.razorpay_key_id, amount: result.amount * 100, currency: "INR",
          order_id: result.razorpay_order_id, name: "Horizon Sports", description: "Mercenary Fee",
          handler: async (response) => {
            try {
              await mercenaryAPI.verifyPayment(postId, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment confirmed!"); loadData();
            } catch { toast.error("Payment verification failed"); }
            setPaying(null);
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); setPaying(null); } },
          theme: { color: "#7C3AED" }
        };
        new window.Razorpay(options).open();
        return;
      }
      toast.success("Payment confirmed!"); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Payment failed"); }
    finally { setPaying(null); }
  };

  const handleCreate = async () => {
    try {
      if (formType === "match") {
        await matchAPI.create({
          sport: form.sport, date: form.date, time: form.time,
          venue_name: form.venue_name, players_needed: Number(form.players_needed),
          min_skill: Number(form.min_skill), max_skill: Number(form.max_skill), description: form.description,
        });
        toast.success("Match created!");
      } else {
        if (!form.booking_id) { toast.error("Select a booking"); return; }
        await mercenaryAPI.create({
          booking_id: form.booking_id, position_needed: form.position_needed,
          amount_per_player: Number(form.amount_per_player), spots_available: Number(form.spots_available),
          description: form.description,
        });
        toast.success("Mercenary post created!");
      }
      setCreateOpen(false); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Creation failed"); }
  };

  const allMercenaryPosts = [...myPosts.filter(p => !mercenaries.some(m => m.id === p.id)), ...mercenaries];

  // Merge all matches + completed for result viewing
  const [allMatches, setAllMatches] = useState([]);
  useEffect(() => {
    matchAPI.list({ status: "filled" }).then(res => {
      const filled = res.data || [];
      matchAPI.list({ status: "pending_result" }).then(res2 => {
        const pending = res2.data || [];
        matchAPI.list({ status: "completed" }).then(res3 => {
          const completed = res3.data || [];
          setAllMatches([...matches, ...filled, ...pending, ...completed].filter(
            (m, i, arr) => arr.findIndex(x => x.id === m.id) === i
          ));
        }).catch(() => setAllMatches(matches));
      }).catch(() => setAllMatches(matches));
    }).catch(() => setAllMatches(matches));
  }, [matches]);

  // My matches = matches I'm part of that need result/confirmation
  const myActiveMatches = allMatches.filter(m =>
    m.players_joined?.includes(user?.id) &&
    (m.status === "filled" || m.status === "pending_result" || m.status === "completed")
  );

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
                  <div><Label className="text-xs text-muted-foreground">Date (YYYY-MM-DD)</Label>
                    <Input value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      placeholder="2026-02-20" className="mt-1 bg-background border-border text-sm" data-testid="create-date-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Venue Name</Label>
                    <Input value={form.venue_name} onChange={e => setForm(p => ({ ...p, venue_name: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-venue-input" /></div>
                  <div><Label className="text-xs text-muted-foreground">Lobbians Needed</Label>
                    <Input type="number" value={form.players_needed} onChange={e => setForm(p => ({ ...p, players_needed: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-players-input" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Min Skill</Label>
                      <Input type="number" value={form.min_skill} onChange={e => setForm(p => ({ ...p, min_skill: e.target.value }))}
                        className="mt-1 bg-background border-border text-sm" data-testid="create-min-skill" /></div>
                    <div><Label className="text-xs text-muted-foreground">Max Skill</Label>
                      <Input type="number" value={form.max_skill} onChange={e => setForm(p => ({ ...p, max_skill: e.target.value }))}
                        className="mt-1 bg-background border-border text-sm" data-testid="create-max-skill" /></div>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Description</Label>
                    <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      className="mt-1 bg-background border-border text-sm" data-testid="create-description-input" /></div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Select Your Booking</Label>
                    {myBookings.length === 0 ? (
                      <p className="text-xs text-amber-400 mt-1">You need a confirmed booking first.</p>
                    ) : (
                      <Select value={form.booking_id} onValueChange={v => setForm(p => ({ ...p, booking_id: v }))}>
                        <SelectTrigger className="mt-1 bg-background border-border text-sm" data-testid="select-booking"><SelectValue placeholder="Choose a booking..." /></SelectTrigger>
                        <SelectContent>{myBookings.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.venue_name} — {b.date} at {b.start_time} ({b.sport})</SelectItem>
                        ))}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Position Needed</Label>
                    <Input value={form.position_needed} onChange={e => setForm(p => ({ ...p, position_needed: e.target.value }))}
                      placeholder="Goalkeeper, Defender..." className="mt-1 bg-background border-border text-sm" data-testid="create-position-input" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Fee Per Lobbian</Label>
                      <Input type="number" value={form.amount_per_player} onChange={e => setForm(p => ({ ...p, amount_per_player: e.target.value }))}
                        className="mt-1 bg-background border-border text-sm" data-testid="create-amount-input" /></div>
                    <div><Label className="text-xs text-muted-foreground">Spots Available</Label>
                      <Input type="number" min={1} max={20} value={form.spots_available} onChange={e => setForm(p => ({ ...p, spots_available: e.target.value }))}
                        className="mt-1 bg-background border-border text-sm" data-testid="create-spots-input" /></div>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Description (optional)</Label>
                    <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Details..." className="mt-1 bg-background border-border text-sm" data-testid="create-merc-description" /></div>
                </>
              )}
              <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleCreate} data-testid="submit-create-btn">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="recommended" data-testid="matchmaking-tabs">
        <TabsList className="bg-secondary/50 mb-6 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="recommended" className="font-bold gap-1 text-xs" data-testid="tab-recommended"><Sparkles className="h-3.5 w-3.5" /> For You</TabsTrigger>
          <TabsTrigger value="matches" className="font-bold gap-1 text-xs" data-testid="tab-matches"><Swords className="h-3.5 w-3.5" /> All Games</TabsTrigger>
          <TabsTrigger value="my-matches" className="font-bold gap-1 text-xs" data-testid="tab-my-matches"><Trophy className="h-3.5 w-3.5" /> My Games</TabsTrigger>
          <TabsTrigger value="mercenary" className="font-bold gap-1 text-xs" data-testid="tab-mercenary"><Users className="h-3.5 w-3.5" /> Mercenary</TabsTrigger>
        </TabsList>

        {/* Recommended Tab */}
        <TabsContent value="recommended">
          <div className="mb-4 glass-card rounded-lg p-4" data-testid="auto-match-section">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> Auto-Match</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Find the best game for your skill level</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={form.sport} onValueChange={v => setForm(p => ({ ...p, sport: v }))}>
                  <SelectTrigger className="w-[120px] bg-background border-border text-xs h-8" data-testid="auto-match-sport">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["football", "cricket", "badminton", "tennis", "basketball"].map(s => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAutoMatch} disabled={autoMatching}
                  className="bg-primary text-primary-foreground font-bold text-xs h-8" data-testid="auto-match-btn">
                  {autoMatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                  Find
                </Button>
              </div>
            </div>
            {autoMatchResult && (
              <div className="mt-3 pt-3 border-t border-border">
                {autoMatchResult.found ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CompatBadge score={autoMatchResult.match.compatibility_score} />
                      <span className="text-xs text-muted-foreground">Best match found!</span>
                    </div>
                    <MatchCard match={autoMatchResult.match} onJoin={handleJoin} userId={user?.id} showCompat />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{autoMatchResult.message}</p>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : recommended.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground" /><p className="text-sm">No recommended matches</p>
              <p className="text-xs mt-1">Create one or check back later!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Recommended for you</h3>
              {recommended.map(m => <MatchCard key={m.id} match={m} onJoin={handleJoin} userId={user?.id} showCompat />)}
            </div>
          )}
        </TabsContent>

        {/* All Games Tab */}
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

        {/* My Games Tab (Results & Confirmations) */}
        <TabsContent value="my-matches">
          {myActiveMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">No active games to report results for</p>
              <p className="text-xs mt-1">Join a match and play to submit results!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Your Games — Report & Confirm Results</h3>
              {myActiveMatches.map(m => (
                <div key={m.id}>
                  <MatchCard match={m} onJoin={handleJoin} userId={user?.id} />
                  <div className="mt-2 flex gap-2 justify-end">
                    <ResultDialog match={m} onSubmit={handleSubmitResult} userId={user?.id} />
                  </div>
                  <ConfirmResultBar match={m} userId={user?.id} onConfirm={handleConfirmResult} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Mercenary Tab */}
        <TabsContent value="mercenary">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : allMercenaryPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3" /><p className="text-sm">No mercenary posts yet</p>
              <p className="text-xs mt-1">Book a slot and create a post to find Lobbians!</p>
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
      </Tabs>
    </div>
  );
}
