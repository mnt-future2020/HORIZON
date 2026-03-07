import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { chatAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { useUnifiedConversations } from "@/hooks/useUnifiedConversations";
import { useDmChat } from "@/hooks/useDmChat";
import useGroupChat from "@/hooks/useGroupChat";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, User, Plus, X, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChatSkeleton } from "@/components/SkeletonLoader";

// Components
import NewChatModal from "@/components/chat/NewChatModal";
import MessageRequestsModal from "@/components/chat/MessageRequestsModal";
import ConversationList from "@/components/chat/ConversationList";
import ActiveChat from "@/components/chat/ActiveChat";
import GroupChatView from "@/components/group/GroupChatView";
import GroupInfoPanel from "@/components/group/GroupInfoPanel";
import GroupDiscoveryView from "@/components/chat/GroupDiscoveryView";
import MessageActionSheet from "@/components/chat/MessageActionSheet";
import PinnedMessagesModal from "@/components/group/PinnedMessagesModal";
import MediaGalleryModal from "@/components/group/MediaGalleryModal";

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startWithUser = searchParams.get("user");

  // WebSocket
  const ws = useChatWebSocket();

  // Unified conversation list (DMs + Groups)
  const convo = useUnifiedConversations(user, ws);

  // DM chat hook (active only when a DM is selected)
  const activeDm = convo.activeType === "dm" ? convo.activeItem : null;
  const dm = useDmChat(activeDm, user, ws, convo.conversations, convo.refreshConversations);

  // Group chat hook (active only when a group is selected)
  const activeGroupId = convo.activeType === "group" ? convo.activeItem?.id : null;
  const gc = useGroupChat({
    groupId: activeGroupId,
    user,
    wsOn: ws.on,
    wsOff: ws.off,
    wsConnected: ws.connected,
    sendGroupTyping: ws.sendGroupTyping,
    refreshConversations: convo.refreshConversations,
  });

  // Group discovery panel
  const [showDiscover, setShowDiscover] = useState(false);

  // Close discover when a conversation is opened
  useEffect(() => {
    if (convo.activeItem) setShowDiscover(false);
  }, [convo.activeItem]);

  // Handle ?discover=true param
  useEffect(() => {
    if (searchParams.get("discover") === "true") {
      setShowDiscover(true);
    }
  }, [searchParams]);

  // Group info side panel
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Close group info when switching conversations
  useEffect(() => {
    setShowGroupInfo(false);
  }, [convo.activeItem?.id]);

  // New Chat modal
  const [showNewChat, setShowNewChat] = useState(false);

  // Message requests
  const [showRequests, setShowRequests] = useState(false);
  const [messageRequests, setMessageRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Lock page scroll when in active chat or discovery (mobile)
  useEffect(() => {
    if (convo.activeItem || showDiscover) {
      window.scrollTo(0, 0);
    }
  }, [convo.activeItem, showDiscover]);

  // Auto-start DM if ?user= param
  useEffect(() => {
    if (startWithUser && !convo.loading) {
      handleStartConversation(startWithUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWithUser, convo.loading]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleStartConversation = async (userId) => {
    try {
      const res = await chatAPI.startConversation(userId);
      const newConvo = { ...res.data, type: "dm" };
      convo.openItem(newConvo);
      setShowNewChat(false);
      convo.refreshConversations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start conversation");
    }
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await chatAPI.getRequests();
      setMessageRequests(res.data || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleAcceptRequest = async (reqConvo) => {
    try {
      await chatAPI.acceptRequest(reqConvo.id);
      toast.success(`Accepted ${reqConvo.other_user?.name}'s request`);
      setMessageRequests((prev) => prev.filter((r) => r.id !== reqConvo.id));
      convo.openItem({ ...reqConvo, type: "dm", status: "active" });
      setShowRequests(false);
      convo.refreshConversations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to accept");
    }
  };

  const handleDeclineRequest = async (reqConvo) => {
    try {
      await chatAPI.declineRequest(reqConvo.id);
      toast.success("Request declined");
      setMessageRequests((prev) => prev.filter((r) => r.id !== reqConvo.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to decline");
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const handleBack = useCallback(() => {
    convo.goBack();
    setShowGroupInfo(false);
  }, [convo]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (convo.loading) {
    return <ChatSkeleton />;
  }

  return (
    <div className="flex-1 flex w-full min-h-0 overflow-hidden bg-background md:bg-card/30 md:backdrop-blur-sm md:rounded-2xl lg:rounded-3xl md:border border-border/20 pb-16 lg:pb-0 md:my-3">
      {/* Sidebar: Conversation List */}
      <div
        className={`w-full lg:w-[340px] xl:w-[380px] lg:border-r border-border/20 flex-shrink-0 flex flex-col bg-transparent relative z-20 min-h-0 overflow-hidden
          ${(convo.activeItem || showDiscover) ? "hidden lg:flex" : "flex"}
        `}
      >
        <ConversationList
          conversations={convo.conversations}
          filteredConvos={convo.filteredConvos}
          convoSearch={convo.convoSearch}
          onConvoSearchChange={convo.setConvoSearch}
          onOpenNewChat={() => setShowNewChat(true)}
          onOpenDiscover={() => { setShowDiscover(true); convo.goBack(); }}
          onOpenConversation={convo.openItem}
          activeConvoId={convo.activeItem?.id}
          requestCount={convo.requestCount}
          onOpenRequests={() => { setShowRequests(true); loadRequests(); }}
          user={user}
          timeAgo={timeAgo}
        />
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden
          ${(!convo.activeItem && !showDiscover) ? "hidden lg:flex" : "flex"}
        `}
      >
        {convo.activeType === "dm" && activeDm ? (
          <ActiveChat
            activeConvo={activeDm}
            onBack={handleBack}
            onlineStatus={dm.onlineStatus}
            isTyping={dm.isTyping}
            lastSeenText={dm.lastSeenText}
            messages={dm.messages}
            groupedMessages={dm.groupedMessages}
            user={user}
            onSend={dm.handleSend}
            msgText={dm.msgText}
            onMsgTextChange={dm.setMsgText}
            onTyping={dm.handleTyping}
            sending={dm.sending}
            loadingMessages={false}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            onToggleMute={dm.handleToggleMute}
            isMuted={dm.isMuted}
            showClearConfirm={dm.showClearConfirm}
            setShowClearConfirm={dm.setShowClearConfirm}
            onClearChat={dm.handleClearChat}
            onOpenPinned={dm.loadPinnedMessages}
            onOpenMedia={dm.loadMediaGallery}
            showMsgSearch={dm.showMsgSearch}
            onToggleSearch={() => dm.setShowMsgSearch(!dm.showMsgSearch)}
            msgSearchQuery={dm.msgSearchQuery}
            onMsgSearch={dm.handleMsgSearch}
            msgSearchResults={dm.msgSearchResults}
            onScrollToMessage={dm.scrollToMessage}
            onLongPress={(msg) => dm.setLongPressMsg(msg)}
            onReply={(msg) => { dm.setReplyTo(msg); setTimeout(() => dm.inputRef.current?.focus(), 100); }}
            onDelete={dm.handleDeleteMessage}
            onPin={dm.handleTogglePin}
            onForward={dm.openForwardModal}
            onOpenSharedPost={dm.openSharedPost}
            onOpenLightbox={(img) => dm.setLightboxImage(img)}
            onTogglePlayAudio={dm.togglePlayAudio}
            playingAudio={dm.playingAudio}
            linkifyText={dm.linkifyText}
            formatTime={dm.formatTime}
            replyTo={dm.replyTo}
            onCancelReply={() => dm.setReplyTo(null)}
            pendingFile={dm.pendingFile}
            onCancelFile={() => dm.setPendingFile(null)}
            onFileSelect={dm.handleFileSelect}
            isRecording={dm.isRecording}
            recordingDuration={dm.recordingDuration}
            onStartRecording={dm.startRecording}
            onStopRecording={dm.stopRecording}
            onCancelRecording={dm.cancelRecording}
            showEmojiPicker={dm.showEmojiPicker}
            onToggleEmojiPicker={() => dm.setShowEmojiPicker(!dm.showEmojiPicker)}
            emojiPickerRef={dm.emojiPickerRef}
            onAddEmoji={(emojiData) => {
              dm.setMsgText((prev) => prev + emojiData.emoji);
              dm.setShowEmojiPicker(false);
            }}
            inputRef={dm.inputRef}
            msgContainerRef={dm.msgContainerRef}
            messagesEndRef={dm.messagesEndRef}
            handleMsgScroll={dm.handleMsgScroll}
            showScrollBtn={dm.showScrollBtn}
            newMsgWhileAway={dm.newMsgWhileAway}
            scrollToBottom={dm.scrollToBottom}
          />
        ) : convo.activeType === "group" && activeGroupId ? (
          <GroupChatView
            g={gc}
            user={user}
            onBack={handleBack}
            onOpenInfo={() => setShowGroupInfo((v) => !v)}
          />
        ) : showDiscover ? (
          <GroupDiscoveryView
            onOpenGroup={(group) => {
              convo.openItem({ ...group, type: "group" });
              setShowDiscover(false);
            }}
            onBack={() => setShowDiscover(false)}
          />
        ) : (
          /* Empty State */
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 max-w-xs"
            >
              <div className="h-16 w-16 rounded-full bg-brand-600/10 flex items-center justify-center mx-auto mb-5">
                <MessageCircle className="h-8 w-8 text-brand-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1.5">
                Select a conversation
              </h2>
              <p className="text-[13px] text-muted-foreground/50 leading-relaxed mb-6 max-w-[220px] mx-auto">
                Choose a teammate or group to start chatting.
              </p>
              <div className="flex flex-col items-center gap-2.5">
                <Button
                  onClick={() => setShowNewChat(true)}
                  className="h-10 px-6 bg-brand-600 hover:bg-brand-500 text-white rounded-full shadow-sm active:scale-95 transition-all flex items-center gap-2 text-[13px] font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  New Message
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDiscover(true)}
                  className="h-10 px-6 rounded-full border-border/30 hover:border-brand-600/30 hover:text-brand-600 active:scale-95 transition-all flex items-center gap-2 text-[13px] font-medium"
                >
                  <Compass className="h-4 w-4" />
                  Explore Groups
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Right Sidebar: Group Info Panel */}
      {showGroupInfo && convo.activeType === "group" && gc.group && (
        <div className="hidden lg:flex w-[340px] flex-shrink-0 border-l border-border/20 flex-col min-h-0 overflow-hidden">
          <GroupInfoPanel
            group={gc.group}
            user={user}
            isAdmin={gc.isAdmin}
            isCreator={gc.isCreator}
            admins={gc.admins}
            memberRoles={gc.memberRoles}
            onlineMembers={gc.onlineMembers}
            isMuted={gc.isMuted}
            onToggleMute={gc.handleToggleMute}
            onClearChat={() => gc.setShowClearConfirm(true)}
            onOpenGallery={gc.loadGallery}
            onOpenInvite={gc.handleGetInvite}
            onLoadJoinRequests={gc.loadJoinRequests}
            onPromote={gc.handlePromote}
            onDemote={gc.handleDemote}
            onRemoveMember={gc.handleRemoveMember}
            onLeave={gc.handleLeave}
            showDeleteConfirm={gc.showDeleteConfirm}
            onToggleDeleteConfirm={gc.setShowDeleteConfirm}
            onDelete={gc.handleDelete}
            deleting={gc.deleting}
            roleEditMember={gc.roleEditMember}
            onSetRoleEditMember={gc.setRoleEditMember}
            roleInput={gc.roleInput}
            onRoleInputChange={gc.setRoleInput}
            onSetRole={gc.handleSetRole}
          />
        </div>
      )}

      {/* Modals */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onStartConvo={handleStartConversation}
        user={user}
      />

      <MessageRequestsModal
        isOpen={showRequests}
        onClose={() => setShowRequests(false)}
        requests={messageRequests}
        loading={requestsLoading}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />

      {/* DM Lightbox */}
      <AnimatePresence>
        {dm.lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-10"
            onClick={() => dm.setLightboxImage(null)}
          >
            <button
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors active:scale-95 z-[110]"
              onClick={() => dm.setLightboxImage(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              src={dm.lightboxImage}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* DM Long-Press Action Sheet (mobile) */}
      <AnimatePresence>
        {dm.longPressMsg && (
          <MessageActionSheet
            msg={dm.longPressMsg}
            isMe={dm.longPressMsg.sender_id === user?.id}
            onClose={() => dm.setLongPressMsg(null)}
            onReply={(msg) => { dm.setReplyTo(msg); setTimeout(() => dm.inputRef.current?.focus(), 150); }}
            onPin={dm.handleTogglePin}
            onDelete={dm.handleDeleteMessage}
            onForward={dm.openForwardModal}
          />
        )}
      </AnimatePresence>

      {/* DM Pinned Messages Modal */}
      <AnimatePresence>
        <PinnedMessagesModal
          isOpen={dm.showPinned}
          onClose={() => dm.setShowPinned?.(false)}
          pinnedMsgs={dm.pinnedMessages}
          formatTime={dm.formatTime}
          onUnpin={dm.handleUnpinMessage}
        />
      </AnimatePresence>

      {/* DM Media Gallery Modal */}
      <AnimatePresence>
        <MediaGalleryModal
          isOpen={dm.showMediaGallery}
          onClose={() => dm.setShowMediaGallery(false)}
          galleryMedia={dm.mediaItems}
        />
      </AnimatePresence>

      {/* DM Forward Modal */}
      <AnimatePresence>
        {dm.showForwardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => { dm.setShowForwardModal(false); }}
          >
            <motion.div
              initial={{ y: 40, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.97 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-sm bg-card border border-border/30 rounded-2xl shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-bold">Forward message</h3>
                <button
                  onClick={() => dm.setShowForwardModal(false)}
                  className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-secondary/50 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              {dm.forwardMsg?.content && (
                <div className="px-3 py-2 mb-3 rounded-lg bg-secondary/20 border border-border/15">
                  <p className="text-[12px] text-muted-foreground/50 line-clamp-2">
                    {dm.forwardMsg.content}
                  </p>
                </div>
              )}
              <p className="text-[11px] font-medium text-muted-foreground/40 mb-2 px-1">
                Select conversation
              </p>
              <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                {dm.forwardConvos.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/40 text-center py-6">
                    No conversations available
                  </p>
                ) : (
                  dm.forwardConvos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => dm.handleForwardToConvo(c)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 transition-colors text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-secondary/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {c.other_user?.avatar ? (
                          <img
                            src={mediaUrl(c.other_user.avatar)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4 text-brand-600/50" />
                        )}
                      </div>
                      <span className="text-[13px] font-medium truncate">
                        {c.display_name || c.other_user?.name || "Chat"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DM Shared Post Detail Modal */}
      <AnimatePresence>
        {dm.viewPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 z-[100]"
            onClick={() => dm.setViewPost(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="bg-card rounded-2xl border border-border/30 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 p-4 border-b border-border/15">
                <div
                  className="h-10 w-10 rounded-full bg-secondary/60 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => { dm.setViewPost(null); navigate(`/player-card/${dm.viewPost.user_id}`); }}
                >
                  {dm.viewPost.user_avatar ? (
                    <img src={mediaUrl(dm.viewPost.user_avatar)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    className="font-semibold text-[14px] hover:text-brand-600 text-left"
                    onClick={() => { dm.setViewPost(null); navigate(`/player-card/${dm.viewPost.user_id}`); }}
                  >
                    {dm.viewPost.user_name}
                  </button>
                  <p className="text-[11px] text-muted-foreground/40">
                    {new Date(dm.viewPost.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => dm.setViewPost(null)} className="p-2 rounded-full hover:bg-secondary/40 transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {dm.viewPost.content && (
                  <p className="p-4 text-[14px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                    {dm.viewPost.content}
                  </p>
                )}
                {dm.viewPost.media_url && (
                  <div className="px-4 pb-4">
                    <img src={mediaUrl(dm.viewPost.media_url)} alt="" className="w-full rounded-xl" />
                  </div>
                )}
                <div className="px-4 pb-4">
                  <span className="text-[11px] font-medium text-muted-foreground/40">
                    Comments ({dm.viewPost.comments_count || 0})
                  </span>
                  {dm.viewPostComments.length > 0 ? (
                    <div className="space-y-3 mt-3">
                      {dm.viewPostComments.map((c) => (
                        <div key={c.id} className="flex gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-secondary flex-shrink-0" />
                          <div>
                            <p className="text-[12px] font-semibold">{c.user_name}</p>
                            <p className="text-[13px] text-foreground/60">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-6 text-[13px] text-muted-foreground/30">
                      No comments yet
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
