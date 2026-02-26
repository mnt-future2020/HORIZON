import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { tournamentAPI, liveAPI } from "@/lib/api";
import { useLiveScore } from "@/hooks/useLiveScore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Trophy, Users, Calendar, MapPin, ArrowLeft, Play,
  Swords, Target, Medal, Crown, UserPlus, UserMinus,
  ChevronRight, Award, Hash, CheckCircle,
  Radio, Plus, Minus, Pause, Square, Eye, Clock
} from "lucide-react";
const PlayIcon = Play;

const STATUS_COLORS = {
  registration: "bg-brand-500/15 text-brand-400 border-brand-500/30",
  in_progress: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  completed: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};
const STATUS_LABELS = {
  registration: "Registration Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bracket");
  const [resultDialog, setResultDialog] = useState(null);
  const [resultForm, setResultForm] = useState({ winner: "", score_a: "", score_b: "" });
  const [submitting, setSubmitting] = useState(false);
  const [nameMap, setNameMap] = useState({});
  const [liveMatches, setLiveMatches] = useState([]);
  const [activeLiveId, setActiveLiveId] = useState(null);
  const [startingLive, setStartingLive] = useState(false);
  const [eventForm, setEventForm] = useState({ type: "goal", team: "home", player_name: "", minute: 0, description: "" });
  const [showEventDialog, setShowEventDialog] = useState(false);

  const loadTournament = useCallback(async () => {
    try {
      const res = await tournamentAPI.get(tournamentId);
      setTournament(res.data);
      // Build name lookup
      const map = {};
      (res.data.participants || []).forEach(p => { map[p.user_id] = p.name; });
      setNameMap(map);
      // Auto-select tab based on format
      if (res.data.format === "round_robin" || res.data.format === "league") {
        setActiveTab("standings");
      }
    } catch {
      toast.error("Tournament not found");
      navigate("/tournaments");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, navigate]);

  useEffect(() => { loadTournament(); }, [loadTournament]);

  const loadLiveMatches = useCallback(async () => {
    try {
      const res = await liveAPI.getActive();
      const forThis = (res.data || []).filter(m => m.tournament_id === tournamentId);
      setLiveMatches(forThis);
      if (forThis.length > 0 && !activeLiveId) {
        setActiveLiveId(forThis[0].id);
      }
    } catch {}
  }, [tournamentId, activeLiveId]);

  useEffect(() => {
    if (tournament?.status === "in_progress") {
      loadLiveMatches();
      const interval = setInterval(loadLiveMatches, 10000);
      return () => clearInterval(interval);
    }
  }, [tournament?.status, loadLiveMatches]);

  if (loading || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOrganizer = user?.id === tournament.organizer_id || user?.role === "super_admin";
  const isRegistered = tournament.participants?.some(p => p.user_id === user?.id);
  const participants = tournament.participants || [];
  const matches = tournament.matches || [];
  const standings = tournament.standings || [];

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

  const handleRegister = async () => {
    try {
      const res = await tournamentAPI.register(tournamentId);
      const data = res.data;

      // Payment required for paid tournaments
      if (data.payment_gateway === "razorpay" && data.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); return; }
        const options = {
          key: data.razorpay_key_id,
          amount: data.entry_fee * 100,
          currency: "INR",
          order_id: data.razorpay_order_id,
          name: tournament.name || "Tournament Entry",
          description: `Entry fee for ${tournament.name}`,
          handler: async (response) => {
            try {
              await tournamentAPI.verifyEntryPayment(tournamentId, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment successful! You're registered.");
              loadTournament();
            } catch { toast.error("Payment verification failed"); }
          },
          modal: { ondismiss: () => toast.info("Payment cancelled. Registration pending.") },
          theme: { color: "#6366f1" },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else if (data.payment_gateway === "test") {
        // Test mode — auto-confirm
        try {
          await tournamentAPI.testConfirmEntry(tournamentId);
          toast.success("Registered & entry confirmed! (Test mode)");
          loadTournament();
        } catch { toast.error("Failed to confirm entry"); }
      } else {
        toast.success("Registered!");
        loadTournament();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleWithdraw = async () => {
    try {
      await tournamentAPI.withdraw(tournamentId);
      toast.success("Withdrawn from tournament");
      loadTournament();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const handleStart = async () => {
    if (participants.length < 2) return toast.error("Need at least 2 participants");
    try {
      await tournamentAPI.start(tournamentId);
      toast.success("Tournament started!");
      loadTournament();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start");
    }
  };

  const openResultDialog = (match) => {
    setResultForm({ winner: "", score_a: "", score_b: "" });
    setResultDialog(match);
  };

  const handleSubmitResult = async () => {
    if (!resultForm.winner) return toast.error("Select a winner");
    setSubmitting(true);
    try {
      await tournamentAPI.submitResult(tournamentId, resultDialog.id, {
        winner: resultForm.winner,
        score_a: resultForm.score_a ? parseInt(resultForm.score_a, 10) : null,
        score_b: resultForm.score_b ? parseInt(resultForm.score_b, 10) : null,
      });
      toast.success("Result submitted!");
      setResultDialog(null);
      loadTournament();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this tournament?")) return;
    try {
      await tournamentAPI.cancel(tournamentId);
      toast.success("Tournament cancelled");
      navigate("/tournaments");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  // Group matches by round for bracket view
  const roundsMap = {};
  matches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });
  const totalRounds = Object.keys(roundsMap).length;
  const roundLabels = (round) => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semi-Final";
    if (round === totalRounds - 2) return "Quarter-Final";
    return `Round ${round}`;
  };

  const TABS = tournament.format === "knockout"
    ? [
        { id: "bracket", label: "Bracket", icon: Swords },
        { id: "participants", label: "Lobbians", icon: Users },
        { id: "info", label: "Info", icon: Trophy },
      ]
    : [
        { id: "standings", label: "Standings", icon: Medal },
        { id: "matches", label: "Matches", icon: Swords },
        { id: "participants", label: "Lobbians", icon: Users },
        { id: "info", label: "Info", icon: Trophy },
      ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-8" data-testid="tournament-detail">
      {/* Back */}
      <button onClick={() => navigate("/tournaments")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Tournaments
      </button>

      {/* Header Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={`text-xs font-bold border ${STATUS_COLORS[tournament.status] || ""}`}>
                {STATUS_LABELS[tournament.status] || tournament.status}
              </Badge>
              <Badge variant="secondary" className="text-xs capitalize">{tournament.sport?.replace("_", " ")}</Badge>
              <Badge variant="secondary" className="text-xs capitalize">{tournament.format?.replace("_", " ")}</Badge>
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-sm text-muted-foreground mt-1">{tournament.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {participants.length}/{tournament.max_participants} Lobbians
              </span>
              {tournament.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(tournament.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {tournament.end_date && ` - ${new Date(tournament.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                </span>
              )}
              {tournament.venue_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{tournament.venue_name}
                </span>
              )}
              {tournament.entry_fee > 0 && (
                <span className="font-bold text-primary">Entry: ₹{tournament.entry_fee}</span>
              )}
              {tournament.prize_pool && (
                <span className="flex items-center gap-1 font-bold text-amber-400">
                  <Award className="h-3.5 w-3.5" />{tournament.prize_pool}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {tournament.status === "registration" && !isRegistered && !isOrganizer && (
              <Button onClick={handleRegister} className="bg-primary text-primary-foreground font-bold text-xs h-9"
                data-testid="detail-register-btn">
                <UserPlus className="h-4 w-4 mr-1" /> {tournament.entry_fee > 0 ? `Pay ₹${tournament.entry_fee} & Register` : "Register"}
              </Button>
            )}
            {tournament.status === "registration" && isRegistered && (
              <Button variant="outline" onClick={handleWithdraw} className="text-xs h-9"
                data-testid="detail-withdraw-btn">
                <UserMinus className="h-4 w-4 mr-1" /> Withdraw
              </Button>
            )}
            {isOrganizer && tournament.status === "registration" && (
              <Button onClick={handleStart} className="bg-brand-600 text-white font-bold text-xs h-9"
                data-testid="start-tournament-btn">
                <Play className="h-4 w-4 mr-1" /> Start Tournament
              </Button>
            )}
            {isOrganizer && tournament.status !== "completed" && tournament.status !== "cancelled" && (
              <Button variant="outline" onClick={handleCancel}
                className="text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-secondary/30 p-1 rounded-lg w-fit">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
        {tournament.status === "in_progress" && (
          <button
            onClick={() => setActiveTab("live")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "live"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Live
          </button>
        )}
      </div>

      {/* ─── Knockout Bracket View ─── */}
      {activeTab === "bracket" && tournament.format === "knockout" && (
        <div className="space-y-4">
          {tournament.status === "registration" ? (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">Bracket will be generated when tournament starts</p>
              <p className="text-xs mt-1">{participants.length} Lobbians registered so far</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max">
                {Object.entries(roundsMap)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([round, roundMatches]) => (
                    <div key={round} className="flex flex-col gap-3 min-w-[240px]">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground text-center mb-1">
                        {roundLabels(parseInt(round))}
                      </h3>
                      {roundMatches.sort((a, b) => a.match_number - b.match_number).map(match => (
                        <MatchCard key={match.id} match={match} nameMap={nameMap}
                          isOrganizer={isOrganizer} onSubmitResult={openResultDialog} />
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Standings Table (Round Robin / League) ─── */}
      {activeTab === "standings" && (
        <div className="space-y-3">
          {standings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Medal className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">
                {tournament.status === "registration" ? "Standings appear after tournament starts" : "No standings yet"}
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3 font-mono uppercase">#</th>
                    <th className="text-left p-3 font-mono uppercase">Lobbian</th>
                    <th className="text-center p-3 font-mono uppercase">P</th>
                    <th className="text-center p-3 font-mono uppercase">W</th>
                    <th className="text-center p-3 font-mono uppercase">D</th>
                    <th className="text-center p-3 font-mono uppercase">L</th>
                    <th className="text-center p-3 font-mono uppercase">GF</th>
                    <th className="text-center p-3 font-mono uppercase">GA</th>
                    <th className="text-center p-3 font-mono uppercase">GD</th>
                    <th className="text-center p-3 font-mono uppercase font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, idx) => (
                    <tr key={s.user_id}
                      className={`border-b border-border/50 ${idx === 0 ? "bg-primary/5" : ""}`}>
                      <td className="p-3 font-bold">
                        {idx === 0 && tournament.status === "completed" ? (
                          <Crown className="h-4 w-4 text-amber-400 inline" />
                        ) : idx + 1}
                      </td>
                      <td className="p-3 font-bold">{s.name}</td>
                      <td className="p-3 text-center">{s.played}</td>
                      <td className="p-3 text-center text-brand-400">{s.won}</td>
                      <td className="p-3 text-center text-muted-foreground">{s.drawn}</td>
                      <td className="p-3 text-center text-destructive">{s.lost}</td>
                      <td className="p-3 text-center">{s.goals_for}</td>
                      <td className="p-3 text-center">{s.goals_against}</td>
                      <td className="p-3 text-center font-medium">{s.goals_for - s.goals_against}</td>
                      <td className="p-3 text-center font-display font-black text-primary text-lg">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Matches List (for round-robin/league) ─── */}
      {activeTab === "matches" && (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">Matches appear after tournament starts</p>
            </div>
          ) : (
            matches.sort((a, b) => a.match_number - b.match_number).map(match => (
              <MatchCard key={match.id} match={match} nameMap={nameMap}
                isOrganizer={isOrganizer} onSubmitResult={openResultDialog} horizontal />
            ))
          )}
        </div>
      )}

      {/* ─── Participants ─── */}
      {activeTab === "participants" && (
        <div className="space-y-2">
          {participants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm">No participants yet</p>
            </div>
          ) : (
            participants.map((p, idx) => (
              <motion.div key={p.user_id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glass-card rounded-lg p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Rating: {p.rating || 1500} · Joined {new Date(p.registered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                {tournament.entry_fee > 0 && p.payment_status && (
                  <Badge className={p.payment_status === "paid" ? "bg-brand-500/15 text-brand-400 text-[10px]" : "bg-amber-500/15 text-amber-400 text-[10px]"}>
                    {p.payment_status === "paid" ? <><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Paid</> : <><Clock className="h-2.5 w-2.5 mr-0.5" /> Pending</>}
                  </Badge>
                )}
                {p.user_id === tournament.organizer_id && (
                  <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">
                    <Crown className="h-2.5 w-2.5 mr-0.5" /> Organizer
                  </Badge>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ─── Info Tab ─── */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-sm">Tournament Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Organizer</span>
                <span className="font-bold">{tournament.organizer_name}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Format</span>
                <span className="font-bold capitalize">{tournament.format?.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Sport</span>
                <span className="font-bold capitalize">{tournament.sport?.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Max Lobbians</span>
                <span className="font-bold">{tournament.max_participants}</span>
              </div>
              {tournament.entry_fee > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground block">Entry Fee</span>
                  <span className="font-bold text-primary">₹{tournament.entry_fee}</span>
                </div>
              )}
              {tournament.prize_pool && (
                <div>
                  <span className="text-xs text-muted-foreground block">Prize Pool</span>
                  <span className="font-bold text-amber-400">{tournament.prize_pool}</span>
                </div>
              )}
              {tournament.registration_deadline && (
                <div>
                  <span className="text-xs text-muted-foreground block">Reg Deadline</span>
                  <span className="font-bold">{new Date(tournament.registration_deadline).toLocaleDateString("en-IN")}</span>
                </div>
              )}
            </div>
            {tournament.rules && (
              <div className="border-t border-border pt-3 mt-3">
                <span className="text-xs text-muted-foreground block mb-1">Rules</span>
                <p className="text-sm whitespace-pre-wrap">{tournament.rules}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Live Tab ─── */}
      {activeTab === "live" && <LiveTabContent
        tournament={tournament}
        liveMatches={liveMatches}
        activeLiveId={activeLiveId}
        setActiveLiveId={setActiveLiveId}
        isOrganizer={isOrganizer}
        matches={matches}
        nameMap={nameMap}
        loadLiveMatches={loadLiveMatches}
        startingLive={startingLive}
        setStartingLive={setStartingLive}
        eventForm={eventForm}
        setEventForm={setEventForm}
        showEventDialog={showEventDialog}
        setShowEventDialog={setShowEventDialog}
        loadTournament={loadTournament}
      />}

      {/* ─── Result Submission Dialog ─── */}
      <Dialog open={!!resultDialog} onOpenChange={() => setResultDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-brand-400" /> Submit Result
            </DialogTitle>
          </DialogHeader>
          {resultDialog && (
            <div className="space-y-4 pt-2">
              <div className="text-center text-sm text-muted-foreground mb-2">
                Match #{resultDialog.match_number}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {nameMap[resultDialog.player_a] || "TBD"} Score
                  </Label>
                  <Input type="number" value={resultForm.score_a}
                    onChange={e => setResultForm(p => ({ ...p, score_a: e.target.value }))}
                    className="mt-1 bg-background border-border text-center text-lg font-bold" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {nameMap[resultDialog.player_b] || "TBD"} Score
                  </Label>
                  <Input type="number" value={resultForm.score_b}
                    onChange={e => setResultForm(p => ({ ...p, score_b: e.target.value }))}
                    className="mt-1 bg-background border-border text-center text-lg font-bold" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Winner</Label>
                <div className="space-y-2">
                  {resultDialog.player_a && (
                    <button onClick={() => setResultForm(p => ({ ...p, winner: resultDialog.player_a }))}
                      className={`w-full p-2.5 rounded-lg border text-sm font-bold text-left transition-all ${resultForm.winner === resultDialog.player_a ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50"}`}>
                      {nameMap[resultDialog.player_a] || "Lobbian A"}
                    </button>
                  )}
                  {resultDialog.player_b && (
                    <button onClick={() => setResultForm(p => ({ ...p, winner: resultDialog.player_b }))}
                      className={`w-full p-2.5 rounded-lg border text-sm font-bold text-left transition-all ${resultForm.winner === resultDialog.player_b ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50"}`}>
                      {nameMap[resultDialog.player_b] || "Lobbian B"}
                    </button>
                  )}
                  {tournament.format !== "knockout" && (
                    <button onClick={() => setResultForm(p => ({ ...p, winner: "draw" }))}
                      className={`w-full p-2.5 rounded-lg border text-sm font-bold text-left transition-all ${resultForm.winner === "draw" ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-border text-muted-foreground hover:border-amber-500/50"}`}>
                      Draw
                    </button>
                  )}
                </div>
              </div>
              <Button className="w-full bg-primary text-primary-foreground font-bold h-10"
                onClick={handleSubmitResult} disabled={submitting} data-testid="submit-result-btn">
                {submitting ? "Submitting..." : "Submit Result"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Live Tab Content Component ──────────────────────────────────────────────

function LiveTabContent({ tournament, liveMatches, activeLiveId, setActiveLiveId, isOrganizer, matches, nameMap, loadLiveMatches, startingLive, setStartingLive, eventForm, setEventForm, showEventDialog, setShowEventDialog, loadTournament }) {
  const { matchData, events, connected, spectatorCount } = useLiveScore(activeLiveId);
  const activeLive = liveMatches.find(m => m.id === activeLiveId);

  const handleStartLive = async (matchId) => {
    setStartingLive(true);
    try {
      const res = await liveAPI.start({ tournament_id: tournament.id, match_id: matchId });
      setActiveLiveId(res.data.id);
      await loadLiveMatches();
      toast.success("Live scoring started!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to start live scoring");
    } finally {
      setStartingLive(false);
    }
  };

  const handleScore = async (team, delta) => {
    if (!activeLiveId) return;
    try {
      await liveAPI.updateScore(activeLiveId, { team, delta });
    } catch (e) {
      toast.error("Failed to update score");
    }
  };

  const handleAddEvent = async () => {
    if (!activeLiveId) return;
    try {
      await liveAPI.addEvent(activeLiveId, eventForm);
      setShowEventDialog(false);
      setEventForm({ type: "goal", team: "home", player_name: "", minute: 0, description: "" });
      toast.success("Event added!");
    } catch (e) {
      toast.error("Failed to add event");
    }
  };

  const handlePause = async () => {
    if (!activeLiveId) return;
    try {
      await liveAPI.pause(activeLiveId);
    } catch (e) {
      toast.error("Failed to pause/resume");
    }
  };

  const handleEndMatch = async () => {
    if (!activeLiveId || !window.confirm("End this match? Final scores will be submitted to the tournament.")) return;
    try {
      await liveAPI.end(activeLiveId);
      toast.success("Match ended! Scores synced to tournament.");
      setActiveLiveId(null);
      await loadLiveMatches();
      await loadTournament();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to end match");
    }
  };

  const handlePeriod = async (period, label) => {
    if (!activeLiveId) return;
    try {
      await liveAPI.changePeriod(activeLiveId, { period, period_label: label });
    } catch {
      toast.error("Failed to change period");
    }
  };

  const EVENT_TYPES = [
    { value: "goal", label: "Goal", icon: "\u26bd" },
    { value: "card", label: "Card", icon: "\ud83d\udfe8" },
    { value: "foul", label: "Foul", icon: "\u274c" },
    { value: "point", label: "Point", icon: "\ud83c\udfaf" },
    { value: "ace", label: "Ace", icon: "\ud83c\udff8" },
    { value: "timeout", label: "Timeout", icon: "\u23f8\ufe0f" },
    { value: "substitution", label: "Sub", icon: "\ud83d\udd04" },
  ];

  // Pending matches that can go live
  const pendingMatches = matches.filter(
    m => m.status === "pending" && m.player_a && m.player_b && !liveMatches.some(lm => lm.match_id === m.id)
  );

  const displayData = matchData || activeLive;
  const displayEvents = matchData ? events : (activeLive?.events || []);

  return (
    <div className="space-y-6">
      {/* Active Live Matches */}
      {liveMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Live Matches</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveMatches.map(lm => (
              <button
                key={lm.id}
                onClick={() => setActiveLiveId(lm.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  activeLiveId === lm.id
                    ? "border-red-500/50 bg-red-500/10"
                    : "border-border bg-card hover:border-red-500/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{lm.match_label}</span>
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    LIVE
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{lm.home?.name}</span>
                  <span className="text-2xl font-bold text-primary">{lm.home?.score} — {lm.away?.score}</span>
                  <span className="font-medium">{lm.away?.name}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{lm.period_label}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {lm.spectator_count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scorecard */}
      {displayData && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border bg-red-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-sm font-semibold text-red-400">
                {displayData.status === "paused" ? "PAUSED" : "LIVE"}
              </span>
              <span className="text-xs text-muted-foreground ml-2">{displayData.period_label || displayData.match_label}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {connected && <span className="text-brand-400">{"\u25cf"} Connected</span>}
              <Eye className="w-3.5 h-3.5" />
              <span>{spectatorCount || displayData.spectator_count || 0}</span>
            </div>
          </div>

          {/* Score Display */}
          <div className="p-6">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center flex-1">
                <p className="text-sm text-muted-foreground mb-1">{displayData.home?.name || "Home"}</p>
                <div className="flex items-center justify-center gap-3">
                  {isOrganizer && displayData.status !== "completed" && (
                    <button onClick={() => handleScore("home", -1)} className="w-8 h-8 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 flex items-center justify-center transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                  <span className="text-5xl font-bold text-foreground tabular-nums">{displayData.home?.score ?? 0}</span>
                  {isOrganizer && displayData.status !== "completed" && (
                    <button onClick={() => handleScore("home", 1)} className="w-8 h-8 rounded-full bg-primary/20 text-primary hover:bg-primary/30 flex items-center justify-center transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-2xl font-light text-muted-foreground">vs</div>

              <div className="text-center flex-1">
                <p className="text-sm text-muted-foreground mb-1">{displayData.away?.name || "Away"}</p>
                <div className="flex items-center justify-center gap-3">
                  {isOrganizer && displayData.status !== "completed" && (
                    <button onClick={() => handleScore("away", -1)} className="w-8 h-8 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 flex items-center justify-center transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                  <span className="text-5xl font-bold text-foreground tabular-nums">{displayData.away?.score ?? 0}</span>
                  {isOrganizer && displayData.status !== "completed" && (
                    <button onClick={() => handleScore("away", 1)} className="w-8 h-8 rounded-full bg-primary/20 text-primary hover:bg-primary/30 flex items-center justify-center transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sets display (for set-based sports) */}
            {displayData.sets?.length > 0 && (
              <div className="flex justify-center gap-4 mt-4">
                {displayData.sets.map((s, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[10px] text-muted-foreground">Set {i + 1}</p>
                    <p className="text-sm font-medium">{s.home} - {s.away}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scorer Controls */}
          {isOrganizer && displayData.status !== "completed" && (
            <div className="p-4 border-t border-border space-y-3">
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(et => (
                  <button key={et.value} onClick={() => { setEventForm(f => ({ ...f, type: et.value })); setShowEventDialog(true); }}
                    className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors">
                    {et.icon} {et.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handlePause}
                  className="flex-1 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors flex items-center justify-center gap-2">
                  {displayData.status === "paused" ? <><PlayIcon className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
                </button>
                <button onClick={() => handlePeriod((displayData.period || 1) + 1, `Period ${(displayData.period || 1) + 1}`)}
                  className="flex-1 py-2 rounded-lg bg-sky-500/15 text-sky-400 text-sm font-medium hover:bg-sky-500/25 transition-colors flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> Next Period
                </button>
                <button onClick={handleEndMatch}
                  className="flex-1 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25 transition-colors flex items-center justify-center gap-2">
                  <Square className="w-4 h-4" /> End Match
                </button>
              </div>
            </div>
          )}

          {/* Event Timeline */}
          {displayEvents.length > 0 && (
            <div className="p-4 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Match Timeline</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...displayEvents].reverse().map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50 text-sm">
                    <span className="text-muted-foreground text-xs w-8 shrink-0">{ev.minute > 0 ? `${ev.minute}'` : ""}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${ev.team === "home" ? "bg-primary" : "bg-brand-500"}`} />
                    <span className="font-medium">{ev.player_name || ev.team}</span>
                    <span className="text-muted-foreground">{ev.description || ev.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event Dialog */}
      {showEventDialog && (
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Match Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Event Type</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {EVENT_TYPES.map(et => (
                    <button key={et.value} onClick={() => setEventForm(f => ({ ...f, type: et.value }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        eventForm.type === et.value ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary"
                      }`}>
                      {et.icon} {et.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Team</Label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setEventForm(f => ({ ...f, team: "home" }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${eventForm.team === "home" ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary"}`}>
                    {displayData?.home?.name || "Home"}
                  </button>
                  <button onClick={() => setEventForm(f => ({ ...f, team: "away" }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${eventForm.team === "away" ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "bg-secondary"}`}>
                    {displayData?.away?.name || "Away"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lobbian Name</Label>
                  <Input value={eventForm.player_name} onChange={e => setEventForm(f => ({ ...f, player_name: e.target.value }))} placeholder="Lobbian name" />
                </div>
                <div>
                  <Label>Minute</Label>
                  <Input type="number" value={eventForm.minute} onChange={e => setEventForm(f => ({ ...f, minute: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <Button onClick={handleAddEvent} className="w-full">Add Event</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Organizer: Start Live for Pending Matches */}
      {isOrganizer && pendingMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Start Live Scoring</h3>
          <div className="space-y-2">
            {pendingMatches.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                <div>
                  <p className="text-sm font-medium">{nameMap[m.player_a] || "TBD"} vs {nameMap[m.player_b] || "TBD"}</p>
                  <p className="text-xs text-muted-foreground">Round {m.round} — Match #{m.match_number}</p>
                </div>
                <Button size="sm" variant="outline" disabled={startingLive} onClick={() => handleStartLive(m.id)}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                  <Radio className="w-3.5 h-3.5 mr-1.5" /> Go Live
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No live matches */}
      {liveMatches.length === 0 && !isOrganizer && (
        <div className="text-center py-12">
          <Radio className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No live matches at the moment</p>
          <p className="text-xs text-muted-foreground mt-1">Check back when the organizer starts live scoring</p>
        </div>
      )}
    </div>
  );
}

// ─── Match Card Component ────────────────────────────────────────────────────

function MatchCard({ match, nameMap, isOrganizer, onSubmitResult, horizontal }) {
  const playerA = nameMap[match.player_a] || (match.player_a ? "Unknown" : "TBD");
  const playerB = nameMap[match.player_b] || (match.player_b ? "Unknown" : "TBD");
  const isBye = match.status === "bye";
  const isDone = match.status === "completed";
  const canSubmit = isOrganizer && match.status === "pending" && match.player_a && match.player_b;

  return (
    <div className={`glass-card rounded-lg p-3 ${horizontal ? "" : ""} ${isDone ? "border-primary/20" : ""}`}
      data-testid={`match-${match.id}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <Hash className="h-2.5 w-2.5" />{match.match_number}
        </span>
        {isDone && <CheckCircle className="h-3 w-3 text-brand-400" />}
        {isBye && <Badge className="text-[9px] bg-secondary text-muted-foreground">BYE</Badge>}
      </div>
      {/* Player A */}
      <div className={`flex items-center justify-between py-1.5 px-2 rounded-md mb-1 text-sm ${match.winner === match.player_a ? "bg-primary/10 font-bold" : ""}`}>
        <span className={`truncate ${!match.player_a ? "text-muted-foreground italic" : ""}`}>
          {playerA}
        </span>
        {isDone && match.score_a !== null && (
          <span className="font-display font-black text-base ml-2">{match.score_a}</span>
        )}
      </div>
      {/* vs divider */}
      <div className="text-[10px] text-center text-muted-foreground font-mono">vs</div>
      {/* Player B */}
      <div className={`flex items-center justify-between py-1.5 px-2 rounded-md mt-1 text-sm ${match.winner === match.player_b ? "bg-primary/10 font-bold" : ""}`}>
        <span className={`truncate ${!match.player_b ? "text-muted-foreground italic" : ""}`}>
          {playerB}
        </span>
        {isDone && match.score_b !== null && (
          <span className="font-display font-black text-base ml-2">{match.score_b}</span>
        )}
      </div>
      {/* Submit button for organizer */}
      {canSubmit && (
        <button onClick={() => onSubmitResult(match)}
          className="w-full mt-2 py-1.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
          data-testid={`result-btn-${match.id}`}>
          Enter Result
        </button>
      )}
    </div>
  );
}
