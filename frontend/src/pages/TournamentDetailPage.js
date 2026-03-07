import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

/* ─── URL param utils (zero re-renders, no useSearchParams) ──── */
function replaceParams(updates) {
  const url = new URL(window.location);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "" || value === false)
      url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}
function getInitParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
import { useAuth } from "@/contexts/AuthContext";
import { tournamentAPI, liveAPI } from "@/lib/api";
import { useLiveScore } from "@/hooks/useLiveScore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  Calendar,
  MapPin,
  ArrowLeft,
  Play,
  Swords,
  Target,
  Medal,
  Crown,
  UserPlus,
  UserMinus,
  ChevronRight,
  Award,
  Hash,
  CheckCircle,
  Radio,
  Plus,
  Minus,
  Pause,
  Square,
  Eye,
  Clock,
  X,
} from "lucide-react";
const PlayIcon = Play;

/* ─── Constants ─────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  registration: {
    label: "Open",
    cls: "bg-green-500/10 text-green-600 border border-green-500/20",
  },
  in_progress: {
    label: "Live",
    cls: "bg-red-500/10 text-red-500 border border-red-500/20",
  },
  completed: {
    label: "Completed",
    cls: "bg-secondary/50 text-muted-foreground border border-border/40",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-destructive/10 text-destructive border border-destructive/20",
  },
};
const FORMAT_ICONS = { knockout: Swords, round_robin: Target, league: Medal };

/* ─── Bottom Sheet wrapper ───────────────────────────────────────────── */
function AppSheet({ open, onClose, title, children }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="
          !fixed !bottom-0 !top-auto !translate-y-0 !translate-x-0 !left-0 !right-0
          w-full max-w-full rounded-t-[24px] rounded-b-none bg-card p-0 shadow-2xl border-border/40
          max-h-[92vh] overflow-y-auto
          sm:!top-[50%] sm:!bottom-auto sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]
          sm:!w-full sm:!max-w-[480px] sm:!rounded-[24px]
        "
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <DialogTitle className="text-base font-bold text-foreground">
            {title}
          </DialogTitle>
          <button
            onClick={() => onClose(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">{children}</div>
        <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, _setActiveTab] = useState(() => getInitParam("tab") || "bracket");
  const setActiveTab = useCallback((tab) => {
    _setActiveTab(tab);
    replaceParams({ tab: tab === "bracket" ? null : tab });
  }, []);

  // Dialogs
  const [resultDialog, setResultDialog] = useState(null);
  const [resultForm, setResultForm] = useState({
    winner: "",
    score_a: "",
    score_b: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [nameMap, setNameMap] = useState({});
  const [liveMatches, setLiveMatches] = useState([]);
  const [activeLiveId, setActiveLiveId] = useState(null);
  const [startingLive, setStartingLive] = useState(false);
  const [eventForm, setEventForm] = useState({
    type: "goal",
    team: "home",
    player_name: "",
    minute: 0,
    description: "",
  });
  const [showEventDialog, setShowEventDialog] = useState(false);

  const loadTournament = useCallback(async () => {
    try {
      const res = await tournamentAPI.get(tournamentId);
      setTournament(res.data);
      const map = {};
      (res.data.participants || []).forEach((p) => {
        map[p.user_id] = p.name;
      });
      setNameMap(map);
      // Default to standings for round_robin/league — but only if no tab in URL
      if ((res.data.format === "round_robin" || res.data.format === "league") && !getInitParam("tab")) {
        setActiveTab("standings");
      }
    } catch {
      toast.error("Tournament not found");
      navigate("/tournaments");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, navigate, setActiveTab]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  const loadLiveMatches = useCallback(async () => {
    try {
      const res = await liveAPI.getActive();
      const forThis = (res.data || []).filter(
        (m) => m.tournament_id === tournamentId,
      );
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
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOrganizer =
    user?.id === tournament.organizer_id || user?.role === "super_admin";
  const isRegistered = tournament.participants?.some(
    (p) => p.user_id === user?.id,
  );
  const participants = tournament.participants || [];
  const matches = tournament.matches || [];
  const standings = tournament.standings || [];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById("razorpay-script")) {
        resolve(true);
        return;
      }
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

      if (data.payment_gateway === "razorpay" && data.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) return toast.error("Payment gateway failed to load");
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
            } catch {
              toast.error("Payment verification failed");
            }
          },
          modal: {
            ondismiss: () =>
              toast.info("Payment cancelled. Registration pending."),
          },
          theme: { color: "#6366f1" },
        };
        new window.Razorpay(options).open();
      } else if (data.payment_gateway === "test") {
        try {
          await tournamentAPI.testConfirmEntry(tournamentId);
          toast.success("Registered & entry confirmed! (Test mode)");
          loadTournament();
        } catch {
          toast.error("Failed to confirm entry");
        }
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
    if (participants.length < 2)
      return toast.error("Need at least 2 participants");
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
    if (!window.confirm("Are you sure you want to cancel this tournament?"))
      return;
    try {
      await tournamentAPI.cancel(tournamentId);
      toast.success("Tournament cancelled");
      navigate("/tournaments");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const roundsMap = {};
  matches.forEach((m) => {
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

  const TABS =
    tournament.format === "knockout"
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

  const statusCfg = STATUS_CONFIG[tournament.status] || STATUS_CONFIG.completed;
  const FormatIcon = FORMAT_ICONS[tournament.format] || Swords;

  return (
    <div
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-8 pb-24 md:pb-8"
      data-testid="tournament-detail"
    >
      {/* Back */}
      <button
        onClick={() => navigate("/tournaments")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors p-2 -ml-2 rounded-lg hover:bg-secondary/50 font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Tournaments
      </button>

      {/* Hero Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[24px] bg-card border border-border/40 shadow-sm p-5 sm:p-6 mb-6"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}
              >
                {tournament.status === "in_progress" && (
                  <Radio className="w-2.5 h-2.5 inline mr-0.5" />
                )}
                {statusCfg.label}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground capitalize flex items-center gap-1 border border-border/40">
                <FormatIcon className="w-2.5 h-2.5" />
                {tournament.format?.replace("_", " ")}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground capitalize border border-border/40">
                {tournament.sport?.replace("_", " ")}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-snug">
              {tournament.name}
            </h1>
            {tournament.description && (
              <p className="text-sm text-muted-foreground mt-1.5">
                {tournament.description}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {participants.length}/{tournament.max_participants} Lobbians
              </span>
              {tournament.start_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(tournament.start_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              {tournament.venue_name && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {tournament.venue_name}
                </span>
              )}
              {tournament.entry_fee > 0 ? (
                <span className="font-bold text-brand-600">
                  ₹{tournament.entry_fee} Entry
                </span>
              ) : (
                <span className="font-bold text-green-600">Free Entry</span>
              )}
            </div>

            {/* Prize pool banner */}
            {tournament.prize_pool && (
              <div className="mt-4 py-2.5 px-3.5 bg-amber-500/10 rounded-xl flex items-center gap-2.5 text-xs text-amber-600 font-bold border border-amber-500/20 w-fit">
                <Trophy className="w-4 h-4 shrink-0" />
                <span>{tournament.prize_pool}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0 md:w-48">
            {tournament.status === "registration" &&
              !isRegistered &&
              !isOrganizer && (
                <button
                  onClick={handleRegister}
                  data-testid="detail-register-btn"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  {tournament.entry_fee > 0
                    ? `Pay ₹${tournament.entry_fee} & Join`
                    : "Join Tournament"}
                </button>
              )}
            {tournament.status === "registration" && isRegistered && (
              <button
                onClick={handleWithdraw}
                disabled={tournament.status !== "registration"}
                data-testid="detail-withdraw-btn"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border/40 text-muted-foreground text-sm font-bold hover:text-foreground hover:bg-secondary/50 active:scale-[0.98] transition-all"
              >
                <UserMinus className="w-4 h-4" /> Withdraw
              </button>
            )}
            {isOrganizer && tournament.status === "registration" && (
              <button
                onClick={handleStart}
                data-testid="start-tournament-btn"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold shadow-sm shadow-brand-600/20 active:scale-[0.98] transition-all"
              >
                <Play className="w-4 h-4" /> Start Tournament
              </button>
            )}
            {isOrganizer &&
              tournament.status !== "completed" &&
              tournament.status !== "cancelled" && (
                <button
                  onClick={handleCancel}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 active:scale-[0.98] transition-all"
                >
                  Cancel Tournament
                </button>
              )}
          </div>
        </div>
      </motion.div>

      {/* Custom Tabs (Mobile friendly pill scroll) */}
      <div
        className="overflow-x-auto no-scrollbar mb-6"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-1 bg-secondary/30 border border-border/40 rounded-xl p-1 w-max min-w-full sm:min-w-0">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`shrink-0 flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-10 px-4 sm:px-6 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                activeTab === id
                  ? "bg-card text-brand-600 shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
          {tournament.status === "in_progress" && (
            <button
              onClick={() => setActiveTab("live")}
              className={`shrink-0 flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-10 px-4 sm:px-6 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                activeTab === "live"
                  ? "bg-card text-red-500 flex  shadow-sm border border-red-500/20"
                  : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              }`}
            >
              <Radio
                className={`w-4 h-4 ${activeTab === "live" ? "animate-pulse" : ""}`}
              />
              Live
            </button>
          )}
        </div>
      </div>

      {/* ─── Tab Content ─── */}

      {/* ── Bracket ── */}
      {activeTab === "bracket" && tournament.format === "knockout" && (
        <div className="space-y-4">
          {tournament.status === "registration" ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card rounded-[24px] border border-border/40 text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
                <Swords className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">
                Bracket not generated yet
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Check back when the tournament starts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-6 custom-scrollbar">
              <div className="flex gap-6 w-max min-w-full">
                {Object.entries(roundsMap)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([round, roundMatches]) => (
                    <div
                      key={round}
                      className="flex flex-col gap-3 w-[260px] shrink-0"
                    >
                      <div className="bg-secondary/40 border border-border/40 rounded-xl py-2 px-3 text-center mb-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          {roundLabels(parseInt(round))}
                        </h3>
                      </div>
                      {roundMatches
                        .sort((a, b) => a.match_number - b.match_number)
                        .map((match) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                            nameMap={nameMap}
                            isOrganizer={isOrganizer}
                            onSubmitResult={openResultDialog}
                          />
                        ))}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Standings ── */}
      {activeTab === "standings" && (
        <div className="space-y-4">
          {standings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card rounded-[24px] border border-border/40 text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
                <Medal className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">
                No standings yet
              </p>
            </div>
          ) : (
            <div className="rounded-[24px] bg-card border border-border/40 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-muted-foreground bg-secondary/10">
                      <th className="text-left p-3.5 font-bold uppercase tracking-wider">
                        #
                      </th>
                      <th className="text-left p-3.5 font-bold uppercase tracking-wider">
                        Lobbian
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider">
                        P
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider">
                        W
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider">
                        D
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider">
                        L
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider text-green-500/70">
                        GF
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider text-red-500/70">
                        GA
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider text-brand-500/70">
                        GD
                      </th>
                      <th className="text-center p-3.5 font-bold uppercase tracking-wider text-brand-600">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {standings.map((s, idx) => (
                      <tr
                        key={s.user_id}
                        className={`hover:bg-secondary/10 transition-colors ${idx === 0 ? "bg-amber-500/5 hover:bg-amber-500/10" : ""}`}
                      >
                        <td className="p-3.5 font-bold text-muted-foreground">
                          {idx === 0 && tournament.status === "completed" ? (
                            <Crown className="w-4 h-4 text-amber-500" />
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="p-3.5 admin-name text-sm sm:text-base truncate max-w-[140px]">
                          {s.name}
                        </td>
                        <td className="p-3.5 text-center font-medium">
                          {s.played}
                        </td>
                        <td className="p-3.5 text-center font-medium text-green-500">
                          {s.won}
                        </td>
                        <td className="p-3.5 text-center font-medium text-muted-foreground">
                          {s.drawn}
                        </td>
                        <td className="p-3.5 text-center font-medium text-red-500">
                          {s.lost}
                        </td>
                        <td className="p-3.5 text-center text-muted-foreground">
                          {s.goals_for}
                        </td>
                        <td className="p-3.5 text-center text-muted-foreground">
                          {s.goals_against}
                        </td>
                        <td className="p-3.5 text-center font-bold text-muted-foreground">
                          {s.goals_for > s.goals_against ? "+" : ""}
                          {s.goals_for - s.goals_against}
                        </td>
                        <td className="p-3.5 text-center font-black text-brand-600 text-lg">
                          {s.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Matches list ── */}
      {activeTab === "matches" && (
        <div className="space-y-3 p-1">
          {matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card rounded-[24px] border border-border/40 text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
                <Swords className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">
                No matches generated
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches
                .sort((a, b) => a.match_number - b.match_number)
                .map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    nameMap={nameMap}
                    isOrganizer={isOrganizer}
                    onSubmitResult={openResultDialog}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Participants ── */}
      {activeTab === "participants" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {participants.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 bg-card rounded-[24px] border border-border/40 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold text-muted-foreground">
                No Lobbians joined yet
              </p>
            </div>
          ) : (
            participants.map((p, idx) => (
              <motion.div
                key={p.user_id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.02 }}
                className="rounded-[20px] bg-card border border-border/40 shadow-sm p-4 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-secondary/50 border border-border/40 flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="admin-name text-sm sm:text-base truncate flex items-center gap-2">
                    {p.name}
                    {p.user_id === tournament.organizer_id && (
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </p>
                  <p className="admin-secondary text-xs sm:text-sm mt-0.5">
                    Rating {p.rating || 1500}
                  </p>
                </div>
                {tournament.entry_fee > 0 && p.payment_status && (
                  <Badge
                    className={`text-[10px] font-bold px-2 py-0.5 border ${p.payment_status === "paid" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}
                  >
                    {p.payment_status === "paid" ? "Paid" : "Pending"}
                  </Badge>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── Info ── */}
      {activeTab === "info" && (
        <div className="rounded-[24px] bg-card border border-border/40 shadow-sm p-5 sm:p-6 mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Tournament Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase mb-1">
                Organizer
              </p>
              <p className="admin-name text-sm sm:text-base">
                {tournament.organizer_name}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase mb-1">
                Format
              </p>
              <p className="text-sm font-semibold capitalize text-foreground">
                {tournament.format?.replace("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase mb-1">
                Sport
              </p>
              <p className="text-sm font-semibold capitalize text-foreground">
                {tournament.sport?.replace("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase mb-1">
                Max Players
              </p>
              <p className="admin-name text-sm sm:text-base">
                {tournament.max_participants}
              </p>
            </div>
            {tournament.registration_deadline && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground/60 uppercase mb-1">
                  Reg. Deadline
                </p>
                <p className="admin-name text-sm sm:text-base">
                  {new Date(
                    tournament.registration_deadline,
                  ).toLocaleDateString("en-IN")}
                </p>
              </div>
            )}
            {tournament.prize_pool && (
              <div className="col-span-2 md:col-span-2">
                <p className="text-[11px] font-bold text-amber-500/60 uppercase mb-1">
                  Prize Pool
                </p>
                <div className="flex items-center gap-1.5 text-amber-600 text-sm font-bold">
                  <Trophy className="w-4 h-4" />
                  <span>{tournament.prize_pool}</span>
                </div>
              </div>
            )}
          </div>

          {tournament.rules && (
            <div className="mt-8 pt-6 border-t border-border/40">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Rules & Regulations
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {tournament.rules}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Live ── */}
      {activeTab === "live" && (
        <LiveTabContent
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
        />
      )}

      {/* ── Result Sheet ── */}
      <AppSheet
        open={!!resultDialog}
        onClose={() => setResultDialog(null)}
        title="Enter Result"
      >
        {resultDialog && (
          <div className="space-y-4">
            <div className="bg-secondary/30 rounded-xl p-3 text-center mb-4 border border-border/40">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Match #{resultDialog.match_number}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={`${nameMap[resultDialog.player_a] || "TBD"} Score`}
              >
                <Input
                  type="number"
                  value={resultForm.score_a}
                  onChange={(e) =>
                    setResultForm((p) => ({ ...p, score_a: e.target.value }))
                  }
                  className="h-14 text-center text-xl font-black bg-secondary/10 border-border/40 rounded-xl"
                />
              </FormField>
              <FormField
                label={`${nameMap[resultDialog.player_b] || "TBD"} Score`}
              >
                <Input
                  type="number"
                  value={resultForm.score_b}
                  onChange={(e) =>
                    setResultForm((p) => ({ ...p, score_b: e.target.value }))
                  }
                  className="h-14 text-center text-xl font-black bg-secondary/10 border-border/40 rounded-xl"
                />
              </FormField>
            </div>

            <FormField label="Select Winner">
              <div className="space-y-2 mt-2">
                {resultDialog.player_a && (
                  <button
                    onClick={() =>
                      setResultForm((p) => ({
                        ...p,
                        winner: resultDialog.player_a,
                      }))
                    }
                    className={`w-full py-3.5 px-4 rounded-xl border text-sm font-bold text-left transition-all ${resultForm.winner === resultDialog.player_a ? "border-brand-600 bg-brand-600/10 text-brand-600 shadow-sm" : "bg-card border-border/40 text-foreground hover:bg-secondary/50"}`}
                  >
                    {nameMap[resultDialog.player_a] || "Lobbian A"}
                  </button>
                )}
                {resultDialog.player_b && (
                  <button
                    onClick={() =>
                      setResultForm((p) => ({
                        ...p,
                        winner: resultDialog.player_b,
                      }))
                    }
                    className={`w-full py-3.5 px-4 rounded-xl border text-sm font-bold text-left transition-all ${resultForm.winner === resultDialog.player_b ? "border-brand-600 bg-brand-600/10 text-brand-600 shadow-sm" : "bg-card border-border/40 text-foreground hover:bg-secondary/50"}`}
                  >
                    {nameMap[resultDialog.player_b] || "Lobbian B"}
                  </button>
                )}
                {tournament.format !== "knockout" && (
                  <button
                    onClick={() =>
                      setResultForm((p) => ({ ...p, winner: "draw" }))
                    }
                    className={`w-full py-3.5 px-4 rounded-xl border text-sm font-bold text-left transition-all ${resultForm.winner === "draw" ? "border-amber-500 bg-amber-500/10 text-amber-600 shadow-sm" : "bg-card border-border/40 text-muted-foreground hover:bg-secondary/50"}`}
                  >
                    Draw match
                  </button>
                )}
              </div>
            </FormField>

            <button
              onClick={handleSubmitResult}
              disabled={submitting}
              className="w-full mt-4 py-3.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Submit Result"}
            </button>
          </div>
        )}
      </AppSheet>
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────────────

function LiveTabContent({
  tournament,
  liveMatches,
  activeLiveId,
  setActiveLiveId,
  isOrganizer,
  matches,
  nameMap,
  loadLiveMatches,
  startingLive,
  setStartingLive,
  eventForm,
  setEventForm,
  showEventDialog,
  setShowEventDialog,
  loadTournament,
}) {
  const { matchData, events, connected, spectatorCount } =
    useLiveScore(activeLiveId);
  const activeLive = liveMatches.find((m) => m.id === activeLiveId);

  const handleStartLive = async (matchId) => {
    setStartingLive(true);
    try {
      const res = await liveAPI.start({
        tournament_id: tournament.id,
        match_id: matchId,
      });
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
    try {
      await liveAPI.updateScore(activeLiveId, { team, delta });
    } catch {}
  };
  const handleAddEvent = async () => {
    try {
      await liveAPI.addEvent(activeLiveId, eventForm);
      setShowEventDialog(false);
      setEventForm({
        type: "goal",
        team: "home",
        player_name: "",
        minute: 0,
        description: "",
      });
      toast.success("Event added!");
    } catch {}
  };
  const handlePause = async () => {
    try {
      await liveAPI.pause(activeLiveId);
    } catch {}
  };
  const handleEndMatch = async () => {
    if (!window.confirm("End match? Final scores will be synced.")) return;
    try {
      await liveAPI.end(activeLiveId);
      toast.success("Match ended!");
      setActiveLiveId(null);
      await loadLiveMatches();
      await loadTournament();
    } catch {}
  };
  const handlePeriod = async (period, label) => {
    try {
      await liveAPI.changePeriod(activeLiveId, { period, period_label: label });
    } catch {}
  };

  const EVENT_TYPES = [
    { value: "goal", label: "Score", icon: "\u26bd" },
    { value: "card", label: "Card", icon: "\ud83d\udfe8" },
    { value: "foul", label: "Foul", icon: "\u274c" },
    { value: "substitution", label: "Sub", icon: "\ud83d\udd04" },
  ];

  const pendingMatches = matches.filter(
    (m) =>
      m.status === "pending" &&
      m.player_a &&
      m.player_b &&
      !liveMatches.some((lm) => lm.match_id === m.id),
  );
  const displayData = matchData || activeLive;
  const displayEvents = matchData ? events : activeLive?.events || [];

  return (
    <div className="space-y-6">
      {/* Live matches selector strip */}
      {liveMatches.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {liveMatches.map((lm) => (
            <button
              key={lm.id}
              onClick={() => setActiveLiveId(lm.id)}
              className={`shrink-0 w-[240px] text-left p-3.5 rounded-[20px] focus:outline-none transition-all border ${activeLiveId === lm.id ? "bg-red-500/10 border-red-500/30" : "bg-card border-border/40 hover:border-red-500/20"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground truncate flex-1 pr-2">
                  {lm.match_label}
                </span>
                {activeLiveId === lm.id && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="truncate flex-1">{lm.home?.name}</span>
                <span
                  className={`${activeLiveId === lm.id ? "text-red-500" : "text-brand-600"} tabular-nums mx-1 bg-secondary/30 rounded px-1.5 py-0.5`}
                >
                  {typeof lm.home?.score === "object" ? `${lm.home.score.runs ?? 0}/${lm.home.score.wickets ?? 0}` : (lm.home?.score ?? 0)}
                  {" — "}
                  {typeof lm.away?.score === "object" ? `${lm.away.score.runs ?? 0}/${lm.away.score.wickets ?? 0}` : (lm.away?.score ?? 0)}
                </span>
                <span className="truncate flex-1 text-right">
                  {lm.away?.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main Scoreboard */}
      {displayData && (
        <div className="rounded-[24px] border border-border/40 bg-card shadow-sm overflow-hidden flex flex-col items-stretch">
          <div className="p-3 border-b border-border/40 bg-red-500/5 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2">
              <Radio
                className={`w-3.5 h-3.5 text-red-500 ${displayData.status !== "paused" ? "animate-pulse" : ""}`}
              />
              <span className="text-[11px] font-bold text-red-500 tracking-wider uppercase">
                {displayData.status === "paused" ? "Paused" : "Live"}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground/60 px-1.5 border-l border-border/60">
                {displayData.period_label || displayData.match_label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
              {connected && (
                <span className="text-green-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>{" "}
                  Sync
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />{" "}
                {spectatorCount || displayData.spectator_count || 0}
              </span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex items-center justify-between max-w-lg mx-auto">
              <div className="flex flex-col items-center flex-1">
                <div className="w-14 h-14 rounded-full bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-xl font-black text-brand-600 mb-3 shadow-inner">
                  {displayData.home?.name?.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-bold truncate w-full text-center px-2">
                  {displayData.home?.name}
                </p>

                {isOrganizer && displayData.status !== "completed" && (
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                      onClick={() => handleScore("home", -1)}
                      className="w-10 h-10 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 flex items-center justify-center transition-transform active:scale-90"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleScore("home", 1)}
                      className="w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 flex items-center justify-center transition-transform active:scale-95"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center px-4">
                <span className="text-5xl md:text-7xl font-black text-foreground tabular-nums tracking-tighter drop-shadow-sm">
                  {typeof displayData.home?.score === "object" ? `${displayData.home.score.runs ?? 0}/${displayData.home.score.wickets ?? 0}` : (displayData.home?.score ?? 0)}
                  <span className="text-muted-foreground/30 font-light mx-2 text-3xl md:text-5xl">
                    :
                  </span>
                  {typeof displayData.away?.score === "object" ? `${displayData.away.score.runs ?? 0}/${displayData.away.score.wickets ?? 0}` : (displayData.away?.score ?? 0)}
                </span>
              </div>

              <div className="flex flex-col items-center flex-1">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl font-black text-amber-500 mb-3 shadow-inner">
                  {displayData.away?.name?.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-bold truncate w-full text-center px-2">
                  {displayData.away?.name}
                </p>

                {isOrganizer && displayData.status !== "completed" && (
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                      onClick={() => handleScore("away", 1)}
                      className="w-14 h-14 rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center transition-transform active:scale-95"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => handleScore("away", -1)}
                      className="w-10 h-10 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 flex items-center justify-center transition-transform active:scale-90"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isOrganizer && displayData.status !== "completed" && (
            <div className="mt-auto border-t border-border/40 p-4 bg-secondary/10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                {EVENT_TYPES.map((e) => (
                  <button
                    key={e.value}
                    onClick={() => {
                      setEventForm((f) => ({ ...f, type: e.value }));
                      setShowEventDialog(true);
                    }}
                    className="py-2.5 rounded-xl bg-card border border-border/50 text-xs font-bold shadow-sm active:scale-95 transition-transform"
                  >
                    {e.icon} <span className="ml-1">{e.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePause}
                  className="flex-1 min-w-[120px] py-3 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-amber-500/20 active:bg-amber-500/20"
                >
                  {displayData.status === "paused" ? (
                    <PlayIcon className="w-3.5 h-3.5" />
                  ) : (
                    <Pause className="w-3.5 h-3.5" />
                  )}{" "}
                  {displayData.status === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={() =>
                    handlePeriod(
                      (displayData.period || 1) + 1,
                      `Period ${(displayData.period || 1) + 1}`,
                    )
                  }
                  className="flex-1 min-w-[120px] py-3 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:bg-sky-500/20"
                >
                  <Clock className="w-3.5 h-3.5" /> Next Period
                </button>
                <button
                  onClick={handleEndMatch}
                  className="flex-1 min-w-[120px] py-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 font-bold flex items-center justify-center gap-1.5 transition-colors active:bg-destructive/20"
                >
                  <Square className="w-3.5 h-3.5" /> End Match
                </button>
              </div>
            </div>
          )}

          {displayEvents.length > 0 && (
            <div className="p-4 bg-secondary/5 border-t border-border/40">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Timeline
              </p>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {[...displayEvents].reverse().map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/40 shadow-sm text-sm"
                  >
                    <span className="text-[10px] font-mono font-bold text-muted-foreground w-6 shrink-0 text-right">
                      {ev.minute > 0 ? `${ev.minute}'` : ""}
                    </span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.team === "home" ? "bg-brand-500" : "bg-amber-500"}`}
                    />
                    <span className="font-bold text-foreground flex-1 truncate">
                      {ev.player_name || ev.team}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {ev.description || ev.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Start Live Scorer list */}
      {isOrganizer && pendingMatches.length > 0 && (
        <div className="rounded-[24px] border border-border/40 bg-card p-4 sm:p-5 shadow-sm">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Start Live Scoring
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingMatches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">
                    {nameMap[m.player_a] || "TBD"} vs{" "}
                    {nameMap[m.player_b] || "TBD"}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide mt-0.5">
                    Round {m.round} · Match #{m.match_number}
                  </p>
                </div>
                <button
                  disabled={startingLive}
                  onClick={() => handleStartLive(m.id)}
                  className="shrink-0 flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-red-500/30 text-red-500 text-xs font-bold active:bg-red-500/10 transition-colors bg-card shadow-sm"
                >
                  <Radio className="w-3 h-3" /> Go Live
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Add Dialog */}
      <AppSheet
        open={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        title="Add Timeline Event"
      >
        <div className="space-y-4">
          <FormField label="Event Type">
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TYPES.map((et) => (
                <button
                  key={et.value}
                  onClick={() =>
                    setEventForm((f) => ({ ...f, type: et.value }))
                  }
                  className={`flex flex-col items-center py-2.5 rounded-xl border transition-colors ${eventForm.type === et.value ? "bg-brand-600/10 border-brand-600/30 text-brand-600" : "bg-secondary/40 border-border/40 text-muted-foreground"}`}
                >
                  <span className="text-xl mb-1">{et.icon}</span>
                  <span className="text-[10px] font-bold">{et.label}</span>
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Assign To Team">
            <div className="flex p-1 bg-secondary/30 rounded-xl border border-border/40">
              <button
                onClick={() => setEventForm((f) => ({ ...f, team: "home" }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${eventForm.team === "home" ? "bg-card shadow-sm text-brand-600" : "text-muted-foreground hover:text-foreground"}`}
              >
                {displayData?.home?.name || "Home"}
              </button>
              <button
                onClick={() => setEventForm((f) => ({ ...f, team: "away" }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${eventForm.team === "away" ? "bg-card shadow-sm text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
              >
                {displayData?.away?.name || "Away"}
              </button>
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Player Name (Opt)">
              <Input
                value={eventForm.player_name}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, player_name: e.target.value }))
                }
                className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
                placeholder="e.g. Messi"
              />
            </FormField>
            <FormField label="Match Minute">
              <Input
                type="number"
                value={eventForm.minute}
                onChange={(e) =>
                  setEventForm((f) => ({
                    ...f,
                    minute: parseInt(e.target.value) || 0,
                  }))
                }
                className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
                placeholder="45"
              />
            </FormField>
          </div>
          <FormField label="Short Description">
            <Input
              value={eventForm.description}
              onChange={(e) =>
                setEventForm((f) => ({ ...f, description: e.target.value }))
              }
              className="h-11 rounded-xl bg-secondary/20 border-border/40 text-sm"
              placeholder="e.g. Card for argument"
            />
          </FormField>
          <button
            onClick={handleAddEvent}
            className="w-full mt-2 py-3.5 bg-brand-600 text-white rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform"
          >
            Add to Timeline
          </button>
        </div>
      </AppSheet>
    </div>
  );
}

function MatchCard({ match, nameMap, isOrganizer, onSubmitResult }) {
  const playerA =
    nameMap[match.player_a] || (match.player_a ? "Unknown" : "TBD");
  const playerB =
    nameMap[match.player_b] || (match.player_b ? "Unknown" : "TBD");
  const isBye = match.status === "bye";
  const isDone = match.status === "completed";
  const canSubmit =
    isOrganizer &&
    match.status === "pending" &&
    match.player_a &&
    match.player_b;

  return (
    <div
      className={`rounded-[20px] bg-card border border-border/40 shadow-sm p-3.5 ${isDone ? "border-brand-600/20" : ""} group transition-colors hover:border-brand-600/30`}
    >
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/40">
        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
          Match #{match.match_number}
        </span>
        {isDone && <CheckCircle className="h-3.5 w-3.5 text-brand-500" />}
        {isBye && (
          <span className="text-[9px] font-black bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
            BYE
          </span>
        )}
      </div>
      <div
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm transition-colors ${match.winner === match.player_a ? "bg-brand-600/10" : ""}`}
      >
        <span
          className={`truncate font-semibold ${!match.player_a ? "text-muted-foreground/50 opacity-60" : match.winner === match.player_a ? "text-brand-600" : "text-foreground"}`}
        >
          {playerA}
        </span>
        {isDone && match.score_a !== null && (
          <span
            className={`font-black ml-2 ${match.winner === match.player_a ? "text-brand-600" : "text-muted-foreground/50"}`}
          >
            {match.score_a}
          </span>
        )}
      </div>
      <div
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm transition-colors mt-0.5 ${match.winner === match.player_b ? "bg-brand-600/10" : ""}`}
      >
        <span
          className={`truncate font-semibold ${!match.player_b ? "text-muted-foreground/50 opacity-60" : match.winner === match.player_b ? "text-brand-600" : "text-foreground"}`}
        >
          {playerB}
        </span>
        {isDone && match.score_b !== null && (
          <span
            className={`font-black ml-2 ${match.winner === match.player_b ? "text-brand-600" : "text-muted-foreground/50"}`}
          >
            {match.score_b}
          </span>
        )}
      </div>
      {canSubmit && (
        <button
          onClick={() => onSubmitResult(match)}
          className="w-full mt-3 py-2 rounded-lg bg-secondary/50 border border-border/40 text-[11px] font-bold text-foreground hover:bg-brand-600/10 hover:text-brand-600 hover:border-brand-600/30 transition-all"
        >
          Update Score
        </button>
      )}
    </div>
  );
}
