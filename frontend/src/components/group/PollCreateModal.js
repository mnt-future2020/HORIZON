import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, BarChart3 } from "lucide-react";

export default function PollCreateModal({
  isOpen,
  onClose,
  pollQuestion,
  onPollQuestionChange,
  pollOptions,
  onPollOptionsChange,
  onCreatePoll,
}) {
  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="w-full max-w-md bg-card border border-border/40 rounded-[28px] shadow-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="admin-heading">Create Poll</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Question</Label>
            <Input value={pollQuestion} onChange={e => onPollQuestionChange(e.target.value)} placeholder="Ask something..." className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" /></div>
          {pollOptions.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; onPollOptionsChange(n); }}
                placeholder={`Option ${i + 1}`} className="bg-secondary/20 border-border/40 rounded-xl" />
              {pollOptions.length > 2 && <button onClick={() => onPollOptionsChange(pollOptions.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>}
            </div>
          ))}
          {pollOptions.length < 10 && (
            <Button variant="outline" size="sm" className="admin-btn" onClick={() => onPollOptionsChange([...pollOptions, ""])}><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
          )}
          <Button onClick={onCreatePoll} className="w-full h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all"><BarChart3 className="h-4 w-4 mr-2" /> Create Poll</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
