import { motion } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import { ImageIcon, X } from "lucide-react";

export default function MediaGalleryModal({
  isOpen,
  onClose,
  galleryMedia,
}) {
  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="w-full max-w-lg bg-card border border-border/40 rounded-[28px] shadow-sm p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="admin-heading flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Media Gallery</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        {galleryMedia.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No media shared yet</p> : (
          <div className="grid grid-cols-3 gap-2">
            {galleryMedia.map(m => (
              <div key={m.id} className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => window.open(mediaUrl(m.media_url), "_blank")}>
                <img src={mediaUrl(m.media_url)} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
