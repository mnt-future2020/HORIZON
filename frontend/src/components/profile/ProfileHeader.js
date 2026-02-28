import { useRef } from "react";
import { mediaUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, BadgeCheck } from "lucide-react";

export function ProfileHeader({ user, playerCard, uploadingAvatar, onAvatarUpload }) {
  const avatarInputRef = useRef(null);

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
        {/* Avatar with better touch target */}
        <div className="relative group shrink-0">
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer touch-manipulation transition-transform active:scale-95"
            title="Change profile photo"
            aria-label="Change profile photo"
          >
            {user?.avatar ? (
              <img src={mediaUrl(user.avatar)} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display font-black text-3xl sm:text-4xl text-primary">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity rounded-full">
              {uploadingAvatar ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatarUpload}
            aria-label="Upload profile photo"
          />
        </div>

        {/* User info */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
              {user?.name}
            </h2>
            {(user?.is_verified || 
              playerCard?.is_verified || 
              (user?.role === "coach" && user?.doc_verification_status === "verified")) && (
              <BadgeCheck className="h-5 w-5 text-blue-400 shrink-0" aria-label="Verified account" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">{user?.email}</p>
          <Badge variant="secondary" className="mt-2 text-[10px] font-bold uppercase tracking-wider">
            {user?.role === "player" ? "LOBBIAN" : user?.role?.replace("_", " ")}
          </Badge>
        </div>
      </div>
    </div>
  );
}
