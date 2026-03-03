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
import { Loader2, MessageCircle, User, Plus, X, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Components
import NewChatModal from "@/components/chat/NewChatModal";
import MessageRequestsModal from "@/components/chat/MessageRequestsModal";
import ConversationList from "@/components/chat/ConversationList";
import ActiveChat from "@/components/chat/ActiveChat";
import GroupChatView from "@/components/group/GroupChatView";
import GroupInfoPanel from "@/components/group/GroupInfoPanel";
import GroupDiscoveryView from "@/components/chat/GroupDiscoveryView";

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
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600 mb-4" aria-label="Loading conversations" />
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          Synchronizing Network
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex w-full min-h-0 overflow-hidden bg-background md:bg-card/40 md:backdrop-blur-md md:rounded-[20px] lg:rounded-[28px] md:border border-border/30 pb-16 lg:pb-0 md:my-4">
      {/* ═══ Sidebar: Conversation List ═══ */}
      <div
        className={`w-full lg:w-[340px] xl:w-[380px] lg:border-r border-border/30 flex-shrink-0 flex flex-col bg-transparent relative z-20 min-h-0 overflow-hidden
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

      {/* ═══ Main Content Area ═══ */}
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
            onReaction={dm.handleReaction}
            onReply={(msg) => dm.setReplyTo(msg)}
            onDelete={dm.handleDeleteMessage}
            onPin={dm.handlePinMessage}
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
          /* ═══ Empty State ═══ */
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center bg-dot-pattern relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-600/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-600/4 rounded-full blur-[80px] pointer-events-none" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 max-w-xs"
            >
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-[32px] bg-brand-600/10 flex items-center justify-center mx-auto mb-6 -rotate-6 border border-brand-600/15 shadow-inner">
                <MessageCircle className="h-10 w-10 sm:h-12 sm:w-12 text-brand-600" />
              </div>
              <h2 className="admin-page-title mb-2">
                Select a conversation
              </h2>
              <p className="text-sm text-muted-foreground/70 leading-relaxed mb-8 max-w-[220px] mx-auto">
                Choose a teammate or group to start chatting.
              </p>
              <div className="flex flex-col items-center gap-3">
                <Button
                  onClick={() => setShowNewChat(true)}
                  className="h-11 px-8 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all flex items-center font-black uppercase text-[11px] tracking-widest"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Message
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDiscover(true)}
                  className="h-11 px-8 rounded-2xl border-border/40 hover:border-brand-600/40 hover:text-brand-600 active:scale-95 transition-all flex items-center font-black uppercase text-[11px] tracking-widest"
                >
                  <Compass className="h-4 w-4 mr-2" />
                  Explore Groups
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* ═══ Right Sidebar: Group Info Panel ═══ */}
      {showGroupInfo && convo.activeType === "group" && gc.group && (
        <div className="hidden lg:flex w-[340px] flex-shrink-0 border-l border-border/30 flex-col min-h-0 overflow-hidden">
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

      {/* ═══ Modals ═══ */}
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 sm:p-10"
            onClick={() => dm.setLightboxImage(null)}
          >
            <button
              className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 z-[110]"
              onClick={() => dm.setLightboxImage(null)}
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              src={dm.lightboxImage}
              alt=""
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5"
              onClick={(e) => e.stopPropagation()}
            />
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
            className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 z-[100]"
            onClick={() => dm.setViewPost(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-card rounded-[32px] border border-border/40 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 p-5 pb-3 border-b border-border/50">
                <div
                  className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => { dm.setViewPost(null); navigate(`/player-card/${dm.viewPost.user_id}`); }}
                >
                  {dm.viewPost.user_avatar ? (
                    <img src={mediaUrl(dm.viewPost.user_avatar)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    className="font-black text-[15px] hover:text-brand-600 text-left tracking-tight"
                    onClick={() => { dm.setViewPost(null); navigate(`/player-card/${dm.viewPost.user_id}`); }}
                  >
                    {dm.viewPost.user_name}
                  </button>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                    {new Date(dm.viewPost.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => dm.setViewPost(null)} className="p-2.5 rounded-2xl hover:bg-secondary/50 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {dm.viewPost.content && (
                  <p className="p-5 pt-4 text-[15px] font-medium leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {dm.viewPost.content}
                  </p>
                )}
                {dm.viewPost.media_url && (
                  <div className="px-5 pb-5">
                    <img src={mediaUrl(dm.viewPost.media_url)} alt="" className="w-full rounded-[24px] shadow-lg border border-border/20" />
                  </div>
                )}
                <div className="px-5 pb-5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Comments ({dm.viewPost.comments_count || 0})
                  </span>
                  {dm.viewPostComments.length > 0 ? (
                    <div className="space-y-4 mt-4">
                      {dm.viewPostComments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="h-8 w-8 rounded-xl bg-secondary flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold">{c.user_name}</p>
                            <p className="text-[13px] opacity-70">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-6 text-[13px] text-muted-foreground font-medium opacity-50 italic">
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
