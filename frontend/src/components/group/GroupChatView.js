import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { mediaUrl } from "@/lib/utils";
import { groupAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Users, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import GroupHeader from "./GroupHeader";
import GroupMessageList from "./GroupMessageList";
import GroupMessageInput from "./GroupMessageInput";
import EditGroupModal from "./EditGroupModal";
import PollCreateModal from "./PollCreateModal";
import PinnedMessagesModal from "./PinnedMessagesModal";
import InviteLinkModal from "./InviteLinkModal";
import JoinRequestsModal from "./JoinRequestsModal";
import MediaGalleryModal from "./MediaGalleryModal";

export default function GroupChatView({ g, user, onBack, onOpenInfo }) {
  if (g.loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!g.group) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <GroupHeader
        group={g.group}
        onlineMembers={g.onlineMembers}
        tab={g.tab}
        onTabToggle={onOpenInfo}
        isAdmin={g.isAdmin}
        showSearch={g.showSearch}
        onToggleSearch={g.setShowSearch}
        searchQuery={g.searchQuery}
        onSearchQueryChange={g.setSearchQuery}
        onSearch={g.handleSearch}
        searching={g.searching}
        searchResults={g.searchResults}
        onOpenPinned={g.loadPinned}
        onOpenEdit={g.openEdit}
        onNavigateBack={onBack}
        formatTime={g.formatTime}
      />

      {/* Chat area or join prompt */}
      {!g.group.is_member ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="admin-heading text-muted-foreground mb-2">
              {g.group.is_private ? "Private Group" : "Join to chat"}
            </h3>
            <p className="text-sm text-muted-foreground/70 mb-4">
              {g.group.is_private ? "Request to join this private group" : "Become a member to send messages"}
            </p>
            <button
              className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl h-10 px-4 flex items-center gap-2 shadow-lg shadow-brand-600/20 mx-auto"
              onClick={g.group.is_private ? async () => {
                try { await groupAPI.requestJoin(g.group.id); toast.success("Join request sent!"); }
                catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
              } : g.handleJoin}
            >
              <Plus className="h-4 w-4" /> {g.group.is_private ? "Request to Join" : "Join Group"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <GroupMessageList
            group={g.group}
            user={user}
            groupedMessages={g.groupedMessages}
            typingUsers={g.typingUsers}
            chatContainerRef={g.chatContainerRef}
            messagesEndRef={g.messagesEndRef}
            reactionMsgId={g.reactionMsgId}
            onToggleReaction={g.setReactionMsgId}
            onReact={g.handleReact}
            contextMsg={g.contextMsg}
            onToggleContext={g.setContextMsg}
            onPin={g.handlePin}
            onDeleteMsg={g.handleDeleteMsg}
            onForwardMsg={(msg) => { g.setForwardMsg(msg); g.setShowForward(true); g.setContextMsg(null); }}
            isAdmin={g.isAdmin}
            renderContent={g.renderContent}
            formatTime={g.formatTime}
            onVote={g.handleVote}
          />
          <GroupMessageInput
            msgText={g.msgText}
            onMsgChange={g.handleMsgChange}
            onMentionKeyDown={g.handleMentionKeyDown}
            onSend={g.handleSend}
            sending={g.sending}
            uploading={g.uploading}
            inputRef={g.inputRef}
            fileInputRef={g.fileInputRef}
            mentionResults={g.mentionResults}
            mentionIndex={g.mentionIndex}
            onSelectMention={g.selectMention}
            pendingFile={g.pendingFile}
            onCancelFile={g.setPendingFile}
            onFileSelect={g.handleFileSelect}
            onOpenPollCreate={() => g.setShowPollCreate(true)}
            recording={g.recording}
            recordingTime={g.recordingTime}
            onStartRecording={g.startRecording}
            onStopRecording={g.stopRecording}
            onCancelRecording={g.cancelRecording}
          />
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        <EditGroupModal
          isOpen={g.showEdit}
          onClose={() => g.setShowEdit(false)}
          editForm={g.editForm}
          onEditFormChange={g.setEditForm}
          onAvatarUpload={g.handleAvatarUpload}
          onCoverUpload={g.handleCoverUpload}
          onSave={g.handleSaveEdit}
          savingEdit={g.savingEdit}
          uploadingAvatar={g.uploadingAvatar}
          uploadingCover={g.uploadingCover}
          avatarInputRef={g.avatarInputRef}
          coverInputRef={g.coverInputRef}
        />
        <PollCreateModal
          isOpen={g.showPollCreate}
          onClose={() => g.setShowPollCreate(false)}
          pollQuestion={g.pollQuestion}
          onPollQuestionChange={g.setPollQuestion}
          pollOptions={g.pollOptions}
          onPollOptionsChange={g.setPollOptions}
          onCreatePoll={g.handleCreatePoll}
        />
        <PinnedMessagesModal
          isOpen={g.showPinned}
          onClose={() => g.setShowPinned(false)}
          pinnedMsgs={g.pinnedMsgs}
          formatTime={g.formatTime}
        />
        <InviteLinkModal
          isOpen={g.showInvite}
          onClose={() => g.setShowInvite(false)}
          groupId={g.group.id}
          inviteCode={g.inviteCode}
          onCopy={g.copyInviteLink}
        />
        <JoinRequestsModal
          isOpen={g.showRequests}
          onClose={() => g.setShowRequests(false)}
          joinRequests={g.joinRequests}
          onApprove={g.handleApproveRequest}
          onReject={g.handleRejectRequest}
        />
        <MediaGalleryModal
          isOpen={g.showGallery}
          onClose={() => g.setShowGallery(false)}
          galleryMedia={g.galleryMedia}
        />

        {/* Forward Modal */}
        {g.showForward && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { g.setShowForward(false); g.setForwardMsg(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-card border border-border/40 rounded-[28px] shadow-sm p-6" onClick={e => e.stopPropagation()}>
              <h2 className="admin-heading mb-4">Forward to Group</h2>
              <p className="text-xs text-muted-foreground mb-3">Select a group:</p>
              <ForwardGroupList onSelect={g.handleForward} currentGroupId={g.group.id} />
            </motion.div>
          </motion.div>
        )}

        {/* Clear Chat Confirm */}
        {g.showClearConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => g.setShowClearConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-card rounded-[28px] p-6 w-full max-w-xs shadow-xl border border-border/40"
              onClick={e => e.stopPropagation()}>
              <h3 className="admin-heading mb-2">Clear Chat?</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Messages will be cleared only for you. Other members will still see their chat history.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => g.setShowClearConfirm(false)}>Cancel</Button>
                <Button variant="destructive" className="flex-1 rounded-xl" onClick={g.handleClearChat}>Clear</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component for forward modal
function ForwardGroupList({ onSelect, currentGroupId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    groupAPI.myGroups().then(res => setGroups((res.data || []).filter(g => g.id !== currentGroupId))).catch(() => {}).finally(() => setLoading(false));
  }, [currentGroupId]);
  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /></div>;
  if (!groups.length) return <p className="text-sm text-muted-foreground text-center py-4">No other groups</p>;
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {groups.map(g => (
        <button key={g.id} onClick={() => onSelect(g.id)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left">
          <div className="h-8 w-8 rounded-xl bg-brand-600/10 flex items-center justify-center">
            {g.avatar_url ? <img src={mediaUrl(g.avatar_url)} alt="" className="h-8 w-8 rounded-xl object-cover" /> : <Users className="h-4 w-4 text-brand-600" />}
          </div>
          <span className="text-sm font-medium truncate">{g.name}</span>
        </button>
      ))}
    </div>
  );
}
