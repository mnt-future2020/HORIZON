import { motion } from "framer-motion";
import { Grid3X3, Loader2, MessageCircle, Heart, Camera } from "lucide-react";
import { mediaUrl } from "@/lib/utils";

const timeAgo = (d) => {
  if (!d) return "";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

export default function UserPostsSection({ posts, loading, postCount, card }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          Loading Posts
        </span>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-24 px-6">
        <div className="h-16 w-16 mx-auto rounded-full bg-secondary/40 border border-border/10 flex items-center justify-center mb-4">
          <Camera className="h-7 w-7 text-muted-foreground/25" />
        </div>
        <p className="font-bold text-sm text-muted-foreground/60 mb-1">
          No Posts Yet
        </p>
        <p className="text-xs text-muted-foreground/40">
          Share your first training moment
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-[1px] sm:gap-0.5">
        {posts.map((post, idx) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.04, duration: 0.3 }}
            className="relative aspect-square bg-secondary/30 overflow-hidden cursor-pointer group"
          >
            {post.media_url ? (
              <img
                src={mediaUrl(post.media_url)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-brand-500/5 group-hover:bg-brand-500/10 transition-colors">
                <p className="text-[10px] font-medium text-foreground/60 text-center line-clamp-4 leading-relaxed">
                  {post.content}
                </p>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-5 z-10">
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <Heart className="h-4 w-4 fill-white" />
                <span className="tabular-nums">{post.likes_count || 0}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <MessageCircle className="h-4 w-4 fill-white" />
                <span className="tabular-nums">{post.comments_count || 0}</span>
              </div>
            </div>

            {/* Caption indicator */}
            {post.content && post.media_url && (
              <div className="absolute top-2 right-2 z-20 opacity-60 group-hover:opacity-0 transition-opacity">
                <div className="bg-black/30 backdrop-blur-sm p-1 rounded">
                  <MessageCircle className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
