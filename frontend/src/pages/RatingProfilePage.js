import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";
import { ratingAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ShieldCheck, ShieldAlert, TrendingUp, TrendingDown, Minus,
  Trophy, Lock, Hash, LinkIcon, Fingerprint, ChevronUp, ChevronDown,
  CalendarDays, Swords, Eye
} from "lucide-react";

function getTier(rating) {
  if (rating >= 2500) return { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", fill: "#22d3ee" };
  if (rating >= 2000) return { label: "Gold", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", fill: "#fbbf24" };
  if (rating >= 1500) return { label: "Silver", color: "text-muted-foreground", bg: "bg-secondary border-border/40", fill: "#94a3b8" };
  return { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", fill: "#fb923c" };
}

function MiniChart({ timeline }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !timeline.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const ratings = timeline.map(t => t.rating);
    const minR = Math.min(...ratings) - 50;
    const maxR = Math.max(...ratings) + 50;
    const range = maxR - minR || 1;

    const padX = 8, padY = 12;
    const drawW = w - padX * 2;
    const drawH = h - padY * 2;

    // Grid lines
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padY + (drawH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    // Draw area fill
    const gradient = ctx.createLinearGradient(0, padY, 0, h - padY);
    gradient.addColorStop(0, "rgba(34,197,94,0.15)");
    gradient.addColorStop(1, "rgba(34,197,94,0.0)");

    ctx.beginPath();
    const points = timeline.map((t, i) => ({
      x: padX + (i / Math.max(timeline.length - 1, 1)) * drawW,
      y: padY + drawH - ((t.rating - minR) / range) * drawH,
    }));

    ctx.moveTo(points[0].x, h - padY);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h - padY);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    // Draw dots + delta colors
    points.forEach((p, i) => {
      const delta = timeline[i].delta;
      const color = delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#94a3b8";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [timeline]);

  if (!timeline.length) return <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No matches yet</div>;

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />;
}

function VerificationBadge({ verification }) {
  if (!verification) return null;
  const ok = verification.verified;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
        ok ? "bg-brand-500/10 border-brand-500/30 text-brand-400" : "bg-red-500/10 border-red-500/30 text-red-400"
      }`} data-testid="verification-badge">
      {ok ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      {ok ? "Verified Rating" : "Chain Broken"}
    </motion.div>
  );
}

function RecordRow({ record, index }) {
  const [expanded, setExpanded] = useState(false);
  const isWin = record.result === "win";
  const isLoss = record.result === "loss";

  return (
    <div className={`rounded-[24px] border transition-colors ${expanded ? "bg-card border-border/40 shadow-sm" : "border-transparent hover:bg-secondary/20"}`}
      data-testid={`history-record-${record.seq}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground w-6">#{record.seq}</span>
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
            isWin ? "bg-brand-500/15 text-brand-400" : isLoss ? "bg-red-500/15 text-red-400" : "bg-secondary text-muted-foreground"
          }`}>
            {isWin ? "W" : isLoss ? "L" : "D"}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground flex items-center gap-2">
            vs {record.opponent_snapshot?.[0]?.name || "Unknown"}
            {record.opponent_snapshot?.length > 1 && <span className="text-muted-foreground">+{record.opponent_snapshot.length - 1}</span>}
            <Badge variant="secondary" className="text-[10px] h-4 capitalize">{record.sport}</Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{record.match_date}</span>
        </div>
        <div className="text-right shrink-0 flex items-center gap-3">
          <div>
            <div className={`text-sm font-display font-bold ${isWin ? "text-brand-400" : isLoss ? "text-red-400" : "text-muted-foreground"}`}>
              {record.delta > 0 ? "+" : ""}{record.delta}
            </div>
            <div className="text-[10px] text-muted-foreground">{record.previous_rating} &rarr; {record.new_rating}</div>
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
          className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Rating Change</span>
              <span className="font-bold">{record.previous_rating} &rarr; {record.new_rating}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">RD Change</span>
              <span className="font-bold">{record.previous_rd} &rarr; {record.new_rd}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Team</span>
              <span className="font-bold uppercase">Team {record.team}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Match ID</span>
              <span className="font-mono text-[10px]">{record.match_id?.slice(0, 12)}...</span>
            </div>
          </div>

          {record.opponent_snapshot?.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Opponents</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {record.opponent_snapshot.map((o, i) => (
                  <span key={i} className="text-xs bg-secondary/40 rounded-md px-2 py-1">
                    {o.name} <span className="text-muted-foreground">({o.rating_at_time})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground break-all">
              SHA-256: {record.record_hash}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground break-all">
              Prev: {record.prev_hash?.slice(0, 32)}...
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Confirmed by {record.confirmations?.length || 0} Lobbian(s)
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function RatingProfilePage() {
  const { user } = useAuth();
  const { userId: paramId } = useParams();
  const targetId = paramId || user?.id;
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [certificate, setCertificate] = useState(null);
  const [verification, setVerification] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [certRes, histRes] = await Promise.all([
        ratingAPI.certificate(targetId),
        ratingAPI.history(targetId, 100),
      ]);
      setCertificate(certRes.data);
      setHistory(histRes.data);
      setVerification(certRes.data?.verification);
    } catch { toast.error("Failed to load rating data"); }
    finally { setLoading(false); }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await ratingAPI.verify(targetId);
      setVerification(res.data);
      if (res.data.verified) toast.success(res.data.message);
      else toast.error(res.data.message);
    } catch { toast.error("Verification failed"); }
    finally { setVerifying(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  );

  const p = certificate?.player || {};
  const j = certificate?.journey || {};
  const v = certificate?.verification || verification || {};
  const timeline = certificate?.timeline || [];
  const records = history?.records || [];
  const tier = getTier(p.skill_rating || 1500);
  const isOwnProfile = targetId === user?.id;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="rating-profile-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Rating Certificate</span>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">
            {p.name || "Lobbian"}
          </h1>
        </div>
        <VerificationBadge verification={v} />
      </div>

      {/* Rating Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[24px] bg-card border border-border/40 shadow-sm p-6 mb-6" data-testid="rating-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`h-16 w-16 rounded-xl flex items-center justify-center font-display font-black text-2xl ${tier.bg} ${tier.color} border`}>
              {p.skill_rating || 1500}
            </div>
            <div>
              <Badge className={`text-xs border ${tier.bg} ${tier.color}`}>{tier.label}</Badge>
              <div className="text-xs text-muted-foreground mt-1">RD: {p.skill_deviation || 350}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-display font-bold text-brand-400">{j.total_wins || 0}</div>
              <div className="text-[10px] font-mono text-muted-foreground">WINS</div>
            </div>
            <div>
              <div className="text-lg font-display font-bold text-red-400">{j.total_losses || 0}</div>
              <div className="text-[10px] font-mono text-muted-foreground">LOSSES</div>
            </div>
            <div>
              <div className="text-lg font-display font-bold text-muted-foreground">{j.total_draws || 0}</div>
              <div className="text-[10px] font-mono text-muted-foreground">DRAWS</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[160px] rounded-lg bg-background/50 border border-border p-2" data-testid="rating-chart">
          <MiniChart timeline={timeline} />
        </div>

        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-brand-400" /> Peak: {j.peak_rating || p.skill_rating || 1500}</span>
          <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-400" /> Lowest: {j.lowest_rating || p.skill_rating || 1500}</span>
          <span className="flex items-center gap-1"><Swords className="h-3 w-3" /> {v.total_matches_recorded || 0} recorded matches</span>
        </div>
      </motion.div>

      {/* Chain Verification */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-[24px] bg-card border border-border/40 shadow-sm p-6 mb-6" data-testid="chain-verification">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-sm flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" /> Chain Integrity
          </h2>
          <Button size="sm" variant="outline" onClick={handleVerify} disabled={verifying}
            className="text-xs h-7 gap-1" data-testid="verify-chain-btn">
            {verifying ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Verify Now
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-secondary/30 rounded-lg p-3">
            <span className="text-muted-foreground block mb-1">Chain Status</span>
            <span className={`font-bold ${v.chain_intact ? "text-brand-400" : "text-red-400"}`}>
              {v.chain_intact ? "Intact" : "Broken"}
            </span>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3">
            <span className="text-muted-foreground block mb-1">Rating Match</span>
            <span className={`font-bold ${v.rating_consistent ? "text-brand-400" : "text-red-400"}`}>
              {v.rating_consistent ? "Consistent" : "Mismatch"}
            </span>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3">
            <span className="text-muted-foreground block mb-1">Total Records</span>
            <span className="font-bold text-foreground">{v.total_matches_recorded || 0}</span>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3">
            <span className="text-muted-foreground block mb-1">Fingerprint</span>
            <span className="font-mono text-[10px] text-foreground break-all">{v.chain_fingerprint?.slice(0, 16) || "—"}...</span>
          </div>
        </div>
        {v.chain_fingerprint && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Hash className="h-3 w-3" />
            <span className="font-mono break-all">Full: {v.chain_fingerprint}</span>
          </div>
        )}
      </motion.div>

      {/* Match History */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Match History
          </h2>
          <span className="text-xs text-muted-foreground">{records.length} records</span>
        </div>

        {records.length === 0 ? (
          <div className="rounded-[24px] bg-card border border-border/40 shadow-sm p-10 text-center text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm">No match results recorded yet</p>
            <p className="text-xs mt-1">Play and report results to build your rating history!</p>
          </div>
        ) : (
          <div className="space-y-1" data-testid="history-list">
            {records.map((r, i) => <RecordRow key={r.seq} record={r} index={i} />)}
          </div>
        )}
      </motion.div>
    </div>
  );
}
