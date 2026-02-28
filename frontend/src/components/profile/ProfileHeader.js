import { useRef } from "react";
import { mediaUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, BadgeCheck } from "lucide-react";

export function ProfileHeader({ user, playerCard, uploadingAvatar, onAvatarUpload }) {
  const avatarInputRef = useRef(null);

  return (
    <div className="rounded-2xl p-6 sm:p-8 mb-6 bg-background border border-border">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="relative group shrink-0">
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-brand-50 dark:bg-brand-950 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer touch-manipulation transition-all duration-200 hover:ring-2 hover:ring-brand-400 active:scale-95 border-2 border-brand-200 dark:border-brand-800"
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
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 rounded-full">
              {uploadingAvatar ? (
                <Loader2 className="h-7 w-7 text-white animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-7 w-7 text-white" aria-hidden="true" />
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
