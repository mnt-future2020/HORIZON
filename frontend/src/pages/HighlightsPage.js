import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { highlightAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Upload, Sparkles, Clock, Share2, Trash2, Eye,
  ChevronRight, Loader2, CheckCircle, AlertTriangle, Copy, Link2, X,
  Zap, Target, Trophy, Flag
} from "lucide-react";

const SIGNIFICANCE_ICONS = {
  goal: Trophy,
  save: Target,
  rally: Zap,
  foul: AlertTriangle,
  celebration: Sparkles,
  turning_point: Flag,
  skill_move: Zap,
  other: ChevronRight,
};

const SIGNIFICANCE_COLORS = {
  goal: "text-amber-400 bg-amber-500/15",
  save: "text-sky-400 bg-sky-500/15",
  rally: "text-brand-400 bg-brand-500/15",
  foul: "text-red-400 bg-red-500/15",
  celebration: "text-brand-400 bg-brand-500/15",
  turning_point: "text-orange-400 bg-orange-500/15",
  skill_move: "text-cyan-400 bg-cyan-500/15",
  other: "text-muted-foreground bg-secondary/50",
};

function MomentBadge({ significance }) {
  const IconComp = SIGNIFICANCE_ICONS[significance] || ChevronRight;
  const color = SIGNIFICANCE_COLORS[significance] || SIGNIFICANCE_COLORS.other;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
      <IconComp className="h-3 w-3" /> {significance?.replace("_", " ")}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    uploaded: { color: "bg-sky-500/15 text-sky-400 border-sky-500/20", label: "Ready" },
    analyzing: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", label: "Analyzing..." },
    completed: { color: "bg-brand-500/15 text-brand-400 border-brand-500/20", label: "Complete" },
    failed: { color: "bg-red-500/15 text-red-400 border-red-500/20", label: "Failed" },
  };
  const s = map[status] || map.uploaded;
  return <Badge className={`text-[10px] border ${s.color}`}>{s.label}</Badge>;
}

function UploadSection({ onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = (f) => {
    if (f && f.type?.startsWith("video/")) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } else {
      toast.error("Please select a video file");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title || "Match Recording");
      await highlightAPI.upload(fd, (e) => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      toast.success("Video uploaded! Click 'Analyze' to generate highlights.");
      setFile(null);
      setTitle("");
      setProgress(0);
      onUpload();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-[24px] bg-card border border-border/40 shadow-sm p-5 sm:p-6" data-testid="upload-section">
      <h3 className="font-display font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
        <Upload className="h-4 w-4 text-primary" /> Upload Match Video
      </h3>

      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => document.getElementById("video-input")?.click()}
          data-testid="drop-zone"
        >
          <Video className="h-8 w-8 mx-auto mb-3 text-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Drag & drop your match video here, or <span className="text-primary font-semibold">browse</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">MP4, MOV, AVI, WebM — Max 100MB</p>
          <input id="video-input" type="file" accept="video/*" className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])} data-testid="video-file-input" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/40 shadow-sm p-3">
            <Video className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-[10px] text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
            </div>
            <button onClick={() => { setFile(null); setTitle(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Match title (e.g., Weekend Football)"
            className="bg-background border-border" data-testid="video-title-input" />
          {uploading && <Progress value={progress} className="h-2" />}
          <Button className="w-full bg-primary text-primary-foreground font-bold" onClick={handleUpload}
            disabled={uploading} data-testid="upload-btn">
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading {progress}%</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Upload Video</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function HighlightCard({ highlight, onAnalyze, onView, onDelete }) {
  const [analyzing, setAnalyzing] = useState(false);
  const isAnalyzing = analyzing || highlight.status === "analyzing";

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await onAnalyze(highlight.id);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] bg-card border border-border/40 shadow-sm p-4 sm:p-5" data-testid={`highlight-card-${highlight.id}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm sm:text-base truncate">{highlight.title}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={highlight.status} />
              <span className="text-[10px] text-muted-foreground">
                {new Date(highlight.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onDelete(highlight.id)} data-testid={`delete-highlight-${highlight.id}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {highlight.status === "completed" && highlight.analysis && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground line-clamp-2">{highlight.analysis.summary}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {highlight.analysis.sport_detected && (
              <Badge className="text-[10px] bg-primary/15 text-primary border border-primary/20">
                {highlight.analysis.sport_detected}
              </Badge>
            )}
            {highlight.analysis.match_intensity && (
              <Badge className="text-[10px] bg-secondary/50 text-muted-foreground">
                {highlight.analysis.match_intensity} intensity
              </Badge>
            )}
            <Badge className="text-[10px] bg-secondary/50 text-muted-foreground">
              {highlight.analysis.key_moments?.length || 0} moments
            </Badge>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {highlight.status === "uploaded" && (
          <Button size="sm" onClick={handleAnalyze} disabled={isAnalyzing}
            className="bg-primary text-primary-foreground font-bold text-xs h-8" data-testid={`analyze-btn-${highlight.id}`}>
            {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
          </Button>
        )}
        {highlight.status === "analyzing" && (
          <Button size="sm" disabled className="text-xs h-8">
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> AI is analyzing...
          </Button>
        )}
        {highlight.status === "completed" && (
          <Button size="sm" variant="outline" onClick={() => onView(highlight)}
            className="text-xs h-8 font-bold" data-testid={`view-btn-${highlight.id}`}>
            <Eye className="h-3.5 w-3.5 mr-1" /> View Analysis
          </Button>
        )}
        {highlight.status === "failed" && (
          <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={isAnalyzing}
            className="text-xs h-8 font-bold text-destructive border-destructive/30" data-testid={`retry-btn-${highlight.id}`}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Retry Analysis
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function AnalysisDialog({ highlight, open, onClose, baseUrl }) {
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);

  if (!highlight?.analysis) return null;
  const a = highlight.analysis;

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await highlightAPI.share(highlight.id);
      const sid = res.data.share_id;
      if (sid) {
        const url = `${baseUrl}/highlights/shared/${sid}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Share link copied!");
      } else {
        setShareUrl(null);
        toast.info("Sharing disabled");
      }
    } catch (err) {
      toast.error("Failed to generate share link");
    } finally {
      setSharing(false);
    }
  };

  const copyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      toast.success("Link copied!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Match Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title + meta */}
          <div>
            <h3 className="font-bold text-lg">{highlight.title}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {a.sport_detected && (
                <Badge className="bg-primary/15 text-primary border border-primary/20 text-xs">{a.sport_detected}</Badge>
              )}
              {a.duration_estimate && (
                <Badge className="bg-secondary/50 text-muted-foreground text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {a.duration_estimate}
                </Badge>
              )}
              {a.match_intensity && (
                <Badge className={`text-xs ${
                  a.match_intensity === "intense" ? "bg-red-500/15 text-red-400" :
                  a.match_intensity === "high" ? "bg-amber-500/15 text-amber-400" :
                  "bg-sky-500/15 text-sky-400"
                }`}>{a.match_intensity} intensity</Badge>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-[24px] bg-card border border-border/40 shadow-sm p-4" data-testid="analysis-summary">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Match Summary</span>
            <p className="text-sm mt-2 text-foreground leading-relaxed">{a.summary}</p>
            {a.players_observed && (
              <p className="text-xs text-muted-foreground mt-2">Lobbians: {a.players_observed}</p>
            )}
          </div>

          {/* Key Moments */}
          {a.key_moments?.length > 0 && (
            <div data-testid="key-moments-list">
              <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Key Moments ({a.key_moments.length})
              </h4>
              <div className="space-y-2">
                {a.key_moments.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl bg-card border border-border/40 shadow-sm p-3 flex items-start gap-3" data-testid={`moment-${i}`}>
                    <div className="shrink-0 h-9 w-16 rounded-md bg-background flex items-center justify-center">
                      <span className="text-xs font-mono font-bold text-primary">{m.timestamp}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{m.description}</p>
                      <div className="mt-1">
                        <MomentBadge significance={m.significance} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
            <Button size="sm" variant="outline" onClick={handleShare} disabled={sharing}
              className="font-bold text-xs h-8" data-testid="share-btn">
              {sharing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Share2 className="h-3.5 w-3.5 mr-1" />}
              {highlight.is_shared ? "Disable Share" : "Generate Share Link"}
            </Button>
            {shareUrl && (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="flex-1 min-w-0 bg-background rounded-md px-2 py-1 text-[10px] text-muted-foreground truncate font-mono">
                  {shareUrl}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyUrl}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function HighlightsPage() {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingHighlight, setViewingHighlight] = useState(null);
  const baseUrl = window.location.origin;

  const loadHighlights = useCallback(async () => {
    try {
      const res = await highlightAPI.list();
      setHighlights(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHighlights(); }, [loadHighlights]);

  const handleAnalyze = async (id) => {
    try {
      const res = await highlightAPI.analyze(id);
      setHighlights(prev => prev.map(h => h.id === id ? res.data : h));
      toast.success("Analysis complete!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Analysis failed");
      loadHighlights();
    }
  };

  const handleDelete = async (id) => {
    try {
      await highlightAPI.delete(id);
      setHighlights(prev => prev.filter(h => h.id !== id));
      toast.success("Highlight deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6" data-testid="highlights-page">
      <div className="mb-8">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">AI Analysis</span>
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mt-1">
          Video <span className="text-primary">Highlights</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Upload match recordings and let AI identify key moments</p>
      </div>

      <UploadSection onUpload={loadHighlights} />

      <div className="mt-8">
        <h3 className="font-display font-bold text-base sm:text-lg mb-4">
          Your Highlights ({highlights.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : highlights.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="empty-state">
            <Video className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm">No highlights yet</p>
            <p className="text-xs mt-1">Upload a match video to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {highlights.map(h => (
                <HighlightCard key={h.id} highlight={h}
                  onAnalyze={handleAnalyze}
                  onView={(hl) => setViewingHighlight(hl)}
                  onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnalysisDialog
        highlight={viewingHighlight}
        open={!!viewingHighlight}
        onClose={() => setViewingHighlight(null)}
        baseUrl={baseUrl}
      />
    </div>
  );
}
