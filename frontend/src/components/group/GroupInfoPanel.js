import { useNavigate } from "react-router-dom";
import { mediaUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, Crown, User, Lock, Globe, LogOut, Trash2,
  ShieldCheck, ShieldOff, UserMinus, Check, Link2,
  BellOff, Bell, Eraser, ImageIcon, Loader2,
} from "lucide-react";

const ROLE_PRESETS = ["Captain", "Vice Captain", "Coach", "Goalkeeper", "Striker", "Manager", "Organizer"];

export default function GroupInfoPanel({
  group,
  user,
  isAdmin,
  isCreator,
  admins,
  memberRoles,
  onlineMembers,
  isMuted,
  onToggleMute,
  onClearChat,
  onOpenGallery,
  onOpenInvite,
  onLoadJoinRequests,
  onPromote,
  onDemote,
  onRemoveMember,
  onLeave,
  showDeleteConfirm,
  onToggleDeleteConfirm,
  onDelete,
  deleting,
  roleEditMember,
  onSetRoleEditMember,
  roleInput,
  onRoleInputChange,
  onSetRole,
}) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {group.cover_url && (
          <div className="rounded-[28px] overflow-hidden h-40">
            <img src={mediaUrl(group.cover_url)} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* About + Quick actions */}
        <div className="p-5 rounded-[28px] border border-border/40 bg-card shadow-sm">
          <h3 className="admin-heading mb-2">About</h3>
          <p className="text-sm text-muted-foreground">{group.description || "No description."}</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Badge variant="sport" className="text-[10px]">{group.group_type}</Badge>
            {group.sport && <Badge variant="outline" className="text-[10px] capitalize">{group.sport}</Badge>}
            <span className="text-[10px] text-muted-foreground ml-auto">Max {group.max_members || 500}</span>
          </div>
          {group.is_member && (
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={onToggleMute}>
                {isMuted ? <Bell className="h-3 w-3 mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                {isMuted ? "Unmute" : "Mute"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={onClearChat}>
                <Eraser className="h-3 w-3 mr-1" /> Clear Chat
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={onOpenGallery}>
                <ImageIcon className="h-3 w-3 mr-1" /> Media
              </Button>
              {isAdmin && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={onOpenInvite}>
                    <Link2 className="h-3 w-3 mr-1" /> Invite Link
                  </Button>
                  {group.is_private && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px] admin-btn" onClick={onLoadJoinRequests}>
                      <Users className="h-3 w-3 mr-1" /> Requests
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="p-5 rounded-[28px] border border-border/40 bg-card shadow-sm">
          <h3 className="admin-heading mb-3">Members ({group.member_count})</h3>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {(group.member_details || []).map(m => {
              const isMemberAdmin = admins.includes(m.id);
              const isMemberCreator = m.id === group.created_by;
              const isMe = m.id === user?.id;
              const isOnline = onlineMembers.includes(m.id);
              const customRole = memberRoles[m.id];
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group/member">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-brand-600/10 flex items-center justify-center cursor-pointer"
                      onClick={() => navigate(`/player-card/${m.id}`)}>
                      {m.avatar ? <img src={mediaUrl(m.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : <User className="h-4 w-4 text-brand-600" />}
                    </div>
                    {isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-400 border-2 border-card" />}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/player-card/${m.id}`)}>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-sm font-medium truncate">{m.name}</span>
                      {isMemberCreator && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                      {isMemberAdmin && !isMemberCreator && <ShieldCheck className="h-3 w-3 text-brand-400 shrink-0" />}
                      {customRole && <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">{customRole}</Badge>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.skill_rating || 1500} SR</span>
                  </div>
                  {isAdmin && !isMe && !isMemberCreator && (
                    <div className="flex gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                      <button onClick={() => { onSetRoleEditMember(m.id); onRoleInputChange(customRole || ""); }} title="Set role"
                        className="h-7 w-7 rounded-md flex items-center justify-center bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
                        <Crown className="h-3.5 w-3.5" />
                      </button>
                      {!isMemberAdmin ? (
                        <button onClick={() => onPromote(m.id)} title="Promote"
                          className="h-7 w-7 rounded-md flex items-center justify-center bg-brand-500/10 text-brand-400 hover:bg-brand-500/20"><ShieldCheck className="h-3.5 w-3.5" /></button>
                      ) : isCreator ? (
                        <button onClick={() => onDemote(m.id)} title="Demote"
                          className="h-7 w-7 rounded-md flex items-center justify-center bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"><ShieldOff className="h-3.5 w-3.5" /></button>
                      ) : null}
                      <button onClick={() => onRemoveMember(m.id)} title="Remove"
                        className="h-7 w-7 rounded-md flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20"><UserMinus className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Role edit inline */}
        {roleEditMember && (
          <div className="p-4 rounded-[28px] border border-border/40 bg-card shadow-sm space-y-3">
            <h4 className="text-xs font-medium text-foreground">Set Custom Role</h4>
            <div className="flex gap-1 flex-wrap">
              {ROLE_PRESETS.map(r => (
                <button key={r} onClick={() => onRoleInputChange(r)}
                  className={`px-2 py-1 rounded-full text-[10px] admin-btn transition-all active:scale-95 ${roleInput === r ? "bg-brand-600 text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
            <Input value={roleInput} onChange={e => onRoleInputChange(e.target.value)} placeholder="Custom role..." className="h-8 text-sm bg-secondary/20 border-border/40 rounded-xl" />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => onSetRoleEditMember(null)}>Cancel</Button>
              <Button size="sm" onClick={() => onSetRole(roleEditMember, roleInput)} className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-8 text-xs px-3"><Check className="h-3 w-3 mr-1" /> Set</Button>
              {memberRoles[roleEditMember] && <Button size="sm" variant="outline" className="text-destructive" onClick={() => onSetRole(roleEditMember, "")}>Remove</Button>}
            </div>
          </div>
        )}

        {group.is_member && !isCreator && (
          <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onLeave}>
            <LogOut className="h-4 w-4 mr-2" /> Leave Group
          </Button>
        )}
        {isCreator && (
          !showDeleteConfirm ? (
            <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => onToggleDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete Group
            </Button>
          ) : (
            <div className="p-4 rounded-[28px] border border-destructive/30 bg-destructive/5 space-y-3">
              <p className="text-sm font-medium text-destructive">Delete permanently? All messages will be lost.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onToggleDeleteConfirm(false)}>Cancel</Button>
                <Button variant="destructive" size="sm" className="flex-1" onClick={onDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />} Confirm
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
