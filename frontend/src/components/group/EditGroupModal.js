import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mediaUrl } from "@/lib/utils";
import { Users, X, Camera, Loader2, Check } from "lucide-react";

const SPORTS = ["football", "cricket", "badminton", "tennis", "basketball", "volleyball", "table-tennis", "swimming"];

export default function EditGroupModal({
  isOpen,
  onClose,
  editForm,
  onEditFormChange,
  onAvatarUpload,
  onCoverUpload,
  onSave,
  savingEdit,
  uploadingAvatar,
  uploadingCover,
  avatarInputRef,
  coverInputRef,
}) {
  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="admin-heading">Edit Group</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Avatar</Label>
            <div className="flex items-center gap-4 mt-1">
              <div className="relative h-16 w-16 rounded-xl bg-brand-600/10 flex items-center justify-center overflow-hidden group/av cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}>
                {editForm.avatar_url ? <img src={mediaUrl(editForm.avatar_url)} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <Users className="h-8 w-8 text-brand-600" />}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity rounded-xl">
                  {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cover Image</Label>
            <div className="mt-1 relative h-28 rounded-xl bg-secondary/30 border border-dashed border-border/40 flex items-center justify-center overflow-hidden group/cv cursor-pointer"
              onClick={() => coverInputRef.current?.click()}>
              {editForm.cover_url ? <img src={mediaUrl(editForm.cover_url)} alt="" className="w-full h-full object-cover" />
                : <div className="text-center"><Camera className="h-6 w-6 mx-auto text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Upload cover</span></div>}
              {editForm.cover_url && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cv:opacity-100 transition-opacity">
                {uploadingCover ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
              </div>}
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverUpload} />
          </div>
          <div><Label className="text-xs text-muted-foreground">Name *</Label>
            <Input value={editForm.name} onChange={e => onEditFormChange({ ...editForm, name: e.target.value })} className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" /></div>
          <div><Label className="text-xs text-muted-foreground">Description</Label>
            <textarea value={editForm.description} onChange={e => onEditFormChange({ ...editForm, description: e.target.value })} rows={3}
              className="mt-1 w-full rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-sm resize-none focus:outline-none" /></div>
          <div><Label className="text-xs text-muted-foreground">Sport</Label>
            <select value={editForm.sport} onChange={e => onEditFormChange({ ...editForm, sport: e.target.value })} className="mt-1 w-full rounded-xl h-11 border border-border/40 bg-secondary/20 px-3 py-2 text-sm">
              <option value="">Any Sport</option>{SPORTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editForm.is_private || false} onChange={e => onEditFormChange({ ...editForm, is_private: e.target.checked })} className="rounded border-border" /><span className="text-sm">Private</span></label>
            <div><Label className="text-xs text-muted-foreground">Max Members</Label>
              <Input type="number" min={2} max={5000} value={editForm.max_members} onChange={e => onEditFormChange({ ...editForm, max_members: parseInt(e.target.value) || 500 })} className="mt-1 bg-secondary/20 border-border/40 rounded-xl" /></div>
          </div>
          <Button onClick={onSave} disabled={savingEdit} className="w-full h-11 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all">
            {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Save
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
