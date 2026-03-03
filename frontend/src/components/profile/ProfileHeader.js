import { useRef } from "react";
import { mediaUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, BadgeCheck } from "lucide-react";

export function ProfileHeader({ user, playerCard, uploadingAvatar, onAvatarUpload }) {
  const avatarInputRef = useRef(null);

  return (
    <div className="rounded-2xl p-6 sm:p-8 mb-6 bg-gradient-to-br from-background via-background to-brand-50/30 dark:to-brand-950/30 border border-border shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="relative group shrink-0">
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900 dark:to-brand-950 flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer touch-manipulation transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-brand-500/20 active:scale-95 border-4 border-brand-300 dark:border-brand-700"
            title="Change profile photo"
            aria-label="Change profile photo"
          >
            {user?.avatar ? (
              <img src={mediaUrl(user.avatar)} alt={user.name} className="w-full h-full object-cover" width="112" height="112" />
            ) : (
              <span className="font-display font-black text-4xl sm:text-5xl text-brand-600 dark:text-brand-400">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-300 rounded-full backdrop-blur-sm">
              {uploadingAvatar ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-7 w-7 text-white animate-spin" aria-hidden="true" />
                  <span className="text-xs text-white font-semibold">Uploading…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-7 w-7 text-white" aria-hidden="true" />
                  <span className="text-xs text-white font-semibold">Change Photo</span>
                </div>
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
          <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap mb-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground truncate">
              {user?.name}
            </h2>
            {(user?.is_verified || 
              playerCard?.is_verified || 
              (user?.role === "coach" && user?.doc_verification_status === "verified")) && (
              <BadgeCheck className="h-6 w-6 text-brand-500 shrink-0" aria-label="Verified account" />
            )}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mb-3 truncate">{user?.email}</p>
          <Badge 
            variant="secondary" 
            className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800"
          >
            {user?.role === "player" ? "LOBBIAN" : user?.role?.replace("_", " ")}
          </Badge>
        </div>
      </div>
    </div>
  );
}
